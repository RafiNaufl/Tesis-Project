import { prisma } from "@/lib/prisma";
import { Status } from "@/types/enums";

/**
 * Membuat laporan kehadiran harian untuk semua karyawan
 */
export const generateDailyAttendanceReport = async (date?: Date) => {
  const reportDate = date || new Date();
  const dayStart = new Date(
    reportDate.getFullYear(),
    reportDate.getMonth(),
    reportDate.getDate()
  );
  const dayEnd = new Date(
    reportDate.getFullYear(),
    reportDate.getMonth(),
    reportDate.getDate(),
    23,
    59,
    59
  );

  // Ambil semua karyawan aktif
  const employees = await prisma.employee.findMany({
    where: { isActive: true },
    include: {
      user: {
        select: {
          name: true,
          email: true,
        },
      },
    },
  });

  // Ambil data kehadiran untuk hari ini
  const attendances = await prisma.attendance.findMany({
    where: {
      date: {
        gte: dayStart,
        lte: dayEnd,
      },
    },
  });

  // Gabungkan data karyawan dengan kehadiran
  const report = employees.map((employee) => {
    const attendance = attendances.find((a) => a.employeeId === employee.id);
    
    return {
      employee: {
        id: employee.id,
        employeeId: employee.employeeId,
        name: employee.user.name,
        email: employee.user.email,
        position: employee.position,
        division: employee.division,
      },
      attendance: attendance
        ? {
            id: attendance.id,
            date: attendance.date,
            checkIn: attendance.checkIn,
            checkOut: attendance.checkOut,
            status: attendance.status,
            isLate: attendance.isLate,
            lateMinutes: attendance.lateMinutes,
            overtime: attendance.overtime,
            notes: attendance.notes,
          }
        : {
            status: Status.ABSENT,
            isLate: false,
            lateMinutes: 0,
            overtime: 0,
          },
    };
  });

  // Ringkasan laporan
  const summary = {
    date: reportDate,
    totalEmployees: employees.length,
    present: report.filter((r) => r.attendance.status === Status.PRESENT).length,
    late: report.filter((r) => r.attendance.status === Status.LATE).length,
    absent: report.filter((r) => r.attendance.status === Status.ABSENT).length,
    leave: report.filter((r) => r.attendance.status === Status.LEAVE).length,
  };

  return {
    summary,
    details: report,
  };
};

/**
 * Membuat laporan kehadiran bulanan untuk semua karyawan
 */
export const generateMonthlyAttendanceReport = async (year: number, month: number) => {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0); // Hari terakhir bulan sebelumnya
  
  // Ambil semua karyawan aktif
  const employees = await prisma.employee.findMany({
    where: { isActive: true },
    include: {
      user: {
        select: {
          name: true,
          email: true,
        },
      },
    },
  });

  // Ambil data kehadiran untuk bulan yang diminta
  const attendances = await prisma.attendance.findMany({
    where: {
      date: {
        gte: startDate,
        lte: endDate,
      },
    },
  });

  // Buat ringkasan untuk setiap karyawan
  const employeeSummaries = await Promise.all(
    employees.map(async (employee) => {
      const employeeAttendances = attendances.filter(
        (a) => a.employeeId === employee.id
      );
      
      const daysPresent = employeeAttendances.filter(
        (a) => a.status === Status.PRESENT
      ).length;
      
      const daysLate = employeeAttendances.filter(
        (a) => a.status === Status.LATE
      ).length;
      
      const daysAbsent = employeeAttendances.filter(
        (a) => a.status === Status.ABSENT
      ).length;
      
      const daysLeave = employeeAttendances.filter(
        (a) => a.status === Status.LEAVE
      ).length;
      
      const totalLateMinutes = employeeAttendances.reduce(
        (total, a) => total + a.lateMinutes,
        0
      );
      
      const totalOvertimeMinutes = employeeAttendances.reduce(
        (total, a) => total + a.overtime,
        0
      );

      // Ambil slip gaji jika ada
      const payroll = await prisma.payroll.findFirst({
        where: {
          employeeId: employee.id,
          month,
          year,
        },
      });

      return {
        employee: {
          id: employee.id,
          employeeId: employee.employeeId,
          name: employee.user.name,
          email: employee.user.email,
          position: employee.position,
          division: employee.division,
        },
        attendance: {
          daysPresent,
          daysLate,
          daysAbsent,
          daysLeave,
          totalLateMinutes,
          totalOvertimeMinutes: totalOvertimeMinutes,
          totalOvertimeHours: totalOvertimeMinutes / 60,
        },
        payroll: payroll
          ? {
              id: payroll.id,
              baseSalary: payroll.baseSalary,
              totalAllowances: payroll.totalAllowances,
              totalDeductions: payroll.totalDeductions,
              netSalary: payroll.netSalary,
              status: payroll.status,
            }
          : null,
      };
    })
  );

  // Ringkasan laporan
  const summary = {
    year,
    month,
    totalEmployees: employees.length,
    totalDays: endDate.getDate(),
  };

  return {
    summary,
    details: employeeSummaries,
  };
};

/**
 * Membuat laporan penggajian bulanan untuk semua karyawan
 */
export const generateMonthlyPayrollReport = async (year: number, month: number) => {
  // Ambil semua slip gaji untuk bulan yang diminta
  const payrolls = await prisma.payroll.findMany({
    where: {
      month,
      year,
    },
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
  });

  // Hitung total gaji dan potongan
  const totalBaseSalary = payrolls.reduce(
    (total, p) => total + p.baseSalary,
    0
  );
  const totalAllowances = payrolls.reduce(
    (total, p) => total + p.totalAllowances,
    0
  );
  const totalDeductions = payrolls.reduce(
    (total, p) => total + p.totalDeductions,
    0
  );
  const totalOvertimeAmount = payrolls.reduce(
    (total, p) => total + p.overtimeAmount,
    0
  );
  const totalNetSalary = payrolls.reduce(
    (total, p) => total + p.netSalary,
    0
  );

  // Ringkasan laporan
  const summary = {
    year,
    month,
    totalEmployees: payrolls.length,
    totalBaseSalary,
    totalAllowances,
    totalDeductions,
    totalOvertimeAmount,
    totalNetSalary,
  };

  // Format detail untuk setiap karyawan
  const details = payrolls.map((payroll) => ({
    employee: {
      id: payroll.employee.id,
      employeeId: payroll.employee.employeeId,
      name: payroll.employee.user.name,
      email: payroll.employee.user.email,
      position: payroll.employee.position,
      division: payroll.employee.division,
    },
    payroll: {
      id: payroll.id,
      baseSalary: payroll.baseSalary,
      totalAllowances: payroll.totalAllowances,
      totalDeductions: payroll.totalDeductions,
      overtimeHours: payroll.overtimeHours,
      overtimeAmount: payroll.overtimeAmount,
      daysPresent: payroll.daysPresent,
      daysAbsent: payroll.daysAbsent,
      daysLate: payroll.daysLate,
      netSalary: payroll.netSalary,
      status: payroll.status,
      paidAt: payroll.paidAt,
    },
  }));

  return {
    summary,
    details,
  };
};