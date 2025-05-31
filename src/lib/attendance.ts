import { prisma } from "@/lib/prisma";
import { Status, LeaveStatus } from "@/generated/prisma";

// Waktu kerja standar
const WORK_START_TIME = 8 * 60; // 8:00 AM dalam menit (8 * 60)
const LATE_THRESHOLD = 8 * 60 + 30; // 8:30 AM dalam menit
const ABSENT_THRESHOLD = 9 * 60; // 9:00 AM dalam menit
const WORK_END_TIME = 16 * 60 + 30; // 4:30 PM dalam menit

/**
 * Menentukan status kehadiran berdasarkan waktu check-in
 */
export const getAttendanceStatus = (checkInTime: Date | null): Status => {
  if (!checkInTime) return Status.ABSENT;

  const hours = checkInTime.getHours();
  const minutes = checkInTime.getMinutes();
  const checkInMinutes = hours * 60 + minutes;

  if (checkInMinutes < WORK_START_TIME) {
    return Status.PRESENT;
  } else if (checkInMinutes < LATE_THRESHOLD) {
    return Status.PRESENT;
  } else if (checkInMinutes < ABSENT_THRESHOLD) {
    return Status.LATE;
  } else {
    return Status.ABSENT;
  }
};

/**
 * Menghitung keterlambatan dalam menit
 */
export const calculateLateMinutes = (checkInTime: Date | null): number => {
  if (!checkInTime) return 0;

  const hours = checkInTime.getHours();
  const minutes = checkInTime.getMinutes();
  const checkInMinutes = hours * 60 + minutes;

  if (checkInMinutes <= WORK_START_TIME) {
    return 0;
  } else {
    return checkInMinutes - WORK_START_TIME;
  }
};

/**
 * Menghitung lembur dalam menit
 */
export const calculateOvertime = (checkOutTime: Date | null): number => {
  if (!checkOutTime) return 0;

  const hours = checkOutTime.getHours();
  const minutes = checkOutTime.getMinutes();
  const checkOutMinutes = hours * 60 + minutes;

  if (checkOutMinutes <= WORK_END_TIME) {
    return 0;
  } else {
    return checkOutMinutes - WORK_END_TIME;
  }
};

/**
 * Mencatat kehadiran karyawan (check-in)
 */
export const recordCheckIn = async (employeeId: string) => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Cek apakah sudah ada catatan kehadiran untuk hari ini
  const existingAttendance = await prisma.attendance.findFirst({
    where: {
      employeeId,
      date: {
        gte: today,
        lt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
      },
    },
  });

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
        data: { status: Status.LEAVE, notes: `Approved leave: ${approvedLeave.type}` },
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

  // Hitung status kehadiran
  const status = getAttendanceStatus(now);
  const isLate = status === Status.LATE;
  const lateMinutes = calculateLateMinutes(now);

  if (existingAttendance) {
    // Jika sudah ada catatan, perbarui
    return prisma.attendance.update({
      where: { id: existingAttendance.id },
      data: {
        checkIn: now,
        status,
        isLate,
        lateMinutes,
      },
    });
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
      },
    });
  }
};

/**
 * Mencatat kehadiran karyawan (check-out)
 */
export const recordCheckOut = async (employeeId: string) => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Cari catatan kehadiran hari ini
  const attendance = await prisma.attendance.findFirst({
    where: {
      employeeId,
      date: {
        gte: today,
        lt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
      },
    },
  });

  if (!attendance) {
    throw new Error("No check-in record found for today");
  }

  // Hitung overtime
  const overtimeMinutes = calculateOvertime(now);

  // Update catatan dengan check-out dan overtime
  return prisma.attendance.update({
    where: { id: attendance.id },
    data: {
      checkOut: now,
      overtime: overtimeMinutes,
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
      date: 'asc',
    },
  });

  const totalDays = endDate.getDate();
  const daysPresent = attendances.filter(a => a.status === Status.PRESENT).length;
  const daysLate = attendances.filter(a => a.status === Status.LATE).length;
  const daysAbsent = attendances.filter(a => a.status === Status.ABSENT).length;
  const daysLeave = attendances.filter(a => a.status === Status.LEAVE).length;
  const totalOvertime = attendances.reduce((total, a) => total + a.overtime, 0);

  return {
    totalDays,
    daysPresent,
    daysLate,
    daysAbsent,
    daysLeave,
    totalOvertime,
    attendances,
  };
}; 