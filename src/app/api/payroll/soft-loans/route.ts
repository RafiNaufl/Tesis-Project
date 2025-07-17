import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

// GET: Get soft loans for an employee or all employees (admin only)
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
    const status = searchParams.get("status");
    
    // Build query conditions
    let conditions = [];
    let params: any[] = [];
    
    if (employeeId) {
      conditions.push(`sl."employeeId" = $${params.length + 1}`);
      params.push(employeeId);
    } else if (session.user.role !== "ADMIN") {
      // If not admin, only show the employee's own soft loans
      const employee = await db.employee.findUnique({
        where: { userId: session.user.id },
      });
      
      if (!employee) {
        return NextResponse.json(
          { error: "Employee not found" },
          { status: 404 }
        );
      }
      
      conditions.push(`sl."employeeId" = $${params.length + 1}`);
      params.push(employee.id);
    }
    
    if (status) {
      conditions.push(`sl.status = $${params.length + 1}`);
      params.push(status);
    }
    
    // Construct the WHERE clause
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    
    // Execute the query
    const query = `
      SELECT 
        sl.id, 
        sl."employeeId", 
        sl."totalAmount",
        sl."monthlyAmount",
        sl."remainingAmount",
        sl."durationMonths",
        sl."startMonth",
        sl."startYear",
        sl.status,
        sl."createdAt",
        sl."completedAt",
        e."employeeId" AS "empId",
        u.name AS "employeeName"
      FROM 
        soft_loans sl
      JOIN 
        employees e ON sl."employeeId" = e.id
      JOIN 
        users u ON e."userId" = u.id
      ${whereClause}
      ORDER BY 
        sl."createdAt" DESC
    `;
    
    const softLoans = await db.$queryRawUnsafe(query, ...params);
    
    return NextResponse.json(softLoans);
  } catch (error) {
    console.error("Error fetching soft loans:", error);
    return NextResponse.json(
      { error: "Failed to fetch soft loans" },
      { status: 500 }
    );
  }
}

// POST: Create a new soft loan (employee can create, admin can create for others)
export async function POST(request: NextRequest) {
  // Declare variables outside try block for proper scope
  let finalEmployeeId: string = '';
  let finalTotalAmount: number = 0;
  let finalDurationMonths: number = 0;
  let finalStartMonth: number = 0;
  let finalStartYear: number = 0;
  let finalReason: string = '';
  
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }
    
    const body = await request.json();
    let { employeeId, totalAmount, durationMonths, startMonth, startYear, reason, monthlyAmount } = body;
    
    // Assign to properly scoped variables
    finalEmployeeId = employeeId || '';
    finalTotalAmount = totalAmount || 0;
    finalDurationMonths = durationMonths || 0;
    finalStartMonth = startMonth || 0;
    finalStartYear = startYear || 0;
    finalReason = reason || '';
    
    // If not admin, get employee ID from session
    if (session.user.role !== "ADMIN") {
      const employee = await db.employee.findUnique({
        where: { userId: session.user.id },
      });
      
      if (!employee) {
        return NextResponse.json(
          { error: "Employee not found" },
          { status: 404 }
        );
      }
      
      finalEmployeeId = employee.id;
    }
    
    if (!finalEmployeeId || !finalTotalAmount || !finalDurationMonths || !finalReason) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }
    
    // Set default start month/year if not provided
    if (!finalStartMonth || !finalStartYear) {
      const now = new Date();
      finalStartMonth = now.getMonth() + 1;
      finalStartYear = now.getFullYear();
    }
    
    // Validate duration months
    if (![3, 6, 12].includes(finalDurationMonths)) {
      return NextResponse.json(
        { error: "Duration must be 3, 6, or 12 months" },
        { status: 400 }
      );
    }
    
    // Check if the employee exists
    const employee = await db.employee.findUnique({
      where: { id: finalEmployeeId },
    });
    
    if (!employee) {
      return NextResponse.json(
        { error: "Employee not found" },
        { status: 404 }
      );
    }
    
    // Check if employee has active or pending soft loan
    const existingSoftLoan = await db.softLoan.findFirst({
      where: {
        employeeId: finalEmployeeId,
        status: {
          in: ["ACTIVE", "PENDING"]
        }
      }
    });
    
    if (existingSoftLoan) {
      return NextResponse.json(
        { error: "Employee already has an active or pending soft loan" },
        { status: 400 }
      );
    }
    
    // Calculate monthly amount if not provided
    if (!monthlyAmount) {
      monthlyAmount = finalTotalAmount / finalDurationMonths;
    }
    
    // Set status based on user role
    const status = session.user.role === "ADMIN" ? "ACTIVE" : "PENDING";
    
    // Create the soft loan
    const softLoan = await db.softLoan.create({
      data: {
        employeeId: finalEmployeeId,
        totalAmount: finalTotalAmount,
        remainingAmount: finalTotalAmount,
        monthlyAmount: monthlyAmount,
        durationMonths: finalDurationMonths,
        startMonth: finalStartMonth,
        startYear: finalStartYear,
        reason: finalReason,
        status: status,
      },
    });

    return NextResponse.json(softLoan, { status: 201 });
  } catch (error) {
    console.error("Error creating soft loan:", error);
    return NextResponse.json(
      { error: "Failed to create soft loan" },
      { status: 500 }
    );
  }
}

// PUT: Update a soft loan (admin only)
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Soft loan ID is required" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { status, completedAt } = body;

    const updatedSoftLoan = await db.softLoan.update({
      where: { id: id },
      data: {
        status: status,
        completedAt: status === "COMPLETED" ? completedAt || new Date() : null,
      },
    });

    return NextResponse.json(updatedSoftLoan);
  } catch (error) {
    console.error("Error updating soft loan:", error);
    return NextResponse.json(
      { error: "Failed to update soft loan" },
      { status: 500 }
    );
  }
}

// DELETE: Delete a soft loan (admin only)
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Soft loan ID is required" },
        { status: 400 }
      );
    }

    await db.softLoan.delete({
      where: { id: id },
    });

    return NextResponse.json({ message: "Soft loan deleted successfully" });
  } catch (error) {
    console.error("Error deleting soft loan:", error);
    return NextResponse.json(
      { error: "Failed to delete soft loan" },
      { status: 500 }
    );
  }
}

// PATCH: Update soft loan (for monthly deductions)
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
    const { id, deductionAmount } = body;
    
    if (!id || !deductionAmount) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }
    
    // Get the soft loan
    const softLoan = await db.softLoan.findUnique({
      where: { id }
    });
    
    if (!softLoan) {
      return NextResponse.json(
        { error: "Soft loan not found" },
        { status: 404 }
      );
    }
    
    if (softLoan.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "Soft loan is not active" },
        { status: 400 }
      );
    }
    
    // Calculate new remaining amount
    const newRemainingAmount = Math.max(0, softLoan.remainingAmount - deductionAmount);
    const isCompleted = newRemainingAmount === 0;
    
    // Update the soft loan
    const updatedSoftLoan = await db.softLoan.update({
      where: { id },
      data: {
        remainingAmount: newRemainingAmount,
        status: isCompleted ? "COMPLETED" : "ACTIVE",
        completedAt: isCompleted ? new Date() : null
      }
    });
    
    return NextResponse.json(updatedSoftLoan);
  } catch (error) {
    console.error("Error updating soft loan:", error);
    return NextResponse.json(
      { error: "Failed to update soft loan" },
      { status: 500 }
    );
  }
}