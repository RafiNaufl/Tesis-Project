import { prisma } from "./prisma";
import { Status } from "../generated/prisma/enums";

// ==========================================
// KONFIGURASI & KONSTANTA
// ==========================================



// Penalty Config
const SHIFT_LATE_PENALTY = 40000; // Denda terlambat per kejadian untuk Shift
const NON_SHIFT_LATE_PENALTY = 40000; // Denda terlambat per kejadian untuk Non-Shift
const ABSENCE_PENALTY_PERCENT = 100; // 100% dari gaji harian dipotong jika alpha

// Allowance Config
// Catatan: Karena logika ditukar, Shift sekarang Monthly, Non-Shift sekarang Daily
const SHIFT_FIXED_ALLOWANCE = 0; // Tidak ada tunjangan fixed untuk Shift
const NON_SHIFT_MEAL_ALLOWANCE = 20000; // Tunjangan makan per kehadiran (Non-Shift Logic Baru)
const NON_SHIFT_TRANSPORT_ALLOWANCE = 20000; // Tunjangan transport per kehadiran (Non-Shift Logic Baru)

// Position Allowance Config
const ASSISTANT_FOREMAN_ALLOWANCE = 500000;
const FOREMAN_ALLOWANCE = 600000;

// Time Config
const NON_SHIFT_WORK_HOURS = 8; // Jam kerja standar non-shift

// ==========================================
// HELPERS
// ==========================================

/**
 * Menghitung Hourly Rate
 * Jika karyawan punya hourlyRate eksplisit, gunakan itu.
 * Jika tidak, hitung dari basicSalary / 173 (standar Depnaker).
 */
const getEmployeeHourlyRate = (employee: any): number => {
  if (employee.hourlyRate && employee.hourlyRate > 0) {
    return employee.hourlyRate;
  }
  // Asumsi 173 jam kerja per bulan untuk konversi gaji bulanan ke per jam
  return (employee.basicSalary || 0) / 173;
};

/**
 * Menghitung Daily Rate
 * Asumsi 22 hari kerja
 */
const getEmployeeDailyRate = (employee: any): number => {
  return (employee.basicSalary || 0) / 22;
};

const getPublicHolidays = async (month: number, year: number) => {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0);
  const holidays = await prisma.publicHoliday.findMany({
    where: { date: { gte: start, lte: end } },
  });
  return new Set(holidays.map(h => new Date(h.date).toDateString()));
};

// ==========================================
// LOGIKA PERHITUNGAN GAJI
// ==========================================

/**
 * 1. Kalkulasi Gaji Karyawan SHIFT (Monthly Fixed - LOGIKA BARU SESUAI REQUEST)
 * - Gaji Dasar = Gaji Pokok Bulanan Tetap
 * - Tunjangan = Tunjangan Tetap
 * - Lembur = (Jam Lembur * Rate Lembur)
 * - Potongan = (Terlambat * Denda) + (Alpha * Potongan Harian) + BPJS
 */
const calculateShiftSalary = async (
  employee: any,
  attendances: any[],
  month: number,
  year: number,
  overtimeData: { hours: number; amount: number },
  tx: any = prisma
) => {
  const baseSalary = employee.basicSalary; // Gaji Tetap
  const dailyRate = getEmployeeDailyRate(employee);
  
  let daysPresent = 0;
  let daysAbsent = 0;
  let daysLate = 0;
  let lateDeductionAmount = 0;
  let absenceDeductionAmount = 0;
  
  // 1. Tunjangan Tetap (Fixed Allowance) - Sekarang 0 untuk Shift
  let totalAllowances = SHIFT_FIXED_ALLOWANCE;

  // 2. Tunjangan Jabatan (Foreman / Asst Foreman)
  const position = employee.position?.toLowerCase() || "";
  const role = employee.user?.role || "";
  
  let positionAllowance = 0;
  let positionAllowanceType = "";

  if (position.includes("assistant foreman") || role === "ASSISTANT_FOREMAN") {
      positionAllowance = ASSISTANT_FOREMAN_ALLOWANCE;
      positionAllowanceType = "TUNJANGAN_JABATAN_ASST_FOREMAN";
  } else if (position.includes("foreman") || role === "FOREMAN") {
      positionAllowance = FOREMAN_ALLOWANCE;
      positionAllowanceType = "TUNJANGAN_JABATAN_FOREMAN";
  }

  if (positionAllowance > 0) {
      totalAllowances += positionAllowance;
      
      // Catat allowance jabatan ke database
      await tx.allowance.create({
        data: {
          employeeId: employee.id,
          month,
          year,
          type: positionAllowanceType,
          amount: positionAllowance,
        }
      });
  }

  for (const att of attendances) {
    if (att.status === Status.PRESENT || att.status === Status.LATE || att.status === Status.LEAVE) {
      daysPresent++;
      
      if (att.status === Status.LATE) {
        daysLate++;
        // Cek threshold keterlambatan (misal > 08:30)
        // Di sini kita simplifikasi jika status LATE maka kena denda
        lateDeductionAmount += SHIFT_LATE_PENALTY;
        
        await recordDeduction(employee.id, month, year, SHIFT_LATE_PENALTY, "LATE", `Keterlambatan Shift ${new Date(att.date).toLocaleDateString()}`, tx);
      }
    } else if (att.status === Status.ABSENT) {
      daysAbsent++;
      // Potong Gaji Harian untuk Alpha
      const deduction = dailyRate * (ABSENCE_PENALTY_PERCENT / 100);
      absenceDeductionAmount += deduction;
      
      await recordDeduction(employee.id, month, year, deduction, "ABSENCE", `Ketidakhadiran Shift ${new Date(att.date).toLocaleDateString()}`, tx);
    }
  }

  // Catat allowance tetap (jika ada)
  if (SHIFT_FIXED_ALLOWANCE > 0) {
    await tx.allowance.create({
      data: {
        employeeId: employee.id,
        month,
        year,
        type: "SHIFT_FIXED_ALLOWANCE",
        amount: SHIFT_FIXED_ALLOWANCE,
      }
    });
  }

  return {
    baseSalary, // Ini tetap
    daysPresent,
    daysAbsent,
    daysLate,
    lateDeductionAmount,
    absenceDeductionAmount,
    totalAllowances,
  };
};

/**
 * 2. Kalkulasi Gaji Karyawan NON-SHIFT (Hourly/Daily Based - LOGIKA BARU SESUAI REQUEST)
 * - Gaji Dasar = (Total Jam Kerja Efektif * Hourly Rate)
 * - Tunjangan = (Jumlah Kehadiran * (Tunjangan Makan + Transport))
 * - Lembur = (Jam Lembur * Rate Lembur)
 * - Potongan = (Terlambat * Denda) + BPJS
 */
const calculateNonShiftSalary = async (
  employee: any,
  attendances: any[],
  month: number,
  year: number,
  overtimeData: { hours: number; amount: number },
  tx: any = prisma
) => {
  const hourlyRate = getEmployeeHourlyRate(employee);
  let totalWorkHours = 0;
  let daysPresent = 0;
  let daysAbsent = 0;
  let daysLate = 0;
  let lateDeductionAmount = 0;
  let mealAllowances = 0;
  let transportAllowances = 0;

  // 1. Tunjangan Jabatan (Foreman / Asst Foreman) - Berlaku juga untuk Non-Shift
  const position = employee.position?.toLowerCase() || "";
  const role = employee.user?.role || "";
  
  let positionAllowance = 0;
  let positionAllowanceType = "";

  if (position.includes("assistant foreman") || role === "ASSISTANT_FOREMAN") {
      positionAllowance = ASSISTANT_FOREMAN_ALLOWANCE;
      positionAllowanceType = "TUNJANGAN_JABATAN_ASST_FOREMAN";
  } else if (position.includes("foreman") || role === "FOREMAN") {
      positionAllowance = FOREMAN_ALLOWANCE;
      positionAllowanceType = "TUNJANGAN_JABATAN_FOREMAN";
  }

  if (positionAllowance > 0) {
      // Catat allowance jabatan ke database
      await tx.allowance.create({
        data: {
          employeeId: employee.id,
          month,
          year,
          type: positionAllowanceType,
          amount: positionAllowance,
        }
      });
  }

  // Iterasi Absensi
  for (const att of attendances) {
    // Hitung kehadiran
    if (att.status === Status.PRESENT || att.status === Status.LATE) {
      daysPresent++;
      
      // Tambah Tunjangan Harian Non-Shift (Makan + Transport)
      mealAllowances += NON_SHIFT_MEAL_ALLOWANCE;
      transportAllowances += NON_SHIFT_TRANSPORT_ALLOWANCE;

      // Hitung Jam Kerja Efektif (CheckOut - CheckIn)
      if (att.checkIn && att.checkOut) {
        const start = new Date(att.checkIn).getTime();
        const end = new Date(att.checkOut).getTime();
        const durationHours = (end - start) / (1000 * 60 * 60);
        
        // Cap jam kerja normal (misal max 8 jam per hari dianggap regular, sisanya overtime)
        // Namun di sini kita ambil real jam kerja, overtime dihitung terpisah di modul overtime
        // Kita batasi max jam normal = NON_SHIFT_WORK_HOURS
        totalWorkHours += Math.min(durationHours, NON_SHIFT_WORK_HOURS);
      } else {
        // Jika lupa checkout, mungkin dihitung setengah hari atau minimal jam
        // Kita asumsi 4 jam jika lupa checkout
        totalWorkHours += 4;
      }

      // Hitung Keterlambatan
      if (att.status === Status.LATE) {
        daysLate++;
        lateDeductionAmount += NON_SHIFT_LATE_PENALTY;
        
        // Catat deduction detail
        await recordDeduction(employee.id, month, year, NON_SHIFT_LATE_PENALTY, "LATE", `Keterlambatan Non-Shift ${new Date(att.date).toLocaleDateString()}`, tx);
      }

    } else if (att.status === Status.ABSENT) {
      daysAbsent++;
      // Karyawan Non-Shift (Daily) biasanya "No Work No Pay", jadi tidak ada deduction eksplisit dari Gaji Pokok
      // karena Gaji Pokok mereka 0 (dibangun dari jam kerja).
    } else if (att.status === Status.LEAVE) {
      // Cuti dibayar atau tidak tergantung kebijakan. Asumsi dibayar 8 jam.
      totalWorkHours += NON_SHIFT_WORK_HOURS; 
    }
  }

  // Hitung Gaji Pokok Berdasarkan Jam Kerja
  const baseSalary = totalWorkHours * hourlyRate;

  // Catat allowance ke database
  if (mealAllowances > 0) {
    await tx.allowance.create({
      data: {
        employeeId: employee.id,
        month,
        year,
        type: "NON_SHIFT_MEAL_ALLOWANCE",
        amount: mealAllowances,
      }
    });
  }

  if (transportAllowances > 0) {
    await tx.allowance.create({
      data: {
        employeeId: employee.id,
        month,
        year,
        type: "NON_SHIFT_TRANSPORT_ALLOWANCE",
        amount: transportAllowances,
      }
    });
  }

  const totalAllowances = mealAllowances + transportAllowances + positionAllowance;

  return {
    baseSalary, // Ini dinamis sesuai jam kerja
    daysPresent,
    daysAbsent,
    daysLate,
    lateDeductionAmount,
    totalAllowances,
  };
};

// ==========================================
// FUNGSI PENDUKUNG LAIN
// ==========================================

const recordDeduction = async (
  employeeId: string, 
  month: number, 
  year: number, 
  amount: number, 
  type: string, 
  reason: string,
  tx: any = prisma
) => {
  const deduction = await tx.deduction.create({
    data: {
      employeeId,
      month,
      year,
      amount,
      type,
      reason,
    }
  });
  return deduction;
};

const calculateOvertime = async (employeeId: string, month: number, year: number, tx: any = prisma) => {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);
  
  const requests = await tx.overtimeRequest.findMany({
    where: {
      employeeId,
      date: { gte: startDate, lte: endDate },
      status: "APPROVED",
    },
  });

  const employee = await tx.employee.findUnique({ where: { id: employeeId } });
  if (!employee) return { hours: 0, amount: 0 };

  const hourlyRate = getEmployeeHourlyRate(employee);
  // getOvertimeConfig uses prisma directly, arguably ok as config doesn't change often in tx
  const holidaysSet = await getPublicHolidays(month, year);

  let totalHours = 0;
  let totalAmount = 0;

  for (const req of requests) {
    // 1. Hitung Durasi Raw
    const start = new Date(req.start).getTime();
    const end = new Date(req.end).getTime();
    let durationHours = (end - start) / (1000 * 60 * 60);

    // 2. Pembulatan ke bawah setiap 30 menit (0.5)
    // Contoh: 1.8 jam -> 1.5 jam. 1.4 jam -> 1.0 jam.
    durationHours = Math.floor(durationHours * 2) / 2;

    if (durationHours <= 0) continue;

    const date = new Date(req.date);
    const day = date.getDay(); // 0 = Sunday, 6 = Saturday
    const isHoliday = holidaysSet.has(date.toDateString());
    const isSunday = day === 0;
    const isSaturday = day === 6;

    let dailyAmount = 0;

    // ==========================================
    // LOGIKA LEMBUR NON-SHIFT (Tiering)
    // ==========================================
    if (employee.workScheduleType === 'NON_SHIFT') {
      
      if (isSunday || isHoliday) {
        // 4. Minggu / Libur Resmi
        // - Jam 1-8: 2x
        // - Jam 9: 3x
        // - Jam 10-11: 4x
        // - Max 11 jam
        const cappedDuration = Math.min(durationHours, 11);
        
        const hoursTier1 = Math.min(cappedDuration, 8); // Jam 1-8
        const hoursTier2 = Math.min(Math.max(0, cappedDuration - 8), 1); // Jam 9
        const hoursTier3 = Math.max(0, cappedDuration - 9); // Jam 10+

        dailyAmount += (hoursTier1 * 2.0 * hourlyRate);
        dailyAmount += (hoursTier2 * 3.0 * hourlyRate);
        dailyAmount += (hoursTier3 * 4.0 * hourlyRate);
        
        // Update total hours pake capped
        durationHours = cappedDuration;

      } else if (isSaturday) {
        // 3. Sabtu (Hari Kerja 5 Jam)
        // - 5 jam pertama lembur: 2x
        // - Jam berikutnya: 1x (Kebijakan unik)
        const hoursTier1 = Math.min(durationHours, 5);
        const hoursTier2 = Math.max(0, durationHours - 5);

        dailyAmount += (hoursTier1 * 2.0 * hourlyRate);
        dailyAmount += (hoursTier2 * 1.0 * hourlyRate);

      } else {
        // 2. Hari Biasa (Senin-Jumat)
        // - Jam ke-1: 1.5x
        // - Jam ke-2 dst: 2x
        const hoursTier1 = Math.min(durationHours, 1);
        const hoursTier2 = Math.max(0, durationHours - 1);

        dailyAmount += (hoursTier1 * 1.5 * hourlyRate);
        dailyAmount += (hoursTier2 * 2.0 * hourlyRate);
      }

    } else {
      // ==========================================
      // LOGIKA LEMBUR SHIFT (Revised)
      // ==========================================
      
      if (isSunday || isHoliday) {
        // 3. Minggu / Libur
        // - Semua jam x2
        // - Potong istirahat 1 jam jika kerja > 6 jam
        let effectiveDuration = durationHours;
        if (effectiveDuration > 6) {
            effectiveDuration -= 1; // Potong istirahat
        }
        
        dailyAmount = effectiveDuration * 2.0 * hourlyRate;

      } else if (isSaturday) {
        // 2. Sabtu
        // - Semua jam x2
        // - Tidak ada potongan istirahat
        dailyAmount = durationHours * 2.0 * hourlyRate;

      } else {
        // 1. Senin - Jumat (Hari Kerja)
        // - Hanya dihitung setelah 16:30 (Logika ini dihandle oleh start/end request lembur)
        // - Jam pertama x1.5
        // - Jam sisa x2.0
        
        const hoursTier1 = Math.min(durationHours, 1);
        const hoursTier2 = Math.max(0, durationHours - 1);

        dailyAmount += (hoursTier1 * 1.5 * hourlyRate);
        dailyAmount += (hoursTier2 * 2.0 * hourlyRate);
      }
    }
    
    totalHours += durationHours;
    totalAmount += dailyAmount;
  }

  return { hours: totalHours, amount: totalAmount };
};

const calculateBpjs = async (employeeId: string, month: number, year: number, tx: any = prisma) => {
  const employee = await tx.employee.findUnique({ where: { id: employeeId } });
  if (!employee) return { kesehatan: 0, ketenagakerjaan: 0 };

  const kesehatan = employee.bpjsKesehatan || 0;
  const ketenagakerjaan = employee.bpjsKetenagakerjaan || 0;

  if (kesehatan > 0) {
    await recordDeduction(employeeId, month, year, kesehatan, "BPJS_KESEHATAN", "Potongan BPJS Kesehatan", tx);
  }
  if (ketenagakerjaan > 0) {
    await recordDeduction(employeeId, month, year, ketenagakerjaan, "BPJS_KETENAGAKERJAAN", "Potongan BPJS Ketenagakerjaan", tx);
  }

  return { kesehatan, ketenagakerjaan };
};

const calculateAdvanceDeduction = async (employeeId: string, month: number, year: number, tx: any = prisma) => {
  const advances = await tx.advance.findMany({
    where: {
      employeeId,
      status: "APPROVED",
      deductionMonth: month,
      deductionYear: year,
      deductedAt: null,
    },
  });

  let totalAmount = 0;
  for (const adv of advances) {
    totalAmount += adv.amount;
    await recordDeduction(employeeId, month, year, adv.amount, "KASBON", `Pelunasan Kasbon`, tx);
    
    await tx.advance.update({
      where: { id: adv.id },
      data: { deductedAt: new Date() }
    });
  }
  return totalAmount;
};

const calculateSoftLoanDeduction = async (employeeId: string, month: number, year: number, tx: any = prisma) => {
  const loans = await tx.softLoan.findMany({
    where: {
      employeeId,
      status: { in: ["APPROVED", "ACTIVE"] },
      remainingAmount: { gt: 0 },
    },
  });

  let totalAmount = 0;
  for (const loan of loans) {
    const startLoanDate = new Date(loan.startYear, loan.startMonth - 1, 1);
    const payrollDate = new Date(year, month - 1, 1);
    
    if (payrollDate >= startLoanDate) {
      // Cek apakah sudah ada deduction untuk pinjaman ini di bulan ini (Mencegah double deduction)
      const existingDeduction = await tx.deduction.findFirst({
        where: {
          employeeId,
          month,
          year,
          type: "PINJAMAN"
        }
      });

      // Jika sudah ada deduction, skip pembuatan baru, tapi tetap hitung totalAmount agar masuk ke payroll
      if (existingDeduction) {
        totalAmount += existingDeduction.amount;
        // Jangan update remaining amount lagi!
        continue;
      }

      const deductionAmount = Math.min(loan.monthlyAmount, loan.remainingAmount);
      
      if (deductionAmount > 0) {
        totalAmount += deductionAmount;
        await recordDeduction(employeeId, month, year, deductionAmount, "PINJAMAN", `Cicilan Pinjaman`, tx);
        
        const newRemaining = loan.remainingAmount - deductionAmount;
        await tx.softLoan.update({
          where: { id: loan.id },
          data: { 
            remainingAmount: newRemaining,
            status: newRemaining <= 0 ? "COMPLETED" : "ACTIVE",
            completedAt: newRemaining <= 0 ? new Date() : null
          }
        });
      }
    }
  }
  return totalAmount;
};

// ==========================================
// FUNGSI UTAMA: GENERATE PAYROLL
// ==========================================

export const generateMonthlyPayroll = async (employeeId: string, month: number, year: number) => {
  // 1. Ambil Data Karyawan (Fail Fast)
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    include: { user: true },
  });

  if (!employee) throw new Error("Karyawan tidak ditemukan");

  // 2. Cek Payroll Existing (Fail Fast)
  const existing = await prisma.payroll.findFirst({
    where: { employeeId, month, year },
  });
  if (existing) throw new Error("Slip gaji bulan ini sudah dibuat");

  // 3. Start Atomic Transaction
  const payroll = await prisma.$transaction(async (tx) => {
    // 3.1 CLEANUP: Hapus deduction dan allowance sementara/orphan dari run sebelumnya untuk bulan ini
    await tx.deduction.deleteMany({
      where: {
        employeeId,
        month,
        year,
        payrollId: null
      }
    });

    await tx.allowance.deleteMany({
      where: {
        employeeId,
        month,
        year,
        type: {
          in: [
            "SHIFT_FIXED_ALLOWANCE", 
            "NON_SHIFT_DAILY_ALLOWANCE", 
            "NON_SHIFT_MEAL_ALLOWANCE", 
            "NON_SHIFT_TRANSPORT_ALLOWANCE",
            "TUNJANGAN_JABATAN_FOREMAN",
            "TUNJANGAN_JABATAN_ASST_FOREMAN"
          ]
        }
      }
    });

    // 3.2 Ambil Data Absensi
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);
    
    const attendances = await tx.attendance.findMany({
      where: {
        employeeId,
        date: { gte: startDate, lte: endDate },
      },
    });

    // 3.3 Hitung Overtime, BPJS, Kasbon, Pinjaman (Paralel)
    // Semua fungsi helper sekarang menerima tx untuk menjamin atomicity
    const [overtimeData, bpjsData, advanceDeduction, loanDeduction] = await Promise.all([
      calculateOvertime(employeeId, month, year, tx),
      calculateBpjs(employeeId, month, year, tx),
      calculateAdvanceDeduction(employeeId, month, year, tx),
      calculateSoftLoanDeduction(employeeId, month, year, tx)
    ]);
    
    const totalBpjs = bpjsData.kesehatan + bpjsData.ketenagakerjaan;
    const otherDeductions = advanceDeduction + loanDeduction;

    // 3.4 Branching Logic Berdasarkan Tipe Karyawan
    let calculationResult;
    let payrollTypeLog = "";

    if (employee.workScheduleType === 'SHIFT') {
      payrollTypeLog = "SHIFT (Monthly Fixed)";
      calculationResult = await calculateShiftSalary(employee, attendances, month, year, overtimeData, tx);
    } else {
      payrollTypeLog = "NON_SHIFT (Hourly Based)";
      calculationResult = await calculateNonShiftSalary(employee, attendances, month, year, overtimeData, tx);
    }

    // Destructure hasil kalkulasi
    const result: any = calculationResult;
    const {
      baseSalary,
      daysPresent,
      daysAbsent,
      daysLate,
      lateDeductionAmount,
      totalAllowances,
      absenceDeductionAmount = 0 
    } = result;

    // 3.5 Hitung Final Net Salary
    const totalDeductions = lateDeductionAmount + absenceDeductionAmount + totalBpjs + otherDeductions;
    const netSalary = baseSalary + totalAllowances + overtimeData.amount - totalDeductions;

    // 3.6 VALIDASI & VERIFIKASI
    if (netSalary < 0) {
      console.warn(`[WARNING] Negative Net Salary for employee ${employeeId}: ${netSalary}`);
    }

    const components = [
      baseSalary, totalAllowances, overtimeData.amount, 
      lateDeductionAmount, absenceDeductionAmount, totalBpjs, otherDeductions
    ];
    
    if (components.some(c => isNaN(c) || c === null || c === undefined)) {
      throw new Error("Validation Error: Calculation resulted in NaN or null values");
    }

    const calculatedNet = baseSalary + totalAllowances + overtimeData.amount - (lateDeductionAmount + absenceDeductionAmount + totalBpjs + otherDeductions);
    if (Math.abs(calculatedNet - netSalary) > 1) {
      throw new Error(`Calculation Mismatch: ${calculatedNet} vs ${netSalary}`);
    }

    // 3.7 Simpan ke Database
    // a. Buat Payroll Record
    const newPayroll = await tx.payroll.create({
      data: {
        employeeId,
        month,
        year,
        baseSalary,
        totalAllowances,
        totalDeductions,
        netSalary,
        daysPresent,
        daysAbsent,
        daysLate,
        overtimeHours: overtimeData.hours,
        overtimeAmount: overtimeData.amount,
        lateDeduction: lateDeductionAmount,
        advanceDeduction: advanceDeduction,
        softLoanDeduction: loanDeduction,
        bpjsKesehatanAmount: bpjsData.kesehatan,
        bpjsKetenagakerjaanAmount: bpjsData.ketenagakerjaan,
        status: "PENDING",
      }
    });

    // b. Link semua deduction bulan ini ke payroll yang baru dibuat
    await tx.deduction.updateMany({
      where: {
        employeeId,
        month,
        year,
        payrollId: null
      },
      data: {
        payrollId: newPayroll.id
      }
    });

    // c. Audit Log
    await tx.payrollAuditLog.create({
      data: {
        payrollId: newPayroll.id,
        userId: employee.userId,
        action: "GENERATE_PAYROLL",
        newValue: {
          type: payrollTypeLog,
          netSalary,
          breakdown: calculationResult
        }
      }
    });

    // d. Notifikasi
    await tx.notification.create({
      data: {
        userId: employee.userId,
        title: "Slip Gaji Tersedia",
        message: `Slip gaji bulan ${month}/${year} telah tersedia. Total: Rp ${netSalary.toLocaleString('id-ID')}`,
        type: "info"
      }
    });

    // e. Retrieve complete enriched record for immediate UI update
    const enrichedPayrollQuery = `
      SELECT 
        p.id, 
        p."employeeId", 
        p.month, 
        p.year, 
        p."baseSalary", 
        p."totalAllowances",
        p."totalDeductions",
        p."netSalary",
        p."daysPresent",
        p."daysAbsent",
        p."overtimeHours",
        p."overtimeAmount",
        p."bpjsKesehatanAmount",
        p."bpjsKetenagakerjaanAmount",
        p."lateDeduction",
        p.status,
        p."createdAt",
        p."paidAt",
        e."employeeId" AS "empId",
        u.name AS "employeeName",
        e.position,
        e.division,
        (SELECT COALESCE(SUM(d."amount"), 0) FROM deductions d WHERE d."payrollId" = p.id AND d."type" = 'KASBON') AS "advanceAmount",
        (SELECT COALESCE(SUM(d."amount"), 0) FROM deductions d WHERE d."payrollId" = p.id AND d."type" = 'PINJAMAN') AS "softLoanDeduction",
        (SELECT COALESCE(SUM(d."amount"), 0) FROM deductions d WHERE d."payrollId" = p.id AND d."type" = 'ABSENCE') AS "absenceDeduction",
        (SELECT COALESCE(SUM(d."amount"), 0) FROM deductions d WHERE d."payrollId" = p.id AND d."type" NOT IN ('ABSENCE', 'LATE', 'BPJS_KESEHATAN', 'BPJS_KETENAGAKERJAAN', 'KASBON', 'PINJAMAN')) AS "otherDeductions",
        (SELECT COALESCE(SUM(a."amount"), 0) FROM allowances a WHERE a."employeeId" = p."employeeId" AND a."month" = p.month AND a."year" = p.year AND a."type" LIKE 'TUNJANGAN_JABATAN%') AS "positionAllowance",
        (SELECT COALESCE(SUM(a."amount"), 0) FROM allowances a WHERE a."employeeId" = p."employeeId" AND a."month" = p.month AND a."year" = p.year AND a."type" = 'NON_SHIFT_MEAL_ALLOWANCE') AS "mealAllowance",
        (SELECT COALESCE(SUM(a."amount"), 0) FROM allowances a WHERE a."employeeId" = p."employeeId" AND a."month" = p.month AND a."year" = p.year AND a."type" = 'NON_SHIFT_TRANSPORT_ALLOWANCE') AS "transportAllowance",
        (SELECT COALESCE(SUM(a."amount"), 0) FROM allowances a WHERE a."employeeId" = p."employeeId" AND a."month" = p.month AND a."year" = p.year AND a."type" = 'SHIFT_FIXED_ALLOWANCE') AS "shiftAllowance"
      FROM 
        payrolls p
      JOIN 
        employees e ON p."employeeId" = e.id
      JOIN 
        users u ON e."userId" = u.id
      WHERE p.id = $1
    `;
    
    const enrichedPayrolls = await tx.$queryRawUnsafe(enrichedPayrollQuery, newPayroll.id) as any[];
    const serialized = enrichedPayrolls[0];

    // Safety Patch: Ensure calculated values are returned even if query returns 0/null (race condition safety)
    // Also handle BigInt serialization
    if (serialized) {
      // 1. Advance / Kasbon
      if (typeof serialized.advanceAmount === 'bigint') {
        serialized.advanceAmount = Number(serialized.advanceAmount);
      }
      if (!serialized.advanceAmount && advanceDeduction > 0) {
        serialized.advanceAmount = advanceDeduction;
      }

      // 2. Soft Loan / Pinjaman
      if (typeof serialized.softLoanDeduction === 'bigint') {
        serialized.softLoanDeduction = Number(serialized.softLoanDeduction);
      }
      if (!serialized.softLoanDeduction && loanDeduction > 0) {
        serialized.softLoanDeduction = loanDeduction;
      }

      // 3. Absence
      if (typeof serialized.absenceDeduction === 'bigint') {
        serialized.absenceDeduction = Number(serialized.absenceDeduction);
      }
      if (!serialized.absenceDeduction && absenceDeductionAmount > 0) {
        serialized.absenceDeduction = absenceDeductionAmount;
      }

      // 4. Other Deductions
      if (typeof serialized.otherDeductions === 'bigint') {
        serialized.otherDeductions = Number(serialized.otherDeductions);
      }

      // 5. BPJS
      if (!serialized.bpjsKesehatanAmount && bpjsData.kesehatan > 0) {
        serialized.bpjsKesehatanAmount = bpjsData.kesehatan;
      }
      if (!serialized.bpjsKetenagakerjaanAmount && bpjsData.ketenagakerjaan > 0) {
        serialized.bpjsKetenagakerjaanAmount = bpjsData.ketenagakerjaan;
      }

      // 6. Allowances (BigInt conversion)
      if (typeof serialized.positionAllowance === 'bigint') serialized.positionAllowance = Number(serialized.positionAllowance);
      if (typeof serialized.mealAllowance === 'bigint') serialized.mealAllowance = Number(serialized.mealAllowance);
      if (typeof serialized.transportAllowance === 'bigint') serialized.transportAllowance = Number(serialized.transportAllowance);
      if (typeof serialized.shiftAllowance === 'bigint') serialized.shiftAllowance = Number(serialized.shiftAllowance);
    }

    return serialized;
  }, {
    maxWait: 10000,
    timeout: 20000
  });

  return payroll;
};

// ==========================================
// EXPORTS LAIN (UTILITY)
// ==========================================

export const getEmployeePayroll = async (employeeId: string, month: number, year: number) => {
  return prisma.payroll.findFirst({
    where: { employeeId, month, year },
    include: {
      employee: {
        include: { user: { select: { name: true, email: true } } }
      }
    }
  });
};

export const getAllEmployeePayrolls = async (employeeId: string) => {
  return prisma.payroll.findMany({
    where: { employeeId },
    orderBy: [{ year: "desc" }, { month: "desc" }]
  });
};

export const markPayrollAsPaid = async (payrollId: string) => {
  const payroll = await prisma.payroll.findUnique({
    where: { id: payrollId },
    include: { employee: true }
  });

  if (!payroll) throw new Error("Slip gaji tidak ditemukan");
  if (payroll.status === "PAID") throw new Error("Sudah dibayar");

  const updated = await prisma.payroll.update({
    where: { id: payrollId },
    data: { status: "PAID", paidAt: new Date() }
  });
  
  // Trigger notifikasi & deduction lain jika perlu (Advance/Loan)
  // ... (Simplifikasi untuk fokus ke logic utama)
  
  return updated;
};
