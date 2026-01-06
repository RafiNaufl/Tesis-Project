import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { db } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import { createPayrollPaidNotification } from "@/lib/notification";


// GET: Fetch a single payroll record by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }
    
    const { id } = await params;
    
    // Get the payroll record
    const payroll = await db.payroll.findUnique({
      where: {
        id,
      },
      include: {
        employee: {
          include: {
            user: {
              select: {
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });
    
    if (!payroll) {
      return NextResponse.json(
        { error: "Payroll record not found" },
        { status: 404 }
      );
    }
    
    // Check if the user is admin/manager or the employee associated with this payroll
    if (session.user.role !== "ADMIN" && session.user.role !== "MANAGER") {
      const employee = await db.employee.findUnique({
        where: { userId: session.user.id },
      });
      
      if (!employee || employee.id !== payroll.employeeId) {
        return NextResponse.json(
          { error: "Unauthorized to view this payroll record" },
          { status: 403 }
        );
      }
    }
    
    // Get allowances for this payroll period
    const allowances = await db.allowance.findMany({
      where: {
        employeeId: payroll.employeeId,
        month: payroll.month,
        year: payroll.year,
      },
    });
    
    // Get deductions for this payroll period
    const deductions = await db.deduction.findMany({
      where: {
        employeeId: payroll.employeeId,
        month: payroll.month,
        year: payroll.year,
      },
    });
    
    // Get attendance for this payroll period
    const startDate = new Date(payroll.year, payroll.month - 1, 1);
    const endDate = new Date(payroll.year, payroll.month, 0); // Last day of the month
    
    const attendance = await db.attendance.findMany({
      where: {
        employeeId: payroll.employeeId,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: {
        date: "asc",
      },
    });
    
    // Add detailed information to the payroll record
    const detailedPayroll = {
      ...payroll,
      allowances,
      deductions,
      attendance,
    };
    
    return NextResponse.json(detailedPayroll);
  } catch (error) {
    console.error("Error fetching payroll record:", error);
    return NextResponse.json(
      { error: "Failed to fetch payroll record" },
      { status: 500 }
    );
  }
}

// PATCH: Update a payroll record (admin/manager only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || (session.user.role !== "ADMIN" && session.user.role !== "MANAGER")) {
      return NextResponse.json(
        { error: "Unauthorized. Admin access required." },
        { status: 403 }
      );
    }
    
    const { id } = await params;
    
    // Check if the payroll record exists
    const payroll = await db.payroll.findUnique({
      where: {
        id,
      },
    });
    
    if (!payroll) {
      return NextResponse.json(
        { error: "Payroll record not found" },
        { status: 404 }
      );
    }
    
    const body = await request.json();
    
    // Validate required fields
    if (body.status && !["PENDING", "PAID", "CANCELLED"].includes(body.status)) {
      return NextResponse.json(
        { error: "Invalid status. Must be PENDING, PAID, or CANCELLED." },
        { status: 400 }
      );
    }
    
    // Prepare update data
    const updateData: any = {};
    
    // Update fields if provided
    if (body.baseSalary !== undefined) updateData.baseSalary = body.baseSalary;
    if (body.totalAllowances !== undefined) updateData.totalAllowances = body.totalAllowances;
    if (body.totalDeductions !== undefined) updateData.totalDeductions = body.totalDeductions;
    if (body.overtimeHours !== undefined) updateData.overtimeHours = body.overtimeHours;
    if (body.overtimeAmount !== undefined) updateData.overtimeAmount = body.overtimeAmount;
    if (body.daysPresent !== undefined) updateData.daysPresent = body.daysPresent;
    if (body.daysAbsent !== undefined) updateData.daysAbsent = body.daysAbsent;
    
    // Recalculate net salary if any salary component is updated
    if (
      body.baseSalary !== undefined ||
      body.totalAllowances !== undefined ||
      body.totalDeductions !== undefined ||
      body.overtimeAmount !== undefined
    ) {
      const baseSalary = body.baseSalary ?? payroll.baseSalary;
      const totalAllowances = body.totalAllowances ?? payroll.totalAllowances;
      const totalDeductions = body.totalDeductions ?? payroll.totalDeductions;
      const overtimeAmount = body.overtimeAmount ?? payroll.overtimeAmount;
      
      updateData.netSalary = baseSalary + totalAllowances + overtimeAmount - totalDeductions;
    }
    
    // Update status
    if (body.status) {
      updateData.status = body.status;
      
      // If status is changed to PAID, set paidAt to current time
      if (body.status === "PAID" && payroll.status !== "PAID") {
        updateData.paidAt = new Date();
      }
      
      // If status is changed from PAID, clear paidAt
      if (body.status !== "PAID" && payroll.status === "PAID") {
        updateData.paidAt = null;
      }
    }
    
    // Update the payroll record
    const updatedPayroll = await db.payroll.update({
      where: {
        id,
      },
      data: updateData,
    });
    
    // If status changed to PAID, send notification
    if (body.status === "PAID" && payroll.status !== "PAID") {
      try {
        await createPayrollPaidNotification(
          updatedPayroll.employeeId,
          updatedPayroll.month,
          updatedPayroll.year,
          updatedPayroll.netSalary
        );
      } catch (error) {
        console.error("Error creating notification:", error);
      }
    }
    
    return NextResponse.json(updatedPayroll);
  } catch (error) {
    console.error("Error updating payroll record:", error);
    return NextResponse.json(
      { error: "Failed to update payroll record" },
      { status: 500 }
    );
  }
}

// DELETE: Delete a payroll record (admin only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Unauthorized. Admin access required." },
        { status: 403 }
      );
    }
    
    const { id } = await params;
    
    // Check if the payroll record exists
    const payroll = await db.payroll.findUnique({
      where: {
        id,
      },
    });
    
    if (!payroll) {
      return NextResponse.json(
        { error: "Payroll record not found" },
        { status: 404 }
      );
    }
    
    // Only allow deleting PENDING or CANCELLED payrolls
    if (payroll.status === "PAID") {
      return NextResponse.json(
        { error: "Cannot delete a PAID payroll record. Mark it as CANCELLED first." },
        { status: 400 }
      );
    }
    
    // Delete the payroll record
    await db.payroll.delete({
      where: {
        id,
      },
    });
    
    return NextResponse.json({ message: "Payroll record deleted successfully" });
  } catch (error) {
    console.error("Error deleting payroll record:", error);
    return NextResponse.json(
      { error: "Failed to delete payroll record" },
      { status: 500 }
    );
  }
}
