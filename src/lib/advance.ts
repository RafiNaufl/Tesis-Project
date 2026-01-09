import { db } from "./db";
import { createAdminNotifications } from "./notification";
import { formatCurrency } from "./utils";

/**
 * Mengambil informasi kasbon (advance) karyawan
 * @param employeeId ID karyawan
 * @returns Informasi kasbon aktif atau yang sudah dideduct
 */
export const getEmployeeAdvanceInfo = async (employeeId: string) => {
  try {
    // Cari kasbon yang sudah disetujui (APPROVED) dan belum dideduct untuk karyawan
    const activeLoan = await db.advance.findFirst({
      where: {
        employeeId,
        status: "APPROVED",
        deductedAt: null,
        // Pastikan deductionMonth dan deductionYear sudah diatur
        deductionMonth: { not: null },
        deductionYear: { not: null },
      },
    });

    if (!activeLoan) {
      // Jika tidak ada kasbon aktif dengan status APPROVED, coba cari kasbon dengan status DEDUCTED
      const deductedLoan = await db.advance.findFirst({
        where: {
          employeeId,
          status: "DEDUCTED",
          deductedAt: { not: null },
        },
        orderBy: { deductedAt: 'desc' },
      });

      if (!deductedLoan) {
        throw new Error("Tidak ada kasbon aktif atau yang sudah dideduct");
      }

      // Untuk kompatibilitas dengan interface AdvanceInfo
      return {
        activeLoan: {
          ...deductedLoan,
          totalAmount: deductedLoan.amount,
        },
        totalRemaining: 0, // Sudah dibayar sepenuhnya
        monthlyPayment: deductedLoan.amount,
      };
    }

    // Untuk kompatibilitas dengan interface AdvanceInfo
    return {
      activeLoan: {
        ...activeLoan,
        totalAmount: activeLoan.amount, // Menambahkan totalAmount untuk kompatibilitas dengan tampilan
      },
      totalRemaining: activeLoan.amount,
      monthlyPayment: activeLoan.amount, // Kasbon biasanya dibayar sekaligus
    };
  } catch (error) {
    console.error("Error in getEmployeeAdvanceInfo:", error);
    throw new Error("Gagal mengambil informasi kasbon");
  }
};

/**
 * Mengambil daftar kasbon untuk karyawan atau semua karyawan (admin only)
 * @param params Parameter pencarian (employeeId, month, year, status)
 * @param isAdmin Apakah pengguna adalah admin
 * @param userId ID pengguna yang sedang login
 * @returns Daftar kasbon yang sesuai dengan parameter
 */
export const getAdvances = async (
  params: {
    employeeId?: string;
    month?: number;
    year?: number;
    status?: string;
  },
  isAdmin: boolean,
  userId: string
) => {
  try {
    const { employeeId, month, year, status } = params;
    let resolvedEmployeeId = employeeId;
    if (!resolvedEmployeeId && !isAdmin) {
      const employee = await db.employee.findUnique({ where: { userId } });
      if (!employee) {
        throw new Error("Employee not found");
      }
      resolvedEmployeeId = employee.id;
    }

    const where: any = {};
    if (resolvedEmployeeId) where.employeeId = resolvedEmployeeId;
    if (month !== undefined) where.month = month;
    if (year !== undefined) where.year = year;
    if (status) where.status = status;

    const advances = await db.advance.findMany({
      where,
      include: {
        employee: {
          include: {
            user: { select: { name: true, email: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return advances.map((a) => ({
      id: a.id,
      employeeId: a.employeeId,
      amount: a.amount,
      reason: a.reason ?? null,
      rejectionReason: a.rejectionReason ?? null,
      month: a.month,
      year: a.year,
      status: a.status,
      createdAt: a.createdAt,
      deductedAt: a.deductedAt ?? null,
      deductionMonth: a.deductionMonth ?? null,
      deductionYear: a.deductionYear ?? null,
      empId: a.employee.employeeId,
      employeeName: a.employee.user?.name ?? "",
    }));
  } catch (error) {
    console.error("Error fetching advances:", error);
    throw new Error("Failed to fetch advances");
  }
};

/**
 * Membuat kasbon baru
 * @param data Data kasbon yang akan dibuat
 * @param isAdmin Apakah pengguna adalah admin
 * @param userId ID pengguna yang sedang login
 * @returns Kasbon yang baru dibuat
 */
export const createAdvance = async (
  data: {
    employeeId?: string;
    amount: number;
    month: number;
    year: number;
    reason?: string;
  },
  isAdmin: boolean,
  userId: string
) => {
  try {
    let { employeeId, amount, month, year, reason } = data;
    
    // If not admin, get employee ID from session
    if (!isAdmin) {
      const employee = await db.employee.findUnique({
        where: { userId },
      });
      
      if (!employee) {
        throw new Error("Employee not found");
      }
      
      employeeId = employee.id;
    }
    
    if (!employeeId || !amount || !month || !year) {
      throw new Error("Missing required fields");
    }
    
    // For employee requests, reason is required
    if (!isAdmin && !reason) {
      throw new Error("Reason is required for advance requests");
    }
    
    // Check if the employee exists
    const employee = await db.employee.findUnique({
      where: { id: employeeId },
    });
    
    if (!employee) {
      throw new Error("Employee not found");
    }
    
    // Check if advance already exists for this employee in this month/year
    // Karyawan dapat mengajukan kembali jika pengajuan sebelumnya ditolak (REJECTED)
    const existingAdvance = await db.advance.findFirst({
      where: {
        employeeId,
        month,
        year,
        status: {
          in: ["PENDING", "APPROVED", "ACTIVE"]
        }
      }
    });
    
    if (existingAdvance) {
      throw new Error("Anda tidak dapat mengajukan kasbon dua kali pada bulan yang sama");
    }
    
    // Jika ada pengajuan yang ditolak, hapus pengajuan tersebut agar tidak menumpuk di database
    const rejectedAdvance = await db.advance.findFirst({
      where: {
        employeeId,
        month,
        year,
        status: "REJECTED"
      }
    });
    
    if (rejectedAdvance) {
      await db.advance.delete({
        where: { id: rejectedAdvance.id }
      });
    }
    
    // Create the advance
    if (amount <= 0) {
      throw new Error("Amount must be greater than zero");
    }
    if (month < 1 || month > 12) {
      throw new Error("Month must be between 1 and 12");
    }
    if (year < 2000 || year > 2100) {
      throw new Error("Year must be between 2000 and 2100");
    }

    const advance = await db.advance.create({
      data: {
        employeeId,
        amount,
        month,
        year,
        reason: reason || null,
        status: isAdmin ? "ACTIVE" : "PENDING",
        // Set deduction month and year to the same as application month and year
        deductionMonth: month,
        deductionYear: year,
      },
    });

    // Kirim notifikasi ke admin jika bukan admin yang membuat
    if (!isAdmin) {
      try {
        const employee = await db.employee.findUnique({
          where: { id: employeeId },
          include: { user: true }
        });

        if (employee && employee.user) {
          await createAdminNotifications(
            "Pengajuan Kasbon Baru",
            `${employee.user.name} mengajukan kasbon sebesar ${formatCurrency(amount)}. Alasan: ${reason || '-'}`,
            "info"
          );
        }
      } catch (notifError) {
        console.error("Gagal mengirim notifikasi kasbon:", notifError);
        // Jangan throw error agar proses pembuatan kasbon tetap dianggap sukses
      }
    }

    return advance;
  } catch (error) {
    console.error("Error creating advance:", error);
    throw error;
  }
};

/**
 * Mengambil detail kasbon berdasarkan ID
 * @param id ID kasbon
 * @param isAdmin Apakah pengguna adalah admin
 * @param userId ID pengguna yang sedang login
 * @returns Detail kasbon
 */
export const getAdvanceById = async (id: string, isAdmin: boolean, userId: string) => {
  try {
    const advance = await db.advance.findUnique({
      where: { id },
      include: {
        employee: {
          include: {
            user: true
          }
        }
      }
    });
    
    if (!advance) {
      throw new Error("Advance not found");
    }
    
    // Check if user has permission to view this advance
    if (!isAdmin && advance.employee.userId !== userId) {
      throw new Error("Forbidden. You can only view your own advances.");
    }
    
    return advance;
  } catch (error) {
    console.error("Error fetching advance:", error);
    throw error;
  }
};

/**
 * Memperbarui status kasbon
 * @param id ID kasbon
 * @param data Data yang akan diperbarui
 * @returns Kasbon yang telah diperbarui
 */
/**
 * Memperbarui status kasbon
 * @param id ID kasbon
 * @param data Data yang akan diperbarui
 * @returns Kasbon yang telah diperbarui
 */
export const updateAdvanceStatus = async (
  id: string,
  data: {
    status: string;
    rejectionReason?: string;
    deductionMonth?: number;
    deductionYear?: number;
  }
) => {
  try {
  const { status, rejectionReason } = data;
    
    if (!status || !['APPROVED', 'REJECTED'].includes(status)) {
      throw new Error("Invalid status. Must be APPROVED or REJECTED");
    }
    
    // Check if advance exists
    const existingAdvance = await db.advance.findUnique({
      where: { id },
      include: {
        employee: {
          include: {
            user: true
          }
        }
      }
    });
    
    if (!existingAdvance) {
      throw new Error("Advance not found");
    }
    
    if (existingAdvance.status !== "PENDING") {
      throw new Error("Advance has already been processed");
    }
    
    // Update advance status
    // Jika status APPROVED, gunakan bulan dan tahun pengajuan sebagai bulan dan tahun pemotongan
    // Ini untuk memastikan kasbon dipotong pada bulan yang sama dengan pengajuan
    const updatedAdvance = await db.advance.update({
      where: { id },
      data: {
        status,
        rejectionReason: status === "REJECTED" ? rejectionReason : null,
        // Gunakan bulan dan tahun dari pengajuan kasbon, bukan dari input admin
        deductionMonth: status === "APPROVED" ? existingAdvance.month : null,
        deductionYear: status === "APPROVED" ? existingAdvance.year : null
      },
      include: {
        employee: {
          include: {
            user: true
          }
        }
      }
    });
    
    return updatedAdvance;
  } catch (error) {
    console.error("Error updating advance status:", error);
    throw error;
  }
};

/**
 * Menghapus beberapa kasbon sekaligus
 * @param ids Array ID kasbon yang akan dihapus
 * @returns Jumlah kasbon yang berhasil dihapus
 */
export const deleteAdvances = async (ids: string[]) => {
  try {
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      throw new Error("Invalid or missing advance IDs");
    }
    
    // Delete the advances
    const result = await db.advance.deleteMany({
      where: {
        id: {
          in: ids
        }
      }
    });
    
    return result.count;
  } catch (error) {
    console.error("Error deleting advances:", error);
    throw error;
  }
};

/**
 * Mendapatkan potongan kasbon untuk periode penggajian tertentu
 * @param employeeId ID karyawan
 * @param month Bulan penggajian
 * @param year Tahun penggajian
 * @returns Total potongan kasbon
 */
export const getAdvanceDeductions = async (employeeId: string, month: number, year: number) => {
  try {
    const advanceDeductions = await db.advance.findMany({
      where: {
        employeeId,
        status: "DEDUCTED",
        deductedAt: {
          gte: new Date(year, month - 1, 1),
          lt: new Date(year, month, 1),
        },
      },
    });

    return advanceDeductions.reduce((sum: number, advance: any) => sum + advance.amount, 0);
  } catch (error) {
    console.error("Error getting advance deductions:", error);
    throw error;
  }
};

/**
 * Mark advances as deducted when payroll is paid
 * This function should be called when a payroll is marked as paid
 */
export const markAdvancesAsDeducted = async (employeeId: string, month: number, year: number) => {
  try {
    // Find advances that are approved and scheduled for deduction in this month/year
    const advances = await db.advance.findMany({
      where: {
        employeeId,
        status: "APPROVED",
        deductionMonth: month,
        deductionYear: year,
        deductedAt: null,
      },
    });

    if (advances.length === 0) {
      return { count: 0 };
    }

    // Update all matching advances to DEDUCTED status
    const updateResult = await db.advance.updateMany({
      where: {
        id: { in: advances.map(advance => advance.id) },
      },
      data: {
        status: "DEDUCTED",
        deductedAt: new Date(),
      },
    });

    return { count: updateResult.count };
  } catch (error) {
    console.error("Error marking advances as deducted:", error);
    throw error;
  }
};
