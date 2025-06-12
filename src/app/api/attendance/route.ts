import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { format, getDay } from "date-fns";
import { recordCheckIn, recordCheckOut, getMonthlyAttendanceReport } from "@/lib/attendance";
import { Status } from "@/generated/prisma/enums";
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
    const limit = searchParams.get("limit");

    // Parse month and year if provided
    const monthNum = month ? parseInt(month) : new Date().getMonth() + 1;
    const yearNum = year ? parseInt(year) : new Date().getFullYear();
    const limitNum = limit ? parseInt(limit) : undefined;

    // Special case: If limit is provided without month/year, return recent activities for admin dashboard
    if (limitNum && session.user.role === "ADMIN" && !month && !year) {
      // Get recent attendance records across all employees for admin dashboard
      const recentAttendances = await prisma.attendance.findMany({
        where: {
          employee: {
            isActive: true
          }
        },
        include: {
          employee: {
            include: {
              user: {
                select: {
                  name: true
                }
              }
            }
          }
        },
        orderBy: [
          {
            date: 'desc'
          },
          {
            checkIn: 'desc'
          }
        ],
        take: limitNum * 2 // Ambil lebih banyak untuk memungkinkan aktivitas terpisah
      });

      // Buat aktivitas terpisah untuk check-in dan check-out
      const activities: any[] = [];
      
      recentAttendances.forEach(attendance => {
        // Tambahkan aktivitas check-out jika ada
        if (attendance.checkOut) {
          activities.push({
            ...formatAttendanceResponse(attendance),
            activityType: 'checkout',
            activityTime: attendance.checkOut
          });
        }
        
        // Tambahkan aktivitas check-in jika ada
        if (attendance.checkIn) {
          activities.push({
            ...formatAttendanceResponse(attendance),
            activityType: 'checkin',
            activityTime: attendance.checkIn
          });
        }
        
        // Tambahkan aktivitas lain (absent, leave) jika tidak ada check-in/out
        if (!attendance.checkIn && !attendance.checkOut && 
            (attendance.status === 'ABSENT' || attendance.status === 'LEAVE')) {
          activities.push({
            ...formatAttendanceResponse(attendance),
            activityType: 'status',
            activityTime: attendance.date
          });
        }
      });
      
      // Urutkan berdasarkan waktu aktivitas dan batasi
      const sortedActivities = activities
        .sort((a, b) => new Date(b.activityTime).getTime() - new Date(a.activityTime).getTime())
        .slice(0, limitNum);
      
      const formattedActivities = sortedActivities;
      
      const response = NextResponse.json({ attendances: formattedActivities });
      
      // Add cache control headers to prevent caching
      response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      response.headers.set('Pragma', 'no-cache');
      response.headers.set('Expires', '0');
      
      return response;
    }

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
      
      // Create response with cache control headers
      const response = NextResponse.json(attendanceReport);
      
      // Add cache control headers to prevent caching
      response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      response.headers.set('Pragma', 'no-cache');
      response.headers.set('Expires', '0');
      
      return response;
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
      
      // Create response with cache control headers
      const response = NextResponse.json(attendanceReport);
      
      // Add cache control headers to prevent caching
      response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      response.headers.set('Pragma', 'no-cache');
      response.headers.set('Expires', '0');
      
      return response;
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

    // Create response with cache control headers
    const response = NextResponse.json(allReports);
    
    // Add cache control headers to prevent caching
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    
    return response;
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
    const { action, photoUrl, latitude, longitude } = body; // action should be "check-in" or "check-out"
    const now = new Date();
    const workdayType = getWorkdayType(now);
    
    try {
      // Validasi berdasarkan aturan kehadiran dan jam kerja
      if (action === "check-in") {
        // Cek apakah ini pengajuan ulang setelah ditolak
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const existingAttendance = await prisma.attendance.findFirst({
          where: {
            employeeId: employee.id,
            date: {
              gte: today,
              lt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
            },
          },
        });
        
        console.log("Check-in request, existing attendance:", existingAttendance);
        
        const isPengajuanUlang = existingAttendance && 
                               existingAttendance.checkIn && 
                               ((existingAttendance.notes && existingAttendance.notes.includes("Di Tolak")) || 
                                (existingAttendance.approvedAt !== null && 
                                 (existingAttendance.isSundayWorkApproved === false || 
                                  existingAttendance.isOvertimeApproved === false)));
        
        // Cek apakah hari Minggu
        if (workdayType === WorkdayType.SUNDAY) {
          // Notifikasi admin bahwa ada karyawan bekerja di hari Minggu
          await createLateCheckInAdminNotification(
            employee.id,
            employee.user.name,
            isPengajuanUlang ? 
              "Pengajuan ulang: Bekerja pada hari Minggu (memerlukan persetujuan admin)" : 
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
            isPengajuanUlang ? 
              "Pengajuan ulang: Check-in pada jam lembur (memerlukan persetujuan admin)" : 
              "Check-in pada jam lembur (memerlukan persetujuan admin)",
            now
          );
        }

        // Proses check-in dengan foto dan geolokasi
        const attendance = await recordCheckIn(employee.id, photoUrl, latitude, longitude);
        console.log("Check-in recorded with photo and geolocation:", attendance);
        
        // Notifikasi karyawan
        let message = "";
        if (isPengajuanUlang) {
          message = "Pengajuan ulang check-in berhasil dicatat. Menunggu persetujuan admin.";
          if (workdayType === WorkdayType.SUNDAY) {
            message += " Bekerja di hari Minggu memerlukan persetujuan.";
          } else if (isOvertimeCheckIn(now, now)) {
            message += " Check-in pada jam lembur memerlukan persetujuan.";
          }
        } else if (workdayType === WorkdayType.SUNDAY) {
          message = "Absen masuk berhasil dicatat. Bekerja pada hari Minggu memerlukan persetujuan admin.";
        } else if (isOvertimeCheckIn(now, now)) {
          message = "Absen masuk berhasil dicatat. Check-in pada jam lembur memerlukan persetujuan admin.";
        } else if (attendance.isLate) {
          message = `Anda terlambat ${attendance.lateMinutes} menit.`;
        } else {
          message = "Absen masuk berhasil dicatat.";
        }
        
        await createCheckInNotification(employee.id, message);
        
        // Kirim respons dengan header notifikasi dan cache control
        const response = NextResponse.json(formatAttendanceResponse(attendance));
        addNotificationUpdateHeader(response);
        response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
        response.headers.set('Pragma', 'no-cache');
        response.headers.set('Expires', '0');
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
        
        console.log("Check-out request, existing attendance:", todayAttendance);
        
        if (!todayAttendance || !todayAttendance.checkIn) {
          return NextResponse.json(
            { error: "Anda belum melakukan check-in hari ini" },
            { status: 400 }
          );
        }
        
        // Cek apakah checkout sudah dilakukan
        if (todayAttendance.checkOut) {
          // Return clearer error message with the existing attendance data
          return NextResponse.json({
            error: "Anda sudah melakukan check-out hari ini",
            existingAttendance: {
              id: todayAttendance.id,
              date: todayAttendance.date,
              checkIn: todayAttendance.checkIn,
              checkOut: todayAttendance.checkOut,
              status: todayAttendance.status,
              notes: todayAttendance.notes,
              isLate: todayAttendance.isLate,
              lateMinutes: todayAttendance.lateMinutes,
              overtime: todayAttendance.overtime || 0,
              isOvertimeApproved: todayAttendance.isOvertimeApproved,
              isSundayWork: todayAttendance.isSundayWork || false,
              isSundayWorkApproved: todayAttendance.isSundayWorkApproved
            }
          }, { status: 400 });
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
        
        try {
        // Proses check-out dengan foto dan geolokasi
        const attendance = await recordCheckOut(employee.id, photoUrl, latitude, longitude);
        console.log("Check-out recorded with photo and geolocation:", attendance);
          
          // Pastikan data lengkap sebelum dikirim ke klien
          const formattedAttendance = formatAttendanceResponse({
            id: attendance.id,
            date: attendance.date,
            checkIn: attendance.checkIn,
            checkOut: attendance.checkOut,
            status: attendance.status,
            notes: attendance.notes,
            isLate: attendance.isLate || false,
            lateMinutes: attendance.lateMinutes || 0,
            overtime: attendance.overtime || 0,
            isOvertimeApproved: attendance.isOvertimeApproved || false,
            isSundayWork: attendance.isSundayWork || false,
            isSundayWorkApproved: attendance.isSundayWorkApproved || false,
            approvedAt: attendance.approvedAt
          });
        
        // Notifikasi karyawan
        let message = "Absen keluar berhasil dicatat.";
        if (isOvertimeCheckOut(now, now)) {
          const overtimeHours = Math.floor(attendance.overtime / 60);
          const overtimeMinutes = attendance.overtime % 60;
          message = `Absen keluar berhasil dicatat. Anda lembur ${overtimeHours} jam ${overtimeMinutes} menit.`;
        } else if (attendance.overtime > 0) {
          const overtimeHours = Math.floor(attendance.overtime / 60);
          const overtimeMinutes = attendance.overtime % 60;
          message += ` Anda lembur ${overtimeHours} jam ${overtimeMinutes} menit.`;
        }
        
        await createCheckOutNotification(employee.id, message);
        
        // Kirim respons dengan header notifikasi dan cache control
          const response = NextResponse.json(formattedAttendance);
        addNotificationUpdateHeader(response);
        response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
        response.headers.set('Pragma', 'no-cache');
        response.headers.set('Expires', '0');
        return response;
        } catch (error: any) {
          console.error("Error during check-out:", error);
          return NextResponse.json(
            { error: `Gagal melakukan absen keluar: ${error.message}` },
            { status: 500 }
          );
        }
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
        
        // Jika error tentang double check-in, dapatkan data kehadiran hari ini
        if (error.message === "Anda sudah melakukan check-in hari ini" || 
            error.message === "Anda sudah melakukan check-out hari ini") {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const todayEnd = new Date(today);
          todayEnd.setHours(23, 59, 59, 999);
          
          try {
            const existingAttendance = await prisma.attendance.findFirst({
              where: {
                employeeId: employee.id,
                date: {
                  gte: today,
                  lte: todayEnd,
                },
              },
            });
            
            if (existingAttendance) {
              return NextResponse.json(
                { 
                  error: error.message,
                  existingAttendance: formatAttendanceResponse({
                    id: existingAttendance.id,
                    date: existingAttendance.date,
                    checkIn: existingAttendance.checkIn,
                    checkOut: existingAttendance.checkOut,
                    status: existingAttendance.status,
                    notes: existingAttendance.notes,
                    isLate: existingAttendance.isLate,
                    lateMinutes: existingAttendance.lateMinutes,
                    overtime: existingAttendance.overtime || 0,
                    isOvertimeApproved: existingAttendance.isOvertimeApproved,
                    isSundayWork: existingAttendance.isSundayWork || false,
                    isSundayWorkApproved: existingAttendance.isSundayWorkApproved
                  })
                },
                { status: 400 }
              );
            }
          } catch (fetchError) {
            console.error("Error fetching existing attendance:", fetchError);
          }
        }
        
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