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
 * Membuat notifikasi check-in baru
 * @param employeeId ID karyawan
 * @param message Pesan notifikasi
 * @returns Objek notifikasi yang dibuat
 */
export const createCheckInNotification = async (
  employeeId: string,
  message: string
) => {
  return createEmployeeNotification(employeeId, "Check-in Berhasil", message, "success");
};

/**
 * Membuat notifikasi check-out baru
 * @param employeeId ID karyawan
 * @param message Pesan notifikasi
 * @returns Objek notifikasi yang dibuat
 */
export const createCheckOutNotification = async (
  employeeId: string,
  message: string
) => {
  return createEmployeeNotification(employeeId, "Check-out Berhasil", message, "success");
};

/**
 * Membuat notifikasi keterlambatan karyawan untuk admin
 * @param employeeId ID karyawan
 * @param employeeName Nama karyawan
 * @param reason Alasan/keterangan tambahan
 * @param time Waktu kejadian
 * @returns Array notifikasi yang dibuat
 */
export const createLateCheckInAdminNotification = async (
  employeeId: string,
  employeeName: string,
  reason: string,
  time: Date
) => {
  const formattedTime = time.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit'
  });
  
  // Cek apakah notifikasi tentang bekerja di hari Minggu
  if (reason.includes("hari Minggu")) {
    const title = `Memerlukan Persetujuan: ${employeeName}`;
    const message = `${employeeName} melakukan check-in pada ${formattedTime}. ${reason}`;
    return createAdminNotifications(title, message, "warning");
  } else {
    // Notifikasi keterlambatan biasa
    const title = `Karyawan Terlambat: ${employeeName}`;
    const message = `${employeeName} melakukan check-in pada ${formattedTime}. ${reason}`;
    return createAdminNotifications(title, message, "warning");
  }
};

/**
 * Membuat notifikasi lembur karyawan untuk admin
 * @param employeeId ID karyawan
 * @param employeeName Nama karyawan
 * @param reason Alasan/keterangan tambahan
 * @param time Waktu kejadian
 * @returns Array notifikasi yang dibuat
 */
export const createOvertimeAdminNotification = async (
  employeeId: string,
  employeeName: string,
  reason: string,
  time: Date
) => {
  const formattedTime = time.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit'
  });
  
  const title = `Memerlukan Persetujuan: ${employeeName}`;
  const message = `${employeeName} sedang lembur pada ${formattedTime}. ${reason} (perlu persetujuan)`;
  
  return createAdminNotifications(title, message, "warning");
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