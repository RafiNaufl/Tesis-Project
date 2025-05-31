import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { format } from "date-fns";
import { recordCheckIn, recordCheckOut, getMonthlyAttendanceReport } from "@/lib/attendance";
import { Status } from "@/generated/prisma";

// Tipe untuk data attendance
interface AttendanceData {
  id: string;
  employeeId: string;
  date: Date;
  checkIn: Date | null;
  checkOut: Date | null;
  status: Status;
  notes: string | null;
  isLate: boolean;
  lateMinutes: number;
  overtime: number;
}

/**
 * Fungsi untuk memformat data attendance untuk respons API
 */
function formatAttendanceResponse(attendance: any): any {
  // Pastikan properti overtime ada
  if (attendance && !attendance.hasOwnProperty('overtime')) {
    attendance.overtime = 0;
  }
  
  // Pastikan properti isLate ada
  if (attendance && !attendance.hasOwnProperty('isLate')) {
    attendance.isLate = attendance.status === 'LATE';
  }
  
  // Pastikan properti lateMinutes ada
  if (attendance && !attendance.hasOwnProperty('lateMinutes')) {
    attendance.lateMinutes = 0;
  }
  
  return attendance;
}

// GET attendance records
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: "Tidak diizinkan" }, { status: 401 });
    }

    const searchParams = req.nextUrl.searchParams;
    const employeeId = searchParams.get("employeeId");
    const month = searchParams.get("month");
    const year = searchParams.get("year");

    // Parse month and year if provided
    const monthNum = month ? parseInt(month) : new Date().getMonth() + 1;
    const yearNum = year ? parseInt(year) : new Date().getFullYear();

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
          { error: "Data karyawan tidak ditemukan" },
          { status: 404 }
        );
      }

      // Get attendance for this employee
      const attendanceReport = await getMonthlyAttendanceReport(
        employee.id,
        yearNum,
        monthNum
      );
      
      // Format attendances
      if (attendanceReport && attendanceReport.attendances) {
        attendanceReport.attendances = attendanceReport.attendances.map(formatAttendanceResponse);
      }
      
      return NextResponse.json(attendanceReport);
    }

    // For admins with specific employee query
    if (employeeId) {
      const attendanceReport = await getMonthlyAttendanceReport(
        employeeId,
        yearNum,
        monthNum
      );
      
      // Format attendances
      if (attendanceReport && attendanceReport.attendances) {
        attendanceReport.attendances = attendanceReport.attendances.map(formatAttendanceResponse);
      }
      
      return NextResponse.json(attendanceReport);
    }

    // For admins requesting all employees
    // Fetch all active employees
    const employees = await prisma.employee.findMany({
      where: { isActive: true },
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    // Get attendance reports for all employees
    const allReports = await Promise.all(
      employees.map(async (employee) => {
        const report = await getMonthlyAttendanceReport(
          employee.id,
          yearNum,
          monthNum
        );
        
        // Format attendances
        if (report && report.attendances) {
          report.attendances = report.attendances.map(formatAttendanceResponse);
        }
        
        return {
          employee: {
            id: employee.id,
            employeeId: employee.employeeId,
            name: employee.user.name,
            email: employee.user.email,
            position: employee.position,
            department: employee.department,
          },
          report,
        };
      })
    );

    return NextResponse.json(allReports);
  } catch (error: any) {
    console.error("Error fetching attendance:", error);
    return NextResponse.json(
      { error: `Gagal mengambil data kehadiran: ${error.message}` },
      { status: 500 }
    );
  }
}

// POST check-in or check-out
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: "Tidak diizinkan" }, { status: 401 });
    }

    // Get employee
    const employee = await prisma.employee.findFirst({
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
        { error: "Data karyawan tidak ditemukan" },
        { status: 404 }
      );
    }

    const body = await req.json();
    const { action } = body; // action should be "check-in" or "check-out"

    if (action !== "check-in" && action !== "check-out") {
      return NextResponse.json(
        { error: "Tindakan tidak valid. Harus 'check-in' atau 'check-out'" },
        { status: 400 }
      );
    }

    let attendanceRecord: AttendanceData;
    const now = new Date();

    if (action === "check-in") {
      // Cek apakah sudah ada catatan kehadiran untuk hari ini
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const existingAttendance = await prisma.attendance.findFirst({
        where: {
          employeeId: employee.id,
          date: {
            gte: today,
            lt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
          },
          checkIn: {
            not: null,
          },
        },
      });

      if (existingAttendance?.checkIn) {
        return NextResponse.json(
          { error: "Anda sudah melakukan check-in hari ini" },
          { status: 400 }
        );
      }

      // Lakukan check-in
      let checkInRecord = await recordCheckIn(employee.id);
      attendanceRecord = formatAttendanceResponse(checkInRecord) as AttendanceData;

      // Buat notifikasi untuk karyawan
      const isLate = attendanceRecord.status === "LATE";
      await prisma.notification.create({
        data: {
          userId: session.user.id,
          title: isLate ? "Check-in Terlambat" : "Check-in Berhasil",
          message: isLate
            ? `Anda check-in pada ${format(now, "HH:mm")} yang terlambat dari waktu yang diharapkan (08:00).`
            : `Anda berhasil check-in pada ${format(now, "HH:mm")}.`,
          type: isLate ? "warning" : "success",
        },
      });

      // Beri tahu admin tentang keterlambatan
      if (isLate) {
        // Cari pengguna admin
        const admins = await prisma.user.findMany({
          where: {
            role: "ADMIN",
          },
        });

        // Buat notifikasi untuk setiap admin
        for (const admin of admins) {
          await prisma.notification.create({
            data: {
              userId: admin.id,
              title: "Peringatan Keterlambatan",
              message: `${employee.user.name} terlambat check-in pada ${format(now, "HH:mm")} tanggal ${format(now, "dd MMMM yyyy")}.`,
              type: "warning",
            },
          });
        }
      }
    } else {
      // Check-out
      try {
        let checkOutRecord = await recordCheckOut(employee.id);
        attendanceRecord = formatAttendanceResponse(checkOutRecord) as AttendanceData;

        // Hitung durasi kerja dalam jam
        const checkInTime = attendanceRecord.checkIn;
        if (!checkInTime) {
          throw new Error("Data check-in tidak ditemukan");
        }

        const workDurationHours = (
          (now.getTime() - checkInTime.getTime()) /
          (1000 * 60 * 60)
        ).toFixed(2);

        // Cek apakah ada lembur
        const hasOvertime = attendanceRecord.overtime > 0;
        const overtimeMinutes = attendanceRecord.overtime;
        const overtimeHours = (overtimeMinutes / 60).toFixed(2);

        // Buat notifikasi untuk check-out
        await prisma.notification.create({
          data: {
            userId: session.user.id,
            title: "Check-out Berhasil",
            message: hasOvertime
              ? `Anda berhasil check-out pada ${format(now, "HH:mm")}. Total durasi kerja: ${workDurationHours} jam, termasuk lembur ${overtimeHours} jam.`
              : `Anda berhasil check-out pada ${format(now, "HH:mm")}. Total durasi kerja: ${workDurationHours} jam.`,
            type: "success",
          },
        });

        // Notifikasi untuk admin jika ada lembur
        if (hasOvertime) {
          const admins = await prisma.user.findMany({
            where: {
              role: "ADMIN",
            },
          });

          for (const admin of admins) {
            await prisma.notification.create({
              data: {
                userId: admin.id,
                title: "Laporan Lembur",
                message: `${employee.user.name} melakukan lembur selama ${overtimeHours} jam pada tanggal ${format(now, "dd MMMM yyyy")}.`,
                type: "info",
              },
            });
          }
        }
      } catch (error: any) {
        return NextResponse.json(
          { error: error.message },
          { status: 400 }
        );
      }
    }

    // Tambahkan header respons untuk memicu pembaruan notifikasi di frontend
    const response = NextResponse.json(attendanceRecord);
    response.headers.set("X-Notification-Update", "true");

    return response;
  } catch (error: any) {
    console.error("Error recording attendance:", error);
    return NextResponse.json(
      { error: `Gagal mencatat kehadiran: ${error.message}` },
      { status: 500 }
    );
  }
} 