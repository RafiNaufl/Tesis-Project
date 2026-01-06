import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { db } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import { createPayrollPaidNotification } from "@/lib/notification";

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
    
    // Build query conditions
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
        p."bpjsKesehatanAmount",
        p."bpjsKetenagakerjaanAmount",
        p."lateDeduction",
        p.status,
        p."createdAt",
        p."paidAt",
        e."employeeId" AS "empId",
        u.name AS "employeeName",
        e.position,
        e.division,
        (SELECT COALESCE(SUM(d."amount"), 0) FROM deductions d WHERE d."payrollId" = p.id AND d."type" = 'KASBON') AS "advanceAmount",
        (SELECT COALESCE(SUM(d."amount"), 0) FROM deductions d WHERE d."payrollId" = p.id AND d."type" = 'PINJAMAN') AS "softLoanDeduction",
        (SELECT COALESCE(SUM(d."amount"), 0) FROM deductions d WHERE d."payrollId" = p.id AND d."type" = 'ABSENCE') AS "absenceDeduction",
        (SELECT COALESCE(SUM(d."amount"), 0) FROM deductions d WHERE d."payrollId" = p.id AND d."type" NOT IN ('ABSENCE', 'LATE', 'BPJS_KESEHATAN', 'BPJS_KETENAGAKERJAAN', 'KASBON', 'PINJAMAN')) AS "otherDeductions",
        (SELECT COALESCE(SUM(a."amount"), 0) FROM allowances a WHERE a."employeeId" = p."employeeId" AND a."month" = p.month AND a."year" = p.year AND a."type" LIKE 'TUNJANGAN_JABATAN%') AS "positionAllowance",
        (SELECT COALESCE(SUM(a."amount"), 0) FROM allowances a WHERE a."employeeId" = p."employeeId" AND a."month" = p.month AND a."year" = p.year AND a."type" = 'NON_SHIFT_MEAL_ALLOWANCE') AS "mealAllowance",
        (SELECT COALESCE(SUM(a."amount"), 0) FROM allowances a WHERE a."employeeId" = p."employeeId" AND a."month" = p.month AND a."year" = p.year AND a."type" = 'NON_SHIFT_TRANSPORT_ALLOWANCE') AS "transportAllowance",
        (SELECT COALESCE(SUM(a."amount"), 0) FROM allowances a WHERE a."employeeId" = p."employeeId" AND a."month" = p.month AND a."year" = p.year AND a."type" = 'SHIFT_FIXED_ALLOWANCE') AS "shiftAllowance"
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
    
    const payrolls = await db.$queryRawUnsafe(query, ...params) as any[];
    
    // Convert BigInt to Number to avoid serialization error
    const serializedPayrolls = payrolls.map((payroll) => {
      const newPayroll: any = { ...payroll };
      // Check specific fields that might be BigInt due to SUM
      if (typeof newPayroll.advanceAmount === 'bigint') {
        newPayroll.advanceAmount = Number(newPayroll.advanceAmount);
      }
      if (typeof newPayroll.softLoanDeduction === 'bigint') {
        newPayroll.softLoanDeduction = Number(newPayroll.softLoanDeduction);
      }
      if (typeof newPayroll.absenceDeduction === 'bigint') {
        newPayroll.absenceDeduction = Number(newPayroll.absenceDeduction);
      }
      if (typeof newPayroll.otherDeductions === 'bigint') {
        newPayroll.otherDeductions = Number(newPayroll.otherDeductions);
      }
      if (typeof newPayroll.positionAllowance === 'bigint') {
        newPayroll.positionAllowance = Number(newPayroll.positionAllowance);
      }
      if (typeof newPayroll.mealAllowance === 'bigint') {
        newPayroll.mealAllowance = Number(newPayroll.mealAllowance);
      }
      if (typeof newPayroll.transportAllowance === 'bigint') {
        newPayroll.transportAllowance = Number(newPayroll.transportAllowance);
      }
      if (typeof newPayroll.shiftAllowance === 'bigint') {
        newPayroll.shiftAllowance = Number(newPayroll.shiftAllowance);
      }
      return newPayroll;
    });
    
    return NextResponse.json(serializedPayrolls);
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
    
    if (!session || (session.user.role !== "ADMIN" && session.user.role !== "MANAGER")) {
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
    
    // Update payroll status
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
      
      // If status is PAID, set paidAt to current time
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
      
      // Buat notifikasi untuk setiap karyawan yang gajinya dibayarkan menggunakan layanan notifikasi
      const notificationPromises = payrollsData.map(payroll => 
        createPayrollPaidNotification(
          payroll.employeeId,
          payroll.month,
          payroll.year,
          payroll.netSalary
        )
      );
      
      // Jalankan pembuatan notifikasi
      await Promise.all(notificationPromises);
    } else {
      // For other statuses, just update the status
      result = await db.$transaction(
        ids.map(id => 
          db.payroll.update({
            where: { id },
            data: { status: status }
          })
        )
      );
    }
    
    return NextResponse.json({ 
      success: true, 
      message: `${result.length} payrolls updated successfully`,
      notificationsSent: status === "PAID" ? result.length : 0
    });
  } catch (error) {
    console.error("Error updating payrolls:", error);
    return NextResponse.json(
      { error: "Failed to update payrolls" },
      { status: 500 }
    );
  }
}

// DELETE: Delete multiple payrolls (admin only)
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Unauthorized. Admin access required." },
        { status: 403 }
      );
    }
    
    const body = await request.json();
    const { ids } = body;
    
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: "Invalid or missing payroll IDs" },
        { status: 400 }
      );
    }
    
    // Check if any of the payrolls are already paid
    const paidPayrolls = await db.payroll.findMany({
      where: {
        id: {
          in: ids,
        },
        status: "PAID",
      },
    });
    
    if (paidPayrolls.length > 0) {
      return NextResponse.json(
        { error: "Cannot delete paid payrolls" },
        { status: 400 }
      );
    }

    // 1. Revert Soft Loan and Advance status before deleting deductions
    const deductionsToDelete = await db.deduction.findMany({
      where: {
        payrollId: { in: ids }
      }
    });

    for (const deduction of deductionsToDelete) {
      // Revert Soft Loan
      if (deduction.type === 'PINJAMAN') {
        // Find the active or recently completed soft loan for this employee
        const loan = await db.softLoan.findFirst({
          where: {
            employeeId: deduction.employeeId,
          },
          orderBy: { createdAt: 'desc' }
        });

        if (loan) {
            const newRemaining = loan.remainingAmount + deduction.amount;
            await db.softLoan.update({
                where: { id: loan.id },
                data: {
                    remainingAmount: newRemaining,
                    status: "ACTIVE", // Revert to active if it was completed
                    completedAt: null
                }
            });
        }
      }

      // Revert Advance (Kasbon)
      if (deduction.type === 'KASBON') {
        // Find the advance for this month/year
        const advance = await db.advance.findFirst({
            where: {
                employeeId: deduction.employeeId,
                deductionMonth: deduction.month,
                deductionYear: deduction.year,
                status: "APPROVED"
            }
        });

        if (advance) {
            await db.advance.update({
                where: { id: advance.id },
                data: { deductedAt: null }
            });
        }
      }
    }
    
    // Delete associated deductions first
    await db.deduction.deleteMany({
      where: {
        payrollId: {
          in: ids,
        },
      },
    });

    // Delete the payrolls
    const result = await db.$executeRawUnsafe(`
      DELETE FROM payrolls
      WHERE id IN (${ids.map((id: string) => `'${id}'`).join(',')})
    `);
    
    return NextResponse.json({ 
      success: true, 
      message: `${result} payrolls deleted successfully` 
    });
  } catch (error) {
    console.error("Error deleting payrolls:", error);
    return NextResponse.json(
      { error: "Failed to delete payrolls" },
      { status: 500 }
    );
  }
}

import { generateMonthlyPayroll } from "@/lib/payroll";

// POST /api/payroll - Generate payroll or update payroll status
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only admins can generate or update payroll
    if (session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Only admins can manage payroll" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { action, employeeId, month, year, payrollId } = body;

    if (!action) {
      return NextResponse.json(
        { error: "Action is required" },
        { status: 400 }
      );
    }

    // Generate payroll for an employee
    if (action === "generate") {
      if (!employeeId || !month || !year) {
        return NextResponse.json(
          { error: "Employee ID, month, and year are required" },
          { status: 400 }
        );
      }

      try {
        const payroll = await generateMonthlyPayroll(
          employeeId,
          parseInt(month),
          parseInt(year)
        );

        return NextResponse.json({
          message: "Payroll generated successfully",
          payroll,
        });
      } catch (error: any) {
        console.error("Error generating payroll:", error);
        return NextResponse.json(
          { error: error.message || "Failed to generate payroll" },
          { status: 400 }
        );
      }
    }

    // Mark payroll as paid
    if (action === "mark-paid") {
      if (!payrollId) {
        return NextResponse.json(
          { error: "Payroll ID is required" },
          { status: 400 }
        );
      }

      // Update payroll status
      const updatedPayroll = await db.payroll.update({
        where: { id: payrollId },
        data: {
          status: "PAID",
          paidAt: new Date(),
        },
      });

      return NextResponse.json({
        message: "Payroll marked as paid",
        payroll: updatedPayroll,
      });
    }

    return NextResponse.json(
      { error: "Invalid action" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Error managing payroll:", error);
    return NextResponse.json(
      { error: "Failed to process payroll action" },
      { status: 500 }
    );
  }
} 
