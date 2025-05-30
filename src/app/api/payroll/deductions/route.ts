import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

// GET: Get deductions for an employee or all employees (admin only)
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
      conditions.push(`d."employeeId" = $${params.length + 1}`);
      params.push(employeeId);
    } else if (session.user.role !== "ADMIN") {
      // If not admin, only show the employee's own deductions
      const employee = await db.employee.findUnique({
        where: { userId: session.user.id },
      });
      
      if (!employee) {
        return NextResponse.json(
          { error: "Employee not found" },
          { status: 404 }
        );
      }
      
      conditions.push(`d."employeeId" = $${params.length + 1}`);
      params.push(employee.id);
    }
    
    if (month !== null) {
      conditions.push(`d.month = $${params.length + 1}`);
      params.push(month);
    }
    
    if (year !== null) {
      conditions.push(`d.year = $${params.length + 1}`);
      params.push(year);
    }
    
    // Construct the WHERE clause
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    
    // Execute the query
    const query = `
      SELECT 
        d.id, 
        d."employeeId", 
        d.month, 
        d.year, 
        d.reason,
        d.amount,
        d.date,
        e."employeeId" AS "empId",
        u.name AS "employeeName"
      FROM 
        deductions d
      JOIN 
        employees e ON d."employeeId" = e.id
      JOIN 
        users u ON e."userId" = u.id
      ${whereClause}
      ORDER BY 
        d.date DESC
    `;
    
    const deductions = await db.$queryRawUnsafe(query, ...params);
    
    return NextResponse.json(deductions);
  } catch (error) {
    console.error("Error fetching deductions:", error);
    return NextResponse.json(
      { error: "Failed to fetch deductions" },
      { status: 500 }
    );
  }
}

// POST: Create a new deduction (admin only)
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
    const { employeeId, month, year, reason, amount } = body;
    
    if (!employeeId || !month || !year || !reason || amount === undefined) {
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
    
    // Create the deduction
    const deduction = await db.deduction.create({
      data: {
        employeeId,
        month,
        year,
        reason,
        amount,
      },
    });
    
    return NextResponse.json(deduction, { status: 201 });
  } catch (error) {
    console.error("Error creating deduction:", error);
    return NextResponse.json(
      { error: "Failed to create deduction" },
      { status: 500 }
    );
  }
}

// DELETE: Delete multiple deductions (admin only)
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
        { error: "Invalid or missing deduction IDs" },
        { status: 400 }
      );
    }
    
    // Delete the deductions
    const result = await db.$executeRaw`
      DELETE FROM deductions
      WHERE id IN (${ids.join(',')})
    `;
    
    return NextResponse.json({ 
      success: true, 
      message: `${result} deductions deleted successfully` 
    });
  } catch (error) {
    console.error("Error deleting deductions:", error);
    return NextResponse.json(
      { error: "Failed to delete deductions" },
      { status: 500 }
    );
  }
} 