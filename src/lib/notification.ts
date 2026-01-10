import { prisma } from "./prisma";
import { sendPushNotification } from "./push-notification";

/**
 * Enum untuk tipe notifikasi
 * Menggunakan enum untuk memastikan konsistensi tipe di seluruh aplikasi
 */
export enum NotificationType {
  INFO = "info",
  SUCCESS = "success",
  WARNING = "warning",
  ERROR = "error"
}

// Type untuk kompatibilitas dengan kode lama
export type NotificationTypeString = "info" | "success" | "warning" | "error";


/**
 * Fungsi untuk membuat notifikasi baru
 * @param userId ID pengguna yang akan menerima notifikasi
 * @param title Judul notifikasi
 * @param message Isi pesan notifikasi
 * @param type Tipe notifikasi (menggunakan enum NotificationType)
 * @returns Objek notifikasi yang dibuat
 */
export const createNotification = async (
  userId: string,
  title: string,
  message: string,
  type: NotificationType | NotificationTypeString,
  opts?: { refType?: string; refId?: string }
) => {
  try {
    // Pastikan tipe notifikasi selalu menggunakan nilai dari enum
    let normalizedType: string;
    
    if (typeof type === 'string') {
      // Konversi string ke nilai enum yang sesuai
      switch(type.toLowerCase()) {
        case 'info': normalizedType = NotificationType.INFO; break;
        case 'success': normalizedType = NotificationType.SUCCESS; break;
        case 'warning': normalizedType = NotificationType.WARNING; break;
        case 'error': normalizedType = NotificationType.ERROR; break;
        default: normalizedType = NotificationType.INFO; // Default ke INFO jika tidak valid
      }
    } else {
      // Gunakan nilai enum langsung
      normalizedType = type;
    }
    
    const notification = await prisma.notification.create({
      data: {
        userId,
        title,
        message,
        type: normalizedType,
        read: false,
        refType: opts?.refType,
        refId: opts?.refId,
      },
    });

    // Fire and forget push notification (don't block the main flow)
    sendPushNotification(userId, title, message, {
      type: normalizedType,
      refType: opts?.refType || '',
      refId: opts?.refId || ''
    }).catch(err => console.error('Background push error:', err));

    return notification;
  } catch (error) {
    console.error("Error creating notification:", error);
    throw new Error(`Gagal membuat notifikasi: ${error}`);
  }
};

/**
 * Helper functions untuk membuat notifikasi dengan tipe spesifik
 */

/**
 * Membuat notifikasi informasi
 */
export const createInfoNotification = async (userId: string, title: string, message: string) => {
  return createNotification(userId, title, message, NotificationType.INFO);
};

/**
 * Membuat notifikasi sukses
 */
export const createSuccessNotification = async (userId: string, title: string, message: string) => {
  return createNotification(userId, title, message, NotificationType.SUCCESS);
};

/**
 * Membuat notifikasi peringatan
 */
export const createWarningNotification = async (userId: string, title: string, message: string) => {
  return createNotification(userId, title, message, NotificationType.WARNING);
};

/**
 * Membuat notifikasi error
 */
export const createErrorNotification = async (userId: string, title: string, message: string) => {
  return createNotification(userId, title, message, NotificationType.ERROR);
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
  type: NotificationType | NotificationTypeString,
  opts?: { refType?: string; refId?: string }
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

    return createNotification(employee.userId, title, message, type, opts);
  } catch (error) {
    console.error("Error creating employee notification:", error);
    throw new Error(`Gagal membuat notifikasi karyawan: ${error}`);
  }
};

/**
 * Helper functions untuk membuat notifikasi karyawan dengan tipe spesifik
 */

/**
 * Membuat notifikasi informasi untuk karyawan
 */
export const createEmployeeInfoNotification = async (employeeId: string, title: string, message: string) => {
  return createEmployeeNotification(employeeId, title, message, NotificationType.INFO);
};

/**
 * Membuat notifikasi sukses untuk karyawan
 */
export const createEmployeeSuccessNotification = async (employeeId: string, title: string, message: string) => {
  return createEmployeeNotification(employeeId, title, message, NotificationType.SUCCESS);
};

/**
 * Membuat notifikasi peringatan untuk karyawan
 */
export const createEmployeeWarningNotification = async (employeeId: string, title: string, message: string) => {
  return createEmployeeNotification(employeeId, title, message, NotificationType.WARNING);
};

/**
 * Membuat notifikasi error untuk karyawan
 */
export const createEmployeeErrorNotification = async (employeeId: string, title: string, message: string) => {
  return createEmployeeNotification(employeeId, title, message, NotificationType.ERROR);
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
  type: NotificationType | NotificationTypeString,
  opts?: { refType?: string; refId?: string }
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
      createNotification(admin.id, title, message, type, opts)
    );

    return Promise.all(notificationPromises);
  } catch (error) {
    console.error("Error creating admin notifications:", error);
    throw new Error(`Gagal membuat notifikasi admin: ${error}`);
  }
};

/**
 * Helper functions untuk membuat notifikasi admin dengan tipe spesifik
 */

/**
 * Membuat notifikasi informasi untuk semua admin
 */
export const createAdminInfoNotifications = async (title: string, message: string) => {
  return createAdminNotifications(title, message, NotificationType.INFO);
};

/**
 * Membuat notifikasi sukses untuk semua admin
 */
export const createAdminSuccessNotifications = async (title: string, message: string) => {
  return createAdminNotifications(title, message, NotificationType.SUCCESS);
};

/**
 * Membuat notifikasi peringatan untuk semua admin
 */
export const createAdminWarningNotifications = async (title: string, message: string) => {
  return createAdminNotifications(title, message, NotificationType.WARNING);
};

/**
 * Membuat notifikasi error untuk semua admin
 */
export const createAdminErrorNotifications = async (title: string, message: string) => {
  return createAdminNotifications(title, message, NotificationType.ERROR);
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
  amount: number,
  payrollId?: string
) => {
  try {
    const formattedDate = new Date(year, month - 1).toLocaleDateString('id-ID', {
      year: 'numeric',
      month: 'long'
    });
    
    const formattedAmount = formatCurrency(amount);
    
    const title = "Gaji Telah Dibayarkan";
    const message = `Gaji Anda untuk periode ${formattedDate} telah dibayarkan. Jumlah: ${formattedAmount}`;
    
    return createEmployeeNotification(employeeId, title, message, "success", payrollId ? { refType: "PAYROLL", refId: payrollId } : undefined);
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
  message: string,
  opts?: { refType?: string; refId?: string }
) => {
  return createEmployeeNotification(employeeId, "Check-out Berhasil", message, "success", opts);
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
