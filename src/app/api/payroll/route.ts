import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { db } from "@/lib/db";
import { authOptions } from "@/lib/auth";

export const dynamic = 'force-dynamic';

// GET: Fetch payrolls with filtering
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }
    
    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const employeeId = searchParams.get("employeeId");
    const month = searchParams.get("month") ? parseInt(searchParams.get("month")!) : null;
    const year = searchParams.get("year") ? parseInt(searchParams.get("year")!) : null;
    const status = searchParams.get("status");
    
    // Build where clause
    const where: any = {};
    
    if (employeeId) {
      where.employeeId = employeeId;
    } else if (session.user.role !== "ADMIN" && session.user.role !== "DIREKTUR") {
      // If not admin or direktur, only show the employee's own payroll
      const employee = await db.employee.findUnique({
        where: { userId: session.user.id },
      });
      
      if (!employee) {
        return NextResponse.json(
          { error: "Employee not found" },
          { status: 404 }
        );
      }
      
      where.employeeId = employee.id;
    }
    
    if (month !== null) {
      where.month = month;
    }
    
    if (year !== null) {
      where.year = year;
    }
    
    if (status) {
      where.status = status;
    }
    
    // Fetch payrolls with employee & user only
    const payrolls = await db.payroll.findMany({
      where,
      include: {
        employee: {
          include: {
            user: true,
          },
        },
      },
      orderBy: [
        { year: 'desc' },
        { month: 'desc' },
      ],
    });
    
    // Get all related deductions and allowances for the relevant employees and period
    const employeeIds = payrolls.map(p => p.employeeId);
    const payrollMonthYearPairs = payrolls.map(p => ({ month: p.month, year: p.year, employeeId: p.employeeId }));
    
    // Get all deductions and allowances in one batch if needed
    let allDeductions: any[] = [];
    let allAllowances: any[] = [];
    
    try {
      if (payrollMonthYearPairs.length > 0) {
        [allDeductions, allAllowances] = await Promise.all([
          db.deduction.findMany({
            where: {
              OR: payrollMonthYearPairs.map(p => ({
                employeeId: p.employeeId,
                month: p.month,
                year: p.year,
              })),
            },
          }),
          db.allowance.findMany({
            where: {
              OR: payrollMonthYearPairs.map(p => ({
                employeeId: p.employeeId,
                month: p.month,
                year: p.year,
              })),
            },
          }),
        ]);
      }
    } catch (e) {
      console.warn("Could not fetch additional deductions/allowances, proceeding without:", e);
    }
    
    // Process payrolls with local aggregation
    const processedPayrolls = payrolls.map((payroll) => {
      // Find matching deductions/allowances
      const payrollDeductions = (payroll as any).deductions || 
        allDeductions.filter(d => 
          d.employeeId === payroll.employeeId && 
          d.month === payroll.month && 
          d.year === payroll.year
        );
      
      const payrollAllowances = (payroll as any).allowances || 
        allAllowances.filter(a => 
          a.employeeId === payroll.employeeId && 
          a.month === payroll.month && 
          a.year === payroll.year
        );
      
      // Aggregate deductions locally
      const advanceAmount = payrollDeductions
        .filter((d: any) => d.type === 'KASBON')
        .reduce((sum: number, d: any) => sum + d.amount, 0);
      
      const softLoanDeduction = payrollDeductions
        .filter((d: any) => d.type === 'PINJAMAN')
        .reduce((sum: number, d: any) => sum + d.amount, 0);
      
      const absenceDeduction = payrollDeductions
        .filter((d: any) => d.type === 'ABSENCE')
        .reduce((sum: number, d: any) => sum + d.amount, 0);
      
      const otherDeductions = payrollDeductions
        .filter((d: any) => !['ABSENCE', 'LATE', 'BPJS_KESEHATAN', 'BPJS_KETENAGAKERJAAN', 'KASBON', 'PINJAMAN'].includes(d.type))
        .reduce((sum: number, d: any) => sum + d.amount, 0);
      
      // Aggregate allowances locally
      const positionAllowance = payrollAllowances
        .filter((a: any) => a.type.startsWith('TUNJANGAN_JABATAN'))
        .reduce((sum: number, a: any) => sum + a.amount, 0);
      
      const mealAllowance = payrollAllowances
        .filter((a: any) => a.type === 'NON_SHIFT_MEAL_ALLOWANCE')
        .reduce((sum: number, a: any) => sum + a.amount, 0);
      
      const transportAllowance = payrollAllowances
        .filter((a: any) => a.type === 'NON_SHIFT_TRANSPORT_ALLOWANCE')
        .reduce((sum: number, a: any) => sum + a.amount, 0);
      
      const shiftAllowance = payrollAllowances
        .filter((a: any) => a.type === 'SHIFT_FIXED_ALLOWANCE')
        .reduce((sum: number, a: any) => sum + a.amount, 0);
      
      // Calculate payableHours if it doesn't exist or is 0
      const payableHours = (payroll as any).payableHours || 
        (payroll.daysPresent * 8 + payroll.overtimeHours);
      
      return {
        id: payroll.id,
        employeeId: payroll.employeeId,
        month: payroll.month,
        year: payroll.year,
        baseSalary: payroll.baseSalary,
        totalAllowances: payroll.totalAllowances,
        totalDeductions: payroll.totalDeductions,
        netSalary: payroll.netSalary,
        daysPresent: payroll.daysPresent,
        daysAbsent: payroll.daysAbsent,
        overtimeHours: payroll.overtimeHours,
        overtimeAmount: payroll.overtimeAmount,
        payableHours,
        bpjsKesehatanAmount: payroll.bpjsKesehatanAmount,
        bpjsKetenagakerjaanAmount: payroll.bpjsKetenagakerjaanAmount,
        lateDeduction: payroll.lateDeduction,
        status: payroll.status,
        createdAt: payroll.createdAt,
        paidAt: payroll.paidAt,
        empId: payroll.employee.employeeId,
        employeeName: payroll.employee.user.name,
        position: payroll.employee.position,
        division: payroll.employee.division,
        hourlyRate: payroll.employee.hourlyRate,
        empBasicSalary: payroll.employee.basicSalary,
        advanceAmount,
        softLoanDeduction,
        absenceDeduction,
        otherDeductions,
        positionAllowance,
        mealAllowance,
        transportAllowance,
        shiftAllowance,
      };
    });
    
    return NextResponse.json(processedPayrolls);
  } catch (error) {
    console.error("Error fetching payrolls:", error);
    return NextResponse.json(
      { error: "Failed to fetch payrolls" },
      { status: 500 }
    );
  }
}

// PATCH: Update multiple payrolls (admin only)
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || (session.user.role !== "ADMIN" && session.user.role !== "MANAGER" && session.user.role !== "DIREKTUR")) {
      return NextResponse.json(
        { error: "Unauthorized. Admin access required." },
        { status: 403 }
      );
    }
    
    const body = await request.json();
    const { ids, status } = body;
    
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: "Invalid or missing payroll IDs" },
        { status: 400 }
      );
    }
    
    if (!status || !["PENDING", "PAID", "CANCELLED"].includes(status)) {
      return NextResponse.json(
        { error: "Invalid status. Must be PENDING, PAID, or CANCELLED." },
        { status: 400 }
      );
    }
    
    // Update payroll status in a single transaction
    let result;
    
    if (status === "PAID") {
      // Dapatkan data payroll dengan informasi karyawan sebelum update
      const payrollsData = await db.payroll.findMany({
        where: { 
          id: { in: ids },
          status: { not: "PAID" } // Hanya yang belum dibayar
        },
        include: {
          employee: {
            include: {
              user: true
            }
          }
        }
      });
      
      result = await db.$transaction(
        ids.map(id => 
          db.payroll.update({
            where: { id },
            data: { 
              status: status,
              paidAt: new Date()
            }
          })
        )
      );
      
      // Create notifications (in parallel but with fewer connections)
      const notificationPromises = payrollsData.map((payroll) => 
        db.notification.create({
          data: {
            userId: payroll.employee.userId,
            title: "Slip Gaji Dikonfirmasi",
            message: `Slip gaji bulan ${payroll.month}/${payroll.year} telah dikonfirmasi sebagai telah dibayar.`,
            type: "info"
          }
        }).catch(err => console.error("Error creating notification:", err))
      );
      
      await Promise.all(notificationPromises);
    } else {
      result = await db.$transaction(
        ids.map(id => 
          db.payroll.update({
            where: { id },
            data: { 
              status: status,
              paidAt: status === "PAID" ? new Date() : null
            }
          })
        )
      );
    }
    
    return NextResponse.json({
      success: true,
      updated: result.length,
      status: status
    });
  } catch (error) {
    console.error("Error updating payrolls:", error);
    return NextResponse.json(
      { error: "Failed to update payrolls" },
      { status: 500 }
    );
  }
}
