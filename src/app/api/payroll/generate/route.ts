import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { generateMonthlyPayroll } from "@/lib/payroll";

// POST: Generate payroll for employees (admin only)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Unauthorized. Admin access required." },
        { status: 403 }
      );
    }
    
    const body = await request.json();
    const { month, year, employeeIds } = body;
    
    if (!month || !year) {
      return NextResponse.json(
        { error: "Month and year are required" },
        { status: 400 }
      );
    }
    
    // Convert month and year to numbers
    const payrollMonth = parseInt(month);
    const payrollYear = parseInt(year);
    
    // Validate month and year
    if (isNaN(payrollMonth) || payrollMonth < 1 || payrollMonth > 12) {
      return NextResponse.json(
        { error: "Invalid month. Must be between 1 and 12." },
        { status: 400 }
      );
    }
    
    if (isNaN(payrollYear) || payrollYear < 2000 || payrollYear > 2100) {
      return NextResponse.json(
        { error: "Invalid year. Must be between 2000 and 2100." },
        { status: 400 }
      );
    }
    
    // Build a list of employees to process
    let employees = [];
    
    if (employeeIds && Array.isArray(employeeIds) && employeeIds.length > 0) {
      // Get specific employees
      employees = await db.employee.findMany({
        where: {
          id: {
            in: employeeIds,
          },
          isActive: true,
        },
        include: {
          user: true,
        },
      });
    } else {
      // Get all active employees
      employees = await db.employee.findMany({
        where: {
          isActive: true,
        },
        include: {
          user: true,
        },
      });
    }
    
    if (employees.length === 0) {
      return NextResponse.json(
        { error: "No active employees found" },
        { status: 404 }
      );
    }
    
    // Generate payroll for each employee
    const results = [];
    const errors = [];
    
    for (const employee of employees) {
      try {
        // Use centralized payroll logic from lib/payroll
        const payroll = await generateMonthlyPayroll(employee.id, payrollMonth, payrollYear);
        
        results.push({
          employeeId: employee.employeeId,
          name: employee.user.name,
          payrollId: payroll.id,
          netSalary: payroll.netSalary,
        });
      } catch (error: any) {
        // If error is "Slip gaji bulan ini sudah dibuat", it's a specific case
        if (error.message && error.message.includes("sudah dibuat")) {
           errors.push({
            employeeId: employee.employeeId,
            name: employee.user.name,
            error: "Payroll already exists for this month and year",
          });
        } else {
          console.error(`Error generating payroll for employee ${employee.employeeId}:`, error);
          errors.push({
            employeeId: employee.employeeId,
            name: employee.user.name,
            error: error.message || "Internal error during payroll generation",
          });
        }
      }
    }
    
    return NextResponse.json({
      success: true,
      month: payrollMonth,
      year: payrollYear,
      processed: employees.length,
      successful: results.length,
      failed: errors.length,
      results,
      errors,
      notificationsSent: results.length
    });
  } catch (error) {
    console.error("Error generating payroll:", error);
    return NextResponse.json(
      { error: "Failed to generate payroll" },
      { status: 500 }
    );
  }
} 