import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

type PayrollRecord = {
  id: string;
  employeeId: string;
  month: number;
  year: number;
  baseSalary: number;
  totalAllowances: number;
  totalDeductions: number;
  netSalary: number;
  daysPresent: number;
  daysAbsent: number;
  overtimeHours: number;
  overtimeAmount: number;
  status: string;
  createdAt: Date;
  paidAt: Date | null;
  empId: string;
  employeeName: string;
  position: string;
  department: string;
};

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }
    
    // Extract query parameters
    const searchParams = request.nextUrl.searchParams;
    const employeeId = searchParams.get("employeeId");
    const month = searchParams.get("month") ? parseInt(searchParams.get("month")!) : null;
    const year = searchParams.get("year") ? parseInt(searchParams.get("year")!) : null;
    const status = searchParams.get("status");
    const fromDate = searchParams.get("fromDate");
    const toDate = searchParams.get("toDate");
    
    // Build the SQL query conditions
    let conditions = [];
    let params: any[] = [];
    
    if (employeeId) {
      conditions.push(`p."employeeId" = $${params.length + 1}`);
      params.push(employeeId);
    } else if (session.user.role !== "ADMIN") {
      // If not admin, only show the employee's own payroll
      const employee = await db.employee.findUnique({
        where: { userId: session.user.id },
      });
      
      if (!employee) {
        return NextResponse.json(
          { error: "Employee not found" },
          { status: 404 }
        );
      }
      
      conditions.push(`p."employeeId" = $${params.length + 1}`);
      params.push(employee.id);
    }
    
    if (month !== null) {
      conditions.push(`p.month = $${params.length + 1}`);
      params.push(month);
    }
    
    if (year !== null) {
      conditions.push(`p.year = $${params.length + 1}`);
      params.push(year);
    }
    
    if (status) {
      conditions.push(`p.status = $${params.length + 1}`);
      params.push(status);
    }
    
    if (fromDate) {
      conditions.push(`p."createdAt" >= $${params.length + 1}`);
      params.push(new Date(fromDate));
    }
    
    if (toDate) {
      conditions.push(`p."createdAt" <= $${params.length + 1}`);
      params.push(new Date(toDate));
    }
    
    // Construct the WHERE clause
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    
    // Execute the query
    const query = `
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
        p.status,
        p."createdAt",
        p."paidAt",
        e."employeeId" AS "empId",
        u.name AS "employeeName",
        e.position,
        e.department
      FROM 
        payrolls p
      JOIN 
        employees e ON p."employeeId" = e.id
      JOIN 
        users u ON e."userId" = u.id
      ${whereClause}
      ORDER BY 
        p.year DESC, p.month DESC
    `;
    
    const result = await db.$queryRawUnsafe<PayrollRecord[]>(query, ...params);
    
    // Calculate summary statistics
    const summary = {
      totalRecords: result.length,
      totalNetSalary: result.reduce((sum, record) => sum + Number(record.netSalary), 0),
      totalBaseSalary: result.reduce((sum, record) => sum + Number(record.baseSalary), 0),
      totalAllowances: result.reduce((sum, record) => sum + Number(record.totalAllowances), 0),
      totalDeductions: result.reduce((sum, record) => sum + Number(record.totalDeductions), 0),
      pendingPayrolls: result.filter(record => record.status === "PENDING").length,
      paidPayrolls: result.filter(record => record.status === "PAID").length,
      cancelledPayrolls: result.filter(record => record.status === "CANCELLED").length,
    };
    
    return NextResponse.json({ 
      data: result,
      summary: summary
    });
  } catch (error) {
    console.error("Error generating payroll report:", error);
    return NextResponse.json(
      { error: "Failed to generate payroll report" },
      { status: 500 }
    );
  }
} 