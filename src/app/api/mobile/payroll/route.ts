import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getUserFromAuthHeader } from "@/lib/mobileAuth";
import { PayrollResponseSchema } from "@shared/payroll";

export async function GET(req: NextRequest) {
  const user = getUserFromAuthHeader(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const searchParams = req.nextUrl.searchParams;
  const month = searchParams.get("month") ? parseInt(searchParams.get("month")!) : new Date().getMonth() + 1;
  const year = searchParams.get("year") ? parseInt(searchParams.get("year")!) : new Date().getFullYear();

  const employee = await db.employee.findUnique({ where: { userId: user.id } });
  if (!employee) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

  const payroll = await db.payroll.findFirst({
    where: { employeeId: employee.id, month, year },
    select: {
      id: true,
      employeeId: true,
      month: true,
      year: true,
      baseSalary: true,
      totalAllowances: true,
      totalDeductions: true,
      netSalary: true,
    },
  });

  const payload = {
    item: payroll
      ? {
          id: payroll.id,
          employeeId: payroll.employeeId,
          month: payroll.month,
          year: payroll.year,
          baseSalary: payroll.baseSalary,
          allowancesTotal: payroll.totalAllowances ?? 0,
          deductionsTotal: payroll.totalDeductions ?? 0,
          netSalary: payroll.netSalary,
        }
      : null,
  };

  const parsed = PayrollResponseSchema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: "Invalid data" }, { status: 500 });
  return NextResponse.json(parsed.data);
}
