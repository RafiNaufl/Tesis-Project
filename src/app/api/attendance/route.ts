import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

// GET attendance records
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = req.nextUrl.searchParams;
    const employeeId = searchParams.get("employeeId");
    const month = searchParams.get("month");
    const year = searchParams.get("year");

    // Parse month and year if provided
    const monthNum = month ? parseInt(month) : null;
    const yearNum = year ? parseInt(year) : null;

    // Admins can see all records, employees can only see their own
    if (session.user.role !== "ADMIN" && !employeeId) {
      // For employees, find their employee ID
      const employee = await prisma.employee.findFirst({
        where: {
          userId: session.user.id,
        },
      });

      if (!employee) {
        return NextResponse.json(
          { error: "Employee record not found" },
          { status: 404 }
        );
      }

      // Get attendance for this employee
      const attendance = await getAttendanceRecords(
        employee.id,
        monthNum,
        yearNum
      );
      return NextResponse.json(attendance);
    }

    // For admins or specific employee queries
    const attendance = await getAttendanceRecords(
      employeeId || undefined,
      monthNum,
      yearNum
    );
    return NextResponse.json(attendance);
  } catch (error) {
    console.error("Error fetching attendance:", error);
    return NextResponse.json(
      { error: "Failed to fetch attendance records" },
      { status: 500 }
    );
  }
}

// POST check-in or check-out
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get employee
    const employee = await prisma.employee.findFirst({
      where: {
        userId: session.user.id,
      },
    });

    if (!employee) {
      return NextResponse.json(
        { error: "Employee record not found" },
        { status: 404 }
      );
    }

    const body = await req.json();
    const { action } = body; // action should be "check-in" or "check-out"

    if (action !== "check-in" && action !== "check-out") {
      return NextResponse.json(
        { error: "Invalid action. Must be 'check-in' or 'check-out'" },
        { status: 400 }
      );
    }

    const now = new Date();
    const today = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );

    // Check if there's already an attendance record for today
    let attendanceRecord = await prisma.attendance.findFirst({
      where: {
        employeeId: employee.id,
        date: {
          gte: today,
          lt: new Date(today.getTime() + 24 * 60 * 60 * 1000), // Next day
        },
      },
    });

    if (action === "check-in") {
      if (attendanceRecord && attendanceRecord.checkIn) {
        return NextResponse.json(
          { error: "Already checked in today" },
          { status: 400 }
        );
      }

      // Create or update the attendance record with check-in time
      attendanceRecord = await prisma.attendance.upsert({
        where: {
          id: attendanceRecord?.id || "",
        },
        create: {
          employeeId: employee.id,
          date: today,
          checkIn: now,
          status: "PRESENT",
        },
        update: {
          checkIn: now,
          status: "PRESENT",
        },
      });
    } else {
      // Check-out
      if (!attendanceRecord || !attendanceRecord.checkIn) {
        return NextResponse.json(
          { error: "Must check in before checking out" },
          { status: 400 }
        );
      }

      if (attendanceRecord.checkOut) {
        return NextResponse.json(
          { error: "Already checked out today" },
          { status: 400 }
        );
      }

      // Update the attendance record with check-out time
      attendanceRecord = await prisma.attendance.update({
        where: {
          id: attendanceRecord.id,
        },
        data: {
          checkOut: now,
        },
      });
    }

    return NextResponse.json(attendanceRecord);
  } catch (error) {
    console.error("Error recording attendance:", error);
    return NextResponse.json(
      { error: "Failed to record attendance" },
      { status: 500 }
    );
  }
}

// Helper function to get attendance records based on filters
async function getAttendanceRecords(
  employeeId?: string,
  month?: number | null,
  year?: number | null
) {
  const where: any = {};

  if (employeeId) {
    where.employeeId = employeeId;
  }

  if (month !== null && year !== null) {
    const startDate = new Date(year!, month! - 1, 1);
    const endDate = new Date(year!, month!, 0); // Last day of the month
    endDate.setHours(23, 59, 59, 999);

    where.date = {
      gte: startDate,
      lte: endDate,
    };
  }

  return prisma.attendance.findMany({
    where,
    orderBy: {
      date: "desc",
    },
    include: {
      employee: {
        include: {
          user: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  });
} 