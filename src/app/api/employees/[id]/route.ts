import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

// GET a single employee
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const employeeId = params.id;

    // Allow admins to access any employee, but employees can only access their own data
    if (session.user.role !== "ADMIN") {
      const employee = await prisma.employee.findFirst({
        where: {
          id: employeeId,
          user: {
            id: session.user.id,
          },
        },
      });

      if (!employee) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    if (!employee) {
      return NextResponse.json(
        { error: "Employee not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(employee);
  } catch (error) {
    console.error("Error fetching employee:", error);
    return NextResponse.json(
      { error: "Failed to fetch employee" },
      { status: 500 }
    );
  }
}

// PUT update an employee
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only admins can update employees
    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const employeeId = params.id;
    const body = await req.json();
    const {
      name,
      email,
      position,
      department,
      basicSalary,
      contactNumber,
      address,
      isActive,
    } = body;

    // Find the employee
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      include: { user: true },
    });

    if (!employee) {
      return NextResponse.json(
        { error: "Employee not found" },
        { status: 404 }
      );
    }

    // Check if email already exists (if changing email)
    if (email !== employee.user.email) {
      const existingUser = await prisma.user.findUnique({
        where: { email },
      });

      if (existingUser) {
        return NextResponse.json(
          { error: "Email already in use" },
          { status: 400 }
        );
      }
    }

    // Update user and employee in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Update user
      const user = await tx.user.update({
        where: { id: employee.userId },
        data: {
          name,
          email,
        },
      });

      // Update employee
      const updatedEmployee = await tx.employee.update({
        where: { id: employeeId },
        data: {
          position,
          department,
          basicSalary,
          contactNumber,
          address,
          isActive,
        },
      });

      return { user, employee: updatedEmployee };
    });

    return NextResponse.json(result.employee);
  } catch (error) {
    console.error("Error updating employee:", error);
    return NextResponse.json(
      { error: "Failed to update employee" },
      { status: 500 }
    );
  }
}

// DELETE an employee
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only admins can delete employees
    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const employeeId = params.id;

    // Find the employee
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
    });

    if (!employee) {
      return NextResponse.json(
        { error: "Employee not found" },
        { status: 404 }
      );
    }

    // Delete employee and associated user in a transaction
    await prisma.$transaction(async (tx) => {
      // Delete employee
      await tx.employee.delete({
        where: { id: employeeId },
      });

      // Delete user
      await tx.user.delete({
        where: { id: employee.userId },
      });
    });

    return NextResponse.json({ message: "Employee deleted successfully" });
  } catch (error) {
    console.error("Error deleting employee:", error);
    return NextResponse.json(
      { error: "Failed to delete employee" },
      { status: 500 }
    );
  }
} 