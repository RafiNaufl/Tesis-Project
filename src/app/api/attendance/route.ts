import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { format, getDay } from "date-fns";
import { recordCheckIn, recordCheckOut, getMonthlyAttendanceReport } from "@/lib/attendance";
import { Status } from "@/generated/prisma";
import { 
  createCheckInNotification, 
  createLateCheckInAdminNotification,
  createCheckOutNotification,
  createOvertimeAdminNotification,
  addNotificationUpdateHeader
} from "@/lib/notification";
import {
  getWorkdayType,
  WorkdayType,
  isOvertimeCheckIn,
  isOvertimeCheckOut
} from "@/lib/attendanceRules";

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
    const now = new Date();
    const workdayType = getWorkdayType(now);
    
    try {
      // Validasi berdasarkan aturan kehadiran dan jam kerja
      if (action === "check-in") {
        // Cek apakah hari Minggu
        if (workdayType === WorkdayType.SUNDAY) {
          // Notifikasi admin bahwa ada karyawan bekerja di hari Minggu
          await createLateCheckInAdminNotification(
            employee.id,
            employee.user.name,
            "Bekerja pada hari Minggu (memerlukan persetujuan admin)",
            now
          );
        }
        
        // Cek apakah check-in adalah lembur
        if (isOvertimeCheckIn(now, now)) {
          // Notifikasi admin untuk persetujuan lembur
          await createOvertimeAdminNotification(
            employee.id,
            employee.user.name,
            "Check-in pada jam lembur (memerlukan persetujuan admin)",
            now
          );
        }

        // Proses check-in
        const attendance = await recordCheckIn(employee.id);
        
        // Notifikasi karyawan
        let message = "";
        if (workdayType === WorkdayType.SUNDAY) {
          message = "Absen masuk berhasil dicatat. Bekerja pada hari Minggu memerlukan persetujuan admin.";
        } else if (isOvertimeCheckIn(now, now)) {
          message = "Absen masuk berhasil dicatat. Check-in pada jam lembur memerlukan persetujuan admin.";
        } else if (attendance.isLate) {
          message = `Anda terlambat ${attendance.lateMinutes} menit.`;
        } else {
          message = "Absen masuk berhasil dicatat.";
        }
        
        await createCheckInNotification(employee.id, message);
        
        // Jika terlambat, notifikasi admin
        if (attendance.isLate) {
          await createLateCheckInAdminNotification(
            employee.id,
            employee.user.name,
            `Terlambat ${attendance.lateMinutes} menit`,
            attendance.checkIn as Date
          );
        }
        
        // Kirim respons dengan header notifikasi
        const response = NextResponse.json(attendance);
        addNotificationUpdateHeader(response);
        return response;
      } else if (action === "check-out") {
        // Cek apakah karyawan melakukan check-in terlebih dahulu
        const todayStart = new Date(now);
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date(now);
        todayEnd.setHours(23, 59, 59, 999);
        
        const todayAttendance = await prisma.attendance.findFirst({
          where: {
            employeeId: employee.id,
            date: {
              gte: todayStart,
              lte: todayEnd,
            },
          },
        });
        
        if (!todayAttendance || !todayAttendance.checkIn) {
          return NextResponse.json(
            { error: "Anda belum melakukan check-in hari ini" },
            { status: 400 }
          );
        }
        
        // Cek apakah checkout menghasilkan lembur
        if (isOvertimeCheckOut(now, now)) {
          // Notifikasi admin untuk persetujuan lembur
          await createOvertimeAdminNotification(
            employee.id,
            employee.user.name,
            "Check-out pada jam lembur",
            now
          );
        }
        
        // Proses check-out
        const attendance = await recordCheckOut(employee.id);
        
        // Notifikasi karyawan
        let message = "Absen keluar berhasil dicatat.";
        if (isOvertimeCheckOut(now, now)) {
          const overtimeHours = Math.floor(attendance.overtime / 60);
          const overtimeMinutes = attendance.overtime % 60;
          message = `Absen keluar berhasil dicatat. Anda lembur ${overtimeHours} jam ${overtimeMinutes} menit (memerlukan persetujuan admin).`;
        } else if (attendance.overtime > 0) {
          const overtimeHours = Math.floor(attendance.overtime / 60);
          const overtimeMinutes = attendance.overtime % 60;
          message += ` Anda lembur ${overtimeHours} jam ${overtimeMinutes} menit.`;
        }
        
        await createCheckOutNotification(employee.id, message);
        
        // Kirim respons dengan header notifikasi
        const response = NextResponse.json(attendance);
        addNotificationUpdateHeader(response);
        return response;
      } else {
        return NextResponse.json(
          { error: "Tindakan tidak valid. Gunakan 'check-in' atau 'check-out'." },
          { status: 400 }
        );
      }
    } catch (error: any) {
      // Tangani error khusus double absen
      if (error.message === "Anda sudah melakukan check-in hari ini" || 
          error.message === "Anda sudah melakukan check-out hari ini") {
        return NextResponse.json(
          { error: error.message },
          { status: 400 }
        );
      }
      // Lanjutkan error ke handler utama
      throw error;
    }
  } catch (error: any) {
    console.error("Error recording attendance:", error);
    return NextResponse.json(
      { error: `Gagal mencatat kehadiran: ${error.message}` },
      { status: 500 }
    );
  }
}

// PUT untuk memperbarui data attendance (hanya untuk admin)
export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Anda tidak memiliki izin untuk melakukan tindakan ini" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { id, checkIn, checkOut, status, notes } = body;

    if (!id) {
      return NextResponse.json(
        { error: "ID kehadiran diperlukan" },
        { status: 400 }
      );
    }

    // Validasi status
    if (status && !Object.values(Status).includes(status as Status)) {
      return NextResponse.json(
        { error: "Status tidak valid" },
        { status: 400 }
      );
    }

    // Parse dates
    let checkInDate = checkIn ? new Date(checkIn) : undefined;
    let checkOutDate = checkOut ? new Date(checkOut) : undefined;

    // Update attendance record
    const updatedAttendance = await prisma.attendance.update({
      where: { id },
      data: {
        checkIn: checkInDate,
        checkOut: checkOutDate,
        status: status as Status,
        notes,
      },
    });

    return NextResponse.json(updatedAttendance);
  } catch (error: any) {
    console.error("Error updating attendance:", error);
    return NextResponse.json(
      { error: `Gagal memperbarui kehadiran: ${error.message}` },
      { status: 500 }
    );
  }
} 