import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/session";
import { getSoftLoanById, updateSoftLoanStatus } from "@/lib/softloan";
import { createEmployeeSuccessNotification, createEmployeeErrorNotification } from "@/lib/notification";

// GET: Get specific soft loan details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const user = await requireAuth();

    // Use the centralized function to get soft loan by ID
    const softLoan = await getSoftLoanById(id, user.role === "ADMIN", user.id);

    return NextResponse.json(softLoan);
  } catch (error) {
    console.error('Error fetching soft loan:', error);
    if (error instanceof Error) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }
    return NextResponse.json({ message: 'Error fetching soft loan' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const user = await requireAuth();

    if (user.role !== "ADMIN") {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 403 });
    }

    const { status } = await request.json();

    if (!['APPROVED', 'REJECTED'].includes(status)) {
      return NextResponse.json({ message: 'Invalid status' }, { status: 400 });
    }

    // Use the centralized function to update soft loan status
    const updatedSoftLoan = await updateSoftLoanStatus(id, status);

    // Create notification for the employee
    const message = status === 'APPROVED' ? `Your soft loan request has been approved.` : `Your soft loan request has been rejected.`;
    const title = status === 'APPROVED' ? 'Soft Loan Approved' : 'Soft Loan Rejected';
    
    if (status === 'APPROVED') {
      await createEmployeeSuccessNotification(
        updatedSoftLoan.employeeId,
        title,
        message
      );
    } else {
      await createEmployeeErrorNotification(
        updatedSoftLoan.employeeId,
        title,
        message
      );
    }

    return NextResponse.json(updatedSoftLoan);
  } catch (error) {
    console.error('Error updating soft loan status:', error);
    if (error instanceof Error) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }
    return NextResponse.json({ message: 'Error updating soft loan status' }, { status: 500 });
  }
}
