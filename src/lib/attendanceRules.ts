/**
 * attendanceRules.ts
 * Berisi logika untuk aturan kehadiran dan jam kerja
 */

import { format, parse, isWeekend, isAfter, isBefore, addDays, differenceInMinutes, isEqual, getDay } from "date-fns";
import { id } from "date-fns/locale";

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
    SATURDAY: "12:00", // Sabtu
  },
  LATE_THRESHOLD: "08:30", // Terlambat jika check-in setelah 08:30
};

export const LATE_PENALTY = 30000; // Denda keterlambatan Rp 30.000

/**
 * Menentukan tipe hari kerja berdasarkan tanggal
 * @param date Tanggal yang akan dicek
 * @returns Tipe hari kerja
 */
export function getWorkdayType(date: Date): WorkdayType {
  const day = getDay(date);
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
export function getWorkStartTime(workdayType: WorkdayType): string {
  if (workdayType === WorkdayType.SUNDAY) return ""; // Minggu tidak ada jam kerja
  if (workdayType === WorkdayType.SATURDAY) return WORK_HOURS.START_TIME.SATURDAY;
  return WORK_HOURS.START_TIME.WEEKDAY;
}

/**
 * Mendapatkan jam selesai kerja berdasarkan tipe hari kerja
 * @param workdayType Tipe hari kerja
 * @returns string format jam "HH:mm"
 */
export function getWorkEndTime(workdayType: WorkdayType): string {
  if (workdayType === WorkdayType.SUNDAY) return ""; // Minggu tidak ada jam kerja
  if (workdayType === WorkdayType.SATURDAY) return WORK_HOURS.END_TIME.SATURDAY;
  return WORK_HOURS.END_TIME.WEEKDAY;
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
  isSundayWorkApproved: boolean = false
): AttendanceStatus {
  if (!checkInTime) return AttendanceStatus.ABSENT;
  
  const workdayType = getWorkdayType(date);
  
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
    `${format(date, "yyyy-MM-dd")} ${WORK_HOURS.LATE_THRESHOLD}`, 
    "yyyy-MM-dd HH:mm", 
    new Date()
  );
  
  // Check apakah check-in setelah threshold keterlambatan
  if (isAfter(checkInTime, lateThresholdTime)) {
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
export function calculateLateMinutes(checkInTime: Date | null, date: Date): number {
  if (!checkInTime) return 0;
  
  const workdayType = getWorkdayType(date);
  
  // Jika hari Minggu, tidak ada keterlambatan
  if (workdayType === WorkdayType.SUNDAY) return 0;
  
  // Parse waktu mulai kerja untuk tanggal tersebut
  const workStartTime = parse(
    `${format(date, "yyyy-MM-dd")} ${getWorkStartTime(workdayType)}`, 
    "yyyy-MM-dd HH:mm", 
    new Date()
  );
  
  // Jika check-in sebelum waktu mulai kerja, tidak ada keterlambatan
  if (isBefore(checkInTime, workStartTime)) return 0;
  
  // Hitung selisih menit
  return differenceInMinutes(checkInTime, workStartTime);
}

/**
 * Menghitung menit lembur berdasarkan waktu check-out dan persetujuan
 * @param checkOutTime Waktu check-out
 * @param date Tanggal
 * @param isOvertimeApproved Apakah lembur disetujui
 * @param isSundayWorkApproved Apakah kerja hari Minggu disetujui
 * @returns Menit lembur (0 jika tidak lembur atau tidak disetujui)
 */
export function calculateOvertimeMinutes(
  checkOutTime: Date | null, 
  date: Date, 
  isOvertimeApproved: boolean = false,
  isSundayWorkApproved: boolean = false
): number {
  if (!checkOutTime) return 0;
  
  const workdayType = getWorkdayType(date);
  
  // Jika hari Minggu, lembur hanya dihitung jika disetujui admin
  if (workdayType === WorkdayType.SUNDAY) {
    // Jika tidak disetujui, tidak ada lembur
    if (!isSundayWorkApproved) return 0;
    
    // Jika disetujui, hitung total menit bekerja pada hari Minggu
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    // Batasi perhitungan dari jam check-out sampai maksimal jam 07:00 keesokan harinya
    const nextDayLimit = new Date(addDays(date, 1));
    nextDayLimit.setHours(7, 0, 0, 0);
    
    const endTime = isBefore(checkOutTime, nextDayLimit) ? checkOutTime : nextDayLimit;
    return differenceInMinutes(endTime, startOfDay);
  }
  
  // Untuk hari kerja normal, lembur hanya dihitung jika disetujui admin
  if (!isOvertimeApproved) return 0;
  
  // Parse waktu selesai kerja untuk tanggal tersebut
  const workEndTime = parse(
    `${format(date, "yyyy-MM-dd")} ${getWorkEndTime(workdayType)}`, 
    "yyyy-MM-dd HH:mm", 
    new Date()
  );
  
  // Jika check-out sebelum waktu selesai kerja, tidak ada lembur
  if (isBefore(checkOutTime, workEndTime)) return 0;
  
  // Batasi perhitungan lembur hingga maksimal jam 07:00 keesokan harinya
  const overtimeLimit = new Date(addDays(date, 1));
  overtimeLimit.setHours(7, 0, 0, 0);
  
  // Jika check-out setelah batas lembur, gunakan batas lembur
  const endTime = isAfter(checkOutTime, overtimeLimit) ? overtimeLimit : checkOutTime;
  
  // Hitung selisih menit
  return differenceInMinutes(endTime, workEndTime);
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