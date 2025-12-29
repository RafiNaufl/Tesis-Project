import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

// GET: Get allowances for an employee or all employees (admin only)
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
    
    // Build query conditions
    let conditions = [];
    let params: any[] = [];
    
    if (employeeId) {
      conditions.push(`a."employeeId" = $${params.length + 1}`);
      params.push(employeeId);
    } else if (session.user.role !== "ADMIN" && session.user.role !== "MANAGER") {
      // If not admin, only show the employee's own allowances
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
    
    // Construct the WHERE clause
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    
    // Execute the query
    const query = `
      SELECT 
        a.id, 
        a."employeeId", 
        a.month, 
        a.year, 
        a.type,
        a.amount,
        a.date,
        e."employeeId" AS "empId",
        u.name AS "employeeName"
      FROM 
        allowances a
      JOIN 
        employees e ON a."employeeId" = e.id
      JOIN 
        users u ON e."userId" = u.id
      ${whereClause}
      ORDER BY 
        a.date DESC
    `;
    
    const allowances = await db.$queryRawUnsafe(query, ...params);
    
    return NextResponse.json(allowances);
  } catch (error) {
    console.error("Error fetching allowances:", error);
    return NextResponse.json(
      { error: "Failed to fetch allowances" },
      { status: 500 }
    );
  }
}

// POST: Create a new allowance (admin/manager only)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || (session.user.role !== "ADMIN" && session.user.role !== "MANAGER")) {
      return NextResponse.json(
        { error: "Unauthorized. Admin access required." },
        { status: 403 }
      );
    }
    
    const body = await request.json();
    const { employeeId, month, year, type, amount } = body;
    
    if (!employeeId || !month || !year || !type || amount === undefined) {
      return NextResponse.json(
        { error: "Missing required fields" },
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
    
    // Create the allowance
    const allowance = await db.allowance.create({
      data: {
        employeeId,
        month,
        year,
        type,
        amount,
      },
    });
    
    return NextResponse.json(allowance, { status: 201 });
  } catch (error) {
    console.error("Error creating allowance:", error);
    return NextResponse.json(
      { error: "Failed to create allowance" },
      { status: 500 }
    );
  }
}

// DELETE: Delete multiple allowances (admin only)
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
        { error: "Invalid or missing allowance IDs" },
        { status: 400 }
      );
    }
    
    // Delete the allowances
    const result = await db.$executeRaw`
      DELETE FROM allowances
      WHERE id IN (${ids.join(',')})
    `;
    
    return NextResponse.json({ 
      success: true, 
      message: `${result} allowances deleted successfully` 
    });
  } catch (error) {
    console.error("Error deleting allowances:", error);
    return NextResponse.json(
      { error: "Failed to delete allowances" },
      { status: 500 }
    );
  }
} 
