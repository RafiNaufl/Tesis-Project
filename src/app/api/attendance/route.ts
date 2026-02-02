import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { format } from "date-fns";

import { checkIn, checkOut, getMonthlyAttendanceReport, startOvertime, endOvertime } from "@/lib/attendance";
import { getWorkdayType, WorkdayType, getWorkEndTime, isOvertimeCheckOut, isOvertimeCheckIn, toWIB } from "@/lib/attendanceRules";
import { calculateOvertimeDuration, calculatePayableOvertime } from "@/lib/overtimeCalculator";
import { Status } from "@/types/enums";
import { 
  createCheckInNotification, 
  createLateCheckInAdminNotification,
  createCheckOutNotification,
  createOvertimeAdminNotification,
  addNotificationUpdateHeader
} from "@/lib/notification";
// removed duplicate import of attendanceRules


/**
 * Fungsi untuk memformat data attendance untuk respons API
 */
function formatAttendanceResponse(attendance: any): any {
  // Pastikan properti overtime ada
  if (attendance && !Object.prototype.hasOwnProperty.call(attendance, 'overtime')) {
    attendance.overtime = 0;
  }
  
  // Pastikan properti isLate ada
  if (attendance && !Object.prototype.hasOwnProperty.call(attendance, 'isLate')) {
    attendance.isLate = attendance.status === 'LATE';
  }
  
  // Pastikan properti lateMinutes ada
  if (attendance && !Object.prototype.hasOwnProperty.call(attendance, 'lateMinutes')) {
    attendance.lateMinutes = 0;
  }

  // Hitung overtimePayable jika ada lembur
  if (attendance && attendance.overtime > 0 && attendance.date) {
    try {
      const date = new Date(attendance.date);
      const workdayType = getWorkdayType(date);
      // Cek tipe jadwal kerja karyawan (NON_SHIFT vs SHIFT)
      const isNonShift = attendance.employee?.workScheduleType === 'NON_SHIFT';
      attendance.overtimePayable = calculatePayableOvertime(attendance.overtime, workdayType, isNonShift);
    } catch (e) {
      console.error("Error calculating payable overtime:", e);
      attendance.overtimePayable = 0;
    }
  } else if (attendance) {
    attendance.overtimePayable = 0;
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

    // Advanced Filtering Parameters
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");
    const departmentParam = searchParams.get("department");
    const positionParam = searchParams.get("position");
    const statusParam = searchParams.get("status"); // Comma separated
    const isLateParam = searchParams.get("isLate");
    const hasLocationParam = searchParams.get("hasLocation");
    const dayTypeParam = searchParams.get("dayType");
    const searchQuery = searchParams.get("search");

    // Check if we are in "Advanced Filter Mode"
    // Triggered if startDate/endDate/search/department/status is present
    const isFilterMode = startDateParam || endDateParam || searchQuery || departmentParam || positionParam || statusParam || isLateParam || hasLocationParam || dayTypeParam || employeeId;

    if (isFilterMode && (session.user.role === "ADMIN" || session.user.role === "MANAGER")) {
      const whereClause: any = {
        employee: {
          isActive: true
        }
      };

      // Date Range Filter
      if (startDateParam || endDateParam) {
        whereClause.date = {};
        if (startDateParam) whereClause.date.gte = new Date(startDateParam);
        if (endDateParam) {
           // Set to end of day
           const end = new Date(endDateParam);
           end.setHours(23, 59, 59, 999);
           whereClause.date.lte = end;
        }
      } else {
         // Default to current month if no date provided in filter mode
         const start = new Date(yearNum, monthNum - 1, 1);
         const end = new Date(yearNum, monthNum, 0, 23, 59, 59);
         whereClause.date = { gte: start, lte: end };
      }

      // Department/Division Filter
      if (departmentParam) {
        whereClause.employee.division = departmentParam;
      }

      // Position Filter
      if (positionParam) {
        whereClause.employee.position = positionParam;
      }

      // Exact Employee filter
      if (employeeId) {
        whereClause.employeeId = employeeId;
      } else if (searchQuery) {
        // Only apply search query if no specific employeeId is selected
        // This prevents conflicts where search text might not match the selected employee's details exactly
        whereClause.employee.OR = [
          {
            user: {
              name: {
                contains: searchQuery,
                mode: 'insensitive'
              }
            }
          },
          {
            employeeId: {
              contains: searchQuery,
              mode: 'insensitive'
            }
          }
        ];
      }

      // Status and Late Filter logic
      // Use AND array to allow multiple OR groups (e.g. Status/Late OR Location)
      const andConditions: any[] = [];
      const statusConditions: any[] = [];

      if (statusParam) {
        const statuses = statusParam.split(',').filter(s => s.trim() !== '');
        if (statuses.length > 0) {
          statusConditions.push({ status: { in: statuses } });
        }
      }

      if (isLateParam === 'true') {
        // Use isLate boolean field for better accuracy
        statusConditions.push({ isLate: true });
      }

      if (statusConditions.length > 0) {
        if (statusConditions.length > 1) {
          // If both provided, we treat it as OR (e.g. "ABSENT" OR "isLate")
          andConditions.push({ OR: statusConditions });
        } else {
          // Single condition
          Object.assign(whereClause, statusConditions[0]);
        }
      }

      // Location Filter
      if (hasLocationParam === 'true') {
        andConditions.push({
          OR: [
            { checkInLatitude: { not: null } },
            { checkOutLatitude: { not: null } }
          ]
        });
      }

      if (andConditions.length > 0) {
        whereClause.AND = andConditions;
      }

      let attendances = await prisma.attendance.findMany({
        where: whereClause,
        include: {
          employee: {
            include: {
              user: {
                select: {
                  name: true,
                  profileImageUrl: true
                }
              }
            }
          }
        },
        orderBy: {
          date: 'desc'
        }
      });

      // Filter by Day Type (In-Memory)
      if (dayTypeParam && dayTypeParam !== 'ALL') {
        // Fetch holidays if needed
        let holidayDates = new Set<string>();
        if (dayTypeParam === 'HOLIDAY' || dayTypeParam === 'WEEKDAY') {
          const holidays = await prisma.publicHoliday.findMany({
             select: { date: true }
          });
          holidays.forEach(h => holidayDates.add(h.date.toISOString().split('T')[0]));
        }

        attendances = attendances.filter(a => {
           const date = new Date(a.date);
           const day = date.getDay(); // 0 = Sunday, 6 = Saturday
           const dateString = date.toISOString().split('T')[0];
           const isHoliday = holidayDates.has(dateString);

           if (dayTypeParam === 'WEEKDAY') return (day >= 1 && day <= 5) && !isHoliday;
           if (dayTypeParam === 'SATURDAY') return day === 6;
           if (dayTypeParam === 'SUNDAY') return day === 0;
           if (dayTypeParam === 'HOLIDAY') return isHoliday;
           return true;
        });
      }

      // Fetch overtime requests for fallback (missing overtimeStartAddressNote)
      const employeeIds = [...new Set(attendances.map(a => a.employeeId))];
      
      if (employeeIds.length > 0) {
        const overtimeRequests = await prisma.overtimeRequest.findMany({
            where: {
                employeeId: { in: employeeIds },
                date: whereClause.date
            }
        });
        
        attendances = attendances.map(att => {
            if (!att.overtimeStartAddressNote && (att.overtime > 0 || att.overtimeStart)) {
                const attDateStr = att.date.toISOString().split('T')[0];
                const req = overtimeRequests.find(r => 
                    r.employeeId === att.employeeId && 
                    r.date.toISOString().split('T')[0] === attDateStr
                );
                
                if (req && req.reason) {
                    return { ...att, overtimeStartAddressNote: req.reason };
                }
            }
            return att;
        });
      }

      // Format response
      const formatted = attendances.map(a => {
        const formattedRecord = formatAttendanceResponse(a);
        return {
            ...formattedRecord,
            employee: {
              id: a.employee.id,
              employeeId: a.employee.employeeId,
              position: a.employee.position,
              division: a.employee.division,
              organization: a.employee.organization ?? null,
              workScheduleType: a.employee.workScheduleType ?? null,
              name: a.employee.user?.name ?? "",
              user: {
                name: a.employee.user?.name ?? "",
                profileImageUrl: a.employee.user?.profileImageUrl
              }
            }
        };
      });

      return NextResponse.json({ attendances: formatted });
    }

    // Special case: If limit is provided without month/year, return recent activities for admin dashboard
    if (limitNum && (session.user.role === "ADMIN" || session.user.role === "MANAGER") && !month && !year) {
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

      // Fetch overtime requests for fallback
      if (recentAttendances.length > 0) {
        const employeeIds = [...new Set(recentAttendances.map(a => a.employeeId))];
        const dates = recentAttendances.map(a => a.date.getTime());
        const minDate = new Date(Math.min(...dates));
        const maxDate = new Date(Math.max(...dates));
        maxDate.setHours(23, 59, 59, 999);
        minDate.setHours(0, 0, 0, 0);

        const overtimeRequests = await prisma.overtimeRequest.findMany({
             where: {
                employeeId: { in: employeeIds },
                date: { gte: minDate, lte: maxDate }
             }
        });
        
        for (const att of recentAttendances) {
             if (!att.overtimeStartAddressNote && (att.overtime > 0 || att.overtimeStart)) {
                 const attDateStr = att.date.toISOString().split('T')[0];
                 const req = overtimeRequests.find(r => 
                    r.employeeId === att.employeeId && 
                    r.date.toISOString().split('T')[0] === attDateStr
                 );
                 if (req && req.reason) {
                    att.overtimeStartAddressNote = req.reason;
                 }
             }
        }
      }

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
    if (session.user.role !== "ADMIN" && session.user.role !== "MANAGER" && !employeeId) {
      // For employees, find their employee ID
      const employee = await prisma.employee.findFirst({
        where: {
          userId: session.user.id,
        },
        include: {
          user: {
            select: {
              name: true,
              profileImageUrl: true,
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

      // Get attendance for this employee
      const attendanceReport = await getMonthlyAttendanceReport(
        employee.id,
        yearNum,
        monthNum
      );
      
      // Format attendances and attach employee details
      if (attendanceReport && attendanceReport.attendances) {
        attendanceReport.attendances = attendanceReport.attendances.map((a: any) => {
          const formatted = formatAttendanceResponse(a);
          return {
            ...formatted,
            employee: {
              id: employee.id,
              employeeId: employee.employeeId,
              position: employee.position,
              division: employee.division,
              organization: employee.organization ?? null,
              workScheduleType: employee.workScheduleType ?? null,
              name: employee.user?.name ?? session.user.name ?? "",
              user: {
                name: employee.user?.name ?? session.user.name ?? "",
                profileImageUrl: employee.user?.profileImageUrl ?? undefined,
              },
            },
          };
        });
      }
      
      // Create response with cache control headers
      const response = NextResponse.json(attendanceReport);
      
      // Add cache control headers to prevent caching
      response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      response.headers.set('Pragma', 'no-cache');
      response.headers.set('Expires', '0');
      
      return response;
    }

    // For admins/managers with specific employee query
    if (employeeId) {
      if (session.user.role !== "ADMIN" && session.user.role !== "MANAGER") {
        const employee = await prisma.employee.findUnique({
          where: { id: employeeId },
          select: { userId: true },
        });
        if (!employee || employee.userId !== session.user.id) {
          return NextResponse.json({ error: "Tidak diizinkan" }, { status: 403 });
        }
      }
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

    // For admins/managers requesting all employees
    // Fetch all active employees
    const employees = await prisma.employee.findMany({
      where: { isActive: true },
      include: {
        user: {
          select: {
            name: true,
            email: true,
            profileImageUrl: true,
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
            division: employee.division,
            organization: employee.organization ?? null,
            workScheduleType: employee.workScheduleType ?? null,
            user: {
              name: employee.user.name,
              profileImageUrl: employee.user.profileImageUrl ?? undefined,
            },
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
      const { action, photoUrl, latitude, longitude, locationNote, reason, consentConfirmed } = body;
    const now = new Date();
    const nowWIB = toWIB(now);
    const workdayType = getWorkdayType(now);
    
    try {
      // Validasi input umum
      if (!photoUrl || typeof latitude !== "number" || typeof longitude !== "number") {
        return NextResponse.json(
          { error: "Foto dan lokasi wajib disertakan untuk presensi" },
          { status: 400 }
        );
      }

      // Validasi berdasarkan aturan kehadiran dan jam kerja
      if (action === "check-in") {
        // Cek apakah ini pengajuan ulang setelah ditolak
        const today = new Date(toWIB(new Date()));
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
            nowWIB
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
            nowWIB
          );
        }

        const attendance = await checkIn(employee.id, photoUrl, latitude, longitude);
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
        const todayStart = new Date(toWIB(now));
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date(toWIB(now));
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
        
        // Opsional: beri tahu admin jika checkout melewati jam kerja
        // (tanpa menghitung lembur otomatis)
        
        try {
        let attendance = await checkOut(employee.id, photoUrl, latitude, longitude);
        console.log("Check-out recorded with photo and geolocation:", attendance);

          const confirmOvertime = body.confirmOvertime === true;
          const overtimeReason = typeof body.overtimeReason === 'string' ? body.overtimeReason : '';
          const consentConfirmedFlag = body.consentConfirmed === true;

          const outside = isOvertimeCheckOut(now, now);
          if (outside && !todayAttendance.overtimeStart && confirmOvertime && consentConfirmedFlag) {
            const workdayType = getWorkdayType(now);
            let overtimeStart: Date;
            
            // Fix: Use todayAttendance.date (WIB) as base to ensure correct date even if crossing midnight
            const baseDateWIB = toWIB(todayAttendance.date);
            const dateStr = format(baseDateWIB, 'yyyy-MM-dd');

            if (workdayType === WorkdayType.SUNDAY) {
              overtimeStart = todayAttendance.checkIn ? new Date(todayAttendance.checkIn) : new Date(`${dateStr}T08:00:00+07:00`);
            } else {
              const endStr = getWorkEndTime(workdayType);
              // Construct correctly in WIB (+07:00) to ensure accurate UTC conversion
              overtimeStart = new Date(`${dateStr}T${endStr}:00+07:00`);
            }
            
            // Safety check: ensure start is not after now (which would cause negative duration)
            if (overtimeStart > now) {
                console.warn(`[Overtime] Calculated start ${overtimeStart.toISOString()} is after now ${now.toISOString()}. Adjusting to now.`);
                overtimeStart = now;
            }

            const overtimeMinutes = calculateOvertimeDuration(overtimeStart, now);

            const updated = await prisma.attendance.update({
              where: { id: todayAttendance.id },
              data: {
                overtimeStart,
                overtimeEnd: now,
                overtime: overtimeMinutes,
                overtimeEndAddressNote: body.locationNote || null,
                overtimeEndPhotoUrl: photoUrl,
                overtimeEndLatitude: latitude,
                overtimeEndLongitude: longitude,
                // Populate start fields as well since this is implicit overtime
                overtimeStartPhotoUrl: photoUrl,
                overtimeStartLatitude: latitude,
                overtimeStartLongitude: longitude,
                overtimeStartAddressNote: body.locationNote || null,
              },
            });

            try {
              const existingRequest = await prisma.overtimeRequest.findFirst({
                where: { employeeId: employee.id, date: todayAttendance.date, start: overtimeStart },
              });
              if (existingRequest) {
                await prisma.overtimeRequest.update({
                  where: { id: existingRequest.id },
                  data: { end: now, reason: overtimeReason || existingRequest.reason },
                });
              } else {
                await prisma.overtimeRequest.create({
                  data: {
                    employeeId: employee.id,
                    date: todayAttendance.date,
                    start: overtimeStart,
                    end: now,
                    reason: overtimeReason,
                    status: "PENDING",
                  },
                });
              }
              await prisma.approvalLog.create({
                data: {
                  attendanceId: todayAttendance.id,
                  action: "REQUEST_SUBMITTED",
                  actorUserId: session.user.id,
                  note: (overtimeReason || '').slice(0, 255) || null,
                },
              });
              await prisma.attendanceAuditLog.create({
                data: {
                  attendanceId: todayAttendance.id,
                  userId: session.user.id,
                  action: "OVERTIME_REQUESTED",
                  oldValue: { overtimeStart: null },
                  newValue: { overtimeStart },
                },
              });
              await prisma.attendanceAuditLog.create({
                data: {
                  attendanceId: todayAttendance.id,
                  userId: session.user.id,
                  action: "OVERTIME_ENDED",
                  oldValue: { overtimeEnd: null },
                  newValue: { overtimeEnd: now },
                },
              });
            } catch (err) {
              console.error("Failed to sync overtime request on checkout:", err);
            }
            attendance = updated;
          }
          
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
        const message = "Absen keluar berhasil dicatat.";
        await createCheckOutNotification(employee.id, message, { refType: "ATTENDANCE", refId: attendance.id });
        
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
      } else if (action === "overtime-start") {
        const todayStart = new Date(toWIB(now));
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date(toWIB(now));
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

        if (todayAttendance && !todayAttendance.checkOut) {
          return NextResponse.json(
            { error: "Anda harus melakukan absen keluar (check-out) terlebih dahulu sebelum mulai lembur." },
            { status: 400 }
          );
        }

        // Jika belum ada attendance, pastikan ini di luar jam kerja (atau hari libur)
        // Jika masih jam kerja normal, arahkan untuk menggunakan Absen Masuk
        if (!todayAttendance && !isOvertimeCheckIn(now, now)) {
          return NextResponse.json(
            { error: "Saat ini masih jam kerja normal. Silakan gunakan tombol Absen Masuk." },
            { status: 400 }
          );
        }

        if (todayAttendance && todayAttendance.overtimeStart) {
          return NextResponse.json(
            { error: "Anda sudah memulai lembur hari ini" },
            { status: 400 }
          );
        }

        // Validasi form lembur
        if (typeof reason !== 'string' || reason.trim().length < 20) {
          return NextResponse.json(
            { error: "Alasan lembur minimal 20 karakter" },
            { status: 400 }
          );
        }
        if (consentConfirmed !== true) {
          return NextResponse.json(
            { error: "Anda harus menyetujui kebijakan lembur perusahaan" },
            { status: 400 }
          );
        }

        const attendance = await startOvertime(employee.id, photoUrl, latitude, longitude, locationNote, reason);

        await createOvertimeAdminNotification(
          employee.id,
          employee.user.name,
          "Pengajuan lembur dimulai (menunggu persetujuan)",
          now
        );

        // Audit & approval logs
        await prisma.approvalLog.create({
          data: {
            attendanceId: attendance.id,
            action: "REQUEST_SUBMITTED",
            actorUserId: session.user.id,
            note: (reason || '').slice(0, 255) || null,
          },
        });
        await prisma.attendanceAuditLog.create({
          data: {
            attendanceId: attendance.id,
            userId: session.user.id,
            action: "OVERTIME_REQUESTED",
            oldValue: { overtimeStart: null },
            newValue: { overtimeStart: attendance.overtimeStart },
          },
        });

        const response = NextResponse.json(formatAttendanceResponse(attendance));
        addNotificationUpdateHeader(response);
        response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
        response.headers.set('Pragma', 'no-cache');
        response.headers.set('Expires', '0');
        return response;
      } else if (action === "overtime-end") {
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

        if (!todayAttendance || !todayAttendance.overtimeStart) {
          return NextResponse.json(
            { error: "Selesai lembur hanya boleh setelah mulai lembur" },
            { status: 400 }
          );
        }

        if (todayAttendance.overtimeEnd) {
          return NextResponse.json(
            { error: "Anda sudah menyelesaikan lembur hari ini" },
            { status: 400 }
          );
        }

        const attendance = await endOvertime(employee.id, photoUrl, latitude, longitude, locationNote);

        // Validasi backend: jika sistem memangkas waktu lembur di atas pukul 07:00
        // tambahkan catatan agar pengguna mengetahui pemangkasan otomatis
        const nextDayLimit = new Date();
        nextDayLimit.setHours(7, 0, 0, 0);
        const attendanceDate = new Date(attendance.date);
        attendanceDate.setHours(0,0,0,0);
        const limit = new Date(attendanceDate.getTime() + 24*60*60*1000);
        limit.setHours(7,0,0,0);
        if (attendance.overtimeEnd && new Date(attendance.overtimeEnd) > limit) {
          await prisma.attendance.update({
            where: { id: attendance.id },
            data: {
              notes: `${attendance.notes ?? ""} Lembur dipangkas hingga 07:00.`.trim()
            }
          });
        }

        const response = NextResponse.json(formatAttendanceResponse(attendance));
        addNotificationUpdateHeader(response);
        response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
        response.headers.set('Pragma', 'no-cache');
        response.headers.set('Expires', '0');
        return response;
      } else {
        return NextResponse.json(
          { error: "Tindakan tidak valid. Gunakan 'check-in', 'check-out', 'overtime-start', atau 'overtime-end'." },
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
          const today = new Date(toWIB(new Date()));
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
