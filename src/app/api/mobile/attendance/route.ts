import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getUserFromAuthHeader } from "@/lib/mobileAuth";
import { AttendanceListResponseSchema } from "@shared/attendance";

export async function GET(req: NextRequest) {
  const user = getUserFromAuthHeader(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const searchParams = req.nextUrl.searchParams;
  const month = searchParams.get("month") ? parseInt(searchParams.get("month")!) : new Date().getMonth() + 1;
  const year = searchParams.get("year") ? parseInt(searchParams.get("year")!) : new Date().getFullYear();
  const page = searchParams.get("page") ? Math.max(parseInt(searchParams.get("page")!), 1) : 1;
  const pageSize = searchParams.get("pageSize") ? Math.max(parseInt(searchParams.get("pageSize")!), 1) : 10;

  const employee = await db.employee.findUnique({ where: { userId: user.id } });
  if (!employee) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0, 23, 59, 59, 999);

  const [items, total] = await Promise.all([
    db.attendance.findMany({
    where: { employeeId: employee.id, date: { gte: start, lte: end } },
    orderBy: { date: "asc" },
    skip: (page - 1) * pageSize,
    take: pageSize,
    select: {
      id: true,
      employeeId: true,
      date: true,
      checkIn: true,
      checkOut: true,
      status: true,
      notes: true,
    },
  }),
    db.attendance.count({ where: { employeeId: employee.id, date: { gte: start, lte: end } } })
  ]);

  const payload = { items, total, page, pageSize };
  const parsed = AttendanceListResponseSchema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: "Invalid data" }, { status: 500 });
  return NextResponse.json(parsed.data);
}
