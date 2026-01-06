import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { rejectOvertime } from "@/lib/attendance";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notification";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json(
        { error: "Anda tidak memiliki izin untuk melakukan tindakan ini" },
        { status: 403 }
      );
    }
    const role = session.user.role;
    const allowedRoles = ["ADMIN", "MANAGER", "FOREMAN", "ASSISTANT_FOREMAN"];
    if (!allowedRoles.includes(role)) {
      return NextResponse.json(
        { error: "Anda tidak memiliki izin untuk melakukan tindakan ini" },
        { status: 403 }
      );
    }
    
    const { id: attendanceId } = await params;
    
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
    
    const body = await req.json().catch(() => ({}));
    const note = typeof body?.note === "string" ? body.note : undefined;

    // Menolak overtime/Sunday work (menggunakan logic atomik di rejectOvertime)
    const { attendance: updatedAttendance, wasUpdated } = await rejectOvertime(
      attendanceId,
      session.user.id
    );
    
    if (wasUpdated) {
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
      await prisma.approvalLog.create({
        data: {
          attendanceId,
          action: "REJECT",
          actorUserId: session.user.id,
          note: note || null,
        },
      });

      // Audit log
      await prisma.attendanceAuditLog.create({
        data: {
          attendanceId,
          userId: session.user.id,
          action: "OVERTIME_REJECTED",
          oldValue: { isOvertimeApproved: attendance.isOvertimeApproved },
          newValue: { isOvertimeApproved: false },
        },
      });

      // Notifikasi ke semua pihak terkait (ADMIN, MANAGER, FOREMAN, ASSISTANT_FOREMAN)
      const approverUsers = await prisma.user.findMany({
        where: { role: { in: ["ADMIN", "MANAGER", "FOREMAN", "ASSISTANT_FOREMAN"] } },
        select: { id: true, name: true, role: true },
      });
      const actor = approverUsers.find(u => u.id === session.user.id);
      const employeeName = attendance.employee?.user?.name || "Karyawan";
      const broadcastMsg = `Status persetujuan lembur untuk ${employeeName} diubah menjadi Ditolak oleh ${actor?.name || "-"} (${actor?.role || "-"}).`;
      await Promise.all(
        approverUsers
          .filter(u => u.id !== session.user.id)
          .map(u => createNotification(u.id, "Pembaruan Persetujuan Lembur", broadcastMsg, "info"))
      );
    }

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
