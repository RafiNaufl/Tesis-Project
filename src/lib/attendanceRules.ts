/**
 * attendanceRules.ts
 * Berisi logika untuk aturan kehadiran dan jam kerja
 */

import { format, parse, isAfter, isBefore, addDays, differenceInMinutes, getDay } from "date-fns";

export enum WorkdayType {
  WEEKDAY = "WEEKDAY", // Senin-Jumat
  SATURDAY = "SATURDAY", // Sabtu
  SUNDAY = "SUNDAY", // Minggu
}

export enum AttendanceStatus {
  ON_TIME = "ON_TIME", // Tepat waktu
  LATE = "LATE", // Terlambat
  ABSENT = "ABSENT", // Tidak hadir
}

export enum OvertimeStatus {
  APPROVED = "APPROVED", // Disetujui admin
  PENDING = "PENDING", // Menunggu persetujuan
  REJECTED = "REJECTED", // Ditolak
}

// Konstanta untuk aturan jam kerja
export const WORK_HOURS = {
  START_TIME: {
    WEEKDAY: "08:00", // Senin-Jumat
    SATURDAY: "08:00", // Sabtu
  },
  END_TIME: {
    WEEKDAY: "16:30", // Senin-Jumat
    SATURDAY: "14:00", // Sabtu
  },
  LATE_THRESHOLD: "08:30", // Terlambat jika check-in setelah 08:30
};

export const LATE_PENALTY = 30000; // Denda keterlambatan Rp 30.000

export function toWIB(date: Date): Date {
  const utcTs = date.getTime() + date.getTimezoneOffset() * 60000;
  const wibTs = utcTs + 7 * 60 * 60000;
  return new Date(wibTs);
}

/**
 * Menentukan tipe hari kerja berdasarkan tanggal
 * @param date Tanggal yang akan dicek
 * @returns Tipe hari kerja
 */
export function getWorkdayType(date: Date): WorkdayType {
  const day = getDay(toWIB(date));
  if (day === 0) return WorkdayType.SUNDAY; // Minggu
  if (day === 6) return WorkdayType.SATURDAY; // Sabtu
  return WorkdayType.WEEKDAY; // Senin-Jumat
}

/**
 * Mengecek apakah tanggal adalah hari kerja
 * @param date Tanggal yang akan dicek
 * @returns boolean
 */
export function isWorkday(date: Date): boolean {
  return getWorkdayType(date) !== WorkdayType.SUNDAY;
}

/**
 * Mendapatkan jam mulai kerja berdasarkan tipe hari kerja
 * @param workdayType Tipe hari kerja
 * @returns string format jam "HH:mm"
 */
export function getWorkStartTime(workdayType: WorkdayType, override?: { weekdayStart?: string; saturdayStart?: string }): string {
  if (workdayType === WorkdayType.SUNDAY) return ""; // Minggu tidak ada jam kerja
  if (workdayType === WorkdayType.SATURDAY) return override?.saturdayStart ?? WORK_HOURS.START_TIME.SATURDAY;
  return override?.weekdayStart ?? WORK_HOURS.START_TIME.WEEKDAY;
}

/**
 * Mendapatkan jam selesai kerja berdasarkan tipe hari kerja
 * @param workdayType Tipe hari kerja
 * @returns string format jam "HH:mm"
 */
export function getWorkEndTime(workdayType: WorkdayType, override?: { weekdayEnd?: string; saturdayEnd?: string }): string {
  if (workdayType === WorkdayType.SUNDAY) return ""; // Minggu tidak ada jam kerja
  if (workdayType === WorkdayType.SATURDAY) return override?.saturdayEnd ?? WORK_HOURS.END_TIME.SATURDAY;
  return override?.weekdayEnd ?? WORK_HOURS.END_TIME.WEEKDAY;
}

/**
 * Memeriksa status kehadiran berdasarkan waktu check-in dan persetujuan
 * @param checkInTime Waktu check-in
 * @param date Tanggal
 * @param isSundayWorkApproved Apakah kerja hari Minggu disetujui
 * @returns Status kehadiran
 */
export function getAttendanceStatus(
  checkInTime: Date | null, 
  date: Date, 
  isSundayWorkApproved: boolean = false,
  lateThresholdOverride?: string
): AttendanceStatus {
  if (!checkInTime) return AttendanceStatus.ABSENT;
  const checkInWIB = toWIB(checkInTime);
  const dateWIB = toWIB(date);
  const workdayType = getWorkdayType(dateWIB);
  
  // Jika hari Minggu dan tidak ada persetujuan, maka dianggap tidak hadir
  if (workdayType === WorkdayType.SUNDAY && !isSundayWorkApproved) {
    return AttendanceStatus.ABSENT;
  }
  
  // Jika hari Minggu dan ada persetujuan, maka dianggap tepat waktu
  if (workdayType === WorkdayType.SUNDAY && isSundayWorkApproved) {
    return AttendanceStatus.ON_TIME;
  }
  
  // Parse waktu threshold keterlambatan untuk tanggal tersebut
  const lateThresholdTime = parse(
    `${format(dateWIB, "yyyy-MM-dd")} ${lateThresholdOverride ?? WORK_HOURS.LATE_THRESHOLD}`, 
    "yyyy-MM-dd HH:mm", 
    new Date()
  );
  
  // Check apakah check-in setelah threshold keterlambatan
  if (isAfter(checkInWIB, lateThresholdTime)) {
    return AttendanceStatus.LATE;
  }
  
  return AttendanceStatus.ON_TIME;
}

/**
 * Menghitung menit keterlambatan
 * @param checkInTime Waktu check-in
 * @param date Tanggal
 * @returns Menit keterlambatan (0 jika tidak terlambat)
 */
export function calculateLateMinutes(checkInTime: Date | null, date: Date, override?: { weekdayStart?: string; saturdayStart?: string }): number {
  if (!checkInTime) return 0;
  const checkInWIB = toWIB(checkInTime);
  const dateWIB = toWIB(date);
  const workdayType = getWorkdayType(dateWIB);
  
  // Jika hari Minggu, tidak ada keterlambatan
  if (workdayType === WorkdayType.SUNDAY) return 0;
  
  // Parse waktu mulai kerja untuk tanggal tersebut
  const workStartTime = parse(
    `${format(dateWIB, "yyyy-MM-dd")} ${getWorkStartTime(workdayType, override)}`, 
    "yyyy-MM-dd HH:mm", 
    new Date()
  );
  
  // Jika check-in sebelum waktu mulai kerja, tidak ada keterlambatan
  if (isBefore(checkInWIB, workStartTime)) return 0;
  
  // Hitung selisih menit
  return differenceInMinutes(checkInWIB, workStartTime);
}

/**
 * Menghitung menit lembur berdasarkan waktu check-out dan persetujuan
 * @param checkOutTime Waktu check-out
 * @param date Tanggal
 * @param isOvertimeApproved Apakah lembur disetujui
 * @param isSundayWorkApproved Apakah kerja hari Minggu disetujui
 * @returns Menit lembur (0 jika tidak lembur atau tidak disetujui)
 */
// Menghitung menit lembur berdasarkan rentang overtimeStart → overtimeEnd
export function calculateOvertimeRangeMinutes(
  overtimeStart: Date | null,
  overtimeEnd: Date | null,
  date: Date
): number {
  if (!overtimeStart || !overtimeEnd) return 0;
  const startWIB = toWIB(overtimeStart);
  const endWIB = toWIB(overtimeEnd);
  const dateWIB = toWIB(date);

  // Batasi sampai pukul 07:00 keesokan harinya
  const overtimeLimit = new Date(addDays(dateWIB, 1));
  overtimeLimit.setHours(7, 0, 0, 0);
  const effectiveEnd = isAfter(endWIB, overtimeLimit) ? overtimeLimit : endWIB;

  if (isBefore(effectiveEnd, startWIB)) return 0;
  return differenceInMinutes(effectiveEnd, startWIB);
}

/**
 * Menghitung denda keterlambatan
 * @param attendanceStatus Status kehadiran
 * @returns Denda keterlambatan (Rp)
 */
export function calculateLatePenalty(attendanceStatus: AttendanceStatus): number {
  if (attendanceStatus === AttendanceStatus.LATE) {
    return LATE_PENALTY;
  }
  return 0;
}

/**
 * Memeriksa apakah check-in dilakukan di luar jam kerja normal (potensial lembur)
 * @param checkInTime Waktu check-in
 * @param date Tanggal
 * @returns boolean
 */
export function isOvertimeCheckIn(checkInTime: Date, date: Date): boolean {
  const workdayType = getWorkdayType(date);
  
  // Jika hari Minggu, selalu dihitung sebagai lembur
  if (workdayType === WorkdayType.SUNDAY) return true;
  
  // Parse waktu selesai kerja untuk tanggal tersebut
  const workEndTime = parse(
    `${format(date, "yyyy-MM-dd")} ${getWorkEndTime(workdayType)}`, 
    "yyyy-MM-dd HH:mm", 
    new Date()
  );
  
  // Check-in setelah jam kerja selesai dianggap lembur
  return isAfter(checkInTime, workEndTime);
}

/**
 * Memeriksa apakah check-out menghasilkan lembur
 * @param checkOutTime Waktu check-out
 * @param date Tanggal
 * @returns boolean
 */
export function isOvertimeCheckOut(checkOutTime: Date, date: Date): boolean {
  const workdayType = getWorkdayType(date);
  
  // Jika hari Minggu, selalu dihitung sebagai lembur
  if (workdayType === WorkdayType.SUNDAY) return true;
  
  // Parse waktu selesai kerja untuk tanggal tersebut
  const workEndTime = parse(
    `${format(date, "yyyy-MM-dd")} ${getWorkEndTime(workdayType)}`, 
    "yyyy-MM-dd HH:mm", 
    new Date()
  );
  
  // Check-out setelah jam kerja selesai dianggap lembur
  return isAfter(checkOutTime, workEndTime);
}

/**
 * Memeriksa apakah tanggal adalah hari Minggu
 * @param date Tanggal yang akan dicek
 * @returns boolean
 */
export function isSunday(date: Date): boolean {
  return getWorkdayType(date) === WorkdayType.SUNDAY;
}

/**
 * Menghasilkan pesan yang sesuai untuk status kehadiran di hari Minggu atau lembur
 * @param date Tanggal
 * @param isCheckIn Flag untuk menentukan apakah check-in atau check-out
 * @param isApproved Flag untuk menentukan apakah sudah disetujui
 * @returns Pesan yang sesuai
 */
export function generateApprovalMessage(date: Date, isCheckIn: boolean, isApproved: boolean = false): string {
  const workdayType = getWorkdayType(date);
  const isSundayWorkday = workdayType === WorkdayType.SUNDAY;
  
  if (isSundayWorkday) {
    if (isApproved) {
      return "Bekerja pada hari Minggu (disetujui admin)";
    } else {
      return "Bekerja pada hari Minggu (memerlukan persetujuan admin)";
    }
  } else {
    // Kasus lembur di hari biasa
    if (isCheckIn) {
      if (isApproved) {
        return "Check-in pada jam lembur (disetujui admin)";
      } else {
        return "Check-in pada jam lembur (memerlukan persetujuan admin)";
      }
    } else {
      if (isApproved) {
        return "Lembur: checkout setelah jam kerja normal (disetujui admin)";
      } else {
        return "Lembur: checkout setelah jam kerja normal (memerlukan persetujuan admin)";
      }
    }
  }
} 
