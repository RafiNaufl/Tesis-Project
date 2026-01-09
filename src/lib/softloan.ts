import { db } from "./db";
import { createAdminNotifications } from "./notification";
import { formatCurrency } from "./utils";

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
export const getEmployeeSoftLoanInfo = async (employeeId: string): Promise<SoftLoanInfo | null> => {
  try {
    // Cari pinjaman lunak yang aktif untuk karyawan
    const activeLoan = await db.softLoan.findFirst({
      where: {
        employeeId,
        status: "ACTIVE",
      },
    });

    if (!activeLoan) {
      return null;
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
    const { employeeId, status } = params;
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
    if (status) where.status = status;

    const loans = await db.softLoan.findMany({
      where,
      include: {
        employee: {
          include: {
            user: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return loans.map((sl) => ({
      id: sl.id,
      employeeId: sl.employeeId,
      totalAmount: sl.totalAmount,
      monthlyAmount: sl.monthlyAmount,
      remainingAmount: sl.remainingAmount,
      durationMonths: sl.durationMonths,
      startMonth: sl.startMonth,
      startYear: sl.startYear,
      status: sl.status,
      createdAt: sl.createdAt,
      completedAt: sl.completedAt ?? null,
      empId: sl.employee.employeeId,
      employeeName: sl.employee.user?.name ?? "",
    }));
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
      const employee = await db.employee.findUnique({
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
    const employee = await db.employee.findUnique({
      where: { id: employeeId },
    });
    
    if (!employee) {
      throw new Error("Employee not found");
    }
    
    // Check if employee has active or pending soft loan
    const existingSoftLoan = await db.softLoan.findFirst({
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
    if (totalAmount <= 0) {
      throw new Error("Total amount must be greater than zero");
    }
    if (monthlyAmount <= 0) {
      throw new Error("Monthly amount must be greater than zero");
    }
    if (startMonth! < 1 || startMonth! > 12) {
      throw new Error("Start month must be between 1 and 12");
    }
    if (startYear! < 2000 || startYear! > 2100) {
      throw new Error("Start year must be between 2000 and 2100");
    }
    
    // Set status based on user role
    const status = isAdmin ? "ACTIVE" : "PENDING";
    
    // Create the soft loan
    const softLoan = await db.softLoan.create({
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

    // Kirim notifikasi ke admin jika bukan admin yang membuat
    if (!isAdmin) {
      try {
        const employee = await db.employee.findUnique({
          where: { id: employeeId },
          include: { user: true }
        });

        if (employee && employee.user) {
          await createAdminNotifications(
            "Pengajuan Pinjaman Lunak Baru",
            `${employee.user.name} mengajukan pinjaman sebesar ${formatCurrency(totalAmount)} untuk ${durationMonths} bulan. Alasan: ${reason}`,
            "info",
            { refType: "SOFT_LOAN", refId: softLoan.id }
          );
        }
      } catch (notifError) {
        console.error("Gagal mengirim notifikasi pinjaman lunak:", notifError);
      }
    }

    return softLoan;
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
    const softLoan = await db.softLoan.findUnique({
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
export const updateSoftLoanStatus = async (id: string, status: string, adminId?: string, rejectionReason?: string) => {
  try {
    if (!['APPROVED', 'REJECTED'].includes(status)) {
      throw new Error("Invalid status");
    }

    // Ambil data pinjaman untuk mendapatkan durasi
    const softLoan = await db.softLoan.findUnique({
      where: { id }
    });

    if (!softLoan) {
      throw new Error("Soft loan not found");
    }

    // Jika status APPROVED, atur startMonth dan startYear ke bulan dan tahun saat ini
    const updateData: any = { status };
    
    if (status === 'APPROVED') {
      updateData.status = 'ACTIVE'; // Map APPROVED to ACTIVE for internal logic
      const now = new Date();
      const currentMonth = now.getMonth() + 1; // Bulan dimulai dari 0
      const currentYear = now.getFullYear();
      
      updateData.startMonth = currentMonth;
      updateData.startYear = currentYear;
      
      // Simpan informasi admin
      if (adminId) {
        updateData.approvedBy = adminId;
        updateData.approvedAt = now;
      }
      
      // Hitung perkiraan bulan dan tahun selesai berdasarkan durasi
      let endMonth = currentMonth + softLoan.durationMonths - 1; // -1 karena bulan saat ini dihitung sebagai cicilan pertama
      let endYear = currentYear;
      
      // Jika endMonth melebihi 12, sesuaikan tahun dan bulan
      if (endMonth > 12) {
        endYear += Math.floor(endMonth / 12);
        endMonth = endMonth % 12;
        if (endMonth === 0) {
          endMonth = 12;
          endYear--;
        }
      }
      
      // Tambahkan informasi perkiraan selesai ke dalam keterangan
      updateData.reason = softLoan.reason + ` (Perkiraan selesai: ${endMonth}/${endYear})`;
    } else if (status === 'REJECTED' && rejectionReason) {
       // Tambahkan alasan penolakan ke dalam keterangan
       updateData.reason = softLoan.reason + ` (DITOLAK: ${rejectionReason})`;
    }

    // Gunakan transaksi untuk memastikan konsistensi data
    const result = await db.$transaction(async (tx) => {
      // 1. Update status pinjaman
      const updatedSoftLoan = await tx.softLoan.update({
        where: { id },
        data: updateData,
        include: {
          employee: true,
        },
      });

      // 2. Jika status ACTIVE, proses pemotongan langsung (Immediate Deduction)
      if (updatedSoftLoan.status === 'ACTIVE') {
        const now = new Date();
        const currentMonth = now.getMonth() + 1;
        const currentYear = now.getFullYear();

        // Cek apakah sudah ada potongan pinjaman untuk bulan ini agar tidak double
        const existingDeduction = await tx.deduction.findFirst({
          where: {
            employeeId: updatedSoftLoan.employeeId,
            month: currentMonth,
            year: currentYear,
            type: "PINJAMAN",
            // Jika kita bisa melacak by reason atau ID pinjaman di masa depan akan lebih baik
            // Untuk saat ini asumsi 1 pinjaman aktif per karyawan
          }
        });

        if (!existingDeduction) {
           // Hitung jumlah potongan (Safety check: tidak melebihi sisa pinjaman)
           const deductionAmount = Math.min(updatedSoftLoan.monthlyAmount, updatedSoftLoan.remainingAmount);

           if (deductionAmount > 0) {
             // a. Cari Payroll Pending (Optional)
             const payroll = await tx.payroll.findFirst({
               where: {
                 employeeId: updatedSoftLoan.employeeId,
                 month: currentMonth,
                 year: currentYear,
                 status: 'PENDING'
               }
             });

             // b. Buat record deduction (Selalu buat, terlepas dari ada payroll atau tidak)
             await tx.deduction.create({
               data: {
                 employeeId: updatedSoftLoan.employeeId,
                 month: currentMonth,
                 year: currentYear,
                 amount: deductionAmount,
                 type: "PINJAMAN",
                 reason: `Cicilan Pinjaman (Auto-deducted on Approval)`,
                 payrollId: payroll ? payroll.id : undefined // Link jika payroll ada
               }
             });

             // c. Update saldo pinjaman LANGSUNG
             const newRemaining = updatedSoftLoan.remainingAmount - deductionAmount;
             await tx.softLoan.update({
               where: { id: updatedSoftLoan.id },
               data: {
                 remainingAmount: newRemaining,
                 status: newRemaining <= 0 ? 'COMPLETED' : 'ACTIVE',
                 completedAt: newRemaining <= 0 ? new Date() : null
               }
             });

             // d. Jika Payroll ada, update total deductions & net salary
             if (payroll) {
                await tx.payroll.update({
                  where: { id: payroll.id },
                  data: {
                    totalDeductions: { increment: deductionAmount },
                    netSalary: { decrement: deductionAmount },
                  }
                });

                // Audit Log Payroll
                await tx.payrollAuditLog.create({
                  data: {
                    payrollId: payroll.id,
                    userId: adminId || "SYSTEM",
                    action: "UPDATE_PAYROLL_DEDUCTION",
                    newValue: { 
                      reason: "Soft Loan Approval Deduction", 
                      amount: deductionAmount,
                      loanId: updatedSoftLoan.id
                    }
                  }
                });
             }
           }
        }
      }

      return updatedSoftLoan;
    });

    return result;
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
    const softLoan = await db.softLoan.findUnique({
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
    return await db.softLoan.update({
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

    await db.softLoan.delete({
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
    const softLoanDeductions = await db.deduction.findMany({
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

/**
 * Memproses pemotongan pinjaman lunak saat penggajian dibayarkan
 * @param employeeId ID karyawan
 * @param month Bulan penggajian
 * @param year Tahun penggajian
 * @returns Jumlah pinjaman lunak yang diproses
 */
export const processSoftLoanDeductions = async (employeeId: string, month: number, year: number) => {
  try {
    // Cari pinjaman lunak yang aktif untuk karyawan
    // Filter berdasarkan startMonth dan startYear
    // Pinjaman hanya diproses jika bulan dan tahun penggajian >= startMonth dan startYear
    const activeLoan = await db.softLoan.findFirst({
      where: {
        employeeId,
        status: "ACTIVE",
        OR: [
          // Jika tahun penggajian lebih besar dari startYear
          { startYear: { lt: year } },
          // Jika tahun sama, bulan penggajian harus >= startMonth
          { 
            AND: [
              { startYear: year },
              { startMonth: { lte: month } }
            ]
          }
        ]
      },
    });

    if (!activeLoan) {
      return { count: 0 };
    }

    // Hitung jumlah yang akan dipotong (cicilan bulanan)
    const deductionAmount = activeLoan.monthlyAmount;
    
    // Update sisa pinjaman
    await updateSoftLoanDeduction(activeLoan.id, deductionAmount);
    
    // Buat catatan deduction untuk pinjaman lunak ini
    await db.deduction.create({
      data: {
        employeeId,
        amount: deductionAmount,
        type: "SOFT_LOAN",
        reason: `Cicilan pinjaman lunak bulan ${month}/${year}`,
        month,
        year,
      },
    });

    return { count: 1 };
  } catch (error) {
    console.error("Error processing soft loan deductions:", error);
    throw error;
  }
};
