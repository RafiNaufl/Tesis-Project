import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAdvances, createAdvance, deleteAdvances } from "@/lib/advance";

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
    const month = searchParams.get("month") ? parseInt(searchParams.get("month")!) : undefined;
    const year = searchParams.get("year") ? parseInt(searchParams.get("year")!) : undefined;
    const status = searchParams.get("status");
    
    // Use the centralized function to get advances
    const advances = await getAdvances(
      { 
        employeeId: employeeId || undefined, 
        month, 
        year, 
        status: status || undefined 
      },
      session.user.role === "ADMIN",
      session.user.id
    );
    
    return NextResponse.json(advances);
  } catch (error) {
    console.error("Error fetching advances:", error);
    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Failed to fetch advances" },
      { status: 500 }
    );
  }
}

// POST: Create a new advance (admin only)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }
    
    const body = await request.json();
    const { employeeId, amount, month, year, reason } = body;
    
    // Use the centralized function to create an advance
    const advance = await createAdvance(
      {
        employeeId,
        amount,
        month,
        year,
        reason
      },
      session.user.role === "ADMIN",
      session.user.id
    );
    
    return NextResponse.json(advance, { status: 201 });
  } catch (error) {
    console.error("Error creating advance:", error);
    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Failed to create advance" },
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
    
    // Use the centralized function to delete advances
    const count = await deleteAdvances(ids);
    
    return NextResponse.json({ 
      success: true, 
      message: `${count} advances deleted successfully` 
    });
  } catch (error) {
    console.error("Error deleting advances:", error);
    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Failed to delete advances" },
      { status: 500 }
    );
  }
}
