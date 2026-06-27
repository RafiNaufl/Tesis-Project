import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { calculateDistance } from "@/lib/geoUtils";
import { checkOut } from "@/lib/attendance";
import { toWIB } from "@/lib/attendanceRules";
import { 
  createCheckOutNotification,
  addNotificationUpdateHeader
} from "@/lib/notification";

// Schema validasi input menggunakan Zod
const checkOutSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  photoUrl: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: "Tidak diizinkan" }, { status: 401 });
    }

    // Ambil data karyawan
    const employee = await prisma.employee.findFirst({
      where: { userId: session.user.id },
    });

    if (!employee) {
      return NextResponse.json({ error: "Data karyawan tidak ditemukan" }, { status: 404 });
    }

    // Validasi body request
    const body = await req.json();
    const validation = checkOutSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Format data tidak valid", details: validation.error.format() },
        { status: 400 }
      );
    }

    const { latitude, longitude, photoUrl } = validation.data;

    // Ambil data lokasi kantor dan radius dari database
    let office = await prisma.officeLocation.findFirst();

    // Jika belum ada data kantor, buat default
    if (!office) {
      office = await prisma.officeLocation.create({
        data: {
          name: "Kantor Pusat",
          latitude: -6.001741,
          longitude: 106.012622,
          radius: 50,
        },
      });
    }

    // Hitung jarak menggunakan Haversine
    const distance = calculateDistance(
      latitude,
      longitude,
      office.latitude,
      office.longitude
    );

    // Validasi Geofencing (Radius)
    if (distance > office.radius) {
      return NextResponse.json(
        { 
          error: "Absensi gagal: Anda berada di luar radius kantor",
          distance: Math.round(distance),
          maxRadius: office.radius
        },
        { status: 400 }
      );
    }

    // Cek apakah karyawan sudah melakukan check-in hari ini
    const now = new Date();
    const todayStart = new Date(toWIB(now));
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(toWIB(now));
    todayEnd.setHours(23, 59, 59, 999);
    
    const todayAttendance = await prisma.attendance.findFirst({
      where: {
        employeeId: employee.id,
        date: {
          gte: todayStart,
          lte: todayEnd,
        },
      },
    });

    if (!todayAttendance || !todayAttendance.checkIn) {
      return NextResponse.json(
        { error: "Anda belum melakukan check-in hari ini" },
        { status: 400 }
      );
    }

    // Simpan data check-out
    const attendance = await checkOut(employee.id, photoUrl, latitude, longitude);

    // Notifikasi Karyawan
    await createCheckOutNotification(employee.id, "Absen keluar berhasil dicatat.");

    const response = NextResponse.json({
      message: "Check-out sukses",
      attendance,
    });

    addNotificationUpdateHeader(response);
    return response;

  } catch (error: any) {
    console.error("Error in check-out:", error);
    return NextResponse.json(
      { error: error.message || "Gagal memproses check-out" },
      { status: 500 }
    );
  }
}
