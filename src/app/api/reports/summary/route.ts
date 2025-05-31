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
    // Cek apakah pengguna terautentikasi
    const session = await getServerSession(authOptions);
    let isAuthenticated = false;
    let isAdmin = false;

    if (session) {
      isAuthenticated = true;
      isAdmin = session.user.role === "ADMIN";
    }

    // Extract query parameters
    const searchParams = request.nextUrl.searchParams;
    const month = searchParams.get("month") ? parseInt(searchParams.get("month")!) : null;
    const year = searchParams.get("year") ? parseInt(searchParams.get("year")!) : null;
    const department = searchParams.get("department");
    
    // Jika pengguna tidak terautentikasi atau bukan admin, berikan data dummy
    if (!isAuthenticated || !isAdmin) {
      // Berikan data default untuk tampilan dashboard
      return NextResponse.json({
        period: { 
          month: month || new Date().getMonth() + 1, 
          year: year || new Date().getFullYear(), 
          department: department || "All Departments" 
        },
        payroll: { 
          totalBaseSalary: 0, 
          totalAllowances: 0, 
          totalDeductions: 0, 
          totalNetSalary: 0, 
          totalOvertimeAmount: 0, 
          employeeCount: 0, 
          averageSalary: 0, 
          pendingCount: 0 
        },
        departments: [],
        attendance: {
          totalAttendanceRecords: 0, 
          presentCount: 0, 
          absentCount: 0,
          lateCount: 0, 
          halfdayCount: 0, 
          presentToday: 0
        }
      });
    }

    try {
      // Dapatkan jumlah karyawan
      const employeeCount = await db.employee.count({
        where: {
          isActive: true
        }
      });

      // Dapatkan jumlah penggajian tertunda
      const pendingCount = await db.payroll.count({
        where: {
          status: "PENDING"
        }
      });

      // Dapatkan total pengeluaran gaji
      const payrollSummary = await db.payroll.aggregate({
        _sum: {
          netSalary: true
        }
      });

      // Dapatkan jumlah kehadiran hari ini
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = today.toISOString().split('T')[0];

      const presentToday = await db.attendance.count({
        where: {
          date: {
            gte: new Date(todayStr),
            lt: new Date(new Date(todayStr).setDate(new Date(todayStr).getDate() + 1))
          },
          status: {
            in: ["PRESENT", "LATE", "HALFDAY"]
          }
        }
      });

      // Format the response with data yang dibutuhkan dashboard
      const result = {
        period: {
          month: month || new Date().getMonth() + 1,
          year: year || new Date().getFullYear(),
          department: department || "All Departments"
        },
        payroll: {
          totalBaseSalary: 0,
          totalAllowances: 0,
          totalDeductions: 0,
          totalNetSalary: payrollSummary._sum.netSalary || 0,
          totalOvertimeAmount: 0,
          employeeCount: employeeCount,
          averageSalary: employeeCount > 0 ? (payrollSummary._sum.netSalary || 0) / employeeCount : 0,
          pendingCount: pendingCount
        },
        departments: [],
        attendance: {
          totalAttendanceRecords: 0,
          presentCount: 0,
          absentCount: 0,
          lateCount: 0,
          halfdayCount: 0,
          presentToday: presentToday
        }
      };

      return NextResponse.json(result);
    } catch (dbError: any) {
      console.error("Database error:", dbError);
      
      // Return fallback data minimal
      return NextResponse.json({
        period: { 
          month: month || new Date().getMonth() + 1, 
          year: year || new Date().getFullYear(), 
          department: department || "All Departments" 
        },
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
    
    // Return fallback data minimal
    return NextResponse.json({ 
      error: "Failed to generate financial summary", 
      message: error.message,
      period: { 
        month: new Date().getMonth() + 1, 
        year: new Date().getFullYear(), 
        department: "All Departments" 
      }, 
      payroll: { 
        totalBaseSalary: 0, 
        totalNetSalary: 0, 
        employeeCount: 0, 
        pendingCount: 0 
      },
      departments: [],
      attendance: { presentToday: 0 }
    }, { status: 200 }); // Use 200 instead of 500 to prevent client errors
  }
} 