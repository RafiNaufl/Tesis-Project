import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

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

    // Periksa data terkait (untuk informasi)
    const attendanceCount = await prisma.attendance.count({
      where: { employeeId: employee.id }
    });

    const payrollCount = await prisma.payroll.count({
      where: { employeeId: employee.id }
    });

    // Lakukan penghapusan CASCADE semua data terkait
    // Hapus semua data dalam transaksi untuk menjaga integritas database
    await prisma.$transaction(async (tx) => {
      // 1. Hapus semua data kehadiran terkait karyawan
      if (attendanceCount > 0) {
        await tx.attendance.deleteMany({
          where: { employeeId: employee.id }
        });
      }

      // 2. Hapus semua data penggajian terkait karyawan
      if (payrollCount > 0) {
        await tx.payroll.deleteMany({
          where: { employeeId: employee.id }
        });
      }

      // 3. Hapus data notifikasi terkait
      await tx.notification.deleteMany({
        where: { userId: employee.userId }
      });

      // 4. Hapus karyawan
      await tx.employee.delete({
        where: { id: employeeId },
      });

      // 5. Hapus user
      await tx.user.delete({
        where: { id: employee.userId },
      });
    });

    // Informasi tentang data yang dihapus (untuk log)
    const deletedDataInfo = [];
    if (attendanceCount > 0) deletedDataInfo.push(`${attendanceCount} data kehadiran`);
    if (payrollCount > 0) deletedDataInfo.push(`${payrollCount} data penggajian`);
    
    const successMessage = deletedDataInfo.length > 0
      ? `Karyawan berhasil dihapus beserta ${deletedDataInfo.join(" dan ")}`
      : "Karyawan berhasil dihapus";

    return NextResponse.json({ 
      message: successMessage,
      deletedRelatedData: {
        attendance: attendanceCount,
        payroll: payrollCount
      }
    });
  } catch (error: any) {
    console.error("Error deleting employee:", error);
    
    // Berikan pesan error yang lebih spesifik berdasarkan jenis error
    let errorMessage = "Gagal menghapus karyawan";
    let statusCode = 500;
    
    if (error.code === 'P2025') {
      errorMessage = "Karyawan tidak ditemukan";
      statusCode = 404;
    } else if (error.code === 'P2003') {
      errorMessage = "Tidak dapat menghapus karyawan. Hubungi administrator sistem.";
      statusCode = 400;
    }
    
    return NextResponse.json(
      { error: errorMessage },
      { status: statusCode }
    );
  }
}