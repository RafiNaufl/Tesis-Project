import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { updateEmployee } from "@/lib/updateEmployee";

// GET a single employee
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: employeeId } = await params;

    // Allow admins/managers to access any employee, but employees can only access their own data
    if (session.user.role !== "ADMIN" && session.user.role !== "MANAGER") {
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
  { params }: { params: Promise<{ id: string }> }
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

    const { id: employeeId } = await params;
    const body = await req.json();

    const result = await updateEmployee(employeeId, body, session.user.id);

    if (!result.ok) {
        if (typeof result.error === "string" && (result.error === "Employee not found")) {
            return NextResponse.json({ error: result.error }, { status: 404 });
        }
        return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json(result.data);
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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: "Tidak diizinkan" }, { status: 401 });
    }

    // Only admins can delete employees
    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
    }

    const { id: employeeId } = await params;

    // Find the employee
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
    });

    if (!employee) {
      return NextResponse.json(
        { error: "Karyawan tidak ditemukan" },
        { status: 404 }
      );
    }

    // Delete user (cascade deletes employee)
    // But we need to manually delete related records first because some relations don't have onDelete: Cascade
    await prisma.$transaction(async (tx) => {
      // 1. Delete Payroll related data
      // Delete PayrollAuditLogs first (no cascade)
      await tx.payrollAuditLog.deleteMany({
        where: {
          payroll: {
            employeeId: employee.id
          }
        }
      });
      // Delete Payrolls
      await tx.payroll.deleteMany({
        where: { employeeId: employee.id }
      });

      // 2. Delete Attendance related data
      // Attendance has cascade for ApprovalLog, AttendanceAuditLog, and AuditLog (via attendanceId)
      await tx.attendance.deleteMany({
        where: { employeeId: employee.id }
      });

      // 3. Delete other related records
      await tx.allowance.deleteMany({ where: { employeeId: employee.id } });
      await tx.deduction.deleteMany({ where: { employeeId: employee.id } });
      await tx.leave.deleteMany({ where: { employeeId: employee.id } });
      await tx.advance.deleteMany({ where: { employeeId: employee.id } });
      await tx.softLoan.deleteMany({ where: { employeeId: employee.id } });
      await tx.overtimeRequest.deleteMany({ where: { employeeId: employee.id } });
      
      // 4. Delete AuditLogs directly linked to employee (not via attendance)
      await tx.auditLog.deleteMany({ where: { employeeId: employee.id } });

      // 5. Finally delete the User (which cascades to Employee and EmployeeIdLog)
      await tx.user.delete({
        where: { id: employee.userId },
      });
    });

    return NextResponse.json({ message: "Karyawan berhasil dihapus" });
  } catch (error) {
    console.error("Error deleting employee:", error);
    return NextResponse.json(
      { error: "Gagal menghapus karyawan" },
      { status: 500 }
    );
  }
}
