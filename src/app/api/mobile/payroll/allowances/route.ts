import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getUserFromAuthHeader } from "@/lib/mobileAuth";
import { AllowanceListResponseSchema } from "@shared/allowance";

export async function GET(req: NextRequest) {
  const user = getUserFromAuthHeader(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const searchParams = req.nextUrl.searchParams;
  const month = searchParams.get("month") ? parseInt(searchParams.get("month")!) : new Date().getMonth() + 1;
  const year = searchParams.get("year") ? parseInt(searchParams.get("year")!) : new Date().getFullYear();

  const employee = await db.employee.findUnique({ where: { userId: user.id } });
  if (!employee) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

  const items = await db.allowance.findMany({
    where: { employeeId: employee.id, month, year },
    orderBy: { date: "desc" },
    select: {
      id: true,
      employeeId: true,
      type: true,
      amount: true,
      month: true,
      year: true,
      date: true,
    },
  });

  const payload = {
    items: items.map((item) => ({
      id: item.id,
      employeeId: item.employeeId,
      type: item.type,
      amount: item.amount,
      month: item.month,
      year: item.year,
      createdAt: item.date,
    })),
  };
  const parsed = AllowanceListResponseSchema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: "Invalid data" }, { status: 500 });
  return NextResponse.json(parsed.data);
}
