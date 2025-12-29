import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { rejectLateSubmission } from "@/lib/attendance";
import { prisma } from "@/lib/prisma";
import { addNotificationUpdateHeader, createEmployeeWarningNotification } from "@/lib/notification";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Tidak diizinkan" }, { status: 401 });
  const role = session.user.role;
  const allowed = ["ADMIN", "MANAGER", "FOREMAN"];
  if (!allowed.includes(role)) return NextResponse.json({ error: "Tidak diizinkan" }, { status: 403 });

  const { id: attendanceId } = await params;
  const body = await req.json().catch(() => ({}));
  const note = typeof body?.note === "string" ? body.note : undefined;
  try {
    const updated = await rejectLateSubmission(attendanceId, session.user.id, note);
    const attendance = await prisma.attendance.findUnique({ where: { id: attendanceId }, select: { employeeId: true } });
    if (attendance?.employeeId) {
      await createEmployeeWarningNotification(attendance.employeeId, "Keterlambatan Ditolak", "Pengajuan alasan keterlambatan Anda ditolak.");
    }
    const response = NextResponse.json(updated);
    addNotificationUpdateHeader(response);
    return response;
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Gagal menolak keterlambatan" }, { status: 400 });
  }
}
