import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { calculateDistance } from "@/lib/geoUtils";
import { checkIn } from "@/lib/attendance";
import { toWIB, getWorkdayType, WorkdayType, isOvertimeCheckIn } from "@/lib/attendanceRules";
import { 
  createCheckInNotification, 
  createLateCheckInAdminNotification,
  createOvertimeAdminNotification,
  addNotificationUpdateHeader
} from "@/lib/notification";

// Schema validasi input menggunakan Zod
const checkInSchema = z.object({
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
      include: { user: { select: { name: true } } },
    });

    if (!employee) {
      return NextResponse.json({ error: "Data karyawan tidak ditemukan" }, { status: 404 });
    }

    // Validasi body request
    const body = await req.json();
    const validation = checkInSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Format data tidak valid", details: validation.error.format() },
        { status: 400 }
      );
    }

    const { latitude, longitude, photoUrl } = validation.data;

    // Ambil data lokasi kantor dan radius dari database
    let office = await prisma.officeLocation.findFirst();

    // Jika belum ada data kantor, buat default sesuai permintaan user
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

    // Lanjutkan proses check-in jika dalam radius
    const now = new Date();
    const nowWIB = toWIB(now);
    const workdayType = getWorkdayType(now);

    // Cek apakah ini pengajuan ulang (logika disesuaikan dari route utama)
    const today = new Date(toWIB(new Date()));
    today.setHours(0, 0, 0, 0);
    const existingAttendance = await prisma.attendance.findFirst({
      where: {
        employeeId: employee.id,
        date: {
          gte: today,
          lt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
        },
      },
    });

    const isPengajuanUlang = existingAttendance && 
                           existingAttendance.checkIn && 
                           ((existingAttendance.notes && existingAttendance.notes.includes("Di Tolak")) || 
                            (existingAttendance.approvedAt !== null && 
                             (existingAttendance.isSundayWorkApproved === false || 
                              existingAttendance.isOvertimeApproved === false)));

    // Notifikasi Admin jika diperlukan
    if (workdayType === WorkdayType.SUNDAY) {
      await createLateCheckInAdminNotification(
        employee.id,
        employee.user.name,
        isPengajuanUlang ? "Pengajuan ulang: Hari Minggu" : "Bekerja pada hari Minggu",
        nowWIB
      );
    }

    if (isOvertimeCheckIn(now, now)) {
      await createOvertimeAdminNotification(
        employee.id,
        employee.user.name,
        isPengajuanUlang ? "Pengajuan ulang: Jam Lembur" : "Check-in pada jam lembur",
        nowWIB
      );
    }

    // Simpan data absensi
    const attendance = await checkIn(employee.id, photoUrl, latitude, longitude);

    // Notifikasi Karyawan
    let message = "Absen masuk berhasil dicatat.";
    if (isPengajuanUlang) {
      message = "Pengajuan ulang check-in berhasil dicatat. Menunggu persetujuan admin.";
    } else if (workdayType === WorkdayType.SUNDAY || isOvertimeCheckIn(now, now)) {
      message = "Absen masuk berhasil dicatat. Memerlukan persetujuan admin.";
    } else if (attendance.isLate) {
      message = `Anda terlambat ${attendance.lateMinutes} menit.`;
    }

    await createCheckInNotification(employee.id, message);

    const response = NextResponse.json({
      message: "Check-in sukses",
      attendance,
    });

    addNotificationUpdateHeader(response);
    return response;

  } catch (error: any) {
    console.error("Error in check-in:", error);
    return NextResponse.json(
      { error: "Gagal memproses check-in" },
      { status: 500 }
    );
  }
}
