import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

// Define types for the query results
type PayrollSummaryResult = {
  totalbasesalary: string | null;
  totalallowances: string | null;
  totaldeductions: string | null;
  totalnetsalary: string | null;
  totalovertimeamount: string | null;
  employeeCount: string | null;
  averagesalary: string | null;
};

type DepartmentBreakdownResult = {
  department: string;
  employeeCount: string;
  totalSalary: string;
  averageSalary: string;
};

type AttendanceSummaryResult = {
  totalAttendanceRecords: string | null;
  presentCount: string | null;
  absentCount: string | null;
  lateCount: string | null;
  halfdayCount: string | null;
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
    
    // Only admin can access financial summary
    if (session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Unauthorized. Admin access required." },
        { status: 403 }
      );
    }
    
    // Extract query parameters
    const searchParams = request.nextUrl.searchParams;
    const month = searchParams.get("month") ? parseInt(searchParams.get("month")!) : null;
    const year = searchParams.get("year") ? parseInt(searchParams.get("year")!) : null;
    const department = searchParams.get("department");
    
    // Build conditions for filtering
    let monthYearCondition = "";
    let departmentCondition = "";
    let params: any[] = [];
    
    if (month !== null && year !== null) {
      monthYearCondition = `WHERE p.month = $1 AND p.year = $2`;
      params.push(month, year);
    } else if (year !== null) {
      monthYearCondition = `WHERE p.year = $1`;
      params.push(year);
    } else {
      // Default to current month and year if not specified
      const currentDate = new Date();
      const currentMonth = currentDate.getMonth() + 1; // JavaScript months are 0-indexed
      const currentYear = currentDate.getFullYear();
      
      monthYearCondition = `WHERE p.month = $1 AND p.year = $2`;
      params.push(currentMonth, currentYear);
    }
    
    if (department) {
      if (params.length > 0) {
        departmentCondition = `AND e.department = $${params.length + 1}`;
      } else {
        departmentCondition = `WHERE e.department = $1`;
      }
      params.push(department);
    }
    
    // Get payroll summary
    const payrollQuery = `
      SELECT 
        SUM(p."baseSalary") as "totalBaseSalary",
        SUM(p."totalAllowances") as "totalAllowances",
        SUM(p."totalDeductions") as "totalDeductions",
        SUM(p."netSalary") as "totalNetSalary",
        SUM(p."overtimeAmount") as "totalOvertimeAmount",
        COUNT(*) as "employeeCount",
        AVG(p."netSalary") as "averageSalary"
      FROM 
        payrolls p
      JOIN 
        employees e ON p."employeeId" = e.id
      ${monthYearCondition}
      ${departmentCondition}
    `;
    
    const payrollSummary = await db.$queryRawUnsafe(payrollQuery, ...params) as PayrollSummaryResult[];
    
    // Get department-wise breakdown
    const departmentQuery = `
      SELECT 
        e.department,
        COUNT(DISTINCT e.id) as "employeeCount",
        SUM(p."netSalary") as "totalSalary",
        AVG(p."netSalary") as "averageSalary"
      FROM 
        payrolls p
      JOIN 
        employees e ON p."employeeId" = e.id
      ${monthYearCondition}
      ${department ? departmentCondition : ''}
      GROUP BY 
        e.department
      ORDER BY 
        "totalSalary" DESC
    `;
    
    const departmentBreakdown = await db.$queryRawUnsafe(departmentQuery, ...params) as DepartmentBreakdownResult[];
    
    // Get employee attendance statistics
    const attendanceParams = [...params]; // Create a copy of params for attendance query
    
    let attendanceMonthYearCondition = "";
    
    if (month !== null && year !== null) {
      attendanceMonthYearCondition = `WHERE EXTRACT(MONTH FROM a.date) = $1 AND EXTRACT(YEAR FROM a.date) = $2`;
    } else if (year !== null) {
      attendanceMonthYearCondition = `WHERE EXTRACT(YEAR FROM a.date) = $1`;
    } else {
      // Default to current month and year
      const currentDate = new Date();
      const currentMonth = currentDate.getMonth() + 1;
      const currentYear = currentDate.getFullYear();
      
      attendanceMonthYearCondition = `WHERE EXTRACT(MONTH FROM a.date) = $1 AND EXTRACT(YEAR FROM a.date) = $2`;
      if (attendanceParams.length === 0) {
        attendanceParams.push(currentMonth, currentYear);
      }
    }
    
    let attendanceDepartmentCondition = "";
    
    if (department) {
      if (attendanceParams.length > 0) {
        attendanceDepartmentCondition = `AND e.department = $${attendanceParams.length + 1}`;
      } else {
        attendanceDepartmentCondition = `WHERE e.department = $1`;
      }
      
      if (!attendanceParams.includes(department)) {
        attendanceParams.push(department);
      }
    }
    
    const attendanceQuery = `
      SELECT 
        COUNT(*) as "totalAttendanceRecords",
        COUNT(CASE WHEN a.status = 'PRESENT' THEN 1 END) as "presentCount",
        COUNT(CASE WHEN a.status = 'ABSENT' THEN 1 END) as "absentCount",
        COUNT(CASE WHEN a.status = 'LATE' THEN 1 END) as "lateCount",
        COUNT(CASE WHEN a.status = 'HALFDAY' THEN 1 END) as "halfdayCount"
      FROM 
        attendances a
      JOIN 
        employees e ON a."employeeId" = e.id
      ${attendanceMonthYearCondition}
      ${attendanceDepartmentCondition}
    `;
    
    const attendanceSummary = await db.$queryRawUnsafe(attendanceQuery, ...attendanceParams) as AttendanceSummaryResult[];
    
    // Format the response
    const result = {
      period: {
        month: month,
        year: year,
        department: department || "All Departments"
      },
      payroll: {
        totalBaseSalary: Number(payrollSummary[0]?.totalbasesalary || 0),
        totalAllowances: Number(payrollSummary[0]?.totalallowances || 0),
        totalDeductions: Number(payrollSummary[0]?.totaldeductions || 0),
        totalNetSalary: Number(payrollSummary[0]?.totalnetsalary || 0),
        totalOvertimeAmount: Number(payrollSummary[0]?.totalovertimeamount || 0),
        employeeCount: Number(payrollSummary[0]?.employeeCount || 0),
        averageSalary: Number(payrollSummary[0]?.averagesalary || 0)
      },
      departments: departmentBreakdown.map((dept) => ({
        name: dept.department,
        employeeCount: Number(dept.employeeCount),
        totalSalary: Number(dept.totalSalary),
        averageSalary: Number(dept.averageSalary)
      })),
      attendance: {
        totalAttendanceRecords: Number(attendanceSummary[0]?.totalAttendanceRecords || 0),
        presentCount: Number(attendanceSummary[0]?.presentCount || 0),
        absentCount: Number(attendanceSummary[0]?.absentCount || 0),
        lateCount: Number(attendanceSummary[0]?.lateCount || 0),
        halfdayCount: Number(attendanceSummary[0]?.halfdayCount || 0)
      }
    };
    
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error generating financial summary:", error);
    return NextResponse.json(
      { error: "Failed to generate financial summary" },
      { status: 500 }
    );
  }
} 