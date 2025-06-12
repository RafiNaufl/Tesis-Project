import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { db } from "@/lib/db";
import { authOptions } from "@/lib/auth";

// GET /api/attendance/[id] - Get attendance record by ID
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

    // Get the attendance record
    const attendance = await db.attendance.findUnique({
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
        { error: "Attendance record not found" },
        { status: 404 }
      );
    }

    // Check if the user is authorized to view this record
    if (
      session.user.role !== "ADMIN" &&
      attendance.employee.user.id !== session.user.id
    ) {
      return NextResponse.json(
        { error: "You don't have permission to access this record" },
        { status: 403 }
      );
    }

    return NextResponse.json({ attendance });
  } catch (error) {
    console.error("Error fetching attendance record:", error);
    return NextResponse.json(
      { error: "Failed to fetch attendance record" },
      { status: 500 }
    );
  }
}

// PUT /api/attendance/[id] - Update attendance record
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only admins can update attendance records
    if (session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Only admins can update attendance records" },
        { status: 403 }
      );
    }

    const { id: attendanceId } = await params;
    const body = await req.json();
    const { checkIn, checkOut, status, notes } = body;

    // Get the attendance record
    const attendance = await db.attendance.findUnique({
      where: { id: attendanceId },
    });

    if (!attendance) {
      return NextResponse.json(
        { error: "Attendance record not found" },
        { status: 404 }
      );
    }

    // Update the attendance record
    const updatedAttendance = await db.attendance.update({
      where: { id: attendanceId },
      data: {
        checkIn: checkIn ? new Date(checkIn) : attendance.checkIn,
        checkOut: checkOut ? new Date(checkOut) : attendance.checkOut,
        status: status || attendance.status,
        notes: notes !== undefined ? notes : attendance.notes,
      },
    });

    return NextResponse.json({
      message: "Attendance record updated successfully",
      attendance: updatedAttendance,
    });
  } catch (error) {
    console.error("Error updating attendance record:", error);
    return NextResponse.json(
      { error: "Failed to update attendance record" },
      { status: 500 }
    );
  }
}

// DELETE /api/attendance/[id] - Delete attendance record
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only admins can delete attendance records
    if (session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Only admins can delete attendance records" },
        { status: 403 }
      );
    }

    const { id: attendanceId } = await params;

    // Check if the attendance record exists
    const attendance = await db.attendance.findUnique({
      where: { id: attendanceId },
    });

    if (!attendance) {
      return NextResponse.json(
        { error: "Attendance record not found" },
        { status: 404 }
      );
    }

    // Delete the attendance record
    await db.attendance.delete({
      where: { id: attendanceId },
    });

    return NextResponse.json({
      message: "Attendance record deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting attendance record:", error);
    return NextResponse.json(
      { error: "Failed to delete attendance record" },
      { status: 500 }
    );
  }
}