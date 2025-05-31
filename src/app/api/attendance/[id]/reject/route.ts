import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { rejectOvertime } from "@/lib/attendance";
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
    
    // Menolak overtime/Sunday work
    const updatedAttendance = await rejectOvertime(
      attendanceId,
      session.user.id
    );
    
    // Kirim notifikasi ke karyawan
    if (attendance.employee?.user) {
      let message = "";
      
      if (attendance.isSundayWork) {
        message = "Permintaan bekerja pada hari Minggu ditolak. Anda dapat mengajukan check-in kembali.";
      } else {
        message = "Permintaan lembur ditolak. Anda dapat mengajukan check-in kembali.";
      }
      
      await createNotification(
        attendance.employee.user.id,
        "Persetujuan Ditolak",
        message,
        "warning"
      );
    }
    
    // Log hasil untuk debugging
    console.log("Rejected attendance:", updatedAttendance);
    
    // Persiapkan response dengan header khusus
    const response = NextResponse.json(updatedAttendance);
    // Tambahkan header khusus untuk notify klien
    response.headers.set('X-Attendance-Rejected', 'true');
    
    return response;
  } catch (error: any) {
    console.error("Error rejecting overtime:", error);
    return NextResponse.json(
      { error: `Gagal menolak lembur: ${error.message}` },
      { status: 500 }
    );
  }
} 