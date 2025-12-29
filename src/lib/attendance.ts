import { prisma } from "@/lib/prisma";
import { Status } from "@/generated/prisma/enums";
import {
  getWorkdayType,
  WorkdayType,
  AttendanceStatus,
  calculateLateMinutes as calculateLateMinutesRule,
  getAttendanceStatus as getAttendanceStatusRule,
  isWorkday,
  isSunday,
} from "./attendanceRules";
import { calculateOvertimeDuration } from "./overtimeCalculator";

// Import fungsi terkait tanggal
import { startOfDay, addDays, isBefore } from "date-fns";

/**
 * Konversi status internal ke enum Prisma
 */
const mapAttendanceStatus = (status: AttendanceStatus): Status => {
  switch (status) {
    case AttendanceStatus.ON_TIME:
      return Status.PRESENT;
    case AttendanceStatus.LATE:
      return Status.LATE;
    case AttendanceStatus.ABSENT:
      return Status.ABSENT;
    default:
      return Status.ABSENT;
  }
};

/**
 * Memastikan record absensi lengkap untuk rentang tanggal tertentu
 * Mengisi kekosongan dengan status ABSENT pada hari kerja
 */
export const ensureAttendanceRecords = async (
  employeeId: string,
  startDate: Date,
  endDate: Date
) => {
  let currentDate = new Date(startDate);
  // Clone endDate to avoid mutation issues if passed by reference (though unlikely here)
  const finalDate = new Date(endDate);
  const now = new Date();
  
  while (currentDate <= finalDate) {
    // Skip if future date
    if (isBefore(now, currentDate)) {
        currentDate = addDays(currentDate, 1);
        continue;
    }

    const date = startOfDay(currentDate);

    // Check existing record
    const existing = await prisma.attendance.findUnique({
      where: {
        employeeId_date: {
          employeeId,
          date,
        },
      },
    });

    if (!existing) {
      // Cek apakah hari kerja
      if (isWorkday(currentDate)) {
          await prisma.attendance.create({
            data: {
              employeeId,
              date,
              status: Status.ABSENT,
              isLate: false,
              lateMinutes: 0,
              isSundayWork: isSunday(currentDate),
            },
          });
      }
    }
    
    currentDate = addDays(currentDate, 1);
  }
};

/**
 * Mencatat kehadiran karyawan (Check-In)
 */
export const checkIn = async (
  employeeId: string,
  photoUrl?: string,
  latitude?: number,
  longitude?: number
) => {
  const now = new Date();
  const date = startOfDay(now);

  // Cek apakah sudah ada absen hari ini
  const existingAttendance = await prisma.attendance.findUnique({
    where: {
      employeeId_date: {
        employeeId,
        date,
      },
    },
  });

  const workdayType = getWorkdayType(now);
  const isSundayWork = workdayType === WorkdayType.SUNDAY;

  // Hitung status kehadiran dan keterlambatan - jika hari Minggu dan tidak disetujui, status ABSENT
  const attendanceStatus = getAttendanceStatusRule(now, now, false); // Belum disetujui
  const status = mapAttendanceStatus(attendanceStatus);
  const isLate = attendanceStatus === AttendanceStatus.LATE;
  const lateMinutes = calculateLateMinutesRule(now, now);

  if (existingAttendance) {
    // Jika sudah ada catatan, perbarui
    const result = await prisma.attendance.update({
      where: { id: existingAttendance.id },
      data: {
        checkIn: now,
        // Reset checkout jika ada pengajuan ulang setelah penolakan
        checkOut: null,
        status,
        isLate,
        lateMinutes,
        isSundayWork,
        // Reset status persetujuan sebelumnya
        approvedAt: null,
        approvedBy: null,
        isOvertimeApproved: false,
        isSundayWorkApproved: false,
        // Hapus catatan penolakan sebelumnya jika ada
        notes: existingAttendance.notes?.includes("Di Tolak") ? "" : existingAttendance.notes,
        // Tambahkan data foto dan geolokasi
        checkInPhotoUrl: photoUrl,
        checkInLatitude: latitude,
        checkInLongitude: longitude,
      },
    });
    
    // Log hasil update untuk debugging
    console.log("Updated attendance:", {
      id: result.id,
      checkIn: result.checkIn,
      checkOut: result.checkOut,
      notes: result.notes,
    });
    
    return result;
  }

  // Buat catatan baru
  return prisma.attendance.create({
    data: {
      employeeId,
      date,
      checkIn: now,
      status,
      isLate,
      lateMinutes,
      isSundayWork,
      checkInPhotoUrl: photoUrl,
      checkInLatitude: latitude,
      checkInLongitude: longitude,
    },
  });
};

/**
 * Mencatat jam keluar karyawan (Check-Out)
 */
export const checkOut = async (
  employeeId: string,
  photoUrl?: string,
  latitude?: number,
  longitude?: number
) => {
  const now = new Date();
  const date = startOfDay(now);

  const attendance = await prisma.attendance.findUnique({
    where: {
      employeeId_date: {
        employeeId,
        date,
      },
    },
  });

  if (!attendance) {
    throw new Error("Anda belum melakukan check-in hari ini.");
  }

  // Update attendance with checkout info only; overtime dihitung dari overtimeStart→overtimeEnd
  return prisma.attendance.update({
    where: { id: attendance.id },
    data: {
      checkOut: now,
      // Jangan set lembur di checkout; akan ditetapkan saat endOvertime
      // Overtime tetap sesuai nilai sebelumnya (jika ada)
      checkOutPhotoUrl: photoUrl,
      checkOutLatitude: latitude,
      checkOutLongitude: longitude,
    },
  });
};

/**
 * Mencatat mulai lembur
 */
export const startOvertime = async (
  employeeId: string,
  photoUrl?: string,
  latitude?: number,
  longitude?: number,
  notes?: string,
  reason?: string
) => {
  const now = new Date();
  const date = startOfDay(now);

  const attendance = await prisma.attendance.findUnique({
    where: {
      employeeId_date: {
        employeeId,
        date,
      },
    },
  });

  if (!attendance) {
    // Jika belum ada data absensi, buat baru (untuk kasus lembur di hari libur atau tanpa shift normal)
    const newAttendance = await prisma.attendance.create({
      data: {
        employeeId,
        date,
        checkIn: now, // Set checkIn sama dengan waktu mulai lembur
        status: Status.PRESENT,
        isLate: false,
        lateMinutes: 0,
        isSundayWork: isSunday(date),
        overtimeStart: now,
        overtimeStartPhotoUrl: photoUrl,
        overtimeStartLatitude: latitude,
        overtimeStartLongitude: longitude,
        overtimeStartAddressNote: notes || reason,
      },
    });

    // Create OvertimeRequest entry
    try {
        await prisma.overtimeRequest.create({
          data: {
            employeeId,
            date: date,
            start: now,
            end: now, // Will be updated on endOvertime
            reason: reason || notes,
            status: "PENDING",
          }
        });
    } catch (error) {
        console.error("Failed to create OvertimeRequest:", error);
    }
    
    return newAttendance;
  }
  
  if (!attendance.checkOut) {
    throw new Error("Anda harus check-out terlebih dahulu sebelum mulai lembur.");
  }

  const updatedAttendance = await prisma.attendance.update({
    where: { id: attendance.id },
    data: {
      overtimeStart: now,
      overtimeStartPhotoUrl: photoUrl,
      overtimeStartLatitude: latitude,
      overtimeStartLongitude: longitude,
      overtimeStartAddressNote: notes || reason,
    },
  });

  // Create OvertimeRequest entry
  try {
      await prisma.overtimeRequest.create({
        data: {
          employeeId,
          date: date,
          start: now,
          end: now, // Will be updated on endOvertime
          reason: reason || notes,
          status: "PENDING",
        }
      });
  } catch (error) {
      console.error("Failed to create OvertimeRequest:", error);
  }
  
  return updatedAttendance;
};

/**
 * Menyetujui lembur
 */
export const approveOvertime = async (attendanceId: string, approverId: string) => {
  const attendance = await prisma.attendance.findUnique({
    where: { id: attendanceId },
  });

  if (!attendance) {
    throw new Error("Data kehadiran tidak ditemukan");
  }

  const updatedAttendance = await prisma.attendance.update({
    where: { id: attendanceId },
    data: {
      isOvertimeApproved: true,
      approvedAt: new Date(),
      approvedBy: approverId,
    },
  });

  // Approve associated OvertimeRequest
  if (updatedAttendance.overtimeStart) {
      try {
        await prisma.overtimeRequest.updateMany({
            where: {
                employeeId: updatedAttendance.employeeId,
                date: updatedAttendance.date,
                start: updatedAttendance.overtimeStart
            },
            data: {
                status: "APPROVED",
                approvedBy: approverId,
                approvedAt: new Date()
            }
        });
      } catch (error) {
          console.error("Failed to approve OvertimeRequest:", error);
      }
  }

  return updatedAttendance;
};

/**
 * Menolak lembur
 */
export const rejectOvertime = async (attendanceId: string, approverId: string, rejectionReason?: string) => {
  const attendance = await prisma.attendance.findUnique({
    where: { id: attendanceId },
  });

  if (!attendance) {
    throw new Error("Data kehadiran tidak ditemukan");
  }

  const updatedAttendance = await prisma.attendance.update({
    where: { id: attendanceId },
    data: {
      isOvertimeApproved: false,
      approvedAt: new Date(),
      approvedBy: approverId,
      // Opsional: simpan alasan penolakan di notes atau field khusus jika ada
      notes: rejectionReason ? (attendance.notes ? `${attendance.notes}. Ditolak: ${rejectionReason}` : `Ditolak: ${rejectionReason}`) : attendance.notes,
    },
  });

  // Reject associated OvertimeRequest
  if (updatedAttendance.overtimeStart) {
      try {
        await prisma.overtimeRequest.updateMany({
            where: {
                employeeId: updatedAttendance.employeeId,
                date: updatedAttendance.date,
                start: updatedAttendance.overtimeStart
            },
            data: {
                status: "REJECTED",
                approvedBy: approverId,
                approvedAt: new Date(),
                notes: rejectionReason
            }
        });
      } catch (error) {
          console.error("Failed to reject OvertimeRequest:", error);
      }
  }

  return updatedAttendance;
};

/**
 * Menyelesaikan lembur
 */
export const endOvertime = async (
  employeeId: string,
  photoUrl?: string,
  latitude?: number,
  longitude?: number,
  notes?: string
) => {
  const now = new Date();
  const date = startOfDay(now);

  const attendance = await prisma.attendance.findUnique({
    where: {
      employeeId_date: {
        employeeId,
        date,
      },
    },
  });

  if (!attendance) {
    throw new Error("Anda belum melakukan check-in hari ini.");
  }

  if (!attendance.overtimeStart) {
    throw new Error("Anda belum memulai lembur.");
  }

  // Gunakan fungsi kalkulasi yang lebih robust dengan validasi dan logging
  const overtimeDuration = calculateOvertimeDuration(attendance.overtimeStart, now);

  const updatedAttendance = await prisma.attendance.update({
    where: { id: attendance.id },
    data: {
      overtimeEnd: now,
      overtimeEndPhotoUrl: photoUrl,
      overtimeEndLatitude: latitude,
      overtimeEndLongitude: longitude,
      overtimeEndAddressNote: notes,
      overtime: overtimeDuration,
      // Jika belum checkout (implicit overtime), set checkout juga
      ...(attendance.checkOut ? {} : {
        checkOut: now,
        checkOutPhotoUrl: photoUrl,
        checkOutLatitude: latitude,
        checkOutLongitude: longitude,
      }),
    },
  });

  // Update OvertimeRequest
  try {
      // Find the request that matches this attendance
      const request = await prisma.overtimeRequest.findFirst({
        where: {
            employeeId,
            date: attendance.date,
            start: attendance.overtimeStart
        }
      });

      if (request) {
          await prisma.overtimeRequest.update({
            where: { id: request.id },
            data: {
                end: now,
            }
          });
      } else {
          // If not found (maybe started before this code change), create it
          await prisma.overtimeRequest.create({
            data: {
                employeeId,
                date: attendance.date,
                start: attendance.overtimeStart,
                end: now,
                reason: attendance.overtimeStartAddressNote,
                status: "PENDING"
            }
          });
      }
  } catch (error) {
      console.error("Failed to update OvertimeRequest:", error);
  }

  return updatedAttendance;
};

/**
 * Menyetujui pengajuan keterlambatan
 */
export const approveLateSubmission = async (attendanceId: string, _approverId: string) => {
  const attendance = await prisma.attendance.findUnique({
    where: { id: attendanceId },
  });

  if (!attendance) {
    throw new Error("Data kehadiran tidak ditemukan");
  }

  return prisma.attendance.update({
    where: { id: attendanceId },
    data: {
      lateApprovalStatus: "APPROVED",
      // Jika disetujui, mungkin status berubah jadi ON_TIME/PRESENT atau tetap LATE tapi excused?
      // Mengikuti pola umum, kita ubah status jadi PRESENT agar tidak dianggap terlambat dalam report
      // Atau biarkan status LATE tapi ada flag approved.
      // Berdasarkan LateApprovals.tsx, hanya mengubah status approval.
      // Namun untuk keperluan payroll/report, mungkin perlu penyesuaian.
      // Kita asumsikan update status approval cukup.
    },
  });
};

/**
 * Menolak pengajuan keterlambatan
 */
export const rejectLateSubmission = async (attendanceId: string, _approverId: string, rejectionReason?: string) => {
  const attendance = await prisma.attendance.findUnique({
    where: { id: attendanceId },
  });

  if (!attendance) {
    throw new Error("Data kehadiran tidak ditemukan");
  }

  return prisma.attendance.update({
    where: { id: attendanceId },
    data: {
      lateApprovalStatus: "REJECTED",
      notes: rejectionReason ? (attendance.notes ? `${attendance.notes}. Ditolak: ${rejectionReason}` : `Ditolak: ${rejectionReason}`) : attendance.notes,
    },
  });
};

/**
 * Mendapatkan laporan absensi bulanan
 */
export const getMonthlyAttendanceReport = async (employeeId: string, year: number, month: number) => {
  const startDate = new Date(year, month - 1, 1);
  // Last day of the month
  const endDate = new Date(year, month, 0, 23, 59, 59);

  const attendances = await prisma.attendance.findMany({
    where: {
      employeeId,
      date: {
        gte: startDate,
        lte: endDate,
      },
    },
    orderBy: {
      date: "asc",
    },
  });

  const summary = {
    present: attendances.filter((a) => a.status === Status.PRESENT).length,
    late: attendances.filter((a) => a.status === Status.LATE).length,
    absent: attendances.filter((a) => a.status === Status.ABSENT).length,
    sick: attendances.filter((a) => a.status === Status.SICK).length,
    permit: attendances.filter((a) => a.status === Status.PERMIT).length,
    totalOvertime: attendances.reduce((acc, curr) => acc + (curr.overtime || 0), 0),
  };

  return {
    employeeId,
    year,
    month,
    summary,
    attendances,
  };
};
