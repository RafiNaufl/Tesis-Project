import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

const ADMIN_ROLES = new Set(["ADMIN", "MANAGER", "DIREKTUR"]);

function getPeriodFilter(searchParams: URLSearchParams) {
  const monthParam = searchParams.get("month");
  const yearParam = searchParams.get("year");
  const startDateParam = searchParams.get("startDate");
  const endDateParam = searchParams.get("endDate");

  const now = new Date();
  const parsedMonth = monthParam ? Number.parseInt(monthParam, 10) : now.getMonth() + 1;
  const parsedYear = yearParam ? Number.parseInt(yearParam, 10) : now.getFullYear();

  if (
    startDateParam &&
    endDateParam &&
    !Number.isNaN(new Date(startDateParam).getTime()) &&
    !Number.isNaN(new Date(endDateParam).getTime())
  ) {
    const startDate = new Date(startDateParam);
    const endDate = new Date(endDateParam);
    endDate.setHours(23, 59, 59, 999);

    const monthYearPairs: Array<{ month: number; year: number }> = [];
    const cursor = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    const endCursor = new Date(endDate.getFullYear(), endDate.getMonth(), 1);

    while (cursor <= endCursor) {
      monthYearPairs.push({
        month: cursor.getMonth() + 1,
        year: cursor.getFullYear(),
      });
      cursor.setMonth(cursor.getMonth() + 1);
    }

    return {
      mode: "range" as const,
      month: parsedMonth,
      year: parsedYear,
      startDate,
      endDate,
      monthYearPairs,
    };
  }

  const safeMonth = Number.isNaN(parsedMonth) ? now.getMonth() + 1 : parsedMonth;
  const safeYear = Number.isNaN(parsedYear) ? now.getFullYear() : parsedYear;

  return {
    mode: "month" as const,
    month: safeMonth,
    year: safeYear,
    startDate: new Date(safeYear, safeMonth - 1, 1),
    endDate: new Date(safeYear, safeMonth, 0, 23, 59, 59, 999),
    monthYearPairs: [{ month: safeMonth, year: safeYear }],
  };
}

function buildMonthYearWhere(
  employeeId: string,
  monthYearPairs: Array<{ month: number; year: number }>
) {
  if (monthYearPairs.length === 1) {
    return {
      employeeId,
      month: monthYearPairs[0].month,
      year: monthYearPairs[0].year,
    };
  }

  return {
    employeeId,
    OR: monthYearPairs.map((pair) => ({
      month: pair.month,
      year: pair.year,
    })),
  };
}

function getMonthIndex(month: number, year: number) {
  return year * 12 + (month - 1);
}

function summarizeAttendance(attendances: Array<{ status: string; isLate: boolean; lateMinutes: number }>) {
  return attendances.reduce(
    (summary, attendance) => {
      const status = (attendance.status || "").toUpperCase();

      if (status === "PRESENT") {
        summary.present += 1;
      }
      if (status === "LATE" || attendance.isLate) {
        summary.late += 1;
      }
      if (status === "LEAVE") {
        summary.leave += 1;
      }
      if (status === "ABSENT") {
        summary.absent += 1;
      }

      summary.totalLateMinutes += attendance.lateMinutes || 0;
      return summary;
    },
    {
      present: 0,
      late: 0,
      leave: 0,
      absent: 0,
      totalLateMinutes: 0,
      totalRecords: attendances.length,
    }
  );
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: "Tidak diizinkan" }, { status: 401 });
    }

    if (!ADMIN_ROLES.has(session.user.role)) {
      return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
    }

    const { id } = await params;
    const periodFilter = getPeriodFilter(req.nextUrl.searchParams);

    const employee = await prisma.employee.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            profileImageUrl: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        employeeIdLogs: {
          orderBy: {
            createdAt: "desc",
          },
        },
      },
    });

    if (!employee) {
      return NextResponse.json({ error: "Karyawan tidak ditemukan" }, { status: 404 });
    }

    const monthYearWhere = buildMonthYearWhere(id, periodFilter.monthYearPairs);

    const [
      attendances,
      advances,
      softLoansRaw,
      deductions,
      allowances,
      payrolls,
      leaveRequests,
      overtimeRequests,
      auditLogs,
    ] = await Promise.all([
      prisma.attendance.findMany({
        where: {
          employeeId: id,
          date: {
            gte: periodFilter.startDate,
            lte: periodFilter.endDate,
          },
        },
        orderBy: {
          date: "desc",
        },
      }),
      prisma.advance.findMany({
        where: monthYearWhere,
        orderBy: {
          createdAt: "desc",
        },
      }),
      prisma.softLoan.findMany({
        where: {
          employeeId: id,
        },
        orderBy: {
          createdAt: "desc",
        },
      }),
      prisma.deduction.findMany({
        where: monthYearWhere,
        orderBy: [{ year: "desc" }, { month: "desc" }, { date: "desc" }],
      }),
      prisma.allowance.findMany({
        where: monthYearWhere,
        select: {
          id: true,
          employeeId: true,
          month: true,
          year: true,
          type: true,
          amount: true,
          date: true,
        },
        orderBy: [{ year: "desc" }, { month: "desc" }, { date: "desc" }],
      }),
      prisma.payroll.findMany({
        where: monthYearWhere,
        orderBy: [{ year: "desc" }, { month: "desc" }],
        select: {
          id: true,
          employeeId: true,
          month: true,
          year: true,
          baseSalary: true,
          totalAllowances: true,
          totalDeductions: true,
          netSalary: true,
          daysPresent: true,
          daysAbsent: true,
          daysLate: true,
          overtimeHours: true,
          overtimeAmount: true,
          payableHours: true,
          lateDeduction: true,
          advanceDeduction: true,
          softLoanDeduction: true,
          bpjsKesehatanAmount: true,
          bpjsKetenagakerjaanAmount: true,
          status: true,
          createdAt: true,
          paidAt: true,
        },
      }),
      prisma.leave.findMany({
        where: {
          employeeId: id,
          startDate: {
            lte: periodFilter.endDate,
          },
          endDate: {
            gte: periodFilter.startDate,
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      }),
      prisma.overtimeRequest.findMany({
        where: {
          employeeId: id,
          date: {
            gte: periodFilter.startDate,
            lte: periodFilter.endDate,
          },
        },
        orderBy: {
          date: "desc",
        },
      }),
      prisma.auditLog.findMany({
        where: {
          employeeId: id,
          createdAt: {
            gte: periodFilter.startDate,
            lte: periodFilter.endDate,
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 50,
      }),
    ]);

    const periodStartIndex = getMonthIndex(
      periodFilter.monthYearPairs[0].month,
      periodFilter.monthYearPairs[0].year
    );
    const periodEndIndex = getMonthIndex(
      periodFilter.monthYearPairs[periodFilter.monthYearPairs.length - 1].month,
      periodFilter.monthYearPairs[periodFilter.monthYearPairs.length - 1].year
    );

    const softLoans = softLoansRaw.filter((loan) => {
      const loanStartIndex = getMonthIndex(loan.startMonth, loan.startYear);
      const loanEndIndex = loanStartIndex + Math.max(loan.durationMonths - 1, 0);
      return loanStartIndex <= periodEndIndex && loanEndIndex >= periodStartIndex;
    });

    const attendanceSummary = summarizeAttendance(attendances);

    const deductionSummary = deductions.reduce<Record<string, number>>((summary, deduction) => {
      const key = deduction.type || "OTHER";
      summary[key] = (summary[key] || 0) + deduction.amount;
      return summary;
    }, {});

    const loanSummary = {
      advancesRequested: advances.reduce((total, advance) => total + advance.amount, 0),
      activeAdvanceCount: advances.filter((advance) => advance.status === "PENDING").length,
      softLoanPrincipal: softLoans.reduce((total, loan) => total + loan.totalAmount, 0),
      softLoanRemaining: softLoans.reduce((total, loan) => total + loan.remainingAmount, 0),
      activeSoftLoanCount: softLoans.filter((loan) => loan.status === "ACTIVE").length,
      completedSoftLoanCount: softLoans.filter((loan) => loan.status === "COMPLETED").length,
    };

    const payrollSummary = {
      totalPayrolls: payrolls.length,
      totalNetSalaryPaid: payrolls.reduce((total, payroll) => total + payroll.netSalary, 0),
      totalOvertimeAmount: payrolls.reduce((total, payroll) => total + payroll.overtimeAmount, 0),
      totalDeductions: payrolls.reduce((total, payroll) => total + payroll.totalDeductions, 0),
      totalAllowances: payrolls.reduce((total, payroll) => total + payroll.totalAllowances, 0),
      latestPayrollPeriod:
        payrolls.length > 0 ? `${payrolls[0].month}/${payrolls[0].year}` : null,
    };

    return NextResponse.json({
      employee,
      attendance: {
        filters: {
          mode: periodFilter.mode,
          month: periodFilter.month,
          year: periodFilter.year,
          startDate: periodFilter.startDate.toISOString(),
          endDate: periodFilter.endDate.toISOString(),
        },
        summary: attendanceSummary,
        records: attendances,
      },
      loans: {
        summary: loanSummary,
        advances,
        softLoans,
      },
      deductions: {
        summaryByType: deductionSummary,
        records: deductions,
      },
      allowances: {
        records: allowances,
      },
      payroll: {
        summary: payrollSummary,
        records: payrolls,
      },
      related: {
        leaveRequests,
        overtimeRequests,
        employeeIdLogs: employee.employeeIdLogs,
        auditLogs,
      },
      additionalData: {
        emergencyContact: null,
        workHistory:
          employee.employeeIdLogs.length > 0
            ? employee.employeeIdLogs
            : [
                {
                  id: "joining-date",
                  reason: "Tanggal bergabung",
                  oldEmployeeId: null,
                  newEmployeeId: employee.employeeId,
                  createdAt: employee.joiningDate,
                },
              ],
        performanceReviews: [],
        disciplineNotes: [],
        notes: [
          "Kontak darurat belum tersimpan pada basis data saat ini.",
          "Modul penilaian kinerja formal belum tersedia pada sistem saat ini.",
          "Modul catatan disiplin formal belum tersedia pada sistem saat ini.",
        ],
      },
    });
  } catch (error) {
    console.error("Error fetching employee detail:", error);
    return NextResponse.json(
      { error: "Gagal mengambil detail karyawan" },
      { status: 500 }
    );
  }
}
