import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { approveLeaveRequest, rejectLeaveRequest } from "@/lib/leave";
import { db } from "@/lib/db";

// Mendapatkan detail permohonan cuti berdasarkan ID
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        { error: "Tidak diizinkan" },
        { status: 401 }
      );
    }

    const leaveId = params.id;

    // Dapatkan permohonan cuti
    const leave = await prisma.leave.findUnique({
      where: { id: leaveId },
      include: {
        employee: {
          include: {
            user: {
              select: {
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!leave) {
      return NextResponse.json(
        { error: "Permohonan cuti tidak ditemukan" },
        { status: 404 }
      );
    }

    // Jika bukan admin dan bukan karyawan yang bersangkutan, tolak akses
    if (
      session.user.role !== "ADMIN" &&
      leave.employee.userId !== session.user.id
    ) {
      return NextResponse.json(
        { error: "Tidak diizinkan" },
        { status: 403 }
      );
    }

    return NextResponse.json(leave);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

// Memperbarui status permohonan cuti (menyetujui atau menolak)
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession();
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    // Check if user is admin
    const user = await db.user.findUnique({
      where: { email: session.user.email! },
    });
    
    if (user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
    }
    
    const body = await req.json();
    const { status } = body;
    
    if (!status || !["APPROVED", "REJECTED"].includes(status)) {
      return NextResponse.json(
        { error: "Status tidak valid" },
        { status: 400 }
      );
    }
    
    // Get leave request
    const leave = await db.leave.findUnique({
      where: { id: params.id },
      include: {
        employee: {
          include: {
            user: true,
          },
        },
      },
    });
    
    if (!leave) {
      return NextResponse.json(
        { error: "Permohonan cuti tidak ditemukan" },
        { status: 404 }
      );
    }
    
    if (leave.status !== "PENDING") {
      return NextResponse.json(
        { error: "Permohonan cuti ini sudah diproses sebelumnya" },
        { status: 400 }
      );
    }
    
    // Update leave status
    const updatedLeave = await db.leave.update({
      where: { id: params.id },
      data: {
        status,
        approvedBy: user.id,
        approvedAt: new Date(),
      },
    });
    
    // If approved, mark attendance as LEAVE for the leave days
    if (status === "APPROVED") {
      // Get all dates between start and end date
      const startDate = new Date(leave.startDate);
      const endDate = new Date(leave.endDate);
      const dateArray = [];
      let currentDate = new Date(startDate);
      
      while (currentDate <= endDate) {
        dateArray.push(new Date(currentDate));
        currentDate.setDate(currentDate.getDate() + 1);
      }
      
      // Update or create attendance records
      for (const date of dateArray) {
        const formattedDate = new Date(
          date.getFullYear(),
          date.getMonth(),
          date.getDate()
        );
        
        await db.attendance.upsert({
          where: {
            employeeId_date: {
              employeeId: leave.employeeId,
              date: formattedDate,
            },
          },
          update: {
            status: "LEAVE",
            notes: `Cuti ${leave.type}: ${leave.reason}`,
          },
          create: {
            employeeId: leave.employeeId,
            date: formattedDate,
            status: "LEAVE",
            notes: `Cuti ${leave.type}: ${leave.reason}`,
          },
        });
      }
    }
    
    // Create notification for employee
    await db.notification.create({
      data: {
        userId: leave.employee.userId,
        title: status === "APPROVED" ? "Permohonan Cuti Disetujui" : "Permohonan Cuti Ditolak",
        message:
          status === "APPROVED"
            ? `Permohonan cuti Anda dari ${leave.startDate.toLocaleDateString()} hingga ${leave.endDate.toLocaleDateString()} telah disetujui.`
            : `Permohonan cuti Anda dari ${leave.startDate.toLocaleDateString()} hingga ${leave.endDate.toLocaleDateString()} telah ditolak.`,
        type: status === "APPROVED" ? "success" : "error",
      },
    });
    
    return NextResponse.json(updatedLeave);
  } catch (error) {
    console.error("Error updating leave request:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan saat memproses permohonan cuti" },
      { status: 500 }
    );
  }
}

// Menghapus permohonan cuti (hanya untuk admin atau pemilik cuti)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        { error: "Tidak diizinkan" },
        { status: 401 }
      );
    }

    const leaveId = params.id;

    // Dapatkan permohonan cuti
    const leave = await prisma.leave.findUnique({
      where: { id: leaveId },
      include: {
        employee: true,
      },
    });

    if (!leave) {
      return NextResponse.json(
        { error: "Permohonan cuti tidak ditemukan" },
        { status: 404 }
      );
    }

    // Cek apakah pengguna adalah admin atau pemilik cuti
    const isAdmin = session.user.role === "ADMIN";
    const isOwner = leave.employee.userId === session.user.id;

    if (!isAdmin && !isOwner) {
      return NextResponse.json(
        { error: "Tidak diizinkan" },
        { status: 403 }
      );
    }

    // Hanya permohonan cuti dengan status PENDING yang dapat dihapus
    if (leave.status !== "PENDING" && !isAdmin) {
      return NextResponse.json(
        { error: "Hanya permohonan cuti dengan status PENDING yang dapat dihapus" },
        { status: 400 }
      );
    }

    // Hapus permohonan cuti
    await prisma.leave.delete({
      where: { id: leaveId },
    });

    return NextResponse.json({ message: "Permohonan cuti berhasil dihapus" });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
} 