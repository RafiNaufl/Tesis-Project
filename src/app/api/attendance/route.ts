import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { format } from "date-fns";

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
      const employee = await db.employee.findFirst({
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
    const employee = await db.employee.findFirst({
      where: {
        userId: session.user.id,
      },
      include: {
        user: {
          select: {
            name: true,
          },
        },
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
    let attendanceRecord = await db.attendance.findFirst({
      where: {
        employeeId: employee.id,
        date: {
          gte: today,
          lt: new Date(today.getTime() + 24 * 60 * 60 * 1000), // Next day
        },
      },
    });

    let isLate = false;
    if (action === "check-in") {
      if (attendanceRecord && attendanceRecord.checkIn) {
        return NextResponse.json(
          { error: "Already checked in today" },
          { status: 400 }
        );
      }

      // Check if the check-in time is after 9:00 AM (considered late)
      isLate = now.getHours() >= 9 && now.getMinutes() > 0;
      const status = isLate ? "LATE" : "PRESENT";
      
      // Create or update the attendance record with check-in time
      attendanceRecord = await db.attendance.upsert({
        where: {
          id: attendanceRecord?.id || "",
        },
        create: {
          employeeId: employee.id,
          date: today,
          checkIn: now,
          status: status,
        },
        update: {
          checkIn: now,
          status: status,
        },
      });
      
      // Create a notification for the check-in
      await db.notification.create({
        data: {
          userId: session.user.id,
          title: isLate ? "Late Check-in Recorded" : "Attendance Confirmed",
          message: isLate 
            ? `You checked in at ${format(now, "h:mm a")} which is after the expected time.`
            : `You successfully checked in at ${format(now, "h:mm a")}.`,
          type: isLate ? "warning" : "success",
          read: false,
        },
      });
      
      // Notify admin about late check-ins
      if (isLate) {
        // Find admin users
        const admins = await db.user.findMany({
          where: {
            role: "ADMIN",
          },
        });
        
        // Create a notification for each admin
        for (const admin of admins) {
          await db.notification.create({
            data: {
              userId: admin.id,
              title: "Late Check-in Alert",
              message: `${employee.user.name} checked in late at ${format(now, "h:mm a")} on ${format(today, "MMMM d, yyyy")}.`,
              type: "warning",
              read: false,
            },
          });
        }
      }
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
      attendanceRecord = await db.attendance.update({
        where: {
          id: attendanceRecord.id,
        },
        data: {
          checkOut: now,
        },
      });
      
      // Calculate work duration in hours
      const checkInTime = new Date(attendanceRecord.checkIn!);
      const workDurationHours = ((now.getTime() - checkInTime.getTime()) / (1000 * 60 * 60)).toFixed(2);
      
      // Create a notification for the check-out
      await db.notification.create({
        data: {
          userId: session.user.id,
          title: "Check-out Confirmed",
          message: `You successfully checked out at ${format(now, "h:mm a")}. Total work duration: ${workDurationHours} hours.`,
          type: "success",
          read: false,
        },
      });
    }

    // Add this response header to trigger notification update in the frontend
    const response = NextResponse.json(attendanceRecord);
    response.headers.set('X-Notification-Update', 'true');
    
    return response;
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

  return db.attendance.findMany({
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