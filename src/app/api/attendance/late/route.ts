import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createAdminWarningNotifications, createEmployeeSuccessNotification, addNotificationUpdateHeader } from "@/lib/notification";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Tidak diizinkan" }, { status: 401 });

  const body = await req.json();
  const { reason, photoUrl } = body || {};

  if (typeof reason !== "string" || reason.trim().length < 20) {
    return NextResponse.json({ error: "Alasan keterlambatan minimal 20 karakter" }, { status: 400 });
  }
  if (photoUrl && typeof photoUrl !== "string") {
    return NextResponse.json({ error: "URL foto tidak valid" }, { status: 400 });
  }

  const employee = await prisma.employee.findFirst({ where: { userId: session.user.id }, select: { id: true, user: { select: { name: true } } } });
  if (!employee) return NextResponse.json({ error: "Data karyawan tidak ditemukan" }, { status: 404 });

  const today = new Date();
  today.setHours(0,0,0,0);
  const attendance = await prisma.attendance.findFirst({ where: { employeeId: employee.id, date: { gte: today, lt: new Date(today.getTime() + 24*60*60*1000) } } });
  if (!attendance) return NextResponse.json({ error: "Data kehadiran hari ini tidak ditemukan" }, { status: 404 });

  const isLateOrAbsent = attendance.status === "LATE" || attendance.status === "ABSENT";
  if (!isLateOrAbsent) return NextResponse.json({ error: "Form keterlambatan hanya untuk status LATE/ABSENT" }, { status: 400 });

  const now = new Date();
  const updated = await prisma.attendance.update({
    where: { id: attendance.id },
    data: {
      lateReason: reason.trim(),
      latePhotoUrl: photoUrl || null,
      lateSubmittedAt: now,
      lateApprovalStatus: "PENDING_LATE_APPROVAL",
    },
  });

  await prisma.approvalLog.create({ data: { attendanceId: updated.id, action: "LATE_REQUEST_SUBMITTED", actorUserId: session.user.id, note: reason.trim().slice(0,255) } });

  const title = `Pengajuan Keterlambatan: ${employee.user?.name || "Karyawan"}`;
  const message = `${employee.user?.name || "Karyawan"} mengajukan alasan keterlambatan. Menunggu persetujuan.`;
  await createAdminWarningNotifications(title, message);

  await createEmployeeSuccessNotification(employee.id, "Form Keterlambatan Dikirim", "Pengajuan Anda telah dikirim. Menunggu persetujuan admin.");

  const response = NextResponse.json(updated);
  addNotificationUpdateHeader(response);
  return response;
}
