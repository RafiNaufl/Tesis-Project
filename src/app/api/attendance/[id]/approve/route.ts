import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { approveOvertime } from "@/lib/attendance";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notification";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    // Pastikan pengguna sudah login dan memiliki role ADMIN
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Anda tidak memiliki izin untuk melakukan tindakan ini" },
        { status: 403 }
      );
    }
    
    const attendanceId = params.id;
    
    // Validasi ID kehadiran
    if (!attendanceId) {
      return NextResponse.json(
        { error: "ID kehadiran diperlukan" },
        { status: 400 }
      );
    }
    
    // Cek apakah kehadiran ada
    const attendance = await prisma.attendance.findUnique({
      where: { id: attendanceId },
      include: {
        employee: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });
    
    if (!attendance) {
      return NextResponse.json(
        { error: "Data kehadiran tidak ditemukan" },
        { status: 404 }
      );
    }
    
    // Menyetujui overtime/Sunday work
    const updatedAttendance = await approveOvertime(
      attendanceId,
      session.user.id
    );
    
    // Kirim notifikasi ke karyawan
    if (attendance.employee?.user) {
      let message = "";
      
      if (attendance.isSundayWork) {
        message = "Permintaan bekerja pada hari Minggu telah disetujui.";
      } else {
        message = "Permintaan lembur telah disetujui.";
      }
      
      await createNotification(
        attendance.employee.user.id,
        "Persetujuan Diterima",
        message,
        "success"
      );
    }
    
    return NextResponse.json(updatedAttendance);
  } catch (error: any) {
    console.error("Error approving overtime:", error);
    return NextResponse.json(
      { error: `Gagal menyetujui lembur: ${error.message}` },
      { status: 500 }
    );
  }
} 