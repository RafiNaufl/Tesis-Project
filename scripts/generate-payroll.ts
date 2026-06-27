
import { PrismaClient } from "../src/generated/prisma";
const prisma = new PrismaClient();

// Import necessary functions from src/lib/payroll (copying relevant parts)
enum Status {
  PRESENT = "PRESENT",
  LATE = "LATE",
  ABSENT = "ABSENT",
  LEAVE = "LEAVE",
  SICK = "SICK",
  PERMIT = "PERMIT"
}

enum WorkdayType {
  WEEKDAY = "WEEKDAY",
  SATURDAY = "SATURDAY",
  SUNDAY = "SUNDAY",
}

const getWorkdayType = (date: Date): WorkdayType => {
  const day = date.getDay();
  if (day === 0) return WorkdayType.SUNDAY;
  if (day === 6) return WorkdayType.SATURDAY;
  return WorkdayType.WEEKDAY;
};

const SHIFT_LATE_PENALTY = 40000;
const NON_SHIFT_LATE_PENALTY = 40000;
const ABSENCE_PENALTY_PERCENT = 100;
const SHIFT_FIXED_ALLOWANCE = 0;
const NON_SHIFT_MEAL_ALLOWANCE = 20000;
const NON_SHIFT_TRANSPORT_ALLOWANCE = 20000;
const ASSISTANT_FOREMAN_ALLOWANCE = 240000;
const FOREMAN_ALLOWANCE = 240000;

const getEmployeeHourlyRate = (employee: any): number => {
  if (employee.hourlyRate && employee.hourlyRate > 0) {
    return employee.hourlyRate;
  }
  return (employee.basicSalary || 0) / 173;
};

const getEmployeeDailyRate = (employee: any): number => {
  return (employee.basicSalary || 0) / 22;
};

const getPublicHolidays = async (month: number, year: number) => {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0);
  const holidays = await prisma.publicHoliday.findMany({
    where: { date: { gte: start, lte: end } },
  });
  return new Set(holidays.map((h) => new Date(h.date).toDateString()));
};

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
  totalWorkHours: number;
}

interface SalaryCalculationResult {
  baseSalary: number;
  allowances: PayrollComponent[];
  deductions: PayrollComponent[];
  meta: CalculationMeta;
}

const calculateShiftSalary = (
  employee: any,
  attendances: any[],
  overtimeData: { hours: number; amount: number }
): SalaryCalculationResult => {
  const baseSalary = employee.basicSalary;
  const dailyRate = getEmployeeDailyRate(employee);

  let daysPresent = 0;
  let daysAbsent = 0;
  let daysLate = 0;

  const allowances: PayrollComponent[] = [];
  const deductions: PayrollComponent[] = [];

  if (SHIFT_FIXED_ALLOWANCE > 0) {
    allowances.push({
      type: "SHIFT_FIXED_ALLOWANCE",
      amount: SHIFT_FIXED_ALLOWANCE,
    });
  }

  const position = employee.position?.toLowerCase() || "";
  const role = employee.user?.role || "";

  let positionAllowance = 0;

  if (
    position.includes("assistant foreman") ||
    role === "ASSISTANT_FOREMAN"
  ) {
    positionAllowance = ASSISTANT_FOREMAN_ALLOWANCE;
    allowances.push({
      type: "TUNJANGAN_JABATAN_ASST_FOREMAN",
      amount: positionAllowance,
    });
  } else if (position.includes("foreman") || role === "FOREMAN") {
    positionAllowance = FOREMAN_ALLOWANCE;
    allowances.push({
      type: "TUNJANGAN_JABATAN_FOREMAN",
      amount: positionAllowance,
    });
  }

  for (const att of attendances) {
    if (
      att.status === Status.PRESENT ||
      att.status === Status.LATE ||
      att.status === Status.LEAVE
    ) {
      daysPresent++;

      if (att.status === Status.LATE) {
        daysLate++;
        deductions.push({
          type: "LATE",
          amount: SHIFT_LATE_PENALTY,
          reason: `Keterlambatan Shift ${new Date(att.date).toLocaleDateString()}`,
        });
      }
    } else if (att.status === Status.ABSENT) {
      daysAbsent++;
      const deduction = dailyRate * (ABSENCE_PENALTY_PERCENT / 100);
      deductions.push({
        type: "ABSENCE",
        amount: deduction,
        reason: `Ketidakhadiran Shift ${new Date(att.date).toLocaleDateString()}`,
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
      overtimeAmount: overtimeData.amount,
      totalWorkHours: daysPresent * 8,
    },
  };
};

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

  const position = employee.position?.toLowerCase() || "";
  const role = employee.user?.role || "";

  let positionAllowance = 0;

  if (
    position.includes("assistant foreman") ||
    role === "ASSISTANT_FOREMAN"
  ) {
    positionAllowance = ASSISTANT_FOREMAN_ALLOWANCE;
    allowances.push({
      type: "TUNJANGAN_JABATAN_ASST_FOREMAN",
      amount: positionAllowance,
    });
  } else if (position.includes("foreman") || role === "FOREMAN") {
    positionAllowance = FOREMAN_ALLOWANCE;
    allowances.push({
      type: "TUNJANGAN_JABATAN_FOREMAN",
      amount: positionAllowance,
    });
  }

  for (const att of attendances) {
    if (att.status === Status.PRESENT || att.status === Status.LATE) {
      daysPresent++;
      mealAllowances += NON_SHIFT_MEAL_ALLOWANCE;
      transportAllowances += NON_SHIFT_TRANSPORT_ALLOWANCE;

      const dayType = getWorkdayType(new Date(att.date));
      let dailyHours = 0;

      if (dayType === WorkdayType.WEEKDAY) {
        dailyHours = 7.5;
      } else if (dayType === WorkdayType.SATURDAY) {
        dailyHours = 10.0;
      }

      totalWorkHours += dailyHours;

      if (att.status === Status.LATE) {
        daysLate++;
        deductions.push({
          type: "LATE",
          amount: NON_SHIFT_LATE_PENALTY,
          reason: `Keterlambatan Non-Shift ${new Date(att.date).toLocaleDateString()}`,
        });
      }
    } else if (att.status === Status.ABSENT) {
      daysAbsent++;
    } else if (att.status === Status.LEAVE) {
      const dayType = getWorkdayType(new Date(att.date));
      if (dayType === WorkdayType.WEEKDAY) {
        totalWorkHours += 7.5;
      } else if (dayType === WorkdayType.SATURDAY) {
        totalWorkHours += 10.0;
      }
    }
  }

  const baseSalary = totalWorkHours * hourlyRate;

  if (mealAllowances > 0) {
    allowances.push({
      type: "NON_SHIFT_MEAL_ALLOWANCE",
      amount: mealAllowances,
    });
  }
  if (transportAllowances > 0) {
    allowances.push({
      type: "NON_SHIFT_TRANSPORT_ALLOWANCE",
      amount: transportAllowances,
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
      overtimeAmount: overtimeData.amount,
      totalWorkHours: totalWorkHours,
    },
  };
};

const calculateOvertime = async (
  employeeId: string,
  month: number,
  year: number,
  tx: any = prisma
) => {
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
  const holidaysSet = await getPublicHolidays(month, year);

  let totalHours = 0;
  let totalAmount = 0;

  for (const req of requests) {
    const start = new Date(req.start).getTime();
    const end = new Date(req.end).getTime();
    let durationHours = (end - start) / (1000 * 60 * 60);
    durationHours = Math.floor(durationHours * 2) / 2;
    if (durationHours <= 0) continue;

    const date = new Date(req.date);
    const day = date.getDay();
    const isHoliday = holidaysSet.has(date.toDateString());
    const isSunday = day === 0;
    const isSaturday = day === 6;

    let dailyAmount = 0;

    if (employee.workScheduleType === "NON_SHIFT") {
      const reqEnd = new Date(req.end);
      if (isSaturday) {
        let deduction = 1.0;
        const cutOff1830 = new Date(req.date);
        cutOff1830.setHours(18, 30, 0, 0);
        if (reqEnd > cutOff1830) {
          deduction += 0.5;
        }
        const netDuration = Math.max(0, durationHours - deduction);
        const zone1 = Math.min(netDuration, 2.5);
        const zone2 = Math.max(0, netDuration - 2.5);
        const payableHours = zone1 * 1.0 + zone2 * 2.0;
        dailyAmount += payableHours * hourlyRate;
        durationHours = netDuration;
      } else if (isSunday || isHoliday) {
        let deduction = 0;
        if (durationHours > 11) {
          deduction = 1.5;
        } else if (durationHours > 5) {
          deduction = 1.0;
        }
        const effectiveDuration = Math.max(0, durationHours - deduction);
        dailyAmount += effectiveDuration * 2.0 * hourlyRate;
        durationHours = effectiveDuration;
      } else {
        if (durationHours > 2) {
          durationHours -= 0.5;
        }
        const hoursTier1 = Math.min(durationHours, 1);
        const hoursTier2 = Math.max(0, durationHours - 1);
        dailyAmount += hoursTier1 * 1.5 * hourlyRate;
        dailyAmount += hoursTier2 * 2.0 * hourlyRate;
      }
    } else {
      if (isSunday || isHoliday) {
        let effectiveDuration = durationHours;
        if (effectiveDuration > 6) {
          effectiveDuration -= 1;
        }
        dailyAmount = effectiveDuration * 2.0 * hourlyRate;
      } else if (isSaturday) {
        dailyAmount = durationHours * 2.0 * hourlyRate;
      } else {
        const hoursTier1 = Math.min(durationHours, 1);
        const hoursTier2 = Math.max(0, durationHours - 1);
        dailyAmount += hoursTier1 * 1.5 * hourlyRate;
        dailyAmount += hoursTier2 * 2.0 * hourlyRate;
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
      reason: "Potongan BPJS Kesehatan",
    });
  }
  if (ketenagakerjaan > 0) {
    deductions.push({
      type: "BPJS_KETENAGAKERJAAN",
      amount: ketenagakerjaan,
      reason: "Potongan BPJS Ketenagakerjaan",
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
      reason: "Pelunasan Kasbon",
    });
    advancesToUpdate.push(adv.id);
  }
  return { totalAmount, deductions, advancesToUpdate };
};

interface LoanDeductionResult {
  totalAmount: number;
  deductions: PayrollComponent[];
  loansToUpdate: {
    id: string;
    remainingAmount: number;
    status: string;
    completedAt: Date | null;
  }[];
}

const calculateSoftLoanDeduction = (
  loans: any[],
  existingDeductions: PayrollComponent[],
  month: number,
  year: number
): LoanDeductionResult => {
  if (existingDeductions.length > 0) {
    const totalAmount = existingDeductions.reduce((sum, d) => sum + d.amount, 0);
    return { totalAmount, deductions: existingDeductions, loansToUpdate: [] };
  }

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
          reason: "Cicilan Pinjaman",
        });
        const newRemaining = loan.remainingAmount - deductionAmount;
        loansToUpdate.push({
          id: loan.id,
          remainingAmount: newRemaining,
          status: newRemaining <= 0 ? "COMPLETED" : "ACTIVE",
          completedAt: newRemaining <= 0 ? new Date() : null,
        });
      }
    }
  }

  return { totalAmount, deductions, loansToUpdate };
};

const generateMonthlyPayroll = async (
  employeeId: string,
  month: number,
  year: number
) => {
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    include: { user: true },
  });

  if (!employee) throw new Error("Karyawan tidak ditemukan");

  const existingPayroll = await prisma.payroll.findFirst({
    where: { employeeId, month, year },
  });

  if (existingPayroll) {
    throw new Error("Slip gaji bulan ini sudah dibuat");
  }

  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);
  const attendances = await prisma.attendance.findMany({
    where: { employeeId, date: { gte: startDate, lte: endDate } },
  });

  const overtimeData = await calculateOvertime(employeeId, month, year);

  let salaryCalculation;
  if (employee.workScheduleType === "SHIFT") {
    salaryCalculation = calculateShiftSalary(employee, attendances, overtimeData);
  } else {
    salaryCalculation = calculateNonShiftSalary(employee, attendances, overtimeData);
  }

  const bpjsDeductions = calculateBpjs(employee);
  const advances = await prisma.advance.findMany({
    where: {
      employeeId,
      month,
      year,
      status: "APPROVED",
      deductionMonth: null,
      deductionYear: null,
    },
  });
  const advanceDeduction = calculateAdvanceDeduction(advances);

  const existingLoanDeductionsRaw = await prisma.deduction.findMany({
    where: { employeeId, month, year, type: "PINJAMAN" },
  });
  const loans = await prisma.softLoan.findMany({
    where: { employeeId, status: "ACTIVE" },
  });
  const loanDeduction = calculateSoftLoanDeduction(
    loans,
    existingLoanDeductionsRaw,
    month,
    year
  );

  const allDeductions = [
    ...salaryCalculation.deductions,
    ...bpjsDeductions.deductions,
    ...advanceDeduction.deductions,
    ...loanDeduction.deductions,
  ];
  const totalAllowances = salaryCalculation.allowances.reduce(
    (sum, a) => sum + a.amount,
    0
  );
  const totalDeductions = allDeductions.reduce((sum, d) => sum + d.amount, 0);
  const netSalary =
    salaryCalculation.baseSalary +
    totalAllowances +
    salaryCalculation.meta.overtimeAmount -
    totalDeductions;

  const result = await prisma.$transaction(async (tx) => {
    const payroll = await tx.payroll.create({
      data: {
        employeeId,
        month,
        year,
        baseSalary: salaryCalculation.baseSalary,
        totalAllowances,
        totalDeductions,
        netSalary,
        daysPresent: salaryCalculation.meta.daysPresent,
        daysAbsent: salaryCalculation.meta.daysAbsent,
        daysLate: salaryCalculation.meta.daysLate,
        overtimeHours: salaryCalculation.meta.overtimeHours,
        overtimeAmount: salaryCalculation.meta.overtimeAmount,
        payableHours: salaryCalculation.meta.totalWorkHours + salaryCalculation.meta.overtimeHours,
        lateDeduction: salaryCalculation.deductions
          .filter((d) => d.type === "LATE")
          .reduce((sum, d) => sum + d.amount, 0),
        bpjsKesehatanAmount: employee.bpjsKesehatan,
        bpjsKetenagakerjaanAmount: employee.bpjsKetenagakerjaan,
      },
    });

    for (const allowance of salaryCalculation.allowances) {
      await tx.allowance.create({
        data: {
          employeeId,
          month,
          year,
          type: allowance.type,
          amount: allowance.amount,
        },
      });
    }

    for (const deduction of allDeductions) {
      await tx.deduction.create({
        data: {
          employeeId,
          month,
          year,
          type: deduction.type,
          amount: deduction.amount,
          reason: deduction.reason || "Potongan",
          payrollId: payroll.id,
        },
      });
    }

    if (advanceDeduction.advancesToUpdate.length > 0) {
      await tx.advance.updateMany({
        where: { id: { in: advanceDeduction.advancesToUpdate } },
        data: {
          deductionMonth: month,
          deductionYear: year,
        },
      });
    }

    if (loanDeduction.loansToUpdate.length > 0) {
      for (const loan of loanDeduction.loansToUpdate) {
        await tx.softLoan.update({
          where: { id: loan.id },
          data: {
            remainingAmount: loan.remainingAmount,
            status: loan.status,
            completedAt: loan.completedAt,
          },
        });
      }
    }

    return payroll;
  });

  return result;
};

async function main() {
  console.log("Generating payroll for Jan-Jun 2026...");

  const employees = await prisma.employee.findMany({
    where: { isActive: true },
    include: { user: true },
  });
  console.log(`Found ${employees.length} employees.`);

  const months = [1, 2, 3, 4, 5, 6];
  for (const month of months) {
    console.log(`Processing month ${month}/2026...`);
    for (const employee of employees) {
      try {
        const existing = await prisma.payroll.findFirst({
          where: { employeeId: employee.id, month, year: 2026 },
        });
        if (existing) {
          console.log(`Payroll already exists for ${employee.user?.name} (${employee.employeeId}) - ${month}/2026`);
          continue;
        }
        const payroll = await generateMonthlyPayroll(employee.id, month, 2026);
        console.log(`Generated payroll for ${employee.user?.name} (${employee.employeeId}) - ${month}/2026: Rp ${payroll.netSalary.toLocaleString("id-ID")}`);
      } catch (e) {
        console.error(`Failed to generate payroll for ${employee.user?.name} (${employee.employeeId}) - ${month}/2026:`, e);
      }
    }
  }

  console.log("Payroll generation complete!");
}

main()
  .catch((e) => {
    console.error("Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

