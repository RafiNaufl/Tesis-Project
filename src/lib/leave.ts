import { prisma } from "@/lib/prisma";
import { LeaveStatus } from "@/types/enums";

/**
 * Membuat permohonan cuti baru
 */
export const createLeaveRequest = async (
  employeeId: string,
  startDate: Date,
  endDate: Date,
  reason: string,
  type: string
) => {
  // Validasi tanggal
  if (startDate > endDate) {
    throw new Error("Tanggal mulai tidak boleh setelah tanggal akhir");
  }

  // Cek apakah ada cuti yang tumpang tindih
  const overlappingLeave = await prisma.leave.findFirst({
    where: {
      employeeId,
      status: LeaveStatus.APPROVED,
      OR: [
        {
          // Cuti baru berada di dalam cuti yang sudah ada
          AND: [
            { startDate: { lte: startDate } },
            { endDate: { gte: startDate } },
          ],
        },
        {
          // Cuti baru mencakup cuti yang sudah ada
          AND: [
            { startDate: { gte: startDate } },
            { startDate: { lte: endDate } },
          ],
        },
      ],
    },
  });

  if (overlappingLeave) {
    throw new Error("Sudah ada permohonan cuti yang disetujui untuk tanggal yang sama");
  }

  // Buat permohonan cuti baru
  return prisma.leave.create({
    data: {
      employeeId,
      startDate,
      endDate,
      reason,
      type,
      status: LeaveStatus.PENDING,
    },
  });
};

/**
 * Mengambil semua permohonan cuti untuk seorang karyawan
 */
export const getEmployeeLeaveRequests = async (employeeId: string) => {
  return prisma.leave.findMany({
    where: { employeeId },
    orderBy: { createdAt: "desc" },
  });
};

/**
 * Mengambil semua permohonan cuti yang tertunda
 */
export const getPendingLeaveRequests = async () => {
  return prisma.leave.findMany({
    where: { status: LeaveStatus.PENDING },
    include: {
      employee: {
        include: {
          user: {
            select: {
              name: true,
              email: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });
};

/**
 * Menyetujui permohonan cuti
 */
export const approveLeaveRequest = async (leaveId: string, adminId: string) => {
  const leave = await prisma.leave.findUnique({
    where: { id: leaveId },
  });

  if (!leave) {
    throw new Error("Permohonan cuti tidak ditemukan");
  }

  if (leave.status !== LeaveStatus.PENDING) {
    throw new Error("Permohonan cuti ini sudah diproses");
  }

  // Update status permohonan cuti
  const updatedLeave = await prisma.leave.update({
    where: { id: leaveId },
    data: {
      status: LeaveStatus.APPROVED,
      approvedBy: adminId,
      approvedAt: new Date(),
    },
  });

  // Buat notifikasi untuk karyawan
  await prisma.notification.create({
    data: {
      userId: (await prisma.employee.findUnique({ where: { id: leave.employeeId } }))?.userId || "",
      title: "Permohonan Cuti Disetujui",
      message: `Permohonan cuti Anda dari ${leave.startDate.toLocaleDateString()} hingga ${leave.endDate.toLocaleDateString()} telah disetujui.`,
      type: "success",
    },
  });

  // Update catatan kehadiran untuk periode cuti
  const startDate = new Date(leave.startDate);
  const endDate = new Date(leave.endDate);
  const days = [];
  
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    days.push(new Date(d));
  }

  // Perbarui atau buat catatan kehadiran untuk setiap hari cuti
  for (const day of days) {
    const existingAttendance = await prisma.attendance.findFirst({
      where: {
        employeeId: leave.employeeId,
        date: {
          gte: new Date(day.setHours(0, 0, 0, 0)),
          lt: new Date(day.setHours(23, 59, 59, 999)),
        },
      },
    });

    if (existingAttendance) {
      await prisma.attendance.update({
        where: { id: existingAttendance.id },
        data: {
          status: "LEAVE",
          notes: `Approved ${leave.type.toLowerCase()} leave`,
        },
      });
    } else {
      await prisma.attendance.create({
        data: {
          employeeId: leave.employeeId,
          date: new Date(day),
          status: "LEAVE",
          notes: `Approved ${leave.type.toLowerCase()} leave`,
        },
      });
    }
  }

  return updatedLeave;
};

/**
 * Menolak permohonan cuti
 */
export const rejectLeaveRequest = async (leaveId: string, adminId: string) => {
  const leave = await prisma.leave.findUnique({
    where: { id: leaveId },
  });

  if (!leave) {
    throw new Error("Permohonan cuti tidak ditemukan");
  }

  if (leave.status !== LeaveStatus.PENDING) {
    throw new Error("Permohonan cuti ini sudah diproses");
  }

  // Update status permohonan cuti
  const updatedLeave = await prisma.leave.update({
    where: { id: leaveId },
    data: {
      status: LeaveStatus.REJECTED,
      approvedBy: adminId,
      approvedAt: new Date(),
    },
  });

  // Buat notifikasi untuk karyawan
  await prisma.notification.create({
    data: {
      userId: (await prisma.employee.findUnique({ where: { id: leave.employeeId } }))?.userId || "",
      title: "Permohonan Cuti Ditolak",
      message: `Permohonan cuti Anda dari ${leave.startDate.toLocaleDateString()} hingga ${leave.endDate.toLocaleDateString()} telah ditolak.`,
      type: "error",
    },
  });

  return updatedLeave;
};