import { prisma } from "./prisma";
import { db } from "./db";

export type NotificationType = "info" | "success" | "warning" | "error";

/**
 * Fungsi untuk membuat notifikasi baru
 * @param userId ID pengguna yang akan menerima notifikasi
 * @param title Judul notifikasi
 * @param message Isi pesan notifikasi
 * @param type Tipe notifikasi (info, success, warning, error)
 * @returns Objek notifikasi yang dibuat
 */
export const createNotification = async (
  userId: string,
  title: string,
  message: string,
  type: NotificationType
) => {
  try {
    const notification = await prisma.notification.create({
      data: {
        userId,
        title,
        message,
        type,
        read: false,
      },
    });

    return notification;
  } catch (error) {
    console.error("Error creating notification:", error);
    throw new Error(`Gagal membuat notifikasi: ${error}`);
  }
};

/**
 * Membuat notifikasi penggajian untuk karyawan
 * @param employeeId ID karyawan
 * @param title Judul notifikasi
 * @param message Isi pesan notifikasi
 * @param type Tipe notifikasi
 * @returns Objek notifikasi yang dibuat
 */
export const createEmployeeNotification = async (
  employeeId: string,
  title: string,
  message: string, 
  type: NotificationType
) => {
  try {
    // Dapatkan user ID dari employee ID
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { userId: true }
    });

    if (!employee) {
      throw new Error(`Karyawan dengan ID ${employeeId} tidak ditemukan`);
    }

    return createNotification(employee.userId, title, message, type);
  } catch (error) {
    console.error("Error creating employee notification:", error);
    throw new Error(`Gagal membuat notifikasi karyawan: ${error}`);
  }
};

/**
 * Membuat notifikasi untuk semua admin
 * @param title Judul notifikasi
 * @param message Isi pesan notifikasi
 * @param type Tipe notifikasi
 * @returns Array notifikasi yang dibuat
 */
export const createAdminNotifications = async (
  title: string,
  message: string,
  type: NotificationType
) => {
  try {
    // Dapatkan semua pengguna dengan peran ADMIN
    const admins = await prisma.user.findMany({
      where: { role: "ADMIN" },
      select: { id: true }
    });

    if (admins.length === 0) {
      console.warn("Tidak ada admin yang ditemukan untuk mengirim notifikasi");
      return [];
    }

    // Buat notifikasi untuk setiap admin
    const notificationPromises = admins.map(admin => 
      createNotification(admin.id, title, message, type)
    );

    return Promise.all(notificationPromises);
  } catch (error) {
    console.error("Error creating admin notifications:", error);
    throw new Error(`Gagal membuat notifikasi admin: ${error}`);
  }
};

/**
 * Format tanggal untuk pesan notifikasi
 * @param date Objek tanggal atau string tanggal
 * @returns String tanggal yang sudah diformat dalam bahasa Indonesia
 */
export const formatNotificationDate = (date: Date | string) => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  return dateObj.toLocaleDateString('id-ID', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

/**
 * Format mata uang untuk pesan notifikasi
 * @param amount Jumlah dalam angka
 * @returns String mata uang yang sudah diformat dalam Rupiah (IDR)
 */
export const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
  }).format(amount);
};

/**
 * Membuat notifikasi penggajian dibayarkan
 * @param employeeId ID karyawan
 * @param month Bulan periode gaji (1-12)
 * @param year Tahun periode gaji
 * @param amount Jumlah gaji yang dibayarkan
 * @returns Objek notifikasi yang dibuat
 */
export const createPayrollPaidNotification = async (
  employeeId: string,
  month: number,
  year: number,
  amount: number
) => {
  try {
    const formattedDate = new Date(year, month - 1).toLocaleDateString('id-ID', {
      year: 'numeric',
      month: 'long'
    });
    
    const formattedAmount = formatCurrency(amount);
    
    const title = "Gaji Telah Dibayarkan";
    const message = `Gaji Anda untuk periode ${formattedDate} telah dibayarkan. Jumlah: ${formattedAmount}`;
    
    return createEmployeeNotification(employeeId, title, message, "success");
  } catch (error) {
    console.error("Error creating payroll paid notification:", error);
    throw new Error(`Gagal membuat notifikasi gaji dibayarkan: ${error}`);
  }
};

/**
 * Membuat notifikasi slip gaji baru
 * @param employeeId ID karyawan
 * @param month Bulan periode gaji (1-12)
 * @param year Tahun periode gaji
 * @returns Objek notifikasi yang dibuat
 */
export const createPayslipGeneratedNotification = async (
  employeeId: string,
  month: number,
  year: number
) => {
  try {
    const formattedDate = new Date(year, month - 1).toLocaleDateString('id-ID', {
      year: 'numeric',
      month: 'long'
    });
    
    const title = "Slip Gaji Baru Tersedia";
    const message = `Slip gaji Anda untuk periode ${formattedDate} telah tersedia. Silahkan periksa halaman Penggajian.`;
    
    return createEmployeeNotification(employeeId, title, message, "info");
  } catch (error) {
    console.error("Error creating payslip notification:", error);
    throw new Error(`Gagal membuat notifikasi slip gaji: ${error}`);
  }
};

/**
 * Membuat notifikasi kehadiran (check-in)
 * @param userId ID pengguna karyawan
 * @param isLate Apakah check-in terlambat
 * @param time Waktu check-in
 * @returns Objek notifikasi yang dibuat
 */
export const createCheckInNotification = async (
  userId: string,
  isLate: boolean,
  time: Date
) => {
  try {
    const formattedTime = time.toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit'
    });
    
    const title = isLate ? "Check-in Terlambat" : "Check-in Berhasil";
    const message = isLate
      ? `Anda check-in pada ${formattedTime} yang terlambat dari waktu yang diharapkan (08:00).`
      : `Anda berhasil check-in pada ${formattedTime}.`;
    
    return createNotification(userId, title, message, isLate ? "warning" : "success");
  } catch (error) {
    console.error("Error creating check-in notification:", error);
    throw new Error(`Gagal membuat notifikasi check-in: ${error}`);
  }
};

/**
 * Membuat notifikasi kehadiran (check-out)
 * @param userId ID pengguna karyawan
 * @param workDurationHours Durasi kerja dalam jam
 * @param hasOvertime Apakah ada lembur
 * @param overtimeHours Jam lembur
 * @param time Waktu check-out
 * @returns Objek notifikasi yang dibuat
 */
export const createCheckOutNotification = async (
  userId: string,
  workDurationHours: number,
  hasOvertime: boolean,
  overtimeHours: number,
  time: Date
) => {
  try {
    const formattedTime = time.toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit'
    });
    
    const title = "Check-out Berhasil";
    const message = hasOvertime
      ? `Anda berhasil check-out pada ${formattedTime}. Total durasi kerja: ${workDurationHours.toFixed(2)} jam, termasuk lembur ${overtimeHours.toFixed(2)} jam.`
      : `Anda berhasil check-out pada ${formattedTime}. Total durasi kerja: ${workDurationHours.toFixed(2)} jam.`;
    
    return createNotification(userId, title, message, "success");
  } catch (error) {
    console.error("Error creating check-out notification:", error);
    throw new Error(`Gagal membuat notifikasi check-out: ${error}`);
  }
};

/**
 * Membuat notifikasi admin untuk keterlambatan karyawan
 * @param employeeName Nama karyawan
 * @param time Waktu check-in
 * @param date Tanggal check-in
 * @returns Array notifikasi yang dibuat
 */
export const createLateCheckInAdminNotification = async (
  employeeName: string,
  time: Date,
  date: Date = new Date()
) => {
  try {
    const formattedTime = time.toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit'
    });
    
    const formattedDate = date.toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
    
    const title = "Peringatan Keterlambatan";
    const message = `${employeeName} terlambat check-in pada ${formattedTime} tanggal ${formattedDate}.`;
    
    return createAdminNotifications(title, message, "warning");
  } catch (error) {
    console.error("Error creating late check-in admin notification:", error);
    throw new Error(`Gagal membuat notifikasi keterlambatan untuk admin: ${error}`);
  }
};

/**
 * Membuat notifikasi admin untuk lembur karyawan
 * @param employeeName Nama karyawan
 * @param overtimeHours Jam lembur
 * @param date Tanggal lembur
 * @returns Array notifikasi yang dibuat
 */
export const createOvertimeAdminNotification = async (
  employeeName: string,
  overtimeHours: number,
  date: Date = new Date()
) => {
  try {
    const formattedDate = date.toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
    
    const title = "Laporan Lembur";
    const message = `${employeeName} melakukan lembur selama ${overtimeHours.toFixed(2)} jam pada tanggal ${formattedDate}.`;
    
    return createAdminNotifications(title, message, "info");
  } catch (error) {
    console.error("Error creating overtime admin notification:", error);
    throw new Error(`Gagal membuat notifikasi lembur untuk admin: ${error}`);
  }
};

/**
 * Menambahkan header respons khusus untuk memicu pembaruan notifikasi di UI
 * @param response Objek NextResponse yang akan ditambahkan headernya
 * @returns Objek NextResponse yang sama dengan header tambahan
 */
export const addNotificationUpdateHeader = (response: any) => {
  // Tambahkan header X-Notification-Update untuk memberi tahu frontend bahwa ada perubahan notifikasi
  response.headers.set('X-Notification-Update', 'true');
  return response;
};

/**
 * Membuat notifikasi dan menyiapkan respons dengan header untuk sinkronisasi
 * @param userId ID pengguna yang akan menerima notifikasi
 * @param title Judul notifikasi
 * @param message Isi pesan notifikasi
 * @param type Tipe notifikasi
 * @param response Objek NextResponse yang akan ditambahkan headernya
 * @returns Objek NextResponse yang sama dengan header tambahan
 */
export const createNotificationWithResponse = async (
  userId: string,
  title: string,
  message: string,
  type: NotificationType,
  response: any
) => {
  await createNotification(userId, title, message, type);
  return addNotificationUpdateHeader(response);
};

/**
 * Membuat notifikasi karyawan dan menyiapkan respons dengan header untuk sinkronisasi
 * @param employeeId ID karyawan
 * @param title Judul notifikasi
 * @param message Isi pesan notifikasi
 * @param type Tipe notifikasi
 * @param response Objek NextResponse yang akan ditambahkan headernya
 * @returns Objek NextResponse yang sama dengan header tambahan
 */
export const createEmployeeNotificationWithResponse = async (
  employeeId: string,
  title: string,
  message: string,
  type: NotificationType,
  response: any
) => {
  await createEmployeeNotification(employeeId, title, message, type);
  return addNotificationUpdateHeader(response);
}; 