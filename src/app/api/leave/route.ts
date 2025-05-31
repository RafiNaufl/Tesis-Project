import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createLeaveRequest, getEmployeeLeaveRequests, getPendingLeaveRequests } from "@/lib/leave";
import { LeaveType } from "@/generated/prisma";

// GET /api/leave - Mendapatkan daftar cuti
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        { error: "Tidak diizinkan" },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    const employee = await prisma.employee.findUnique({
      where: { userId },
    });

    if (!employee) {
      return NextResponse.json(
        { error: "Data karyawan tidak ditemukan" },
        { status: 404 }
      );
    }

    // Jika admin, kembalikan semua permohonan cuti yang tertunda
    if (session.user.role === "ADMIN") {
      const pendingLeaves = await getPendingLeaveRequests();
      return NextResponse.json(pendingLeaves);
    }

    // Jika karyawan biasa, kembalikan hanya permohonan cuti mereka
    const leaves = await getEmployeeLeaveRequests(employee.id);
    return NextResponse.json(leaves);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

// POST /api/leave - Membuat permohonan cuti baru
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        { error: "Tidak diizinkan" },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    const employee = await prisma.employee.findUnique({
      where: { userId },
    });

    if (!employee) {
      return NextResponse.json(
        { error: "Data karyawan tidak ditemukan" },
        { status: 404 }
      );
    }

    const data = await request.json();
    const { startDate, endDate, reason, type } = data;

    if (!startDate || !endDate || !reason || !type) {
      return NextResponse.json(
        { error: "Data tidak lengkap" },
        { status: 400 }
      );
    }

    // Validasi tipe cuti
    if (!Object.values(LeaveType).includes(type as LeaveType)) {
      return NextResponse.json(
        { error: "Tipe cuti tidak valid" },
        { status: 400 }
      );
    }

    const leave = await createLeaveRequest(
      employee.id,
      new Date(startDate),
      new Date(endDate),
      reason,
      type as LeaveType
    );

    return NextResponse.json(leave, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
} 