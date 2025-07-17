import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/session";

// GET: Get specific soft loan details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const user = await requireAuth();

    const softLoan = await prisma.softLoan.findUnique({
      where: {
        id: id,
      },
      include: {
        employee: true,
      },
    });

    if (!softLoan) {
      return NextResponse.json({ message: 'Soft loan not found' }, { status: 404 });
    }

    // Restrict access: only the employee who requested it or an admin can view
    if (!user.isAdmin && user.employeeId !== softLoan.employeeId) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 403 });
    }

    return NextResponse.json(softLoan);
  } catch (error) {
    console.error('Error fetching soft loan:', error);
    return NextResponse.json({ message: 'Error fetching soft loan' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const user = await requireAuth();

    if (!user.isAdmin) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 403 });
    }

    const { status } = await request.json();

    if (!['APPROVED', 'REJECTED'].includes(status)) {
      return NextResponse.json({ message: 'Invalid status' }, { status: 400 });
    }

    const updatedSoftLoan = await prisma.softLoan.update({
      where: {
        id,
      },
      data: {
        status,
      },
      include: {
        employee: true,
      },
    });

    // Create notification for the employee
    const message = status === 'APPROVED' ? `Your soft loan request has been approved.` : `Your soft loan request has been rejected.`;

    await prisma.notification.create({
      data: {
        userId: updatedSoftLoan.employee.userId,
        title: status === 'APPROVED' ? 'Soft Loan Approved' : 'Soft Loan Rejected',
        message,
        type: status === 'APPROVED' ? 'SUCCESS' : 'ERROR',
      },
    });

    return NextResponse.json(updatedSoftLoan);
  } catch (error) {
    console.error('Error updating soft loan status:', error);
    return NextResponse.json({ message: 'Error updating soft loan status' }, { status: 500 });
  }
}