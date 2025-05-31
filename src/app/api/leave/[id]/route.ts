import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { approveLeaveRequest, rejectLeaveRequest } from "@/lib/leave";

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
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Hanya admin yang dapat menyetujui atau menolak permohonan cuti" },
        { status: 403 }
      );
    }

    const leaveId = params.id;
    const data = await request.json();
    const { action } = data;

    if (action !== "approve" && action !== "reject") {
      return NextResponse.json(
        { error: "Tindakan tidak valid, gunakan 'approve' atau 'reject'" },
        { status: 400 }
      );
    }

    let result;
    if (action === "approve") {
      result = await approveLeaveRequest(leaveId, session.user.id);
    } else {
      result = await rejectLeaveRequest(leaveId, session.user.id);
    }

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
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