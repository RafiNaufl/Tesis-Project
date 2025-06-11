import { prisma } from "@/lib/prisma";
import { Status, LeaveStatus } from "@/generated/prisma";
import {
  getWorkdayType,
  WorkdayType,
  AttendanceStatus,
  calculateLateMinutes as calculateLateMinutesRule,
  calculateOvertimeMinutes,
  getAttendanceStatus as getAttendanceStatusRule,
  calculateLatePenalty,
  isOvertimeCheckIn,
  isOvertimeCheckOut,
  isWorkday,
  isSunday,
  generateApprovalMessage
} from "./attendanceRules";

// Import fungsi terkait tanggal
import { format, startOfDay, endOfDay, addDays } from "date-fns";

/**
 * Mengonversi AttendanceStatus ke Status Prisma
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
 * Menentukan status kehadiran berdasarkan waktu check-in
 */
export const getAttendanceStatus = (checkInTime: Date | null): Status => {
  if (!checkInTime) return Status.ABSENT;
  
  const status = getAttendanceStatusRule(checkInTime, new Date(checkInTime));
  return mapAttendanceStatus(status);
};

/**
 * Menghitung keterlambatan dalam menit
 */
export const calculateLateMinutes = (checkInTime: Date | null): number => {
  if (!checkInTime) return 0;
  return calculateLateMinutesRule(checkInTime, new Date(checkInTime));
};

/**
 * Menghitung lembur dalam menit
 */
export const calculateOvertime = (checkOutTime: Date | null, isOvertimeApproved: boolean = false, isSundayWorkApproved: boolean = false): number => {
  if (!checkOutTime) return 0;
  return calculateOvertimeMinutes(checkOutTime, new Date(checkOutTime), isOvertimeApproved, isSundayWorkApproved);
};

/**
 * Mencatat kehadiran karyawan (check-in)
 */
export const recordCheckIn = async (employeeId: string) => {
  const now = new Date();
  const today = startOfDay(now);
  const tomorrow = endOfDay(now);

  // Cek apakah sudah ada catatan kehadiran untuk hari ini
  const existingAttendance = await prisma.attendance.findFirst({
    where: {
      employeeId,
      date: {
        gte: today,
        lt: addDays(today, 1),
      },
    },
  });

  // Jika sudah ada catatan dengan check-in, cek apakah pengajuan sebelumnya ditolak
  if (existingAttendance && existingAttendance.checkIn) {
    // Jika catatan sebelumnya menunjukkan penolakan, izinkan check-in kembali
    const notesDitolak = existingAttendance.notes && existingAttendance.notes.includes("Di Tolak");
    const sudahDitolak = (existingAttendance.isSundayWorkApproved === false && existingAttendance.approvedAt !== null) ||
                          (existingAttendance.isOvertimeApproved === false && existingAttendance.approvedAt !== null);
    
    // Log untuk debugging
    console.log("Existing attendance:", {
      id: existingAttendance.id,
      checkIn: existingAttendance.checkIn,
      checkOut: existingAttendance.checkOut,
      notes: existingAttendance.notes,
      approvedAt: existingAttendance.approvedAt,
      isOvertimeApproved: existingAttendance.isOvertimeApproved,
      isSundayWorkApproved: existingAttendance.isSundayWorkApproved
    });
    console.log("Rejected status:", { notesDitolak, sudahDitolak });
    
    if (!notesDitolak && !sudahDitolak) {
      throw new Error("Anda sudah melakukan check-in hari ini");
    }
    // Jika sudah ditolak, lanjutkan dengan proses check-in baru
  }

  // Cek apakah karyawan memiliki izin cuti yang disetujui untuk hari ini
  const approvedLeave = await prisma.leave.findFirst({
    where: {
      employeeId,
      status: LeaveStatus.APPROVED,
      startDate: { lte: today },
      endDate: { gte: today },
    },
  });

  if (approvedLeave) {
    // Jika karyawan memiliki izin cuti, catat sebagai LEAVE
    if (existingAttendance) {
      return prisma.attendance.update({
        where: { id: existingAttendance.id },
        data: { 
          status: Status.LEAVE, 
          notes: `Approved leave: ${approvedLeave.type}`,
          // Reset status persetujuan sebelumnya jika ada
          approvedAt: null,
          approvedBy: null,
          isOvertimeApproved: false,
          isSundayWorkApproved: false 
        },
      });
    } else {
      return prisma.attendance.create({
        data: {
          employeeId,
          date: today,
          status: Status.LEAVE,
          notes: `Approved leave: ${approvedLeave.type}`,
        },
      });
    }
  }

  // Cek apakah hari ini adalah hari kerja
  const workdayType = getWorkdayType(now);
  const isSundayWorkday = workdayType === WorkdayType.SUNDAY;
  
  // Tentukan apakah check-in ini adalah lembur
  const isOvertimeEntry = isOvertimeCheckIn(now, now);
  
  // Flag untuk Sunday work
  const isSundayWork = isSundayWorkday;

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
  } else {
    // Jika belum ada catatan, buat baru
    return prisma.attendance.create({
      data: {
        employeeId,
        date: today,
        checkIn: now,
        status,
        isLate,
        lateMinutes,
        isSundayWork,
        isOvertimeApproved: false, // Default tidak disetujui
        isSundayWorkApproved: false, // Default tidak disetujui
      },
    });
  }
};

/**
 * Mencatat kehadiran karyawan (check-out)
 */
export const recordCheckOut = async (employeeId: string) => {
  const now = new Date();
  const today = startOfDay(now);

  // Cari catatan kehadiran hari ini
  const attendance = await prisma.attendance.findFirst({
    where: {
      employeeId,
      date: {
        gte: today,
        lt: addDays(today, 1),
      },
    },
  });

  if (!attendance) {
    throw new Error("No check-in record found for today");
  }

  // Cek apakah sudah checkout sebelumnya
  if (attendance.checkOut) {
    throw new Error("Anda sudah melakukan check-out hari ini");
  }

  // Cek apakah hari ini adalah hari kerja
  const workdayType = getWorkdayType(now);
  const isSundayWorkday = workdayType === WorkdayType.SUNDAY;
  
  // Hitung overtime berdasarkan persetujuan yang ada
  const isOvertimeApproved = attendance.isOvertimeApproved;
  const isSundayWorkApproved = attendance.isSundayWorkApproved;
  
  // Untuk saat ini, hitung overtime tanpa memperhitungkan persetujuan
  // Nanti admin bisa menyetujui dan overtime akan dihitung ulang
  const overtimeMinutes = calculateOvertimeMinutes(now, today, false, false);
  
  // Update catatan dengan check-out dan overtime
  const updatedAttendance = await prisma.attendance.update({
    where: { id: attendance.id },
    data: {
      checkOut: now,
      overtime: overtimeMinutes, // Simpan overtime meskipun belum disetujui
    },
  });
  
  // Log untuk debugging
  console.log("Updated attendance after checkout:", {
    id: updatedAttendance.id,
    checkIn: updatedAttendance.checkIn,
    checkOut: updatedAttendance.checkOut,
    overtime: updatedAttendance.overtime
  });
  
  return updatedAttendance;
};

/**
 * Menyetujui lembur atau kerja hari Minggu
 */
export const approveOvertime = async (attendanceId: string, adminId: string) => {
  const attendance = await prisma.attendance.findUnique({
    where: { id: attendanceId },
  });

  if (!attendance) {
    throw new Error("Attendance record not found");
  }

  // Cek apakah ini hari Minggu
  const isSundayWorkday = isSunday(new Date(attendance.date));
  
  // Cek apakah ada lembur atau bekerja di hari Minggu
  const isOvertime = attendance.overtime > 0;

  // Hitung ulang overtime dengan persetujuan jika ada checkout
  let overtimeMinutes = attendance.overtime;
  if (attendance.checkOut) {
    overtimeMinutes = calculateOvertimeMinutes(
      new Date(attendance.checkOut), 
      new Date(attendance.date), 
      true, // Lembur disetujui
      isSundayWorkday // Jika hari Minggu, persetujuan Sunday work
    );
  }

  // Update status persetujuan
  return prisma.attendance.update({
    where: { id: attendanceId },
    data: {
      isOvertimeApproved: isOvertime,
      isSundayWorkApproved: isSundayWorkday,
      overtime: overtimeMinutes, // Update overtime dengan perhitungan baru
      approvedBy: adminId,
      approvedAt: new Date(),
      // Jika hari Minggu dan disetujui, update status menjadi PRESENT
      status: isSundayWorkday ? Status.PRESENT : attendance.status,
    },
  });
};

/**
 * Menolak lembur atau kerja hari Minggu
 */
export const rejectOvertime = async (attendanceId: string, adminId: string) => {
  const attendance = await prisma.attendance.findUnique({
    where: { id: attendanceId },
  });

  if (!attendance) {
    throw new Error("Attendance record not found");
  }

  // Cek apakah ini hari Minggu
  const isSundayWorkday = isSunday(new Date(attendance.date));
  
  // Tambahkan catatan penolakan
  let notes = attendance.notes || "";
  if (notes) {
    notes += " (Di Tolak)";
  } else {
    notes = "(Di Tolak)";
  }

  // Tentukan status absensi yang akan digunakan
  let statusAbsensi = attendance.status;
  
  // Jika hari Minggu dan ditolak, status menjadi ABSENT
  if (isSundayWorkday) {
    statusAbsensi = Status.ABSENT;
  } else {
    // Jika bukan hari Minggu, kembalikan ke status berdasarkan waktu check-in
    if (attendance.checkIn) {
      const status = getAttendanceStatusRule(new Date(attendance.checkIn), new Date(attendance.date));
      statusAbsensi = mapAttendanceStatus(status);
    }
  }

  // Update status persetujuan
  return prisma.attendance.update({
    where: { id: attendanceId },
    data: {
      isOvertimeApproved: false,
      isSundayWorkApproved: false,
      overtime: 0, // Reset overtime karena ditolak
      checkOut: null, // Reset checkout untuk memungkinkan pengajuan ulang
      notes, // Tambahkan catatan penolakan
      approvedBy: adminId,
      approvedAt: new Date(),
      status: statusAbsensi, // Gunakan status yang sudah ditentukan
    },
  });
};

/**
 * Mendapatkan laporan kehadiran bulanan untuk karyawan
 */
export const getMonthlyAttendanceReport = async (employeeId: string, year: number, month: number) => {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);

  const attendances = await prisma.attendance.findMany({
    where: {
      employeeId,
      date: {
        gte: startDate,
        lte: endDate,
      },
    },
    orderBy: {
      date: 'desc',
    },
  });

  // Menghitung jumlah hari kerja dalam bulan tersebut
  let workdays = 0;
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    if (isWorkday(new Date(d))) {
      workdays++;
    }
  }

  const totalDays = workdays; // Jumlah hari kerja dalam bulan ini
  const daysPresent = attendances.filter(a => a.status === Status.PRESENT).length;
  const daysLate = attendances.filter(a => a.status === Status.LATE).length;
  const daysAbsent = attendances.filter(a => a.status === Status.ABSENT).length;
  const daysLeave = attendances.filter(a => a.status === Status.LEAVE).length;
  
  // Hitung total overtime yang disetujui
  const totalApprovedOvertime = attendances.reduce((total, a) => {
    // Jika overtime disetujui atau hari Minggu disetujui, tambahkan ke total
    if ((a.isOvertimeApproved || a.isSundayWorkApproved) && a.overtime > 0) {
      return total + a.overtime;
    }
    return total;
  }, 0);
  
  // Hitung total denda keterlambatan
  const totalLatePenalty = daysLate * calculateLatePenalty(AttendanceStatus.LATE);

  return {
    totalDays,
    daysPresent,
    daysLate,
    daysAbsent,
    daysLeave,
    totalOvertime: totalApprovedOvertime, // Hanya overtime yang disetujui
    totalLatePenalty,
    attendances,
  };
};