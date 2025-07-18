import { prisma } from "./prisma";

/**
 * Interface untuk informasi pinjaman lunak
 */
export interface SoftLoanInfo {
  activeLoan: any;
  totalRemaining: number;
  monthlyPayment: number;
}

/**
 * Mengambil informasi pinjaman lunak karyawan
 * @param employeeId ID karyawan
 * @returns Informasi pinjaman lunak aktif
 */
export const getEmployeeSoftLoanInfo = async (employeeId: string): Promise<SoftLoanInfo> => {
  try {
    // Cari pinjaman lunak yang aktif untuk karyawan
    const activeLoan = await prisma.softLoan.findFirst({
      where: {
        employeeId,
        status: "ACTIVE",
      },
    });

    if (!activeLoan) {
      throw new Error("Tidak ada pinjaman lunak aktif");
    }

    return {
      activeLoan,
      totalRemaining: activeLoan.remainingAmount,
      monthlyPayment: activeLoan.monthlyAmount,
    };
  } catch (error) {
    console.error("Error in getEmployeeSoftLoanInfo:", error);
    throw new Error("Gagal mengambil informasi pinjaman lunak");
  }
};

/**
 * Mengambil daftar pinjaman lunak untuk karyawan atau semua karyawan (admin only)
 * @param params Parameter pencarian (employeeId, status)
 * @param isAdmin Apakah pengguna adalah admin
 * @param userId ID pengguna yang sedang login
 * @returns Daftar pinjaman lunak yang sesuai dengan parameter
 */
export const getSoftLoans = async (
  params: {
    employeeId?: string;
    status?: string;
  },
  isAdmin: boolean,
  userId: string
) => {
  try {
    let conditions = [];
    let queryParams: any[] = [];
    
    const { employeeId, status } = params;
    
    if (employeeId) {
      conditions.push(`sl."employeeId" = $${queryParams.length + 1}`);
      queryParams.push(employeeId);
    } else if (!isAdmin) {
      // If not admin, only show the employee's own soft loans
      const employee = await prisma.employee.findUnique({
        where: { userId },
      });
      
      if (!employee) {
        throw new Error("Employee not found");
      }
      
      conditions.push(`sl."employeeId" = $${queryParams.length + 1}`);
      queryParams.push(employee.id);
    }
    
    if (status) {
      conditions.push(`sl.status = $${queryParams.length + 1}`);
      queryParams.push(status);
    }
    
    // Construct the WHERE clause
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    
    // Execute the query
    const query = `
      SELECT 
        sl.id, 
        sl."employeeId", 
        sl."totalAmount",
        sl."monthlyAmount",
        sl."remainingAmount",
        sl."durationMonths",
        sl."startMonth",
        sl."startYear",
        sl.status,
        sl."createdAt",
        sl."completedAt",
        e."employeeId" AS "empId",
        u.name AS "employeeName"
      FROM 
        soft_loans sl
      JOIN 
        employees e ON sl."employeeId" = e.id
      JOIN 
        users u ON e."userId" = u.id
      ${whereClause}
      ORDER BY 
        sl."createdAt" DESC
    `;
    
    return await prisma.$queryRawUnsafe(query, ...queryParams);
  } catch (error) {
    console.error("Error fetching soft loans:", error);
    throw new Error("Failed to fetch soft loans");
  }
};

/**
 * Membuat pinjaman lunak baru
 * @param data Data pinjaman lunak yang akan dibuat
 * @param isAdmin Apakah pengguna adalah admin
 * @param userId ID pengguna yang sedang login
 * @returns Pinjaman lunak yang baru dibuat
 */
export const createSoftLoan = async (
  data: {
    employeeId?: string;
    totalAmount: number;
    durationMonths: number;
    startMonth?: number;
    startYear?: number;
    reason: string;
    monthlyAmount?: number;
  },
  isAdmin: boolean,
  userId: string
) => {
  try {
    let { employeeId, totalAmount, durationMonths, startMonth, startYear, reason, monthlyAmount } = data;
    
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
    
    if (!employeeId || !totalAmount || !durationMonths || !reason) {
      throw new Error("Missing required fields");
    }
    
    // Set default start month/year if not provided
    if (!startMonth || !startYear) {
      const now = new Date();
      startMonth = now.getMonth() + 1;
      startYear = now.getFullYear();
    }
    
    // Validate duration months
    if (![3, 6, 12].includes(durationMonths)) {
      throw new Error("Duration must be 3, 6, or 12 months");
    }
    
    // Check if the employee exists
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
    });
    
    if (!employee) {
      throw new Error("Employee not found");
    }
    
    // Check if employee has active or pending soft loan
    const existingSoftLoan = await prisma.softLoan.findFirst({
      where: {
        employeeId,
        status: {
          in: ["ACTIVE", "PENDING"]
        }
      }
    });
    
    if (existingSoftLoan) {
      throw new Error("Employee already has an active or pending soft loan");
    }
    
    // Calculate monthly amount if not provided
    if (!monthlyAmount) {
      monthlyAmount = totalAmount / durationMonths;
    }
    
    // Set status based on user role
    const status = isAdmin ? "ACTIVE" : "PENDING";
    
    // Create the soft loan
    return await prisma.softLoan.create({
      data: {
        employeeId,
        totalAmount,
        remainingAmount: totalAmount,
        monthlyAmount,
        durationMonths,
        startMonth,
        startYear,
        reason,
        status,
      },
    });
  } catch (error) {
    console.error("Error creating soft loan:", error);
    throw error;
  }
};

/**
 * Mengambil detail pinjaman lunak berdasarkan ID
 * @param id ID pinjaman lunak
 * @param isAdmin Apakah pengguna adalah admin
 * @param userId ID pengguna yang sedang login
 * @returns Detail pinjaman lunak
 */
export const getSoftLoanById = async (id: string, isAdmin: boolean, userId: string) => {
  try {
    const softLoan = await prisma.softLoan.findUnique({
      where: {
        id,
      },
      include: {
        employee: true,
      },
    });

    if (!softLoan) {
      throw new Error("Soft loan not found");
    }

    // Restrict access: only the employee who requested it or an admin can view
    if (!isAdmin && softLoan.employee.userId !== userId) {
      throw new Error("Unauthorized");
    }

    return softLoan;
  } catch (error) {
    console.error("Error fetching soft loan:", error);
    throw error;
  }
};

/**
 * Memperbarui status pinjaman lunak
 * @param id ID pinjaman lunak
 * @param status Status baru
 * @returns Pinjaman lunak yang telah diperbarui
 */
export const updateSoftLoanStatus = async (id: string, status: string) => {
  try {
    if (!['APPROVED', 'REJECTED'].includes(status)) {
      throw new Error("Invalid status");
    }

    const updatedSoftLoan = await prisma.softLoan.update({
      where: {
        id,
      },
      data: {
        status,
      },
      include: {
        employee: true,
      },
    });

    return updatedSoftLoan;
  } catch (error) {
    console.error("Error updating soft loan status:", error);
    throw error;
  }
};

/**
 * Memperbarui pinjaman lunak (untuk potongan bulanan)
 * @param id ID pinjaman lunak
 * @param deductionAmount Jumlah potongan
 * @returns Pinjaman lunak yang telah diperbarui
 */
export const updateSoftLoanDeduction = async (id: string, deductionAmount: number) => {
  try {
    if (!id || !deductionAmount) {
      throw new Error("Missing required fields");
    }
    
    // Get the soft loan
    const softLoan = await prisma.softLoan.findUnique({
      where: { id }
    });
    
    if (!softLoan) {
      throw new Error("Soft loan not found");
    }
    
    if (softLoan.status !== "ACTIVE") {
      throw new Error("Soft loan is not active");
    }
    
    // Calculate new remaining amount
    const newRemainingAmount = Math.max(0, softLoan.remainingAmount - deductionAmount);
    const isCompleted = newRemainingAmount === 0;
    
    // Update the soft loan
    return await prisma.softLoan.update({
      where: { id },
      data: {
        remainingAmount: newRemainingAmount,
        status: isCompleted ? "COMPLETED" : "ACTIVE",
        completedAt: isCompleted ? new Date() : null
      }
    });
  } catch (error) {
    console.error("Error updating soft loan:", error);
    throw error;
  }
};

/**
 * Menghapus pinjaman lunak
 * @param id ID pinjaman lunak
 * @returns Pesan sukses
 */
export const deleteSoftLoan = async (id: string) => {
  try {
    if (!id) {
      throw new Error("Soft loan ID is required");
    }

    await prisma.softLoan.delete({
      where: { id },
    });

    return "Soft loan deleted successfully";
  } catch (error) {
    console.error("Error deleting soft loan:", error);
    throw error;
  }
};

/**
 * Mendapatkan potongan pinjaman lunak untuk periode penggajian tertentu
 * @param employeeId ID karyawan
 * @param month Bulan penggajian
 * @param year Tahun penggajian
 * @returns Total potongan pinjaman lunak
 */
export const getSoftLoanDeductions = async (employeeId: string, month: number, year: number) => {
  try {
    const softLoanDeductions = await prisma.deduction.findMany({
      where: {
        employeeId,
        type: "SOFT_LOAN",
        month,
        year,
      },
    });

    return softLoanDeductions.reduce((sum: number, deduction: any) => sum + deduction.amount, 0);
  } catch (error) {
    console.error("Error getting soft loan deductions:", error);
    throw error;
  }
};