import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calculateOvertimeDuration } from "@/lib/overtimeCalculator";

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Tidak diizinkan" }, { status: 401 });
  }
  const role = session.user.role;
  const allowed = ["ADMIN", "MANAGER", "FOREMAN", "ASSISTANT_FOREMAN"];
  if (!allowed.includes(role)) {
    return NextResponse.json({ error: "Tidak diizinkan" }, { status: 403 });
  }

  const filters: any = {
    OR: [{ overtime: { gt: 0 } }, { isSundayWork: true }],
    approvedAt: null,
    employee: { isActive: true },
  };

  if (role === "ASSISTANT_FOREMAN") {
    filters.isSundayWork = false;
    filters.overtime = { gt: 0, lte: 120 };
  }

  const pending = await prisma.attendance.findMany({
    where: filters,
    include: {
      employee: {
        include: {
          user: { select: { name: true, profileImageUrl: true } },
        },
      },
    },
    orderBy: [{ date: "desc" }, { checkOut: "desc" }],
  });

  const attendanceIds = pending.map((a) => a.id);
  const logs = await prisma.approvalLog.findMany({
    where: { attendanceId: { in: attendanceIds } },
    orderBy: { createdAt: "desc" },
  });
  const actorIds = Array.from(new Set(logs.map((l) => l.actorUserId))).filter(Boolean);
  const actors = await prisma.user.findMany({
    where: { id: { in: actorIds } },
    select: { id: true, name: true, role: true },
  });
  const actorMap = new Map(actors.map((a) => [a.id, a]));
  const _enrichedLogs = logs.map((l) => ({
    ...l,
    actorName: actorMap.get(l.actorUserId)?.name || "-",
    actorRole: actorMap.get(l.actorUserId)?.role || "-",
  }));

  const recentRequests = await prisma.overtimeRequest.findMany({
    where: {
      date: { gte: new Date(new Date().setDate(new Date().getDate() - 30)) },
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });

  const employeeIds = Array.from(new Set(recentRequests.map((r) => r.employeeId)));
  const employees = await prisma.employee.findMany({
    where: { id: { in: employeeIds } },
    include: { user: { select: { name: true, profileImageUrl: true } } },
  });
  const employeeMap = new Map(employees.map((e) => [e.id, e]));
  const attendanceByKey: Record<string, any> = {};
  
  // Filter attendance to match the date range of recentRequests to optimize query
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 31); // Extra day buffer

  const attendances = await prisma.attendance.findMany({
    where: { 
      employeeId: { in: employeeIds },
      date: { gte: thirtyDaysAgo }
    },
    include: {
      employee: { include: { user: { select: { name: true, profileImageUrl: true } } } },
    },
  });
  
  const getDateKey = (date: Date | string) => {
    try {
      const d = new Date(date);
      return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
    } catch {
      return String(date);
    }
  };

  attendances.forEach((a) => {
    const key = `${a.employeeId}_${getDateKey(a.date)}`;
    attendanceByKey[key] = a;
  });

  const items = recentRequests.map((r) => {
    const key = `${r.employeeId}_${getDateKey(r.date)}`;
    const a = attendanceByKey[key];
    const emp = employeeMap.get(r.employeeId);
    let durationMinutes = a?.overtime && a.overtime > 0 ? a.overtime : 0;
    if (durationMinutes === 0) {
      try {
        durationMinutes = calculateOvertimeDuration(new Date(r.start), new Date(r.end));
      } catch {
        durationMinutes = Math.max(0, Math.round((new Date(r.end).getTime() - new Date(r.start).getTime()) / 60000));
      }
    }

    return {
      requestId: r.id,
      attendanceId: a?.id || null,
      requestDate: r.createdAt,
      overtimeDate: r.date,
      employeeId: r.employeeId,
      employeeName: a?.employee?.user?.name ?? emp?.user?.name ?? null,
      employeeAvatarUrl: a?.employee?.user?.profileImageUrl ?? emp?.user?.profileImageUrl ?? null,
      employeePosition: a?.employee?.position ?? emp?.position ?? null,
      employeeDepartment: a?.employee?.division ?? emp?.division ?? null,
      start: r.start,
      end: r.end,
      durationMinutes,
      reason: r.reason || "",
      status: r.status, // PENDING | APPROVED | REJECTED
      overtimeStartPhotoUrl: a?.overtimeStartPhotoUrl || null,
      overtimeEndPhotoUrl: a?.overtimeEndPhotoUrl || null,
      overtimeStartLatitude: a?.overtimeStartLatitude || null,
      overtimeStartLongitude: a?.overtimeStartLongitude || null,
      overtimeEndLatitude: a?.overtimeEndLatitude || null,
      overtimeEndLongitude: a?.overtimeEndLongitude || null,
    };
  });

  // Gabungkan attendance yang pending approval (tanpa OvertimeRequest)
  const requestAttendanceIds = new Set(items.map((i) => i.attendanceId).filter(Boolean));
  const pendingItems = pending
    .filter((a) => !requestAttendanceIds.has(a.id))
    .map((a) => {
      const start = a.overtimeStart ?? a.checkIn ?? a.date;
      const end = a.overtimeEnd ?? a.checkOut ?? start;

      let durationMinutes = a.overtime || 0;
      if (durationMinutes === 0) {
        try {
          if (new Date(end).getTime() !== new Date(start).getTime()) {
            durationMinutes = calculateOvertimeDuration(new Date(start), new Date(end));
          }
        } catch {
          // Keep 0
        }
      }

      return {
        requestId: `att_${a.id}`,
        attendanceId: a.id,
        requestDate: a.overtimeStart ?? a.checkOut ?? a.updatedAt ?? a.date,
        overtimeDate: a.date,
        employeeId: a.employeeId,
        employeeName: a.employee?.user?.name ?? null,
        employeeAvatarUrl: a.employee?.user?.profileImageUrl ?? null,
        employeePosition: a.employee?.position ?? null,
        employeeDepartment: a.employee?.division ?? null,
        start: start,
        end: end,
        durationMinutes,
        reason: a.overtimeStartAddressNote || (a.isSundayWork ? "Kerja Hari Minggu" : ""),
        status: "PENDING",
        overtimeStartPhotoUrl: a.overtimeStartPhotoUrl || null,
        overtimeEndPhotoUrl: a.overtimeEndPhotoUrl || null,
        overtimeStartLatitude: a.overtimeStartLatitude || null,
        overtimeStartLongitude: a.overtimeStartLongitude || null,
        overtimeEndLatitude: a.overtimeEndLatitude || null,
        overtimeEndLongitude: a.overtimeEndLongitude || null,
      };
    });

  const allItems = [...items, ...pendingItems];

  // Gabungkan logs untuk attendance yang terkait dengan recent requests juga
  const attendanceIdsFromRequests = attendances.map((a) => a.id);
  const allAttendanceIds = Array.from(new Set([...attendanceIds, ...attendanceIdsFromRequests]));
  const moreLogs = await prisma.approvalLog.findMany({
    where: { attendanceId: { in: allAttendanceIds } },
    orderBy: { createdAt: "desc" },
  });
  const actorIdsAll = Array.from(new Set(moreLogs.map((l) => l.actorUserId))).filter(Boolean) as string[];
  const actorsAll = await prisma.user.findMany({
    where: { id: { in: actorIdsAll } },
    select: { id: true, name: true, role: true },
  });
  const actorMapAll = new Map(actorsAll.map((a) => [a.id, a]));
  const enrichedAllLogs = moreLogs.map((l) => ({
    ...l,
    actorName: actorMapAll.get(l.actorUserId)?.name || "-",
    actorRole: actorMapAll.get(l.actorUserId)?.role || "-",
  }));

  return NextResponse.json({ pending, logs: enrichedAllLogs, items: allItems });
}
