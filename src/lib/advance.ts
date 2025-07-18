import { prisma } from "./prisma";

/**
 * Mengambil informasi kasbon (advance) karyawan
 * @param employeeId ID karyawan
 * @returns Informasi kasbon aktif atau yang sudah dideduct
 */
export const getEmployeeAdvanceInfo = async (employeeId: string) => {
  try {
    // Cari kasbon yang sudah disetujui (APPROVED) dan belum dideduct untuk karyawan
    const activeLoan = await prisma.advance.findFirst({
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
      const deductedLoan = await prisma.advance.findFirst({
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
    let conditions = [];
    let queryParams: any[] = [];
    
    const { employeeId, month, year, status } = params;
    
    if (employeeId) {
      conditions.push(`a."employeeId" = $${queryParams.length + 1}`);
      queryParams.push(employeeId);
    } else if (!isAdmin) {
      // If not admin, only show the employee's own advances
      const employee = await prisma.employee.findUnique({
        where: { userId },
      });
      
      if (!employee) {
        throw new Error("Employee not found");
      }
      
      conditions.push(`a."employeeId" = $${queryParams.length + 1}`);
      queryParams.push(employee.id);
    }
    
    if (month !== undefined) {
      conditions.push(`a.month = $${queryParams.length + 1}`);
      queryParams.push(month);
    }
    
    if (year !== undefined) {
      conditions.push(`a.year = $${queryParams.length + 1}`);
      queryParams.push(year);
    }
    
    if (status) {
      conditions.push(`a.status = $${queryParams.length + 1}`);
      queryParams.push(status);
    }
    
    // Construct the WHERE clause
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    
    // Execute the query
    const query = `
      SELECT 
        a.id, 
        a."employeeId", 
        a.amount,
        a.reason,
        a."rejectionReason",
        a.month, 
        a.year, 
        a.status,
        a."createdAt",
        a."deductedAt",
        a."deductionMonth",
        a."deductionYear",
        e."employeeId" AS "empId",
        u.name AS "employeeName"
      FROM 
        advances a
      JOIN 
        employees e ON a."employeeId" = e.id
      JOIN 
        users u ON e."userId" = u.id
      ${whereClause}
      ORDER BY 
        a."createdAt" DESC
    `;
    
    return await prisma.$queryRawUnsafe(query, ...queryParams);
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
      const employee = await prisma.employee.findUnique({
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
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
    });
    
    if (!employee) {
      throw new Error("Employee not found");
    }
    
    // Check if advance already exists for this employee in this month/year
    // Karyawan dapat mengajukan kembali jika pengajuan sebelumnya ditolak (REJECTED)
    const existingAdvance = await prisma.advance.findFirst({
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
    const rejectedAdvance = await prisma.advance.findFirst({
      where: {
        employeeId,
        month,
        year,
        status: "REJECTED"
      }
    });
    
    if (rejectedAdvance) {
      await prisma.advance.delete({
        where: { id: rejectedAdvance.id }
      });
    }
    
    // Create the advance
    return await prisma.advance.create({
      data: {
        employeeId,
        amount,
        month,
        year,
        reason: reason || null,
        status: isAdmin ? "ACTIVE" : "PENDING",
      },
    });
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
    const advance = await prisma.advance.findUnique({
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
    const { status, rejectionReason, deductionMonth, deductionYear } = data;
    
    if (!status || !['APPROVED', 'REJECTED'].includes(status)) {
      throw new Error("Invalid status. Must be APPROVED or REJECTED");
    }
    
    // Validate deduction date if status is APPROVED
    if (status === 'APPROVED' && (!deductionMonth || !deductionYear)) {
      throw new Error("Deduction month and year are required for approval");
    }
    
    // Check if advance exists
    const existingAdvance = await prisma.advance.findUnique({
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
    const updatedAdvance = await prisma.advance.update({
      where: { id },
      data: {
        status,
        rejectionReason: status === "REJECTED" ? rejectionReason : null,
        deductionMonth: status === "APPROVED" ? deductionMonth : null,
        deductionYear: status === "APPROVED" ? deductionYear : null
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
    const result = await prisma.advance.deleteMany({
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
    const advanceDeductions = await prisma.advance.findMany({
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
    const advances = await prisma.advance.findMany({
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
    const updateResult = await prisma.advance.updateMany({
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