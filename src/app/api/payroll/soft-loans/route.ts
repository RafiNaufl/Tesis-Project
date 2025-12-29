import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSoftLoans, createSoftLoan, updateSoftLoanStatus, updateSoftLoanDeduction, deleteSoftLoan } from "@/lib/softloan";

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
    
    // Get parameters and handle null values
    const employeeIdParam = searchParams.get("employeeId");
    const statusParam = searchParams.get("status");
    
    // Convert null to undefined to match expected types in getSoftLoans
    const employeeId = employeeIdParam === null ? undefined : employeeIdParam;
    const status = statusParam === null ? undefined : statusParam;
    
    // Use the centralized function to get soft loans
    const softLoans = await getSoftLoans(
      { employeeId, status },
      session.user.role === "ADMIN",
      session.user.id
    );
    
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
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }
    
    const body = await request.json();
    const { employeeId, totalAmount, durationMonths, startMonth, startYear, reason, monthlyAmount } = body;
    
    // Use the centralized function to create a soft loan
    const softLoan = await createSoftLoan(
      {
        employeeId,
        totalAmount,
        durationMonths,
        startMonth,
        startYear,
        reason,
        monthlyAmount
      },
      session.user.role === "ADMIN",
      session.user.id
    );

    return NextResponse.json(softLoan, { status: 201 });
  } catch (error) {
    console.error("Error creating soft loan:", error);
    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Failed to create soft loan" },
      { status: 500 }
    );
  }
}

// PUT: Update a soft loan status (admin only)
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
    const { status } = body;

    // Use the centralized function to update soft loan status
    const updatedSoftLoan = await updateSoftLoanStatus(id, status);

    return NextResponse.json(updatedSoftLoan);
  } catch (error) {
    console.error("Error updating soft loan:", error);
    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }
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

    // Use the centralized function to delete a soft loan
    await deleteSoftLoan(id);

    return NextResponse.json({ message: "Soft loan deleted successfully" });
  } catch (error) {
    console.error("Error deleting soft loan:", error);
    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }
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
    
    // Use the centralized function to update soft loan deduction
    const updatedSoftLoan = await updateSoftLoanDeduction(id, deductionAmount);
    
    return NextResponse.json(updatedSoftLoan);
  } catch (error) {
    console.error("Error updating soft loan:", error);
    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Failed to update soft loan" },
      { status: 500 }
    );
  }
}
