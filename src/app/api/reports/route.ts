import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { db } from "@/lib/db";
import { authOptions } from "@/lib/auth";

// GET /api/reports - Get various report data
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only admins can access reports
    if (session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Only admins can access reports" },
        { status: 403 }
      );
    }

    const searchParams = req.nextUrl.searchParams;
    const reportType = searchParams.get("type");
    const month = searchParams.get("month");
    const year = searchParams.get("year");
    const employeeId = searchParams.get("employeeId");

    // Parse month and year if provided
    const monthNum = month ? parseInt(month) : new Date().getMonth() + 1;
    const yearNum = year ? parseInt(year) : new Date().getFullYear();

    if (!reportType) {
      return NextResponse.json(
        { error: "Report type is required" },
        { status: 400 }
      );
    }

    let reportData = null;

    switch (reportType) {
      case "attendance":
        reportData = await generateAttendanceReport(monthNum, yearNum, employeeId);
        break;
      case "payroll":
        reportData = await generatePayrollReport(monthNum, yearNum, employeeId);
        break;
      case "financial":
        reportData = await generateFinancialReport(monthNum, yearNum);
        break;
      default:
        return NextResponse.json(
          { error: "Invalid report type" },
          { status: 400 }
        );
    }

    return NextResponse.json(reportData);
  } catch (error) {
    console.error("Error generating report:", error);
    return NextResponse.json(
      { error: "Failed to generate report" },
      { status: 500 }
    );
  }
}

// Helper function to generate attendance report
async function generateAttendanceReport(month: number, year: number, employeeId?: string | null) {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0); // Last day of the month
  endDate.setHours(23, 59, 59, 999);

  const whereClause: any = {
    date: {
      gte: startDate,
      lte: endDate,
    },
  };

  if (employeeId) {
    whereClause.employeeId = employeeId;
  }

  // Get all attendance records for the month
  const attendanceRecords = await db.attendance.findMany({
    where: whereClause,
    include: {
      employee: {
        include: {
          user: {
            select: {
              name: true,
            },
          },
        },
      },
    },
    orderBy: [
      { date: "asc" },
    ],
  });

  // Group attendance by employee
  const attendanceByEmployee: { [key: string]: any } = {};
  attendanceRecords.forEach(record => {
    const employeeId = record.employeeId;
    if (!attendanceByEmployee[employeeId]) {
      attendanceByEmployee[employeeId] = {
        employee: {
          id: record.employee.id,
          employeeId: record.employee.employeeId,
          name: record.employee.user.name,
        },
        records: [],
        summary: {
          present: 0,
          absent: 0,
          late: 0,
          halfday: 0,
          total: 0,
        },
      };
    }

    attendanceByEmployee[employeeId].records.push({
      id: record.id,
      date: record.date,
      checkIn: record.checkIn,
      checkOut: record.checkOut,
      status: record.status,
      notes: record.notes,
    });

    // Update summary
    attendanceByEmployee[employeeId].summary.total++;
    if (record.status === "PRESENT") {
      attendanceByEmployee[employeeId].summary.present++;
    } else if (record.status === "ABSENT") {
      attendanceByEmployee[employeeId].summary.absent++;
    } else if (record.status === "LATE") {
      attendanceByEmployee[employeeId].summary.late++;
    } else if (record.status === "HALFDAY") {
      attendanceByEmployee[employeeId].summary.halfday++;
    }
  });

  // Calculate working days in the month
  const workingDays = calculateWorkingDaysInMonth(month, year);

  return {
    type: "attendance",
    month,
    year,
    workingDays,
    employees: Object.values(attendanceByEmployee),
  };
}

// Helper function to generate payroll report
async function generatePayrollReport(month: number, year: number, employeeId?: string | null) {
  const whereClause: any = {
    month,
    year,
  };

  if (employeeId) {
    whereClause.employeeId = employeeId;
  }

  // Get all payroll records for the month
  const payrollRecords = await db.payroll.findMany({
    where: whereClause,
    include: {
      employee: {
        include: {
          user: {
            select: {
              name: true,
            },
          },
        },
      },
    },
    orderBy: [
      { employee: { employeeId: "asc" } },
    ],
  });

  // Calculate totals
  const totals = {
    baseSalary: 0,
    totalAllowances: 0,
    totalDeductions: 0,
    overtimeAmount: 0,
    netSalary: 0,
  };

  const payrollData = payrollRecords.map(record => {
    // Update totals
    totals.baseSalary += record.baseSalary;
    totals.totalAllowances += record.totalAllowances;
    totals.totalDeductions += record.totalDeductions;
    totals.overtimeAmount += record.overtimeAmount;
    totals.netSalary += record.netSalary;

    return {
      id: record.id,
      employee: {
        id: record.employee.id,
        employeeId: record.employee.employeeId,
        name: record.employee.user.name,
      },
      month: record.month,
      year: record.year,
      baseSalary: record.baseSalary,
      totalAllowances: record.totalAllowances,
      totalDeductions: record.totalDeductions,
      overtimeHours: record.overtimeHours,
      overtimeAmount: record.overtimeAmount,
      daysPresent: record.daysPresent,
      daysAbsent: record.daysAbsent,
      netSalary: record.netSalary,
      status: record.status,
      paidAt: record.paidAt,
    };
  });

  return {
    type: "payroll",
    month,
    year,
    payroll: payrollData,
    totals,
  };
}

// Helper function to generate financial report
async function generateFinancialReport(month: number, year: number) {
  // Get all payroll records for the month
  const payrollRecords = await db.payroll.findMany({
    where: {
      month,
      year,
    },
  });

  // Calculate financial summary
  const totalEmployees = payrollRecords.length;
  const totalBaseSalary = payrollRecords.reduce((sum, record) => sum + record.baseSalary, 0);
  const totalAllowances = payrollRecords.reduce((sum, record) => sum + record.totalAllowances, 0);
  const totalDeductions = payrollRecords.reduce((sum, record) => sum + record.totalDeductions, 0);
  const totalOvertimeAmount = payrollRecords.reduce((sum, record) => sum + record.overtimeAmount, 0);
  const totalNetSalary = payrollRecords.reduce((sum, record) => sum + record.netSalary, 0);
  
  const totalPaid = payrollRecords
    .filter(record => record.status === "PAID")
    .reduce((sum, record) => sum + record.netSalary, 0);
  
  const totalPending = payrollRecords
    .filter(record => record.status === "PENDING")
    .reduce((sum, record) => sum + record.netSalary, 0);

  // Get division-wise expense
  const employees = await db.employee.findMany({
    select: {
      id: true,
      division: true,
    },
  });

  const divisionMap = employees.reduce((map, emp) => {
    map[emp.id] = emp.division;
    return map;
  }, {} as Record<string, string>);

  const divisionExpenses: Record<string, number> = {};
  
  payrollRecords.forEach(record => {
    const division = divisionMap[record.employeeId] || "Unknown";
    divisionExpenses[division] = (divisionExpenses[division] || 0) + record.netSalary;
  });

  return {
    type: "financial",
    month,
    year,
    summary: {
      totalEmployees,
      totalBaseSalary,
      totalAllowances,
      totalDeductions,
      totalOvertimeAmount,
      totalNetSalary,
      totalPaid,
      totalPending,
    },
    divisionExpenses: Object.entries(divisionExpenses).map(([division, amount]) => ({
      division,
      amount,
    })),
  };
}

// Helper function to calculate working days in a month (Mon-Fri)
function calculateWorkingDaysInMonth(month: number, year: number) {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);
  
  let workingDays = 0;
  const currentDate = new Date(startDate);
  
  while (currentDate <= endDate) {
    const dayOfWeek = currentDate.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      // Not weekend (0 = Sunday, 6 = Saturday)
      workingDays++;
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return workingDays;
} 