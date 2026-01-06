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

    // Get other deductions for this payroll period
    const deductions = await prisma.deduction.findMany({
      where: {
        employeeId: payroll.employeeId,
        month: payroll.month,
        year: payroll.year,
      },
    });

    const advanceDeduction = deductions
      .filter((d) => d.type === "KASBON")
      .reduce((sum, d) => sum + d.amount, 0);

    const softLoanDeduction = deductions
      .filter((d) => d.type === "PINJAMAN")
      .reduce((sum, d) => sum + d.amount, 0);

    const absenceDeduction = deductions
      .filter((d) => d.type === "ABSENCE")
      .reduce((sum, d) => sum + d.amount, 0);

    const otherDeductionsTotal = deductions
      .filter(
        (d) =>
          !["ABSENCE", "LATE", "BPJS_KESEHATAN", "BPJS_KETENAGAKERJAAN", "KASBON", "PINJAMAN"].includes(d.type)
      )
      .reduce((sum, d) => sum + d.amount, 0);

    const deductionBreakdown = {
      advanceDeduction,
      softLoanDeduction,
      bpjsKesehatan: payroll.bpjsKesehatanAmount || 0,
      bpjsKetenagakerjaan: payroll.bpjsKetenagakerjaanAmount || 0,
      lateDeduction: payroll.lateDeduction,
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