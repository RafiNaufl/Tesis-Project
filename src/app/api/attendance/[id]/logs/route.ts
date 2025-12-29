import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { db } from "@/lib/db";
import { authOptions } from "@/lib/auth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: attendanceId } = await params;

    // Get the attendance record to check permissions
    const attendance = await db.attendance.findUnique({
      where: { id: attendanceId },
      include: {
        employee: {
          include: {
            user: {
              select: {
                id: true,
              },
            },
          },
        },
      },
    });

    if (!attendance) {
      return NextResponse.json(
        { error: "Attendance record not found" },
        { status: 404 }
      );
    }

    // Check if the user is authorized to view this record
    if (
      session.user.role !== "ADMIN" && 
      session.user.role !== "MANAGER" &&
      attendance.employee.user.id !== session.user.id
    ) {
      return NextResponse.json(
        { error: "You don't have permission to access this record" },
        { status: 403 }
      );
    }

    // Fetch approval logs
    const logs = await db.approvalLog.findMany({
      where: { attendanceId },
      orderBy: { createdAt: "desc" },
    });

    // Fetch actor details
    const actorIds = Array.from(new Set(logs.map((l) => l.actorUserId))).filter(Boolean);
    const actors = await db.user.findMany({
      where: { id: { in: actorIds } },
      select: { id: true, name: true, role: true },
    });
    
    const actorMap = new Map(actors.map((a) => [a.id, a]));
    
    const enrichedLogs = logs.map((l) => ({
      ...l,
      actorName: actorMap.get(l.actorUserId)?.name || "-",
      actorRole: actorMap.get(l.actorUserId)?.role || "-",
    }));

    return NextResponse.json({ logs: enrichedLogs });
  } catch (error) {
    console.error("Error fetching attendance logs:", error);
    return NextResponse.json(
      { error: "Failed to fetch attendance logs" },
      { status: 500 }
    );
  }
}
