import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

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
    
    // Define date range for the specified month and year
    const startDate = new Date(payrollYear, payrollMonth - 1, 1);
    const endDate = new Date(payrollYear, payrollMonth, 0);
    
    // Generate payroll for each employee
    const results = [];
    const errors = [];
    
    for (const employee of employees) {
      try {
        // Check if payroll already exists for this employee, month, and year
        const existingPayroll = await db.payroll.findUnique({
          where: {
            employeeId_month_year: {
              employeeId: employee.id,
              month: payrollMonth,
              year: payrollYear,
            },
          },
        });
        
        if (existingPayroll) {
          errors.push({
            employeeId: employee.employeeId,
            name: employee.user.name,
            error: "Payroll already exists for this month and year",
          });
          continue;
        }
        
        // Get attendance records for the employee in the specified month
        const attendanceRecords = await db.attendance.findMany({
          where: {
            employeeId: employee.id,
            date: {
              gte: startDate,
              lte: endDate,
            },
          },
        });
        
        // Count days present/absent
        const daysPresent = attendanceRecords.filter(record => 
          record.status === "PRESENT" || record.status === "LATE" || record.status === "HALFDAY"
        ).length;
        
        const daysAbsent = endDate.getDate() - daysPresent;
        
        // Calculate overtime hours
        const overtimeHours = attendanceRecords.reduce((total, record) => {
          if (record.checkIn && record.checkOut) {
            const checkInTime = new Date(record.checkIn).getTime();
            const checkOutTime = new Date(record.checkOut).getTime();
            const hoursWorked = (checkOutTime - checkInTime) / (1000 * 60 * 60);
            
            // Consider any time over 8 hours as overtime
            return total + Math.max(0, hoursWorked - 8);
          }
          return total;
        }, 0);
        
        // Calculate overtime amount (assuming overtime rate is 1.5x hourly rate)
        const hourlyRate = employee.basicSalary / (22 * 8); // Assuming 22 working days per month, 8 hours per day
        const overtimeAmount = overtimeHours * hourlyRate * 1.5;
        
        // Get allowances for the employee in the specified month and year
        const allowances = await db.allowance.findMany({
          where: {
            employeeId: employee.id,
            month: payrollMonth,
            year: payrollYear,
          },
        });
        
        const totalAllowances = allowances.reduce((total, allowance) => total + Number(allowance.amount), 0);
        
        // Get deductions for the employee in the specified month and year
        const deductions = await db.deduction.findMany({
          where: {
            employeeId: employee.id,
            month: payrollMonth,
            year: payrollYear,
          },
        });
        
        const totalDeductions = deductions.reduce((total, deduction) => total + Number(deduction.amount), 0);
        
        // Calculate net salary
        const baseSalary = employee.basicSalary;
        const netSalary = baseSalary + totalAllowances + overtimeAmount - totalDeductions;
        
        // Create payroll record
        const payroll = await db.payroll.create({
          data: {
            employeeId: employee.id,
            month: payrollMonth,
            year: payrollYear,
            baseSalary,
            totalAllowances,
            totalDeductions,
            netSalary,
            daysPresent,
            daysAbsent,
            overtimeHours,
            overtimeAmount,
            status: "PENDING",
          },
        });
        
        results.push({
          employeeId: employee.employeeId,
          name: employee.user.name,
          payrollId: payroll.id,
          netSalary: payroll.netSalary,
        });
      } catch (error) {
        console.error(`Error generating payroll for employee ${employee.employeeId}:`, error);
        errors.push({
          employeeId: employee.employeeId,
          name: employee.user.name,
          error: "Internal error during payroll generation",
        });
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
    });
  } catch (error) {
    console.error("Error generating payroll:", error);
    return NextResponse.json(
      { error: "Failed to generate payroll" },
      { status: 500 }
    );
  }
} 