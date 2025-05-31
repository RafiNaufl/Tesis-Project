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
    
    try {
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
          COALESCE(SUM(p."baseSalary"), 0) as "totalBaseSalary",
          COALESCE(SUM(p."totalAllowances"), 0) as "totalAllowances",
          COALESCE(SUM(p."totalDeductions"), 0) as "totalDeductions",
          COALESCE(SUM(p."netSalary"), 0) as "totalNetSalary",
          COALESCE(SUM(p."overtimeAmount"), 0) as "totalOvertimeAmount",
          COUNT(*) as "employeeCount",
          CASE 
            WHEN COUNT(*) > 0 THEN AVG(p."netSalary") 
            ELSE 0 
          END as "averageSalary"
        FROM 
          payrolls p
        JOIN 
          employees e ON p."employeeId" = e.id
        ${monthYearCondition}
        ${departmentCondition}
      `;
      
      // Tambahkan log untuk debugging
      console.log("Payroll Query:", payrollQuery);
      console.log("Params:", params);
      
      const payrollSummary = await db.$queryRawUnsafe(payrollQuery, ...params) as PayrollSummaryResult[];
      
      // Dapatkan jumlah penggajian tertunda dengan query yang lebih sederhana
      const pendingPayrollQuery = `
        SELECT 
          COUNT(*) as "pendingCount"
        FROM 
          payrolls p
        JOIN 
          employees e ON p."employeeId" = e.id
        WHERE 
          p.status = 'PENDING'
      `;
      
      const pendingPayroll = await db.$queryRaw`
        SELECT COUNT(*) as "pendingCount"
        FROM payrolls
        WHERE status = 'PENDING'
      `;
      
      // Get department-wise breakdown - gunakan COALESCE untuk menghindari nilai NULL
      const departmentQuery = `
        SELECT 
          e.department,
          COUNT(DISTINCT e.id) as "employeeCount",
          COALESCE(SUM(p."netSalary"), 0) as "totalSalary",
          CASE 
            WHEN COUNT(*) > 0 THEN AVG(p."netSalary") 
            ELSE 0 
          END as "averageSalary"
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
      
      // Gunakan query yang lebih sederhana untuk kehadiran
      const attendanceSummary = await db.$queryRaw`
        SELECT 
          COUNT(*) as "totalAttendanceRecords",
          COUNT(CASE WHEN status = 'PRESENT' THEN 1 END) as "presentCount",
          COUNT(CASE WHEN status = 'ABSENT' THEN 1 END) as "absentCount",
          COUNT(CASE WHEN status = 'LATE' THEN 1 END) as "lateCount",
          COUNT(CASE WHEN status = 'HALFDAY' THEN 1 END) as "halfdayCount"
        FROM 
          attendances
      ` as AttendanceSummaryResult[];
      
      // Dapatkan kehadiran hari ini dengan query yang lebih sederhana
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = today.toISOString().split('T')[0];
      
      const todayAttendance = await db.$queryRaw`
        SELECT 
          COUNT(*) as "presentToday"
        FROM 
          attendances
        WHERE 
          DATE(date) = ${todayStr}
          AND (status = 'PRESENT' OR status = 'LATE' OR status = 'HALFDAY')
      `;
      
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
          averageSalary: Number(payrollSummary[0]?.averagesalary || 0),
          pendingCount: Number(pendingPayroll[0]?.pendingCount || 0)
        },
        departments: departmentBreakdown.map((dept) => ({
          name: dept.department,
          employeeCount: Number(dept.employeeCount || 0),
          totalSalary: Number(dept.totalSalary || 0),
          averageSalary: Number(dept.averageSalary || 0)
        })),
        attendance: {
          totalAttendanceRecords: Number(attendanceSummary[0]?.totalAttendanceRecords || 0),
          presentCount: Number(attendanceSummary[0]?.presentCount || 0),
          absentCount: Number(attendanceSummary[0]?.absentCount || 0),
          lateCount: Number(attendanceSummary[0]?.lateCount || 0),
          halfdayCount: Number(attendanceSummary[0]?.halfdayCount || 0),
          presentToday: Number(todayAttendance[0]?.presentToday || 0)
        }
      };
      
      return NextResponse.json(result);
    } catch (dbError: any) {
      console.error("Database error:", dbError);
      
      // Jika terjadi error database, kembalikan data minimal untuk mencegah error di frontend
      return NextResponse.json({
        period: { month: month, year: year, department: department || "All Departments" },
        payroll: { 
          totalBaseSalary: 0, totalAllowances: 0, totalDeductions: 0, 
          totalNetSalary: 0, totalOvertimeAmount: 0, employeeCount: 0, 
          averageSalary: 0, pendingCount: 0 
        },
        departments: [],
        attendance: {
          totalAttendanceRecords: 0, presentCount: 0, absentCount: 0,
          lateCount: 0, halfdayCount: 0, presentToday: 0
        },
        error: dbError.message || "Terjadi kesalahan pada database"
      });
    }
  } catch (error: any) {
    console.error("Error generating financial summary:", error);
    return NextResponse.json(
      { 
        error: "Failed to generate financial summary", 
        message: error.message,
        // Sediakan data minimal untuk mencegah error di frontend
        period: {}, 
        payroll: { totalBaseSalary: 0, totalNetSalary: 0, employeeCount: 0, pendingCount: 0 },
        departments: [],
        attendance: { presentToday: 0 }
      },
      { status: 500 }
    );
  }
} 