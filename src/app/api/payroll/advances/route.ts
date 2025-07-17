import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

// GET: Get advances for an employee or all employees (admin only)
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
      conditions.push(`a."employeeId" = $${params.length + 1}`);
      params.push(employeeId);
    } else if (session.user.role !== "ADMIN") {
      // If not admin, only show the employee's own advances
      const employee = await db.employee.findUnique({
        where: { userId: session.user.id },
      });
      
      if (!employee) {
        return NextResponse.json(
          { error: "Employee not found" },
          { status: 404 }
        );
      }
      
      conditions.push(`a."employeeId" = $${params.length + 1}`);
      params.push(employee.id);
    }
    
    if (month !== null) {
      conditions.push(`a.month = $${params.length + 1}`);
      params.push(month);
    }
    
    if (year !== null) {
      conditions.push(`a.year = $${params.length + 1}`);
      params.push(year);
    }
    
    if (status) {
      conditions.push(`a.status = $${params.length + 1}`);
      params.push(status);
    }
    
    // Construct the WHERE clause
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    
    // Execute the query
    const query = `
      SELECT 
        a.id, 
        a."employeeId", 
        a.amount,
        a.month, 
        a.year, 
        a.status,
        a."createdAt",
        a."deductedAt",
        e."employeeId" AS "empId",
        u.name AS "employeeName"
      FROM 
        advances a
      JOIN 
        employees e ON a."employeeId" = e.id
      JOIN 
        users u ON e."userId" = u.id
      ${whereClause}
      ORDER BY 
        a."createdAt" DESC
    `;
    
    const advances = await db.$queryRawUnsafe(query, ...params);
    
    return NextResponse.json(advances);
  } catch (error) {
    console.error("Error fetching advances:", error);
    return NextResponse.json(
      { error: "Failed to fetch advances" },
      { status: 500 }
    );
  }
}

// POST: Create a new advance (admin only)
export async function POST(request: NextRequest) {
  let employeeId, amount, month, year, reason;
  
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }
    
    const body = await request.json();
    let { employeeId, amount, month, year, reason } = body;
    
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
      
      employeeId = employee.id;
    }
    
    if (!employeeId || !amount || !month || !year) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }
    
    // For employee requests, reason is required
    if (session.user.role !== "ADMIN" && !reason) {
      return NextResponse.json(
        { error: "Reason is required for advance requests" },
        { status: 400 }
      );
    }
    
    // Check if the employee exists
    const employee = await db.employee.findUnique({
      where: { id: employeeId },
    });
    
    if (!employee) {
      return NextResponse.json(
        { error: "Employee not found" },
        { status: 404 }
      );
    }
    
    // Check if advance already exists for this employee in this month/year
    const existingAdvance = await db.advance.findFirst({
      where: {
        employeeId,
        month,
        year,
        status: "ACTIVE"
      }
    });
    
    if (existingAdvance) {
      return NextResponse.json(
        { error: "Active advance already exists for this employee in this period" },
        { status: 400 }
      );
    }
    
    // Create the advance
    const advance = await db.advance.create({
      data: {
        employeeId,
        amount,
        month,
        year,
        reason: reason || null,
        status: session.user.role === "ADMIN" ? "ACTIVE" : "PENDING",
      },
    });
    
    return NextResponse.json(advance, { status: 201 });
  } catch (error) {
    console.error("Error creating advance:", error);
    console.error("Error details:", {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      requestBody: { employeeId, amount, month, year, reason },
      errorType: typeof error,
      errorName: error instanceof Error ? error.constructor.name : 'Unknown'
    });
    
    // Log the specific error message for debugging
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error("Specific error message:", errorMessage);
    
    return NextResponse.json(
      { 
        error: "Failed to create advance",
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
      },
      { status: 500 }
    );
  }
}

// DELETE: Delete multiple advances (admin only)
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
        { error: "Invalid or missing advance IDs" },
        { status: 400 }
      );
    }
    
    // Delete the advances
    const result = await db.advance.deleteMany({
      where: {
        id: {
          in: ids
        }
      }
    });
    
    return NextResponse.json({ 
      success: true, 
      message: `${result.count} advances deleted successfully` 
    });
  } catch (error) {
    console.error("Error deleting advances:", error);
    return NextResponse.json(
      { error: "Failed to delete advances" },
      { status: 500 }
    );
  }
}