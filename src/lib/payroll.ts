import { prisma } from "@/lib/prisma";
import { Status } from "@/generated/prisma/enums";

// Konstanta untuk perhitungan penggajian
const OVERTIME_RATE_PER_HOUR = 1.5; // 1.5x dari gaji dasar per jam
const LATE_PENALTY_PER_MINUTE = 0.01; // Pengurangan 1% per menit keterlambatan
const ABSENCE_PENALTY_PER_DAY = 1.0; // Pengurangan 100% gaji per hari untuk absen tanpa izin

/**
 * Menghitung gaji karyawan per jam
 */
const calculateHourlyRate = (basicSalary: number): number => {
  // Asumsi 22 hari kerja per bulan, 8.5 jam per hari
  return basicSalary / (22 * 8.5);
};

/**
 * Menghitung gaji per hari
 */
const calculateDailyRate = (basicSalary: number): number => {
  // Asumsi 22 hari kerja per bulan
  return basicSalary / 22;
};

/**
 * Menghitung total potongan untuk keterlambatan
 */
const calculateLateDeductions = async (employeeId: string, month: number, year: number): Promise<number> => {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);
  
  const attendances = await prisma.attendance.findMany({
    where: {
      employeeId,
      date: {
        gte: startDate,
        lte: endDate,
      },
      isLate: true,
    },
  });

  // Ambil gaji dasar karyawan
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
  });

  if (!employee) {
    throw new Error("Karyawan tidak ditemukan");
  }

  const dailyRate = calculateDailyRate(employee.basicSalary);
  let totalDeduction = 0;

  // Hitung total potongan berdasarkan menit keterlambatan
  for (const attendance of attendances) {
    const lateMinutes = attendance.lateMinutes;
    // Potongan per menit terlambat (maksimal 100% gaji harian)
    const deduction = Math.min(
      dailyRate * LATE_PENALTY_PER_MINUTE * lateMinutes,
      dailyRate
    );
    totalDeduction += deduction;

    // Catat potongan
    await prisma.deduction.create({
      data: {
        employeeId,
        month,
        year,
        reason: `Keterlambatan ${attendance.date.toLocaleDateString()} (${lateMinutes} menit)`,
        amount: deduction,
        type: "LATE",
      },
    });
  }

  return totalDeduction;
};

/**
 * Menghitung total potongan untuk ketidakhadiran
 */
const calculateAbsenceDeductions = async (employeeId: string, month: number, year: number): Promise<number> => {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);
  
  const absences = await prisma.attendance.findMany({
    where: {
      employeeId,
      date: {
        gte: startDate,
        lte: endDate,
      },
      status: Status.ABSENT,
    },
  });

  // Ambil gaji dasar karyawan
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
  });

  if (!employee) {
    throw new Error("Karyawan tidak ditemukan");
  }

  const dailyRate = calculateDailyRate(employee.basicSalary);
  const totalDeduction = absences.length * dailyRate * ABSENCE_PENALTY_PER_DAY;

  // Catat potongan absensi jika ada
  if (absences.length > 0) {
    await prisma.deduction.create({
      data: {
        employeeId,
        month,
        year,
        reason: `Ketidakhadiran (${absences.length} hari)`,
        amount: totalDeduction,
        type: "ABSENCE",
      },
    });
  }

  return totalDeduction;
};

/**
 * Menghitung total jam lembur dan jumlah pembayaran lembur
 */
const calculateOvertime = async (employeeId: string, month: number, year: number): Promise<{ hours: number, amount: number }> => {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);
  
  const attendances = await prisma.attendance.findMany({
    where: {
      employeeId,
      date: {
        gte: startDate,
        lte: endDate,
      },
      overtime: {
        gt: 0,
      },
    },
  });

  // Ambil gaji dasar karyawan
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
  });

  if (!employee) {
    throw new Error("Karyawan tidak ditemukan");
  }

  const hourlyRate = calculateHourlyRate(employee.basicSalary);
  let totalOvertimeMinutes = 0;

  // Hitung total menit lembur
  for (const attendance of attendances) {
    totalOvertimeMinutes += attendance.overtime;
  }

  // Konversi menit ke jam
  const totalOvertimeHours = totalOvertimeMinutes / 60;
  
  // Hitung jumlah pembayaran lembur
  const overtimeAmount = totalOvertimeHours * hourlyRate * OVERTIME_RATE_PER_HOUR;

  return {
    hours: totalOvertimeHours,
    amount: overtimeAmount,
  };
};

/**
 * Menghitung total tunjangan karyawan
 */
const calculateTotalAllowances = async (employeeId: string, month: number, year: number): Promise<number> => {
  const allowances = await prisma.allowance.findMany({
    where: {
      employeeId,
      month,
      year,
    },
  });

  return allowances.reduce((total, allowance) => total + allowance.amount, 0);
};

/**
 * Menghitung dan membuat slip gaji bulanan
 */
export const generateMonthlyPayroll = async (employeeId: string, month: number, year: number) => {
  // Ambil data karyawan
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    include: {
      user: true,
    },
  });

  if (!employee) {
    throw new Error("Karyawan tidak ditemukan");
  }

  // Cek apakah slip gaji untuk bulan ini sudah ada
  const existingPayroll = await prisma.payroll.findFirst({
    where: {
      employeeId,
      month,
      year,
    },
  });

  if (existingPayroll) {
    throw new Error("Slip gaji untuk bulan ini sudah dibuat");
  }

  // Ambil data kehadiran
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);
  const totalDays = endDate.getDate();
  
  const attendances = await prisma.attendance.findMany({
    where: {
      employeeId,
      date: {
        gte: startDate,
        lte: endDate,
      },
    },
  });

  // Hitung jumlah hari hadir, terlambat, dan absen
  const daysPresent = attendances.filter(a => a.status === Status.PRESENT || a.status === Status.LEAVE).length;
  const daysLate = attendances.filter(a => a.status === Status.LATE).length;
  const daysAbsent = attendances.filter(a => a.status === Status.ABSENT).length;

  // Hitung potongan keterlambatan
  const lateDeduction = await calculateLateDeductions(employeeId, month, year);

  // Hitung potongan ketidakhadiran
  const absenceDeduction = await calculateAbsenceDeductions(employeeId, month, year);

  // Hitung lembur
  const overtime = await calculateOvertime(employeeId, month, year);

  // Hitung tunjangan
  const totalAllowances = await calculateTotalAllowances(employeeId, month, year);

  // Hitung total potongan
  const totalDeductions = lateDeduction + absenceDeduction;

  // Hitung gaji bersih
  const netSalary = employee.basicSalary - totalDeductions + overtime.amount + totalAllowances;

  // Buat slip gaji
  const payroll = await prisma.payroll.create({
    data: {
      employeeId,
      month,
      year,
      baseSalary: employee.basicSalary,
      totalAllowances,
      totalDeductions,
      netSalary,
      daysPresent,
      daysAbsent,
      daysLate,
      overtimeHours: overtime.hours,
      overtimeAmount: overtime.amount,
      lateDeduction,
      status: "PENDING",
    },
  });

  // Buat notifikasi untuk karyawan
  await prisma.notification.create({
    data: {
      userId: employee.userId,
      title: "Slip Gaji Tersedia",
      message: `Slip gaji Anda untuk bulan ${month}/${year} telah tersedia. Silakan periksa di halaman Penggajian.`,
      type: "info",
    },
  });

  return payroll;
};

/**
 * Mengambil slip gaji bulanan karyawan
 */
export const getEmployeePayroll = async (employeeId: string, month: number, year: number) => {
  return prisma.payroll.findFirst({
    where: {
      employeeId,
      month,
      year,
    },
    include: {
      employee: {
        include: {
          user: {
            select: {
              name: true,
              email: true,
            },
          },
        },
      },
    },
  });
};

/**
 * Mengambil semua slip gaji karyawan
 */
export const getAllEmployeePayrolls = async (employeeId: string) => {
  return prisma.payroll.findMany({
    where: {
      employeeId,
    },
    orderBy: [
      { year: "desc" },
      { month: "desc" },
    ],
  });
};

/**
 * Memperbarui status slip gaji menjadi PAID
 */
export const markPayrollAsPaid = async (payrollId: string) => {
  const payroll = await prisma.payroll.findUnique({
    where: { id: payrollId },
    include: {
      employee: true,
    },
  });

  if (!payroll) {
    throw new Error("Slip gaji tidak ditemukan");
  }

  if (payroll.status === "PAID") {
    throw new Error("Slip gaji ini sudah dibayarkan");
  }

  // Update status slip gaji
  const updatedPayroll = await prisma.payroll.update({
    where: { id: payrollId },
    data: {
      status: "PAID",
      paidAt: new Date(),
    },
  });

  // Buat notifikasi untuk karyawan
  await prisma.notification.create({
    data: {
      userId: payroll.employee.userId,
      title: "Gaji Telah Dibayarkan",
      message: `Gaji Anda untuk bulan ${payroll.month}/${payroll.year} telah dibayarkan.`,
      type: "success",
    },
  });

  return updatedPayroll;
};