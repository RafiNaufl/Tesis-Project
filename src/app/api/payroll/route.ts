import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { db } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import { Prisma } from "@prisma/client";

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
    
    const payrolls = await db.$queryRawUnsafe(query, ...params);
    
    return NextResponse.json(payrolls);
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
    
    if (!session || session.user.role !== "ADMIN") {
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
      // If status is PAID, set paidAt to current time
      result = await db.$executeRaw`
        UPDATE payrolls
        SET status = ${status}:::"PayStatus", "paidAt" = NOW()
        WHERE id IN (${ids.join(',')})
      `;
    } else {
      // For other statuses, just update the status
      result = await db.$executeRaw`
        UPDATE payrolls
        SET status = ${status}:::"PayStatus"
        WHERE id IN (${ids.join(',')})
      `;
    }
    
    return NextResponse.json({ 
      success: true, 
      message: `${result} payrolls updated successfully` 
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
    
    // Delete the payrolls
    const result = await db.$executeRaw`
      DELETE FROM payrolls
      WHERE id IN (${ids.map(id => `'${id}'`).join(',')})
    `;
    
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

      // Check if payroll for this employee and month/year already exists
      const existingPayroll = await db.payroll.findFirst({
        where: {
          employeeId,
          month: parseInt(month),
          year: parseInt(year),
        },
      });

      if (existingPayroll) {
        return NextResponse.json(
          { error: "Payroll for this period already exists" },
          { status: 400 }
        );
      }

      // Get employee details
      const employee = await db.employee.findUnique({
        where: { id: employeeId },
      });

      if (!employee) {
        return NextResponse.json(
          { error: "Employee not found" },
          { status: 404 }
        );
      }

      // Get attendance records for the month to calculate days present/absent
      const monthNum = parseInt(month);
      const yearNum = parseInt(year);
      const startDate = new Date(yearNum, monthNum - 1, 1);
      const endDate = new Date(yearNum, monthNum, 0); // Last day of the month
      endDate.setHours(23, 59, 59, 999);

      const attendanceRecords = await db.attendance.findMany({
        where: {
          employeeId,
          date: {
            gte: startDate,
            lte: endDate,
          },
        },
      });

      // Calculate days present and absent
      const daysPresent = attendanceRecords.filter(
        (record) => record.status === "PRESENT"
      ).length;
      
      // Calculate working days in the month (assuming Mon-Fri are working days)
      const workingDaysInMonth = calculateWorkingDaysInMonth(monthNum, yearNum);
      const daysAbsent = workingDaysInMonth - daysPresent;

      // Calculate overtime (this would come from a more complex calculation in a real system)
      const overtimeHours = 0; // Mock value
      const overtimeRate = 1.5; // Time and a half
      const hourlyRate = employee.basicSalary / (workingDaysInMonth * 8); // Assuming 8 hour days
      const overtimeAmount = overtimeHours * hourlyRate * overtimeRate;

      // Calculate allowances and deductions (mock values for demonstration)
      const totalAllowances = employee.basicSalary * 0.1; // 10% of base salary
      const totalDeductions = employee.basicSalary * 0.05; // 5% of base salary

      // Calculate net salary
      const netSalary =
        employee.basicSalary +
        totalAllowances +
        overtimeAmount -
        totalDeductions;

      // Create the payroll record
      const payroll = await db.payroll.create({
        data: {
          employeeId,
          month: monthNum,
          year: yearNum,
          baseSalary: employee.basicSalary,
          totalAllowances,
          totalDeductions,
          overtimeHours,
          overtimeAmount,
          daysPresent,
          daysAbsent,
          netSalary,
          status: "PENDING",
        },
      });

      return NextResponse.json({
        message: "Payroll generated successfully",
        payroll,
      });
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

// Helper function to calculate working days in a month (Mon-Fri)
function calculateWorkingDaysInMonth(month: number, year: number) {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);
  
  let workingDays = 0;
  const currentDate = new Date(startDate);
  
  while (currentDate <= endDate) {
    const dayOfWeek = currentDate.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      // Not weekend (0 = Sunday, 6 = Saturday)
      workingDays++;
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return workingDays;
} 