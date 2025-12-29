import { prisma } from "./prisma";
import { Status } from "../generated/prisma/enums";

// Konfigurasi default jika tidak ada di database
const DEFAULT_OVERTIME_RATE_MULTIPLIER = 1.5;
const DEFAULT_SUNDAY_MULTIPLIER = 2.0;
const DEFAULT_HOLIDAY_MULTIPLIER = 2.0;
const DEFAULT_MAX_DAILY_OVERTIME_HOURS = 12;
const DEFAULT_LATE_PER_DAY_AMOUNT = 30000;
const DEFAULT_ABSENCE_PENALTY_PERCENT = 100; // persen dari gaji harian

// Konfigurasi Shift
const SHIFT_LATE_PENALTY = 40000;
const SHIFT_ABSENCE_PENALTY = 97500;
const SHIFT_OVERTIME_RATE = 14300;



// Konfigurasi Non-Shift
const NON_SHIFT_LATE_PENALTY = 40000;
const NON_SHIFT_MEAL_INCENTIVE = 20000;
const NON_SHIFT_TRANSPORT_INCENTIVE = 20000;
const NON_SHIFT_ROLE_ALLOWANCE = 230000;
const NON_SHIFT_LATE_THRESHOLD_HOUR = 8;
const NON_SHIFT_LATE_THRESHOLD_MINUTE = 15;

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

// Ambil konfigurasi lembur dari database
const getOvertimeConfig = async () => {
  const cfg = await prisma.overtimeConfig.findFirst({ orderBy: { effectiveDate: "desc" } });
  return {
    rateMultiplier: cfg?.rateMultiplier ?? DEFAULT_OVERTIME_RATE_MULTIPLIER,
    sundayMultiplier: cfg?.sundayMultiplier ?? DEFAULT_SUNDAY_MULTIPLIER,
    holidayMultiplier: cfg?.holidayMultiplier ?? DEFAULT_HOLIDAY_MULTIPLIER,
    maxDailyOvertimeHours: cfg?.maxDailyOvertimeHours ?? DEFAULT_MAX_DAILY_OVERTIME_HOURS,
  };
};

// Ambil konfigurasi denda dari database
const getPenaltyConfig = async () => {
  const cfg = await prisma.penaltyConfig.findFirst({ orderBy: { effectiveDate: "desc" } });
  return {
    latePerDayAmount: cfg?.latePerDayAmount ?? DEFAULT_LATE_PER_DAY_AMOUNT,
    absencePenaltyPercent: cfg?.absencePenaltyPercent ?? DEFAULT_ABSENCE_PENALTY_PERCENT,
  };
};

// Ambil daftar hari libur untuk periode
const getPublicHolidays = async (month: number, year: number) => {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0);
  const holidays = await prisma.publicHoliday.findMany({
    where: {
      date: { gte: start, lte: end },
    },
  });
  const set = new Set(holidays.map(h => new Date(h.date).toDateString()));
  return set;
};

/**
 * Menghitung total potongan untuk keterlambatan
 */
const calculateLateDeductions = async (employeeId: string, month: number, year: number): Promise<number> => {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);
  
  // Ambil data karyawan
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
  });

  if (!employee) {
    throw new Error("Karyawan tidak ditemukan");
  }

  let totalDeduction = 0;

  // Logic khusus Non-Shift
  if (employee.workScheduleType === 'NON_SHIFT') {
      const attendances = await prisma.attendance.findMany({
          where: {
              employeeId,
              date: { gte: startDate, lte: endDate },
              status: { in: [Status.PRESENT, Status.LATE] },
              checkIn: { not: null }
          }
      });

      for (const att of attendances) {
          if (!att.checkIn) continue;
          
          // Kecuali hari Minggu
          if (att.date.getDay() === 0) continue;

          const checkInTime = new Date(att.checkIn);
          const threshold = new Date(checkInTime);
          threshold.setHours(NON_SHIFT_LATE_THRESHOLD_HOUR, NON_SHIFT_LATE_THRESHOLD_MINUTE, 0, 0);

          if (checkInTime > threshold) {
              const deduction = NON_SHIFT_LATE_PENALTY;
              totalDeduction += deduction;
              
              const record = await prisma.deduction.create({
                  data: {
                      employeeId,
                      month,
                      year,
                      reason: `Keterlambatan Non-Shift (>08:15) ${att.date.toLocaleDateString()}`,
                      amount: deduction,
                      type: "LATE",
                  },
              });
              
              await prisma.attendanceAuditLog.create({
                  data: {
                      attendanceId: att.id,
                      userId: employee.userId,
                      action: "CREATE_DEDUCTION_LATE_NON_SHIFT",
                      oldValue: undefined,
                      newValue: { deductionId: record.id, amount: deduction },
                  },
              });
          }
      }
      return totalDeduction;
  }

  // Logic Standard (Shift)
  const attendances = await prisma.attendance.findMany({
    where: {
      employeeId,
      date: {
        gte: startDate,
        lte: endDate,
      },
      status: { in: [Status.PRESENT, Status.LATE] }, // Ambil semua hadir untuk cek jam
      checkIn: { not: null },
    },
  });

  for (const attendance of attendances) {
    if (!attendance.checkIn) continue;

    // Cek keterlambatan > 15 menit
    // Asumsi Shift Masuk 08:00
    // Tolerance 15 mins -> 08:15
    const checkIn = new Date(attendance.checkIn);
    const limit = new Date(attendance.date);
    limit.setHours(8, 15, 0, 0); // 08:15

    // Jika checkIn > 08:15
    if (checkIn > limit) {
        const deduction = SHIFT_LATE_PENALTY;
        totalDeduction += deduction;

        const record = await prisma.deduction.create({
        data: {
            employeeId,
            month,
            year,
            reason: `Keterlambatan Shift (>15 min) ${attendance.date.toLocaleDateString()}`,
            amount: deduction,
            type: "LATE",
        },
        });

        // Audit log
        await prisma.attendanceAuditLog.create({
        data: {
            attendanceId: attendance.id,
            userId: employee.userId,
            action: "CREATE_DEDUCTION_LATE",
            oldValue: undefined,
            newValue: { deductionId: record.id, amount: deduction },
        },
        });
    }
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
  const { absencePenaltyPercent } = await getPenaltyConfig();
  
  let perDay = (dailyRate * absencePenaltyPercent) / 100;
  
  // Override for Shift
  if (employee.workScheduleType !== 'NON_SHIFT') {
      perDay = SHIFT_ABSENCE_PENALTY;
  }

  const totalDeduction = absences.length * perDay;

  // Catat potongan absensi jika ada
  if (absences.length > 0) {
    const record = await prisma.deduction.create({
      data: {
        employeeId,
        month,
        year,
        reason: `Ketidakhadiran (${absences.length} hari)`,
        amount: totalDeduction,
        type: "ABSENCE",
      },
    });

    await prisma.attendanceAuditLog.create({
      data: {
        attendanceId: absences[0]?.id,
        userId: employee.userId,
        action: "CREATE_DEDUCTION_ABSENCE",
        oldValue: undefined,
        newValue: { deductionId: record.id, amount: totalDeduction },
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
  // Gunakan OvertimeRequest yang APPROVED
  const requests = await prisma.overtimeRequest.findMany({
    where: {
      employeeId,
      date: { gte: startDate, lte: endDate },
      status: "APPROVED",
    },
  });

  // Ambil gaji dasar karyawan
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
  });

  if (!employee) {
    throw new Error("Karyawan tidak ditemukan");
  }

  const hourlyRate = (employee.workScheduleType === 'NON_SHIFT' && employee.hourlyRate)
    ? employee.hourlyRate
    : (employee.workScheduleType !== 'NON_SHIFT') ? SHIFT_OVERTIME_RATE : calculateHourlyRate(employee.basicSalary);
  
  const cfg = await getOvertimeConfig();
  const holidaysSet = await getPublicHolidays(month, year);
  let totalOvertimeHours = 0;
  let totalAmount = 0;

  for (const req of requests) {
    // Helper to calculate overlap in hours
    const getOverlap = (start: number, end: number, zoneStart: number, zoneEnd: number) => {
        const s = Math.max(start, zoneStart);
        const e = Math.min(end, zoneEnd);
        return Math.max(0, e - s);
    };

    const startHour = new Date(req.start).getHours();
    const startMinute = new Date(req.start).getMinutes();
    const startTime = startHour + (startMinute / 60);
    
    const endHour = new Date(req.end).getHours();
    const endMinute = new Date(req.end).getMinutes();
    let effectiveEndTime = endHour + (endMinute / 60);
    if (effectiveEndTime < startTime) effectiveEndTime += 24;
    
    const duration = effectiveEndTime - startTime;
    const dateStr = new Date(req.date).toDateString();
    const isSunday = new Date(req.date).getDay() === 0;
    const isSaturday = new Date(req.date).getDay() === 6;
    const isHoliday = holidaysSet.has(dateStr);

    let currentAmount = 0;

    // Logic khusus NON_SHIFT
    if (employee.workScheduleType === 'NON_SHIFT') {
        const minutes = Math.max(0, (new Date(req.end).getTime() - new Date(req.start).getTime()) / 60000);
        let hours = minutes / 60;
        if (hours > cfg.maxDailyOvertimeHours) hours = cfg.maxDailyOvertimeHours;

        if ((isSunday || isSaturday) && !isHoliday) {
            if (hours <= 4) {
                 currentAmount = hours * hourlyRate * 2.0;
            } else {
                 if (isSaturday) {
                     const firstPart = Math.min(hours, 5);
                     const secondPart = Math.max(0, hours - 5);
                     currentAmount = (firstPart * 2.0 * hourlyRate) + (secondPart * 1.0 * hourlyRate);
                 } else {
                     currentAmount = hours * hourlyRate * 2.0;
                 }
            }
        } else {
            let multiplier = cfg.rateMultiplier;
            if (isHoliday) multiplier = Math.max(multiplier, cfg.holidayMultiplier);
            else if (isSunday) multiplier = Math.max(multiplier, cfg.sundayMultiplier);
            currentAmount = hours * hourlyRate * multiplier;
        }
        totalOvertimeHours += hours;
    } else {
        // Logic SHIFT
        // Break Times
        const lunchStart = 12.0;
        const lunchEnd = 13.0;
        const maghribStart = 19.0;
        const maghribEnd = 19.5;

        // Calculate Deductible Break Duration
        let breakDeduction = 0;
        
        // Sunday/Holiday: Deduct Lunch + Maghrib
        // Saturday/Weekday: Deduct Maghrib only
        if (isSunday || isHoliday) {
            breakDeduction += getOverlap(startTime, effectiveEndTime, lunchStart, lunchEnd);
        }
        breakDeduction += getOverlap(startTime, effectiveEndTime, maghribStart, maghribEnd);

        if (isSunday || isHoliday) {
             // Full Day Overtime: 2.0x
             // Apply Deduction
             const payHours = Math.max(0, duration - breakDeduction);
             currentAmount = payHours * hourlyRate * 2.0;
        } else if (isSaturday) {
             // Saturday Overtime: 2.0x
             // Apply Deduction
             const payHours = Math.max(0, duration - breakDeduction);
             currentAmount = payHours * hourlyRate * 2.0;
        } else {
             // Weekday
             // Zone 1: 16.30 - 17.30 (1.5x)
             // Zone 2: > 17.30 (2.0x)
             const zone1Start = 16.5;
             const zone1End = 17.5;
             
             // Calculate Zone 1 Hours (No break in this zone usually)
             const hours1_5 = getOverlap(startTime, effectiveEndTime, zone1Start, zone1End);
             
             // Calculate Zone 2 Hours (Raw)
             const hours2_0_Raw = Math.max(0, effectiveEndTime - Math.max(startTime, 17.5));
             
             // Deduct Maghrib from Zone 2
             // Maghrib is 19.0-19.5, which is inside Zone 2
             // Check overlap of break with actual time, assuming break is in Zone 2
             // (Since 19.0 > 17.5, it is always in Zone 2 if it exists)
             const breakInZone2 = getOverlap(startTime, effectiveEndTime, maghribStart, maghribEnd);
             
             const hours2_0 = Math.max(0, hours2_0_Raw - breakInZone2);
             
             currentAmount = (hours1_5 * hourlyRate * 1.5) + (hours2_0 * hourlyRate * 2.0);
        }
        
        // Accumulate (Use duration - total break for consistency in hours record?)
        // Or just sum of paid hours? 
        // Usually record actual work hours (Duration - Break)
        totalOvertimeHours += Math.max(0, duration - breakDeduction);
    }

    totalAmount += currentAmount;
  }

  return {
    hours: totalOvertimeHours,
    amount: totalAmount,
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
 * Menghitung potongan BPJS
 */
const calculateBpjsDeductions = async (employeeId: string, month: number, year: number): Promise<{ kesehatan: number, ketenagakerjaan: number }> => {
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
  });

  if (!employee) {
    throw new Error("Karyawan tidak ditemukan");
  }

  const kesehatan = employee.bpjsKesehatan || 0;
  const ketenagakerjaan = employee.bpjsKetenagakerjaan || 0;

  if (kesehatan > 0) {
    await prisma.deduction.create({
      data: {
        employeeId,
        month,
        year,
        reason: "Potongan BPJS Kesehatan",
        amount: kesehatan,
        type: "BPJS_KESEHATAN",
      },
    });
  }

  if (ketenagakerjaan > 0) {
    await prisma.deduction.create({
      data: {
        employeeId,
        month,
        year,
        reason: "Potongan BPJS Ketenagakerjaan",
        amount: ketenagakerjaan,
        type: "BPJS_KETENAGAKERJAAN",
      },
    });
  }

  return { kesehatan, ketenagakerjaan };
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
  const _totalDays = endDate.getDate();
  
  const attendances = await prisma.attendance.findMany({
    where: {
      employeeId,
      date: {
        gte: startDate,
        lte: endDate,
      },
    },
  });

  // Hitung jumlah hari hadir (dengan penyesuaian jika tidak checkout)
  let daysPresent = 0;
  let daysAbsent = 0;
  let noCheckoutCount = 0;
  
  // Variable khusus Non-Shift
  let workEarnings = 0;
  
  // Helper untuk Non-Shift Hourly Rate
  const hourlyRate = (employee.workScheduleType === 'NON_SHIFT') 
      ? (employee.hourlyRate || (employee.basicSalary / 173)) 
      : 0;

  attendances.forEach(a => {
    if (a.status === Status.LEAVE) {
      daysPresent += 1;
    } else if (a.status === Status.PRESENT || a.status === Status.LATE) {
      if (!a.checkOut && employee.workScheduleType === 'NON_SHIFT') {
        // Tidak checkout: dihitung 0.5 hari (hanya NON_SHIFT)
        daysPresent += 0.5;
        daysAbsent += 0.5; // Sisa 0.5 dianggap absen
        noCheckoutCount++;
        
        // Non-Shift Work Earnings Logic for No Checkout
        // Asumsi: 0.5 hari = 4 jam
        const hours = 4;
        let multiplier = 1.0;
        
        // Weekend Logic (Sabtu/Minggu) <= 4 jam -> 2x
        const day = new Date(a.date).getDay();
        const isWeekend = day === 0 || day === 6;
        if (isWeekend) {
            multiplier = 2.0;
        }
        
        workEarnings += (hours * hourlyRate * multiplier);

      } else {
        daysPresent += 1;
        
        // Non-Shift Work Earnings Logic
        if (employee.workScheduleType === 'NON_SHIFT' && a.checkIn && a.checkOut) {
            const diff = new Date(a.checkOut).getTime() - new Date(a.checkIn).getTime();
            const hours = diff / (1000 * 60 * 60);
            
            let multiplier = 1.0;
            const day = new Date(a.date).getDay();
            const isWeekend = day === 0 || day === 6;
            
            // Weekend <= 4 jam -> 2x
            if (isWeekend && hours <= 4) {
                multiplier = 2.0;
            }
            workEarnings += (hours * hourlyRate * multiplier);
        }
      }
    } else if (a.status === Status.ABSENT) {
      daysAbsent += 1;
    }
  });
  
  const daysLate = attendances.filter(a => a.status === Status.LATE).length;

  // Hitung potongan keterlambatan
  const lateDeduction = await calculateLateDeductions(employeeId, month, year);

  // Hitung potongan ketidakhadiran (status ABSENT murni)
  let absenceDeduction = await calculateAbsenceDeductions(employeeId, month, year);

  // Hitung potongan BPJS
  const bpjsDeductions = await calculateBpjsDeductions(employeeId, month, year);
  const totalBpjs = bpjsDeductions.kesehatan + bpjsDeductions.ketenagakerjaan;
  
  // Logic Tambahan untuk Non-Shift
  if (employee.workScheduleType === 'NON_SHIFT') {
      // 1. Reset Absence Deduction (Tanpa penalti jika absent)
      absenceDeduction = 0;
      
      // 2. Insentif Harian (Makan + Transport)
      // Dihitung berdasarkan jumlah hari hadir fisik (PRESENT/LATE)
      const actualPresentDays = attendances.filter(a => a.status === Status.PRESENT || a.status === Status.LATE).length;
      const dailyIncentives = actualPresentDays * (NON_SHIFT_MEAL_INCENTIVE + NON_SHIFT_TRANSPORT_INCENTIVE);
      
      if (dailyIncentives > 0) {
          await prisma.allowance.create({
              data: {
                  employeeId,
                  month,
                  year,
                  type: "DAILY_INCENTIVE",
                  amount: dailyIncentives,
              }
          });
      }
      
      // 3. Tunjangan Role
      if (employee.position && ['foreman', 'assistant_foreman'].includes(employee.position.toLowerCase().replace(' ', '_'))) {
          await prisma.allowance.create({
              data: {
                  employeeId,
                  month,
                  year,
                  type: "ROLE_ALLOWANCE",
                  amount: NON_SHIFT_ROLE_ALLOWANCE,
              }
          });
      }
      
      // Note: No Checkout deduction is skipped because pay is based on hours.
  } else {
      // Logic Standard (Shift) untuk No Checkout Deduction
      // Rule: Jika tidak absen pulang maka dianggap pulang jam normal 16.30 (Tidak ada potongan)
      // Namun kita bisa mencatat log atau warning jika diperlukan, tapi tidak ada deduction financial.
      if (noCheckoutCount > 0) {
          // Opsional: Catat log bahwa ada no-checkout yang dianggap pulang normal
          console.log(`[Payroll] ${noCheckoutCount} hari tidak checkout untuk ${employeeId}, dianggap pulang 16:30.`);
      }
  }

  // Hitung lembur
  const overtime = await calculateOvertime(employeeId, month, year);

  // Hitung tunjangan (Termasuk yang baru dibuat untuk Non + totalBpjs-Shift)
  const totalAllowances = await calculateTotalAllowances(employeeId, month, year);

  // Hitung total potongan
  const totalDeductions = lateDeduction + absenceDeduction + totalBpjs;

  // Hitung gaji bersih
  let netSalary = 0;
  let baseSalaryForRecord = employee.basicSalary;
  
  if (employee.workScheduleType === 'NON_SHIFT') {
      // Rumus: (Jam Kerja Total x Rate Per Jam x Multiplier) + Tunjangan + Insentif + Role - Potongan
      // workEarnings = (Jam Kerja Total x Rate Per Jam x Multiplier)
      // totalAllowances = Tunjangan + Insentif + Role (karena sudah masuk DB)
      // totalDeductions = Potongan Late + BPJS (Absence 0)
      netSalary = workEarnings + totalAllowances - totalDeductions + overtime.amount;
      baseSalaryForRecord = workEarnings;
  } else {
      netSalary = employee.basicSalary - totalDeductions + overtime.amount + totalAllowances;
  }

  // Buat slip gaji
  const payroll = await prisma.payroll.create({
    data: {
      employeeId,
      month,
      year,
      baseSalary: baseSalaryForRecord,
      totalAllowances,
      totalDeductions,
      netSalary,
      daysPresent,
      daysAbsent,
      bpjsKesehatanAmount: bpjsDeductions.kesehatan,
      bpjsKetenagakerjaanAmount: bpjsDeductions.ketenagakerjaan,
      daysLate,
      overtimeHours: overtime.hours,
      overtimeAmount: overtime.amount,
      lateDeduction,
      status: "PENDING",
    },
  });

  // Audit log generate payroll
  await prisma.payrollAuditLog.create({
    data: {
      payrollId: payroll.id,
      userId: employee.userId,
      action: "GENERATE_PAYROLL",
      oldValue: undefined,
      newValue: {
        totalAllowances,
        totalDeductions,
        overtimeHours: overtime.hours,
        overtimeAmount: overtime.amount,
        netSalary,
      },
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
      message: `Gaji Anda untuk bulan ${payroll.month}/${payroll.year} telah dibayarkan. [#ref:PAYROLL:${payroll.id}]`,
      type: "success",
      refType: "PAYROLL",
      refId: payroll.id,
    },
  });

  // Mark advances as deducted for this employee in this month/year
  try {
    const { markAdvancesAsDeducted } = await import("./advance");
    const result = await markAdvancesAsDeducted(
      payroll.employeeId,
      payroll.month,
      payroll.year
    );
    
    if (result.count > 0) {
      console.log(`Marked ${result.count} advances as deducted for employee ${payroll.employeeId}`);
    }
  } catch (error) {
    console.error("Error marking advances as deducted:", error);
    // Continue with the process even if marking advances fails
    // We don't want to prevent payroll from being marked as paid
  }
  
  // Process soft loan deductions for this employee in this month/year
  try {
    const { processSoftLoanDeductions } = await import("./softloan");
    const softLoanResult = await processSoftLoanDeductions(
      payroll.employeeId,
      payroll.month,
      payroll.year
    );
    
    if (softLoanResult.count > 0) {
      console.log(`Processed ${softLoanResult.count} soft loan deductions for employee ${payroll.employeeId}`);
    }
  } catch (error) {
    console.error("Error processing soft loan deductions:", error);
    // Continue with the process even if processing soft loans fails
    // We don't want to prevent payroll from being marked as paid
  }

  return updatedPayroll;
};

// Fungsi getEmployeeSoftLoanInfo telah dipindahkan ke src/lib/softLoan.ts

/**
 * SIMULASI PERHITUNGAN GAJI NON-SHIFT
 * 
 * Skenario:
 * - Karyawan: Non-Shift, Role: Foreman
 * - Hourly Rate: Rp 20.000 (Misal)
 * - Kehadiran:
 *   - Senin-Jumat: 20 hari (8 jam/hari) = 160 jam
 *   - Sabtu (Weekend): 2 hari (4 jam/hari) = 8 jam (Multiplier 2x -> 16 jam bayaran)
 *   - Total Jam Bayaran = 160 + 16 = 176 jam
 *   - Work Earnings = 176 x 20.000 = Rp 3.520.000
 * - Late: 2 hari terlambat (> 08:15)
 *   - Penalti = 2 x 40.000 = Rp 80.000
 * - Insentif:
 *   - Hadir 22 hari (20 weekday + 2 sabtu)
 *   - Insentif = 22 x (20.000 + 20.000) = 22 x 40.000 = Rp 880.000
 * - Role Allowance (Foreman): Rp 230.000
 * 
 * Perhitungan:
 * (+) Work Earnings: Rp 3.520.000
 * (+) Insentif: Rp 880.000
 * (+) Role Allowance: Rp 230.000
 * (-) Late Penalty: Rp 80.000
 * (-) Absence Penalty: Rp 0 (Sesuai aturan)
 * 
 * Total Gaji Bersih = 3.520.000 + 880.000 + 230.000 - 80.000 = Rp 4.550.000
 */
