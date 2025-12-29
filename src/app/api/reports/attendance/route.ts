import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

type AttendanceRecord = {
  id: string;
  employeeId: string;
  date: Date;
  checkIn: Date | null;
  checkOut: Date | null;
  status: string;
  notes: string | null;
  empId: string;
  employeeName: string;
  position: string;
  division: string;
};

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }
    
    // Extract query parameters
    const searchParams = request.nextUrl.searchParams;
    const employeeId = searchParams.get("employeeId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const status = searchParams.get("status");
    const month = searchParams.get("month") ? parseInt(searchParams.get("month")!) : null;
    const year = searchParams.get("year") ? parseInt(searchParams.get("year")!) : null;
    
    // Build the SQL query conditions
    let conditions = [];
    let params: any[] = [];
    
    if (employeeId) {
      conditions.push(`a."employeeId" = $${params.length + 1}`);
      params.push(employeeId);
    } else if (session.user.role !== "ADMIN") {
      // If not admin, only show the employee's own attendance
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
    
    if (startDate) {
      conditions.push(`a."date" >= $${params.length + 1}`);
      params.push(new Date(startDate));
    }
    
    if (endDate) {
      conditions.push(`a."date" <= $${params.length + 1}`);
      params.push(new Date(endDate));
    }
    
    if (status) {
      conditions.push(`a."status" = $${params.length + 1}`);
      params.push(status);
    }
    
    if (month !== null) {
      conditions.push(`EXTRACT(MONTH FROM a."date") = $${params.length + 1}`);
      params.push(month);
    }
    
    if (year !== null) {
      conditions.push(`EXTRACT(YEAR FROM a."date") = $${params.length + 1}`);
      params.push(year);
    }
    
    // Construct the WHERE clause
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    
    // Execute the query
    const query = `
      SELECT 
        a.id, 
        a."employeeId", 
        a.date, 
        a."checkIn", 
        a."checkOut", 
        a.status,
        a.notes,
        e."employeeId" AS "empId",
        u.name AS "employeeName",
        e.position,
        e.division
      FROM 
        attendances a
      JOIN 
        employees e ON a."employeeId" = e.id
      JOIN 
        users u ON e."userId" = u.id
      ${whereClause}
      ORDER BY 
        a.date DESC
    `;
    
    const result = await db.$queryRawUnsafe<AttendanceRecord[]>(query, ...params);
    
    // Calculate summary statistics
    const summary = {
      totalRecords: result.length,
      present: result.filter((record) => record.status === "PRESENT").length,
      absent: result.filter((record) => record.status === "ABSENT").length,
      late: result.filter((record) => record.status === "LATE").length,
      halfday: result.filter((record) => record.status === "HALFDAY").length,
    };
    
    return NextResponse.json({ 
      data: result,
      summary: summary
    });
  } catch (error) {
    console.error("Error generating attendance report:", error);
    return NextResponse.json(
      { error: "Failed to generate attendance report" },
      { status: 500 }
    );
  }
} 