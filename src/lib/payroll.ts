import { prisma } from "./prisma";
import { Status } from "@/types/enums";
import { getWorkdayType, WorkdayType } from "./attendanceRules";

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
const ASSISTANT_FOREMAN_ALLOWANCE = 240000;
const FOREMAN_ALLOWANCE = 240000;

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
// TYPES
// ==========================================

interface PayrollComponent {
  type: string;
  amount: number;
  reason?: string;
}

interface CalculationMeta {
  daysPresent: number;
  daysAbsent: number;
  daysLate: number;
  overtimeHours: number;
  overtimeAmount: number;
}

interface SalaryCalculationResult {
  baseSalary: number;
  allowances: PayrollComponent[];
  deductions: PayrollComponent[];
  meta: CalculationMeta;
}

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
const calculateShiftSalary = (
  employee: any,
  attendances: any[],
  overtimeData: { hours: number; amount: number }
): SalaryCalculationResult => {
  const baseSalary = employee.basicSalary; // Gaji Tetap
  const dailyRate = getEmployeeDailyRate(employee);
  
  let daysPresent = 0;
  let daysAbsent = 0;
  let daysLate = 0;
  
  const allowances: PayrollComponent[] = [];
  const deductions: PayrollComponent[] = [];

  // 1. Tunjangan Tetap (Fixed Allowance) - Sekarang 0 untuk Shift
  if (SHIFT_FIXED_ALLOWANCE > 0) {
    allowances.push({
      type: "SHIFT_FIXED_ALLOWANCE",
      amount: SHIFT_FIXED_ALLOWANCE
    });
  }

  // 2. Tunjangan Jabatan (Foreman / Asst Foreman)
  const position = employee.position?.toLowerCase() || "";
  const role = employee.user?.role || "";
  
  let positionAllowance = 0;

  if (position.includes("assistant foreman") || role === "ASSISTANT_FOREMAN") {
      positionAllowance = ASSISTANT_FOREMAN_ALLOWANCE;
      allowances.push({
        type: "TUNJANGAN_JABATAN_ASST_FOREMAN",
        amount: positionAllowance
      });
  } else if (position.includes("foreman") || role === "FOREMAN") {
      positionAllowance = FOREMAN_ALLOWANCE;
      allowances.push({
        type: "TUNJANGAN_JABATAN_FOREMAN",
        amount: positionAllowance
      });
  }

  for (const att of attendances) {
    if (att.status === Status.PRESENT || att.status === Status.LATE || att.status === Status.LEAVE) {
      daysPresent++;
      
      if (att.status === Status.LATE) {
        daysLate++;
        // Cek threshold keterlambatan (misal > 08:30)
        // Di sini kita simplifikasi jika status LATE maka kena denda
        deductions.push({
          type: "LATE",
          amount: SHIFT_LATE_PENALTY,
          reason: `Keterlambatan Shift ${new Date(att.date).toLocaleDateString()}`
        });
      }
    } else if (att.status === Status.ABSENT) {
      daysAbsent++;
      // Potong Gaji Harian untuk Alpha
      const deduction = dailyRate * (ABSENCE_PENALTY_PERCENT / 100);
      deductions.push({
        type: "ABSENCE",
        amount: deduction,
        reason: `Ketidakhadiran Shift ${new Date(att.date).toLocaleDateString()}`
      });
    }
  }

  return {
    baseSalary,
    allowances,
    deductions,
    meta: {
      daysPresent,
      daysAbsent,
      daysLate,
      overtimeHours: overtimeData.hours,
      overtimeAmount: overtimeData.amount
    }
  };
};

/**
 * 2. Kalkulasi Gaji Karyawan NON-SHIFT (Hourly/Daily Based - LOGIKA BARU SESUAI REQUEST)
 * - Gaji Dasar = (Total Jam Kerja Efektif * Hourly Rate)
 * - Tunjangan = (Jumlah Kehadiran * (Tunjangan Makan + Transport))
 * - Lembur = (Jam Lembur * Rate Lembur)
 * - Potongan = (Terlambat * Denda) + BPJS
 */
const calculateNonShiftSalary = (
  employee: any,
  attendances: any[],
  overtimeData: { hours: number; amount: number }
): SalaryCalculationResult => {
  const hourlyRate = getEmployeeHourlyRate(employee);
  let totalWorkHours = 0;
  let daysPresent = 0;
  let daysAbsent = 0;
  let daysLate = 0;
  
  const allowances: PayrollComponent[] = [];
  const deductions: PayrollComponent[] = [];
  
  let mealAllowances = 0;
  let transportAllowances = 0;

  // 1. Tunjangan Jabatan (Foreman / Asst Foreman) - Berlaku juga untuk Non-Shift
  const position = employee.position?.toLowerCase() || "";
  const role = employee.user?.role || "";
  
  let positionAllowance = 0;

  if (position.includes("assistant foreman") || role === "ASSISTANT_FOREMAN") {
      positionAllowance = ASSISTANT_FOREMAN_ALLOWANCE;
      allowances.push({
        type: "TUNJANGAN_JABATAN_ASST_FOREMAN",
        amount: positionAllowance
      });
  } else if (position.includes("foreman") || role === "FOREMAN") {
      positionAllowance = FOREMAN_ALLOWANCE;
      allowances.push({
        type: "TUNJANGAN_JABATAN_FOREMAN",
        amount: positionAllowance
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

      // Hitung Jam Kerja Efektif Berdasarkan Tipe Hari
      const dayType = getWorkdayType(new Date(att.date));
      let dailyHours = 0;
      
      if (dayType === WorkdayType.WEEKDAY) {
        dailyHours = 7.5; // Senin-Jumat: 7.5 jam
      } else if (dayType === WorkdayType.SATURDAY) {
        dailyHours = 10.0; // Sabtu: 5 jam kerja x 2 = 10 jam payable
      }
      // Minggu tidak dihitung sebagai jam kerja reguler (hanya lembur)
      
      totalWorkHours += dailyHours;

      // Hitung Keterlambatan
      if (att.status === Status.LATE) {
        daysLate++;
        deductions.push({
          type: "LATE",
          amount: NON_SHIFT_LATE_PENALTY,
          reason: `Keterlambatan Non-Shift ${new Date(att.date).toLocaleDateString()}`
        });
      }

    } else if (att.status === Status.ABSENT) {
      daysAbsent++;
      // Karyawan Non-Shift (Daily) biasanya "No Work No Pay", jadi tidak ada deduction eksplisit dari Gaji Pokok
      // karena Gaji Pokok mereka 0 (dibangun dari jam kerja).
    } else if (att.status === Status.LEAVE) {
      // Cuti dibayar sesuai jam kerja standar hari tersebut
      const dayType = getWorkdayType(new Date(att.date));
      if (dayType === WorkdayType.WEEKDAY) {
        totalWorkHours += 7.5;
      } else if (dayType === WorkdayType.SATURDAY) {
        totalWorkHours += 10.0;
      }
    }
  }

  // Hitung Gaji Pokok Berdasarkan Total Jam Kerja (Bukan Jumlah Hari x 8)
  const baseSalary = totalWorkHours * hourlyRate;

  // Catat allowance ke list
  if (mealAllowances > 0) {
    allowances.push({
      type: "NON_SHIFT_MEAL_ALLOWANCE",
      amount: mealAllowances
    });
  }

  if (transportAllowances > 0) {
    allowances.push({
      type: "NON_SHIFT_TRANSPORT_ALLOWANCE",
      amount: transportAllowances
    });
  }

  return {
    baseSalary,
    allowances,
    deductions,
    meta: {
      daysPresent,
      daysAbsent,
      daysLate,
      overtimeHours: overtimeData.hours,
      overtimeAmount: overtimeData.amount
    }
  };
};

// ==========================================
// FUNGSI PENDUKUNG LAIN
// ==========================================



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
      
      // Calculate raw duration first (before deductions)
      // durationHours passed from top is already rounded to 0.5
      
      // We need absolute times for Zone logic (mostly for cutoff checks)
      const reqEnd = new Date(req.end);
      
      if (isSaturday) {
         // Saturday Non-Shift Logic
         // 1. Standard Deduction: 1.0 hour (implied break 12:00-13:00 or during OT)
         let deduction = 1.0;
         
         // 2. Additional Deduction: 0.5 hour if ends after 18:30
         const cutOff1830 = new Date(req.date);
         cutOff1830.setHours(18, 30, 0, 0);
         
         if (reqEnd > cutOff1830) {
            deduction += 0.5;
         }
         
         // Apply deduction to duration
         const netDuration = Math.max(0, durationHours - deduction);
         
         // Calculate Payable Hours
         // Base Bonus: 5 hours (to upgrade 08-13 to 2x)
         // Zone 1 (13:00 - 16:30): 1x (Max 2.5 hours effective)
         // Zone 2 (> 16:30): 2x
         
         // Note: Zone 1 physical window is 13:00-16:30 (3.5h).
         // After 1.0h deduction, max effective Zone 1 is 2.5h.
         // Any net duration beyond 2.5h falls into Zone 2.
         
         const zone1 = Math.min(netDuration, 2.5);
          const zone2 = Math.max(0, netDuration - 2.5);
          
          const payableHours = (zone1 * 1.0) + (zone2 * 2.0);
          dailyAmount += (payableHours * hourlyRate);
          
          // Update durationHours for display/logging
          durationHours = netDuration;

      } else if (isSunday || isHoliday) {
        // Sunday / Holiday Non-Shift Logic (New Request)
        // All hours x2
        // Deduction: 1h if > 5h, 1.5h if > 11h
        
        let deduction = 0;
        if (durationHours > 11) {
             deduction = 1.5;
        } else if (durationHours > 5) {
             deduction = 1.0;
        }

        const effectiveDuration = Math.max(0, durationHours - deduction);
        
        dailyAmount += (effectiveDuration * 2.0 * hourlyRate);
        
        durationHours = effectiveDuration;

      } else {
        // Weekday
        // Generic 0.5h deduction if > 2h
        if (durationHours > 2) {
             durationHours -= 0.5;
        }

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

const calculateBpjs = (employee: any): { deductions: PayrollComponent[] } => {
  const deductions: PayrollComponent[] = [];
  const kesehatan = employee.bpjsKesehatan || 0;
  const ketenagakerjaan = employee.bpjsKetenagakerjaan || 0;

  if (kesehatan > 0) {
    deductions.push({
      type: "BPJS_KESEHATAN",
      amount: kesehatan,
      reason: "Potongan BPJS Kesehatan"
    });
  }
  if (ketenagakerjaan > 0) {
    deductions.push({
      type: "BPJS_KETENAGAKERJAAN",
      amount: ketenagakerjaan,
      reason: "Potongan BPJS Ketenagakerjaan"
    });
  }

  return { deductions };
};

interface AdvanceDeductionResult {
  totalAmount: number;
  deductions: PayrollComponent[];
  advancesToUpdate: string[];
}

const calculateAdvanceDeduction = (advances: any[]): AdvanceDeductionResult => {
  let totalAmount = 0;
  const deductions: PayrollComponent[] = [];
  const advancesToUpdate: string[] = [];

  for (const adv of advances) {
    totalAmount += adv.amount;
    deductions.push({
      type: "KASBON",
      amount: adv.amount,
      reason: "Pelunasan Kasbon"
    });
    advancesToUpdate.push(adv.id);
  }
  
  return { totalAmount, deductions, advancesToUpdate };
};

interface LoanDeductionResult {
  totalAmount: number;
  deductions: PayrollComponent[];
  loansToUpdate: { id: string; remainingAmount: number; status: string; completedAt: Date | null }[];
}

const calculateSoftLoanDeduction = (
  loans: any[], 
  existingDeductions: PayrollComponent[], 
  month: number, 
  year: number
): LoanDeductionResult => {
  // Jika sudah ada history potongan (dari run sebelumnya yang committed), 
  // kita assume loan balance SUDAH terupdate.
  // Kita kembalikan data existing tanpa mentrigger update baru.
  if (existingDeductions.length > 0) {
    const totalAmount = existingDeductions.reduce((sum, d) => sum + d.amount, 0);
    return {
      totalAmount,
      deductions: existingDeductions,
      loansToUpdate: [] 
    };
  }

  // Jika belum ada, hitung normal dan trigger update loan
  let totalAmount = 0;
  const deductions: PayrollComponent[] = [];
  const loansToUpdate: any[] = [];

  for (const loan of loans) {
    const startLoanDate = new Date(loan.startYear, loan.startMonth - 1, 1);
    const payrollDate = new Date(year, month - 1, 1);
    
    if (payrollDate >= startLoanDate) {
      const deductionAmount = Math.min(loan.monthlyAmount, loan.remainingAmount);
      
      if (deductionAmount > 0) {
        totalAmount += deductionAmount;
        deductions.push({
          type: "PINJAMAN",
          amount: deductionAmount,
          reason: "Cicilan Pinjaman"
        });
        
        const newRemaining = loan.remainingAmount - deductionAmount;
        loansToUpdate.push({
          id: loan.id,
          remainingAmount: newRemaining,
          status: newRemaining <= 0 ? "COMPLETED" : "ACTIVE",
          completedAt: newRemaining <= 0 ? new Date() : null
        });
      }
    }
  }
  return { totalAmount, deductions, loansToUpdate };
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

  // PRE-FETCH IDEMPOTENCY DATA (Outside Transaction for committed state check)
  // Kita perlu tahu apakah bulan ini SUDAH pernah dipotong pinjamannya di run sebelumnya.
  // Karena transaction akan menghapus deduction, kita harus cek dulu.
  const existingLoanDeductionsRaw = await prisma.deduction.findMany({
    where: {
      employeeId,
      month,
      year,
      type: "PINJAMAN"
    }
  });
  
  const existingLoanDeductions: PayrollComponent[] = existingLoanDeductionsRaw.map(d => ({
    type: d.type,
    amount: d.amount,
    reason: d.reason || "Cicilan Pinjaman"
  }));

  // 3. Start Atomic Transaction
  const payroll = await prisma.$transaction(async (tx) => {
    // 3.1 CLEANUP TOTAL: Hapus data payroll lama jika ada (Retry Mechanism)
    // Kita hapus semua data terkait bulan ini agar kalkulasi ulang bersih.
    
    // Hapus Deduction (Semua tipe untuk bulan ini)
    await tx.deduction.deleteMany({
      where: { employeeId, month, year }
    });

    // Hapus Allowance (Semua tipe untuk bulan ini)
    await tx.allowance.deleteMany({
      where: { employeeId, month, year }
    });
    
    // Hapus Payroll Header
    await tx.payroll.deleteMany({
      where: { employeeId, month, year }
    });

    // 3.2 Ambil Data Absensi & Komponen Lain
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);
    
    const attendances = await tx.attendance.findMany({
      where: {
        employeeId,
        date: { gte: startDate, lte: endDate },
      },
    });

    const advances = await tx.advance.findMany({
      where: {
        employeeId,
        status: "APPROVED",
        deductionMonth: month,
        deductionYear: year,
      },
    });

    const loans = await tx.softLoan.findMany({
      where: {
        employeeId,
        status: { in: ["APPROVED", "ACTIVE"] },
        remainingAmount: { gt: 0 },
      },
      orderBy: { id: 'asc' }
    });

    // 3.3 Hitung Komponen-Komponen (PURE CALCULATIONS / READ-ONLY PHASE)
    const overtimeData = await calculateOvertime(employeeId, month, year, tx);
    const bpjsResult = calculateBpjs(employee);
    const advanceResult = calculateAdvanceDeduction(advances);
    const loanResult = calculateSoftLoanDeduction(loans, existingLoanDeductions, month, year);
    
    let salaryResult: SalaryCalculationResult;
    let payrollTypeLog = "";

    if (employee.workScheduleType === 'SHIFT') {
      payrollTypeLog = "SHIFT (Monthly Fixed)";
      salaryResult = calculateShiftSalary(employee, attendances, overtimeData);
    } else {
      payrollTypeLog = "NON_SHIFT (Hourly Based)";
      salaryResult = calculateNonShiftSalary(employee, attendances, overtimeData);
    }

    // 3.4 AGGREGATE DATA
    const allAllowances = [...salaryResult.allowances];
    const allDeductions = [
      ...salaryResult.deductions,
      ...bpjsResult.deductions,
      ...advanceResult.deductions,
      ...loanResult.deductions
    ];

    const totalAllowances = allAllowances.reduce((sum, item) => sum + item.amount, 0);
    const totalDeductions = allDeductions.reduce((sum, item) => sum + item.amount, 0);
    
    const { baseSalary, meta } = salaryResult;
    const netSalary = baseSalary + totalAllowances + overtimeData.amount - totalDeductions;

    // 3.5 VALIDASI & VERIFIKASI
    if (netSalary < 0) {
      console.warn(`[WARNING] Negative Net Salary for employee ${employeeId}: ${netSalary}`);
    }

    if (isNaN(netSalary)) {
      throw new Error("Validation Error: Calculation resulted in NaN");
    }

    // 3.6 WRITE TO DATABASE (SIDE EFFECTS PHASE)
    
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
        daysPresent: meta.daysPresent,
        daysAbsent: meta.daysAbsent,
        daysLate: meta.daysLate,
        overtimeHours: meta.overtimeHours,
        overtimeAmount: meta.overtimeAmount,
        lateDeduction: salaryResult.deductions.filter(d => d.type === 'LATE').reduce((s, d) => s + d.amount, 0),
        advanceDeduction: advanceResult.totalAmount,
        softLoanDeduction: loanResult.totalAmount,
        bpjsKesehatanAmount: bpjsResult.deductions.find(d => d.type === 'BPJS_KESEHATAN')?.amount || 0,
        bpjsKetenagakerjaanAmount: bpjsResult.deductions.find(d => d.type === 'BPJS_KETENAGAKERJAAN')?.amount || 0,
        status: "PENDING",
      }
    });

    // b. Simpan Allowances
    if (allAllowances.length > 0) {
      await tx.allowance.createMany({
        data: allAllowances.map(a => ({
          employeeId,
          month,
          year,
          type: a.type,
          amount: a.amount,
        }))
      });
    }

    // c. Simpan Deductions (Linked to Payroll)
    if (allDeductions.length > 0) {
      await tx.deduction.createMany({
        data: allDeductions.map(d => ({
          employeeId,
          month,
          year,
          amount: d.amount,
          type: d.type,
          reason: d.reason || "",
          payrollId: newPayroll.id
        }))
      });
    }

    // d. Update Advances (Mark as deducted)
    for (const advId of advanceResult.advancesToUpdate) {
      await tx.advance.update({
        where: { id: advId },
        data: { deductedAt: new Date() }
      });
    }

    // e. Update Soft Loans
    for (const loanUpdate of loanResult.loansToUpdate) {
      await tx.softLoan.update({
        where: { id: loanUpdate.id },
        data: { 
          remainingAmount: loanUpdate.remainingAmount,
          status: loanUpdate.status,
          completedAt: loanUpdate.completedAt
        }
      });
    }

    // f. Audit Log
    const breakdownJson = JSON.parse(JSON.stringify(salaryResult));
    
    await tx.payrollAuditLog.create({
      data: {
        payrollId: newPayroll.id,
        userId: employee.userId,
        action: "GENERATE_PAYROLL",
        newValue: {
          type: payrollTypeLog,
          netSalary,
          breakdown: breakdownJson
        }
      }
    });

    // g. Notifikasi
    await tx.notification.create({
      data: {
        userId: employee.userId,
        title: "Slip Gaji Tersedia",
        message: `Slip gaji bulan ${month}/${year} telah tersedia. Total: Rp ${netSalary.toLocaleString('id-ID')}`,
        type: "info"
      }
    });

    return newPayroll;
  });

  // 4. Retrieve complete enriched record for immediate UI update
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
  
  const enrichedPayrolls = await prisma.$queryRawUnsafe(enrichedPayrollQuery, payroll.id) as any[];
  const serialized = enrichedPayrolls[0];

  if (serialized) {
    if (typeof serialized.advanceAmount === 'bigint') serialized.advanceAmount = Number(serialized.advanceAmount);
    if (typeof serialized.softLoanDeduction === 'bigint') serialized.softLoanDeduction = Number(serialized.softLoanDeduction);
    if (typeof serialized.absenceDeduction === 'bigint') serialized.absenceDeduction = Number(serialized.absenceDeduction);
    if (typeof serialized.otherDeductions === 'bigint') serialized.otherDeductions = Number(serialized.otherDeductions);
    if (typeof serialized.positionAllowance === 'bigint') serialized.positionAllowance = Number(serialized.positionAllowance);
    if (typeof serialized.mealAllowance === 'bigint') serialized.mealAllowance = Number(serialized.mealAllowance);
    if (typeof serialized.transportAllowance === 'bigint') serialized.transportAllowance = Number(serialized.transportAllowance);
    if (typeof serialized.shiftAllowance === 'bigint') serialized.shiftAllowance = Number(serialized.shiftAllowance);
  }

  return serialized;
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
