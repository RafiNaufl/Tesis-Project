import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payrollId = id;

    // Get payroll record
    const payroll = await prisma.payroll.findUnique({
      where: { id: payrollId },
      include: {
        employee: true,
      },
    });

    if (!payroll) {
      return NextResponse.json({ error: "Payroll not found" }, { status: 404 });
    }

    // Check if user can access this payroll
    if (session.user.role !== "ADMIN" && session.user.id !== payroll.employee.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get advance deductions for this payroll period
    const advanceDeductions = await prisma.advance.findMany({
      where: {
        employeeId: payroll.employeeId,
        status: "DEDUCTED",
        deductedAt: {
          gte: new Date(payroll.year, payroll.month - 1, 1),
          lt: new Date(payroll.year, payroll.month, 1),
        },
      },
    });

    // Get soft loan deductions for this payroll period
    const softLoanDeductions = await prisma.deduction.findMany({
      where: {
        employeeId: payroll.employeeId,
        type: "SOFT_LOAN",
        month: payroll.month,
        year: payroll.year,
      },
    });

    // Get other deductions for this payroll period
    const otherDeductions = await prisma.deduction.findMany({
      where: {
        employeeId: payroll.employeeId,
        month: payroll.month,
        year: payroll.year,
      },
    });

    // Calculate totals
    const advanceDeduction = advanceDeductions.reduce((sum: number, advance: any) => sum + advance.amount, 0);
    const softLoanDeduction = softLoanDeductions.reduce((sum: number, deduction: any) => sum + deduction.amount, 0);
    const bpjsDeduction = 155814; // Fixed BPJS amount
    const otherDeductionsTotal = otherDeductions.reduce((sum: number, deduction: any) => sum + deduction.amount, 0);

    // Get late and absence deductions from attendance
    const attendanceRecords = await prisma.attendance.findMany({
      where: {
        employeeId: payroll.employeeId,
        date: {
          gte: new Date(payroll.year, payroll.month - 1, 1),
          lt: new Date(payroll.year, payroll.month, 1),
        },
      },
    });

    const lateMinutes = attendanceRecords.reduce((sum: number, record: any) => sum + (record.lateMinutes || 0), 0);
    const absentDays = attendanceRecords.filter((record: any) => record.status === "ABSENT").length;
    
    // Calculate daily rate for deductions
    const dailyRate = payroll.baseSalary / 30;
    const lateDeduction = lateMinutes * 5000; // 5000 per minute late
    const absenceDeduction = absentDays * dailyRate;

    const deductionBreakdown = {
      advanceDeduction,
      softLoanDeduction,
      bpjsDeduction: payroll.totalDeductions > 0 ? bpjsDeduction : 0, // Only include if there are deductions
      lateDeduction,
      absenceDeduction,
      otherDeductions: otherDeductionsTotal,
      totalDeductions: payroll.totalDeductions,
    };

    return NextResponse.json(deductionBreakdown);
  } catch (error) {
    console.error("Error fetching deduction breakdown:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}