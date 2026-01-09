import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { db } from "@/lib/db";
import { differenceInDays } from "date-fns";
import { createAdminNotifications } from "@/lib/notification";

// GET /api/leave - Mendapatkan daftar cuti
export async function GET(_req: NextRequest) {
  try {
    const session = await getServerSession();
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const user = await db.user.findUnique({
      where: { email: session.user.email! },
      include: { employee: true },
    });
    
    if (!user?.employee) {
      return NextResponse.json({ error: "Karyawan tidak ditemukan" }, { status: 404 });
    }
    
    const leaves = await db.leave.findMany({
      where: {
        employeeId: user.employee.id,
      },
      orderBy: {
        createdAt: "desc",
      },
      include: {
        employee: {
          include: {
            user: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });
    
    return NextResponse.json(leaves);
  } catch (error) {
    console.error("Error getting leave requests:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan saat memuat data cuti" },
      { status: 500 }
    );
  }
}

// POST /api/leave - Membuat permohonan cuti baru
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession();
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const body = await req.json();
    const { startDate, endDate, type, reason } = body;
    
    // Validate input data
    if (!startDate || !endDate || !type || !reason) {
      return NextResponse.json(
        { error: "Semua bidang wajib diisi" },
        { status: 400 }
      );
    }
    
    const user = await db.user.findUnique({
      where: { email: session.user.email! },
      include: { employee: true },
    });
    
    if (!user?.employee) {
      return NextResponse.json(
        { error: "Karyawan tidak ditemukan" },
        { status: 404 }
      );
    }
    
    // Check if there are overlapping leave requests
    const overlappingLeaves = await db.leave.findMany({
      where: {
        employeeId: user.employee.id,
        status: { in: ["PENDING", "APPROVED"] },
        OR: [
          {
            // Requested start date falls within an existing leave
            startDate: { lte: new Date(startDate) },
            endDate: { gte: new Date(startDate) },
          },
          {
            // Requested end date falls within an existing leave
            startDate: { lte: new Date(endDate) },
            endDate: { gte: new Date(endDate) },
          },
          {
            // Existing leave falls within the requested dates
            startDate: { gte: new Date(startDate) },
            endDate: { lte: new Date(endDate) },
          },
        ],
      },
    });
    
    if (overlappingLeaves.length > 0) {
      return NextResponse.json(
        { error: "Terdapat permohonan cuti yang tumpang tindih dengan tanggal yang dipilih" },
        { status: 400 }
      );
    }
    
    // Calculate leave duration
    const duration = differenceInDays(new Date(endDate), new Date(startDate)) + 1;

    // Create dates at noon UTC to avoid timezone shifting issues
    // When dates are stored as midnight UTC, converting to local time in western timezones (e.g. UTC-5)
    // shifts them to the previous day. Noon UTC is safe for all business timezones.
    const startDateTime = new Date(startDate);
    startDateTime.setUTCHours(12, 0, 0, 0);
    
    const endDateTime = new Date(endDate);
    endDateTime.setUTCHours(12, 0, 0, 0);
    
    // Create leave request
    const leaveRequest = await db.leave.create({
      data: {
        employeeId: user.employee.id,
        startDate: startDateTime,
        endDate: endDateTime,
        type,
        reason,
      },
    });
    
    // Create notification for admin
    await createAdminNotifications(
      "Permohonan Cuti Baru",
      `${user.name} mengajukan cuti ${duration} hari (${new Date(startDate).toLocaleDateString('id-ID')} - ${new Date(endDate).toLocaleDateString('id-ID')})`,
      "info",
      { refType: "LEAVE", refId: leaveRequest.id }
    );
    
    return NextResponse.json(leaveRequest);
  } catch (error) {
    console.error("Error creating leave request:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan saat memproses permohonan cuti" },
      { status: 500 }
    );
  }
} 
