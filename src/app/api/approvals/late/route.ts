import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Tidak diizinkan" }, { status: 401 });
  const role = session.user.role;
  const allowed = ["ADMIN", "MANAGER", "FOREMAN", "ASSISTANT_FOREMAN"];
  if (!allowed.includes(role)) return NextResponse.json({ error: "Tidak diizinkan" }, { status: 403 });

  const pending = await prisma.attendance.findMany({
    where: {
      lateSubmittedAt: { not: null },
      lateApprovalStatus: "PENDING_LATE_APPROVAL",
      employee: { isActive: true },
    },
    include: {
      employee: { include: { user: { select: { name: true, profileImageUrl: true }, }, }, },
    },
    orderBy: [{ date: "desc" }, { lateSubmittedAt: "desc" }],
  });

  const attendanceIds = pending.map((a) => a.id);
  const logs = await prisma.approvalLog.findMany({ where: { attendanceId: { in: attendanceIds } }, orderBy: { createdAt: "desc" } });
  const actorIds = Array.from(new Set(logs.map((l) => l.actorUserId))).filter(Boolean) as string[];
  const actors = await prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true, role: true } });
  const actorMap = new Map(actors.map((a) => [a.id, a]));
  const enrichedLogs = logs.map((l) => ({ ...l, actorName: actorMap.get(l.actorUserId)?.name || "-", actorRole: actorMap.get(l.actorUserId)?.role || "-" }));

  const items = pending.map((a) => ({
    attendanceId: a.id,
    employeeId: a.employeeId,
    employeeName: a.employee?.user?.name || null,
    employeeAvatarUrl: a.employee?.user?.profileImageUrl || null,
    submittedAt: a.lateSubmittedAt,
    date: a.date,
    status: a.lateApprovalStatus || "PENDING_LATE_APPROVAL",
    reason: a.lateReason || "",
    photoUrl: a.latePhotoUrl || null,
  }));

  return NextResponse.json({ pending, logs: enrichedLogs, items });
}
