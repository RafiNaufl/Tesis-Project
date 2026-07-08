"use client";

import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import EditEmployeeModal from "./EditEmployeeModal";
import {
  ArrowLeft,
  Briefcase,
  CalendarDays,
  CreditCard,
  Download,
  FileSpreadsheet,
  FileText,
  Pencil,
  Phone,
  Power,
  ShieldAlert,
  Trash2,
  UserRound,
  Wallet,
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import {
  getEmployeeButtonClass,
  getEmployeeIconButtonClass,
} from "./buttonStyles";

type EmployeeDetailResponse = {
  employee: {
    id: string;
    employeeId: string;
    userId: string;
    position: string;
    division: string;
    basicSalary: number;
    joiningDate: string;
    contactNumber: string | null;
    address: string | null;
    isActive: boolean;
    organization: string | null;
    employmentStatus: string | null;
    workScheduleType: string | null;
    hourlyRate: number | null;
    bpjsKesehatan: number;
    bpjsKetenagakerjaan: number;
    user: {
      id: string;
      name: string;
      email: string;
      role: string;
      profileImageUrl: string | null;
      createdAt: string;
      updatedAt: string;
    };
  };
  attendance: {
    filters: {
      mode: "month" | "range";
      month: number;
      year: number;
      startDate: string;
      endDate: string;
    };
    summary: {
      present: number;
      late: number;
      leave: number;
      absent: number;
      totalLateMinutes: number;
      totalRecords: number;
    };
    records: Array<{
      id: string;
      date: string;
      checkIn: string | null;
      checkOut: string | null;
      status: string;
      notes: string | null;
      isLate: boolean;
      lateMinutes: number;
      overtime: number;
      isOvertimeApproved: boolean;
    }>;
  };
  loans: {
    summary: {
      advancesRequested: number;
      activeAdvanceCount: number;
      softLoanPrincipal: number;
      softLoanRemaining: number;
      activeSoftLoanCount: number;
      completedSoftLoanCount: number;
    };
    advances: Array<{
      id: string;
      amount: number;
      month: number;
      year: number;
      reason: string | null;
      status: string;
      rejectionReason: string | null;
      deductionMonth: number | null;
      deductionYear: number | null;
      createdAt: string;
      deductedAt: string | null;
    }>;
    softLoans: Array<{
      id: string;
      totalAmount: number;
      monthlyAmount: number;
      remainingAmount: number;
      durationMonths: number;
      startMonth: number;
      startYear: number;
      reason: string | null;
      status: string;
      approvedAt: string | null;
      createdAt: string;
      completedAt: string | null;
    }>;
  };
  deductions: {
    summaryByType: Record<string, number>;
    records: Array<{
      id: string;
      month: number;
      year: number;
      reason: string;
      amount: number;
      date: string;
      type: string;
    }>;
  };
  allowances: {
    records: Array<{
      id: string;
      month: number;
      year: number;
      type: string;
      amount: number;
      date: string;
    }>;
  };
  payroll: {
    summary: {
      totalPayrolls: number;
      totalNetSalaryPaid: number;
      totalOvertimeAmount: number;
      totalDeductions: number;
      totalAllowances: number;
      latestPayrollPeriod: string | null;
    };
    records: Array<{
      id: string;
      month: number;
      year: number;
      baseSalary: number;
      totalAllowances: number;
      totalDeductions: number;
      netSalary: number;
      daysPresent: number;
      daysAbsent: number;
      daysLate: number;
      overtimeHours: number;
      overtimeAmount: number;
      lateDeduction: number;
      advanceDeduction: number;
      softLoanDeduction: number;
      bpjsKesehatanAmount: number;
      bpjsKetenagakerjaanAmount: number;
      status: string;
      createdAt: string;
      paidAt: string | null;
    }>;
  };
  related: {
    leaveRequests: Array<{
      id: string;
      startDate: string;
      endDate: string;
      reason: string;
      type: string;
      status: string;
      createdAt: string;
    }>;
    overtimeRequests: Array<{
      id: string;
      date: string;
      start: string;
      end: string;
      reason: string | null;
      status: string;
      createdAt: string;
    }>;
    employeeIdLogs: Array<{
      id: string;
      oldEmployeeId: string | null;
      newEmployeeId: string;
      reason: string | null;
      createdAt: string;
    }>;
    auditLogs: Array<{
      id: string;
      action: string;
      createdAt: string;
      metadata: unknown;
    }>;
  };
  additionalData: {
    emergencyContact: null;
    workHistory: Array<{
      id: string;
      reason: string | null;
      oldEmployeeId: string | null;
      newEmployeeId: string;
      createdAt: string;
    }>;
    performanceReviews: unknown[];
    disciplineNotes: unknown[];
    notes: string[];
  };
};

type Props = {
  employeeId: string;
};

type EmployeeEditFormValues = {
  name: string;
  email: string;
  role: string;
  division: string;
  organization: string;
  employmentStatus: string;
  workSchedule: "SHIFT" | "NON_SHIFT";
  monthlySalary?: number;
  hourlyRate?: number;
  contactNumber?: string;
  address?: string;
  isActive: boolean;
  bpjsKesehatan?: number;
  bpjsKetenagakerjaan?: number;
  profileImageUrl?: string;
};

type EmployeeEditSubmitResult = {
  success: boolean;
  fieldErrors?: Partial<Record<keyof EmployeeEditFormValues, string>>;
  formError?: string;
};

type EditableEmployee = {
  id: string;
  employeeId: string;
  position: string;
  division: string;
  isActive: boolean;
  basicSalary?: number;
  contactNumber?: string;
  address?: string;
  organization?: string | null;
  employmentStatus?: string | null;
  workScheduleType?: "SHIFT" | "NON_SHIFT" | null;
  hourlyRate?: number | null;
  bpjsKesehatan?: number;
  bpjsKetenagakerjaan?: number;
  user?: {
    name: string;
    email: string;
    profileImageUrl?: string | null;
  };
};

const MONTH_OPTIONS = Array.from({ length: 12 }, (_, index) => ({
  value: index + 1,
  label: new Date(2026, index, 1).toLocaleDateString("id-ID", { month: "long" }),
}));

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatMonthYear(month: number, year: number) {
  return new Date(year, month - 1, 1).toLocaleDateString("id-ID", {
    month: "long",
    year: "numeric",
  });
}

function formatTime(value?: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function getStatusClasses(status?: string) {
  switch ((status || "").toUpperCase()) {
    case "ACTIVE":
    case "APPROVED":
    case "PAID":
    case "PRESENT":
      return "bg-emerald-50 text-emerald-700";
    case "PENDING":
      return "bg-amber-50 text-amber-700";
    case "LATE":
      return "bg-orange-50 text-orange-700";
    case "ABSENT":
    case "REJECTED":
    case "CANCELLED":
      return "bg-rose-50 text-rose-700";
    case "COMPLETED":
      return "bg-blue-50 text-blue-700";
    case "LEAVE":
      return "bg-violet-50 text-violet-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

function getHeaderBadgeClass(tone: "active" | "inactive" | "info") {
  const baseClass =
    "inline-flex min-h-10 items-center rounded-full border px-3.5 py-2 text-xs font-semibold tracking-wide shadow-sm backdrop-blur-sm";

  if (tone === "active") {
    return `${baseClass} border-emerald-300/20 bg-emerald-400/15 text-emerald-50`;
  }

  if (tone === "inactive") {
    return `${baseClass} border-rose-300/20 bg-rose-400/15 text-rose-50`;
  }

  return `${baseClass} border-white/15 bg-white/10 text-blue-50`;
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
      {message}
    </div>
  );
}

function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-4 py-4 sm:px-6">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
      </div>
      <div className="px-4 py-5 sm:px-6">{children}</div>
    </section>
  );
}

function StatCard({
  label,
  value,
  helper,
  accent,
}: {
  label: string;
  value: string | number;
  helper?: string;
  accent: string;
}) {
  return (
    <div className={`rounded-2xl border px-4 py-4 sm:px-5 sm:py-5 ${accent}`}>
      <p className="text-xs font-semibold uppercase tracking-wide sm:text-[13px]">{label}</p>
      <p className="mt-2 text-xl font-bold sm:text-2xl">{value}</p>
      {helper ? <p className="mt-1 text-xs opacity-80 sm:text-sm">{helper}</p> : null}
    </div>
  );
}

export default function EmployeeDetailView({ employeeId }: Props) {
  const router = useRouter();
  const { data: session } = useSession();
  const [data, setData] = useState<EmployeeDetailResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState<"edit" | "toggle" | "delete" | null>(null);

  const currentDate = useMemo(() => new Date(), []);
  const [filterMode, setFilterMode] = useState<"month" | "range">("month");
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const loadDetail = useCallback(async (query?: string) => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`/api/employees/${employeeId}/detail${query ? `?${query}` : ""}`);

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || "Gagal mengambil detail karyawan");
      }

      const result: EmployeeDetailResponse = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengambil detail karyawan");
    } finally {
      setIsLoading(false);
    }
  }, [employeeId]);

  useEffect(() => {
    const initialQuery = new URLSearchParams({
      month: String(currentDate.getMonth() + 1),
      year: String(currentDate.getFullYear()),
    }).toString();

    loadDetail(initialQuery);
  }, [currentDate, loadDetail]);

  useEffect(() => {
    if (!data) return;
    setFilterMode(data.attendance.filters.mode);
    setSelectedMonth(data.attendance.filters.month);
    setSelectedYear(data.attendance.filters.year);
    setStartDate(data.attendance.filters.startDate.slice(0, 10));
    setEndDate(data.attendance.filters.endDate.slice(0, 10));
  }, [data]);

  const years = useMemo(() => {
    const baseYear = currentDate.getFullYear();
    return Array.from({ length: 7 }, (_, index) => baseYear - 3 + index);
  }, [currentDate]);

  const summaryByTypeEntries = useMemo(() => {
    if (!data) return [];
    return Object.entries(data.deductions.summaryByType).sort((a, b) => b[1] - a[1]);
  }, [data]);

  const buildCurrentQuery = () => {
    const params = new URLSearchParams();

    if (filterMode === "range" && startDate && endDate) {
      params.set("startDate", startDate);
      params.set("endDate", endDate);
      params.set("month", String(selectedMonth));
      params.set("year", String(selectedYear));
    } else {
      params.set("month", String(selectedMonth));
      params.set("year", String(selectedYear));
    }

    return params.toString();
  };

  const applyPeriodFilter = async () => {
    await loadDetail(buildCurrentQuery());
  };

  const handleExportPdf = async () => {
    if (!data) return;

    try {
      setIsExportingPdf(true);

      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const employee = data.employee;
      const title = `Detail Karyawan - ${employee.user.name}`;
      doc.setFontSize(16);
      doc.text(title, 14, 16);
      doc.setFontSize(10);
      doc.text(`ID Karyawan: ${employee.employeeId}`, 14, 22);
      doc.text(
        `Filter Periode: ${
          filterMode === "range" && startDate && endDate
            ? `${formatDate(startDate)} - ${formatDate(endDate)}`
            : formatMonthYear(selectedMonth, selectedYear)
        }`,
        14,
        28
      );

      autoTable(doc, {
        startY: 34,
        head: [["Profil", "Nilai"]],
        body: [
          ["Nama", employee.user.name],
          ["Email", employee.user.email],
          ["Role Sistem", employee.user.role],
          ["Jabatan", employee.position],
          ["Divisi", employee.division],
          ["Organisasi", employee.organization || "-"],
          ["Status Kepegawaian", employee.employmentStatus || "-"],
          ["Tipe Jadwal", employee.workScheduleType || "-"],
          ["Status Akun", employee.isActive ? "Aktif" : "Nonaktif"],
          ["Tanggal Bergabung", formatDate(employee.joiningDate)],
          ["Nomor Kontak", employee.contactNumber || "-"],
          ["Alamat", employee.address || "-"],
          ["Gaji Pokok", formatCurrency(employee.basicSalary || 0)],
          ["Upah per Jam", formatCurrency(employee.hourlyRate || 0)],
          ["BPJS Kesehatan", formatCurrency(employee.bpjsKesehatan || 0)],
          ["BPJS Ketenagakerjaan", formatCurrency(employee.bpjsKetenagakerjaan || 0)],
        ],
        styles: { fontSize: 9, cellPadding: 2 },
        headStyles: { fillColor: [37, 99, 235] },
      });

      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 6,
        head: [["Ringkasan Absensi", "Jumlah"]],
        body: [
          ["Total Kehadiran", String(data.attendance.summary.present)],
          ["Total Terlambat", String(data.attendance.summary.late)],
          ["Total Izin/Cuti", String(data.attendance.summary.leave)],
          ["Total Tidak Hadir", String(data.attendance.summary.absent)],
          ["Akumulasi Menit Terlambat", `${data.attendance.summary.totalLateMinutes} menit`],
        ],
        styles: { fontSize: 9, cellPadding: 2 },
        headStyles: { fillColor: [14, 116, 144] },
      });

      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 6,
        head: [["Tanggal", "Status", "Masuk", "Pulang", "Telat", "Lembur", "Catatan"]],
        body: data.attendance.records.map((record) => [
          formatDate(record.date),
          record.status,
          formatTime(record.checkIn),
          formatTime(record.checkOut),
          record.isLate ? `${record.lateMinutes} menit` : "-",
          `${record.overtime || 0} jam`,
          record.notes || "-",
        ]),
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [79, 70, 229] },
      });

      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 6,
        head: [["Periode Payroll", "Gaji Bersih", "Potongan", "Tunjangan", "Status"]],
        body: data.payroll.records.map((record) => [
          formatMonthYear(record.month, record.year),
          formatCurrency(record.netSalary),
          formatCurrency(record.totalDeductions),
          formatCurrency(record.totalAllowances),
          record.status,
        ]),
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [22, 163, 74] },
      });

      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 6,
        head: [["Jenis Potongan", "Periode", "Alasan", "Jumlah"]],
        body: data.deductions.records.map((record) => [
          record.type,
          formatMonthYear(record.month, record.year),
          record.reason,
          formatCurrency(record.amount),
        ]),
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [234, 88, 12] },
      });

      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 6,
        head: [["Jenis Pinjaman", "Jumlah", "Sisa", "Status", "Tanggal"]],
        body: [
          ...data.loans.softLoans.map((loan) => [
            "Pinjaman Lunak",
            formatCurrency(loan.totalAmount),
            formatCurrency(loan.remainingAmount),
            loan.status,
            formatDate(loan.createdAt),
          ]),
          ...data.loans.advances.map((advance) => [
            "Kasbon",
            formatCurrency(advance.amount),
            advance.deductedAt ? "Sudah dipotong" : "Belum dipotong",
            advance.status,
            formatDate(advance.createdAt),
          ]),
        ],
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [168, 85, 247] },
      });

      doc.save(`detail-karyawan-${employee.employeeId}.pdf`);
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleExportExcel = async () => {
    if (!data) return;

    try {
      setIsExportingExcel(true);

      const workbook = XLSX.utils.book_new();

      const profileSheet = XLSX.utils.json_to_sheet([
        {
          nama: data.employee.user.name,
          email: data.employee.user.email,
          role_sistem: data.employee.user.role,
          id_karyawan: data.employee.employeeId,
          jabatan: data.employee.position,
          divisi: data.employee.division,
          organisasi: data.employee.organization || "",
          status_kepegawaian: data.employee.employmentStatus || "",
          tipe_jadwal: data.employee.workScheduleType || "",
          status_akun: data.employee.isActive ? "Aktif" : "Nonaktif",
          tanggal_bergabung: formatDate(data.employee.joiningDate),
          nomor_kontak: data.employee.contactNumber || "",
          alamat: data.employee.address || "",
          gaji_pokok: data.employee.basicSalary || 0,
          upah_per_jam: data.employee.hourlyRate || 0,
          bpjs_kesehatan: data.employee.bpjsKesehatan || 0,
          bpjs_ketenagakerjaan: data.employee.bpjsKetenagakerjaan || 0,
        },
      ]);

      const attendanceSheet = XLSX.utils.json_to_sheet(
        data.attendance.records.map((record) => ({
          tanggal: formatDate(record.date),
          status: record.status,
          check_in: formatTime(record.checkIn),
          check_out: formatTime(record.checkOut),
          terlambat: record.isLate ? "Ya" : "Tidak",
          menit_terlambat: record.lateMinutes,
          lembur_jam: record.overtime,
          catatan: record.notes || "",
        }))
      );

      const payrollSheet = XLSX.utils.json_to_sheet(
        data.payroll.records.map((record) => ({
          periode: formatMonthYear(record.month, record.year),
          gaji_pokok: record.baseSalary,
          total_tunjangan: record.totalAllowances,
          total_potongan: record.totalDeductions,
          gaji_bersih: record.netSalary,
          hari_hadir: record.daysPresent,
          hari_tidak_hadir: record.daysAbsent,
          hari_terlambat: record.daysLate,
          lembur_jam: record.overtimeHours,
          nominal_lembur: record.overtimeAmount,
          potongan_terlambat: record.lateDeduction,
          potongan_kasbon: record.advanceDeduction,
          potongan_pinjaman: record.softLoanDeduction,
          status: record.status,
          dibayar_pada: formatDateTime(record.paidAt),
        }))
      );

      const deductionsSheet = XLSX.utils.json_to_sheet(
        data.deductions.records.map((record) => ({
          jenis: record.type,
          periode: formatMonthYear(record.month, record.year),
          alasan: record.reason,
          jumlah: record.amount,
          tanggal: formatDate(record.date),
        }))
      );

      const allowancesSheet = XLSX.utils.json_to_sheet(
        data.allowances.records.map((record) => ({
          jenis: record.type,
          periode: formatMonthYear(record.month, record.year),
          jumlah: record.amount,
          tanggal: formatDate(record.date),
        }))
      );

      const loansSheet = XLSX.utils.json_to_sheet([
        ...data.loans.softLoans.map((loan) => ({
          jenis: "Pinjaman Lunak",
          jumlah: loan.totalAmount,
          cicilan_bulanan: loan.monthlyAmount,
          sisa_pinjaman: loan.remainingAmount,
          jadwal_mulai: formatMonthYear(loan.startMonth, loan.startYear),
          durasi_bulan: loan.durationMonths,
          status: loan.status,
          alasan: loan.reason || "",
          dibuat_pada: formatDate(loan.createdAt),
          selesai_pada: formatDate(loan.completedAt),
        })),
        ...data.loans.advances.map((advance) => ({
          jenis: "Kasbon",
          jumlah: advance.amount,
          cicilan_bulanan: 0,
          sisa_pinjaman: advance.deductedAt ? 0 : advance.amount,
          jadwal_mulai:
            advance.deductionMonth && advance.deductionYear
              ? formatMonthYear(advance.deductionMonth, advance.deductionYear)
              : "",
          durasi_bulan: 1,
          status: advance.status,
          alasan: advance.reason || "",
          dibuat_pada: formatDate(advance.createdAt),
          selesai_pada: formatDate(advance.deductedAt),
        })),
      ]);

      const relatedSheet = XLSX.utils.json_to_sheet([
        ...data.related.leaveRequests.map((leave) => ({
          kategori: "Cuti/Izin",
          tanggal_mulai: formatDate(leave.startDate),
          tanggal_selesai: formatDate(leave.endDate),
          status: leave.status,
          keterangan: leave.reason,
        })),
        ...data.related.overtimeRequests.map((request) => ({
          kategori: "Lembur",
          tanggal_mulai: formatDateTime(request.start),
          tanggal_selesai: formatDateTime(request.end),
          status: request.status,
          keterangan: request.reason || "",
        })),
        ...data.related.auditLogs.map((log) => ({
          kategori: "Audit",
          tanggal_mulai: formatDateTime(log.createdAt),
          tanggal_selesai: "",
          status: log.action,
          keterangan: JSON.stringify(log.metadata || {}),
        })),
      ]);

      XLSX.utils.book_append_sheet(workbook, profileSheet, "Profil");
      XLSX.utils.book_append_sheet(workbook, attendanceSheet, "Absensi");
      XLSX.utils.book_append_sheet(workbook, payrollSheet, "Payroll");
      XLSX.utils.book_append_sheet(workbook, deductionsSheet, "Potongan");
      XLSX.utils.book_append_sheet(workbook, allowancesSheet, "Tunjangan");
      XLSX.utils.book_append_sheet(workbook, loansSheet, "Pinjaman");
      XLSX.utils.book_append_sheet(workbook, relatedSheet, "Data Terkait");

      XLSX.writeFile(workbook, `detail-karyawan-${data.employee.employeeId}.xlsx`);
    } finally {
      setIsExportingExcel(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-100 border-t-blue-600" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-3xl border border-rose-200 bg-rose-50 px-6 py-8">
        <p className="text-lg font-semibold text-rose-700">Gagal memuat detail karyawan</p>
        <p className="mt-2 text-sm text-rose-600">{error || "Data tidak tersedia."}</p>
        <Link
          href="/dashboard/employees"
          className={cn(getEmployeeButtonClass("danger"), "mt-4 w-full sm:w-auto")}
        >
          <ArrowLeft className="h-4 w-4" />
          Kembali ke daftar karyawan
        </Link>
      </div>
    );
  }

  const employee = data.employee;
  const editableEmployee: EditableEmployee = {
    id: employee.id,
    employeeId: employee.employeeId,
    position: employee.position,
    division: employee.division,
    isActive: employee.isActive,
    basicSalary: employee.basicSalary,
    contactNumber: employee.contactNumber || undefined,
    address: employee.address || undefined,
    organization: employee.organization,
    employmentStatus: employee.employmentStatus,
    workScheduleType: employee.workScheduleType as "SHIFT" | "NON_SHIFT" | null,
    hourlyRate: employee.hourlyRate,
    bpjsKesehatan: employee.bpjsKesehatan,
    bpjsKetenagakerjaan: employee.bpjsKetenagakerjaan,
    user: {
      name: employee.user.name,
      email: employee.user.email,
      profileImageUrl: employee.user.profileImageUrl,
    },
  };
  const canEditOrToggle = session?.user?.role === "ADMIN" || session?.user?.role === "DIREKTUR";
  const canDelete = session?.user?.role === "ADMIN";

  const handleEditEmployeeSubmit = async (id: string, formData: EmployeeEditFormValues) => {
    try {
      setActionLoading("edit");
      const response = await fetch(`/api/employees/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const payload = await response.json().catch(() => ({} as any));

      if (!response.ok) {
        return {
          success: false,
          fieldErrors: payload.fieldErrors,
          formError:
            payload.formError ||
            (Array.isArray(payload.error)
              ? payload.error.join(", ")
              : payload.error || "Gagal memperbarui karyawan"),
        } satisfies EmployeeEditSubmitResult;
      }

      await loadDetail(buildCurrentQuery());
      router.refresh();
      return { success: true } satisfies EmployeeEditSubmitResult;
    } catch (submitError) {
      console.error("Error updating employee:", submitError);
      return {
        success: false,
        formError: "Terjadi kesalahan saat menyimpan perubahan karyawan",
      } satisfies EmployeeEditSubmitResult;
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleStatus = async () => {
    try {
      setActionLoading("toggle");
      const payload: EmployeeEditFormValues = {
        name: employee.user.name,
        email: employee.user.email,
        role: employee.position,
        division: employee.division,
        organization: employee.organization || "CTU",
        employmentStatus: employee.employmentStatus || "Tetap",
        workSchedule: (employee.workScheduleType as "SHIFT" | "NON_SHIFT") || "SHIFT",
        monthlySalary: employee.workScheduleType === "SHIFT" ? (employee.basicSalary || 0) : undefined,
        hourlyRate: employee.workScheduleType === "NON_SHIFT" ? (employee.hourlyRate ?? undefined) : undefined,
        contactNumber: employee.contactNumber || undefined,
        address: employee.address || undefined,
        isActive: !employee.isActive,
        bpjsKesehatan: employee.bpjsKesehatan,
        bpjsKetenagakerjaan: employee.bpjsKetenagakerjaan,
        profileImageUrl: employee.user.profileImageUrl || undefined,
      };

      const response = await fetch(`/api/employees/${employee.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        let msg = "Gagal memperbarui status karyawan";
        try {
          const raw = await response.text();
          if (raw) {
            const err = JSON.parse(raw);
            msg = Array.isArray(err.error) ? err.error.join(", ") : (err.error || msg);
          }
        } catch (parseError) {
          console.error(parseError);
        }
        alert(msg);
        throw new Error(msg);
      }

      await loadDetail(buildCurrentQuery());
      router.refresh();
    } catch (toggleError) {
      console.error("Error updating employee status:", toggleError);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteEmployee = async () => {
    if (!confirm("Apakah Anda yakin ingin menghapus karyawan ini? Semua data terkait juga akan dihapus.")) {
      return;
    }

    try {
      setActionLoading("delete");
      const response = await fetch(`/api/employees/${employee.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        let errorMessage = `Gagal menghapus karyawan (${response.status})`;
        try {
          const raw = await response.text();
          if (raw) {
            const errJson = JSON.parse(raw);
            errorMessage = errJson.error || errorMessage;
          }
        } catch (parseError) {
          console.error(parseError);
        }
        alert(errorMessage);
        throw new Error(errorMessage);
      }

      alert("Karyawan berhasil dihapus");
      router.push("/dashboard/employees");
      router.refresh();
    } catch (deleteError) {
      console.error("Error deleting employee:", deleteError);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-gradient-to-r from-slate-900 via-blue-900 to-indigo-900 px-4 py-5 text-white shadow-lg sm:px-6 sm:py-6">
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.95fr)] xl:items-stretch">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-inner shadow-black/10 backdrop-blur-sm sm:p-5">
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-stretch">
                <div className="flex items-start gap-3 sm:gap-4">
                  <div className="pt-1">
                    <Link
                      href="/dashboard/employees"
                      aria-label="Kembali ke daftar karyawan"
                      className={getEmployeeIconButtonClass("neutral", "rounded-full border-white/10 bg-white/10 text-white shadow-md hover:border-white/20 hover:bg-white/20")}
                    >
                      <ArrowLeft className="h-5 w-5" />
                    </Link>
                  </div>
                  <div className="h-28 w-28 shrink-0 overflow-hidden rounded-3xl border border-white/10 bg-white/10 shadow-lg sm:h-32 sm:w-32">
                    {employee.user.profileImageUrl ? (
                      <Image
                        src={employee.user.profileImageUrl}
                        alt={employee.user.name}
                        width={128}
                        height={128}
                        className="h-28 w-28 object-cover sm:h-32 sm:w-32"
                      />
                    ) : (
                      <div className="flex h-28 w-28 items-center justify-center bg-white/10 text-3xl font-semibold sm:h-32 sm:w-32 sm:text-4xl">
                        {employee.user.name
                          .split(" ")
                          .map((part) => part[0])
                          .slice(0, 2)
                          .join("")}
                      </div>
                    )}
                  </div>
                </div>

                <div className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-black/10 px-4 py-4 sm:px-5 sm:py-5">
                  <div className="flex min-h-[112px] flex-col justify-between sm:min-h-[128px]">
                    <div>
                      <p className="text-sm font-medium text-blue-100/90">Detail Individu Karyawan</p>
                      <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
                        {employee.user.name}
                      </h1>
                      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-blue-100/90">
                        <span>{employee.employeeId}</span>
                        <span className="hidden sm:inline text-white/40">•</span>
                        <span>{employee.position}</span>
                        <span className="hidden sm:inline text-white/40">•</span>
                        <span>{employee.division}</span>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap items-center gap-2.5">
                      <span className={getHeaderBadgeClass(employee.isActive ? "active" : "inactive")}>
                        {employee.isActive ? "Status Aktif" : "Status Nonaktif"}
                      </span>
                      <span className={getHeaderBadgeClass("info")}>
                        {employee.employmentStatus || "Status belum diisi"}
                      </span>
                      <span className={getHeaderBadgeClass("info")}>
                        {employee.workScheduleType || "Jadwal belum diisi"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-black/10 px-4 py-3">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-blue-100/75">
                    <Briefcase className="h-4 w-4" />
                    Organisasi
                  </div>
                  <p className="mt-2 text-sm font-semibold text-white">
                    {employee.organization || "Belum diatur"}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/10 px-4 py-3">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-blue-100/75">
                    <CalendarDays className="h-4 w-4" />
                    Tanggal Bergabung
                  </div>
                  <p className="mt-2 text-sm font-semibold text-white">
                    {formatDate(employee.joiningDate)}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/10 px-4 py-3">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-blue-100/75">
                    <Phone className="h-4 w-4" />
                    Kontak
                  </div>
                  <p className="mt-2 truncate text-sm font-semibold text-white">
                    {employee.contactNumber || employee.user.email}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="w-full">
            <div className="rounded-2xl border border-white/10 bg-white/10 p-4 shadow-inner shadow-black/10 backdrop-blur-sm">
              <div className="mb-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-100/70">
                  Aksi Cepat
                </p>
                <h2 className="mt-1 text-lg font-semibold text-white">Ekspor dan kelola data</h2>
                <p className="mt-1 text-sm text-blue-100/80">
                  Seluruh tindakan untuk karyawan ini tersedia dalam satu panel yang rapi.
                </p>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <button
                  type="button"
                  onClick={handleExportPdf}
                  disabled={isExportingPdf || isExportingExcel || actionLoading !== null}
                  className={getEmployeeButtonClass("light", "min-h-12 w-full text-sm")}
                >
                  {isExportingPdf ? <Download className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                  Ekspor PDF
                </button>
                <button
                  type="button"
                  onClick={handleExportExcel}
                  disabled={isExportingPdf || isExportingExcel || actionLoading !== null}
                  className={getEmployeeButtonClass("success", "min-h-12 w-full text-sm")}
                >
                  {isExportingExcel ? <Download className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
                  Ekspor Excel
                </button>
              </div>

              {(canEditOrToggle || canDelete) ? (
                <>
                  <div className="my-4 h-px bg-white/10" />
                  <div className="grid gap-3 md:grid-cols-2">
                    {canEditOrToggle ? (
                      <button
                        type="button"
                        onClick={() => setIsEditModalOpen(true)}
                        disabled={actionLoading !== null || isExportingPdf || isExportingExcel}
                        className={getEmployeeButtonClass("primary", "min-h-12 w-full text-sm")}
                      >
                        <Pencil className="h-4 w-4" />
                        Edit Karyawan
                      </button>
                    ) : null}

                    {canEditOrToggle ? (
                      <button
                        type="button"
                        onClick={handleToggleStatus}
                        disabled={actionLoading !== null || isExportingPdf || isExportingExcel}
                        className={getEmployeeButtonClass(
                          employee.isActive ? "warning" : "success",
                          "min-h-12 w-full text-sm"
                        )}
                      >
                        <Power className="h-4 w-4" />
                        {actionLoading === "toggle"
                          ? "Memproses..."
                          : employee.isActive
                            ? "Nonaktifkan"
                            : "Aktifkan"}
                      </button>
                    ) : null}

                    {canDelete ? (
                      <button
                        type="button"
                        onClick={handleDeleteEmployee}
                        disabled={actionLoading !== null || isExportingPdf || isExportingExcel}
                        className={getEmployeeButtonClass("danger", "min-h-12 w-full md:col-span-2 text-sm")}
                      >
                        <Trash2 className="h-4 w-4" />
                        {actionLoading === "delete" ? "Menghapus..." : "Hapus Karyawan"}
                      </button>
                    ) : null}
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <SectionCard
        title="Profil Lengkap"
      >
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          <div className="space-y-4 md:col-span-2 xl:col-span-2">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
                  <UserRound className="h-4 w-4 text-blue-600" />
                  Informasi Pribadi
                </div>
                <dl className="space-y-3 text-sm">
                  <div>
                    <dt className="text-slate-500">Nama Lengkap</dt>
                    <dd className="font-medium text-slate-900">{employee.user.name}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Email</dt>
                    <dd className="font-medium text-slate-900">{employee.user.email}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Nomor Kontak</dt>
                    <dd className="font-medium text-slate-900">{employee.contactNumber || "-"}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Alamat</dt>
                    <dd className="font-medium text-slate-900">{employee.address || "-"}</dd>
                  </div>
                </dl>
              </div>

              <div className="rounded-2xl border border-slate-200 p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
                  <Briefcase className="h-4 w-4 text-indigo-600" />
                  Data Kepegawaian
                </div>
                <dl className="space-y-3 text-sm">
                  <div>
                    <dt className="text-slate-500">ID Karyawan</dt>
                    <dd className="font-medium text-slate-900">{employee.employeeId}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Jabatan dan Divisi</dt>
                    <dd className="font-medium text-slate-900">{employee.position} / {employee.division}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Organisasi</dt>
                    <dd className="font-medium text-slate-900">{employee.organization || "-"}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Tanggal Bergabung</dt>
                    <dd className="font-medium text-slate-900">{formatDate(employee.joiningDate)}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Status Kepegawaian</dt>
                    <dd className="font-medium text-slate-900">{employee.employmentStatus || "-"}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Tipe Jadwal</dt>
                    <dd className="font-medium text-slate-900">{employee.workScheduleType || "-"}</dd>
                  </div>
                </dl>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 p-4">
                <p className="text-sm text-slate-500">Gaji Pokok</p>
                <p className="mt-2 text-xl font-semibold text-slate-900">{formatCurrency(employee.basicSalary || 0)}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 p-4">
                <p className="text-sm text-slate-500">Upah per Jam</p>
                <p className="mt-2 text-xl font-semibold text-slate-900">{formatCurrency(employee.hourlyRate || 0)}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 p-4">
                <p className="text-sm text-slate-500">Potongan BPJS</p>
                <p className="mt-2 text-xl font-semibold text-slate-900">
                  {formatCurrency((employee.bpjsKesehatan || 0) + (employee.bpjsKetenagakerjaan || 0))}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
                <Phone className="h-4 w-4 text-emerald-600" />
                Kontak Darurat
              </div>
              <p className="text-sm text-slate-500">
                Detail kontak darurat belum tersedia pada data master karyawan saat ini.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
                <CalendarDays className="h-4 w-4 text-amber-600" />
                Riwayat Pekerjaan
              </div>
              <div className="space-y-3">
                <div className="rounded-xl bg-slate-50 p-3 text-sm">
                  <p className="font-medium text-slate-900">Mulai bekerja</p>
                  <p className="text-slate-500">{formatDate(employee.joiningDate)}</p>
                </div>
                {data.additionalData.workHistory.map((item) => (
                  <div key={item.id} className="rounded-xl bg-slate-50 p-3 text-sm">
                    <p className="font-medium text-slate-900">{item.reason || "Perubahan data pekerjaan"}</p>
                    <p className="text-slate-500">
                      {item.oldEmployeeId ? `${item.oldEmployeeId} -> ${item.newEmployeeId}` : item.newEmployeeId}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">{formatDateTime(item.createdAt)}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </SectionCard>

      <EditEmployeeModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSubmit={handleEditEmployeeSubmit}
        employee={editableEmployee}
      />

      <SectionCard
        title="Absensi Karyawan"
        subtitle="Pilih bulan/tahun atau rentang tanggal untuk memfilter seluruh data periodik karyawan, termasuk absensi dan riwayat transaksi terkait."
      >
        <div className="space-y-5">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setFilterMode("month")}
                  className={`min-h-12 rounded-xl px-4 py-2.5 text-sm font-medium ${
                    filterMode === "month" ? "bg-blue-600 text-white" : "bg-white text-slate-600"
                  }`}
                >
                  Bulan dan Tahun
                </button>
                <button
                  type="button"
                  onClick={() => setFilterMode("range")}
                  className={`min-h-12 rounded-xl px-4 py-2.5 text-sm font-medium ${
                    filterMode === "range" ? "bg-blue-600 text-white" : "bg-white text-slate-600"
                  }`}
                >
                  Rentang Tanggal
                </button>
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <label className="space-y-1">
                  <span className="text-xs font-medium text-slate-500">Bulan</span>
                  <select
                    aria-label="Pilih bulan"
                    value={selectedMonth}
                    onChange={(event) => setSelectedMonth(Number(event.target.value))}
                    className="min-h-12 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                  >
                    {MONTH_OPTIONS.map((month) => (
                      <option key={month.value} value={month.value}>
                        {month.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-medium text-slate-500">Tahun</span>
                  <select
                    aria-label="Pilih tahun"
                    value={selectedYear}
                    onChange={(event) => setSelectedYear(Number(event.target.value))}
                    className="min-h-12 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                  >
                    {years.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-medium text-slate-500">Tanggal mulai</span>
                  <input
                    aria-label="Pilih tanggal mulai"
                    type="date"
                    value={startDate}
                    onChange={(event) => setStartDate(event.target.value)}
                    disabled={filterMode !== "range"}
                    className="min-h-12 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 disabled:bg-slate-100"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-medium text-slate-500">Tanggal akhir</span>
                  <input
                    aria-label="Pilih tanggal akhir"
                    type="date"
                    value={endDate}
                    onChange={(event) => setEndDate(event.target.value)}
                    disabled={filterMode !== "range"}
                    className="min-h-12 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 disabled:bg-slate-100"
                  />
                </label>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-500">
                Filter aktif:{" "}
                {filterMode === "range" && startDate && endDate
                  ? `${formatDate(startDate)} - ${formatDate(endDate)}`
                  : formatMonthYear(selectedMonth, selectedYear)}
              </p>
              <button
                type="button"
                onClick={applyPeriodFilter}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-700"
              >
                Terapkan Periode
              </button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <StatCard
              label="Kehadiran"
              value={data.attendance.summary.present}
              accent="border-emerald-200 bg-emerald-50 text-emerald-700"
            />
            <StatCard
              label="Terlambat"
              value={data.attendance.summary.late}
              helper={`${data.attendance.summary.totalLateMinutes} menit`}
              accent="border-orange-200 bg-orange-50 text-orange-700"
            />
            <StatCard
              label="Izin/Cuti"
              value={data.attendance.summary.leave}
              accent="border-violet-200 bg-violet-50 text-violet-700"
            />
            <StatCard
              label="Tidak Hadir"
              value={data.attendance.summary.absent}
              accent="border-rose-200 bg-rose-50 text-rose-700"
            />
            <StatCard
              label="Total Catatan"
              value={data.attendance.summary.totalRecords}
              accent="border-blue-200 bg-blue-50 text-blue-700"
            />
          </div>

          {data.attendance.records.length === 0 ? (
            <EmptyState message="Belum ada data absensi pada filter yang dipilih." />
          ) : (
            <>
              <div className="hidden overflow-x-auto xl:block">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <th className="px-4 py-3">Tanggal</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Masuk</th>
                      <th className="px-4 py-3">Pulang</th>
                      <th className="px-4 py-3">Keterlambatan</th>
                      <th className="px-4 py-3">Lembur</th>
                      <th className="px-4 py-3">Catatan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white text-sm">
                    {data.attendance.records.map((record) => (
                      <tr key={record.id}>
                        <td className="px-4 py-3 font-medium text-slate-900">{formatDate(record.date)}</td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusClasses(record.status)}`}>
                            {record.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600">{formatTime(record.checkIn)}</td>
                        <td className="px-4 py-3 text-slate-600">{formatTime(record.checkOut)}</td>
                        <td className="px-4 py-3 text-slate-600">
                          {record.isLate ? `${record.lateMinutes} menit` : "-"}
                        </td>
                        <td className="px-4 py-3 text-slate-600">{record.overtime || 0} jam</td>
                        <td className="px-4 py-3 text-slate-600">{record.notes || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:hidden">
                {data.attendance.records.map((record) => (
                  <div key={record.id} className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{formatDate(record.date)}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          Masuk {formatTime(record.checkIn)} / Pulang {formatTime(record.checkOut)}
                        </p>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusClasses(record.status)}`}>
                        {record.status}
                      </span>
                    </div>
                    <div className="mt-3 grid gap-2 text-sm text-slate-600">
                      <p>Telat: {record.isLate ? `${record.lateMinutes} menit` : "-"}</p>
                      <p>Lembur: {record.overtime || 0} jam</p>
                    </div>
                    {record.notes ? <p className="mt-3 text-sm text-slate-500">{record.notes}</p> : null}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </SectionCard>

      <SectionCard
        title="Riwayat Pinjaman"
        subtitle="Meliputi pinjaman lunak dan kasbon, lengkap dengan nilai, jadwal cicilan, sisa kewajiban, dan status."
      >
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Total Kasbon"
              value={formatCurrency(data.loans.summary.advancesRequested)}
              helper={`${data.loans.summary.activeAdvanceCount} kasbon berjalan`}
              accent="border-amber-200 bg-amber-50 text-amber-700"
            />
            <StatCard
              label="Pokok Pinjaman"
              value={formatCurrency(data.loans.summary.softLoanPrincipal)}
              accent="border-violet-200 bg-violet-50 text-violet-700"
            />
            <StatCard
              label="Sisa Pinjaman"
              value={formatCurrency(data.loans.summary.softLoanRemaining)}
              accent="border-rose-200 bg-rose-50 text-rose-700"
            />
            <StatCard
              label="Pinjaman Lunas"
              value={data.loans.summary.completedSoftLoanCount}
              accent="border-emerald-200 bg-emerald-50 text-emerald-700"
            />
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
                <CreditCard className="h-4 w-4 text-violet-600" />
                Pinjaman Lunak
              </div>
              {data.loans.softLoans.length === 0 ? (
                <EmptyState message="Tidak ada riwayat pinjaman lunak." />
              ) : (
                <div className="space-y-3">
                  {data.loans.softLoans.map((loan) => (
                    <div key={loan.id} className="rounded-2xl border border-slate-200 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-base font-semibold text-slate-900">{formatCurrency(loan.totalAmount)}</p>
                          <p className="text-sm text-slate-500">
                            Mulai {formatMonthYear(loan.startMonth, loan.startYear)} • {loan.durationMonths} bulan
                          </p>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusClasses(loan.status)}`}>
                          {loan.status}
                        </span>
                      </div>
                      <div className="mt-3 grid gap-2 text-sm text-slate-600 md:grid-cols-2">
                        <p>Cicilan bulanan: {formatCurrency(loan.monthlyAmount)}</p>
                        <p>Sisa pinjaman: {formatCurrency(loan.remainingAmount)}</p>
                        <p>Dibuat: {formatDate(loan.createdAt)}</p>
                        <p>Selesai: {formatDate(loan.completedAt)}</p>
                      </div>
                      {loan.reason ? <p className="mt-3 text-sm text-slate-500">{loan.reason}</p> : null}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
                <Wallet className="h-4 w-4 text-amber-600" />
                Kasbon
              </div>
              {data.loans.advances.length === 0 ? (
                <EmptyState message="Tidak ada riwayat kasbon." />
              ) : (
                <div className="space-y-3">
                  {data.loans.advances.map((advance) => (
                    <div key={advance.id} className="rounded-2xl border border-slate-200 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-base font-semibold text-slate-900">{formatCurrency(advance.amount)}</p>
                          <p className="text-sm text-slate-500">{formatMonthYear(advance.month, advance.year)}</p>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusClasses(advance.status)}`}>
                          {advance.status}
                        </span>
                      </div>
                      <div className="mt-3 grid gap-2 text-sm text-slate-600 md:grid-cols-2">
                        <p>Diajukan: {formatDate(advance.createdAt)}</p>
                        <p>Dipotong: {formatDate(advance.deductedAt)}</p>
                        <p>
                          Jadwal potong:{" "}
                          {advance.deductionMonth && advance.deductionYear
                            ? formatMonthYear(advance.deductionMonth, advance.deductionYear)
                            : "-"}
                        </p>
                        <p>Alasan: {advance.reason || "-"}</p>
                      </div>
                      {advance.rejectionReason ? (
                        <p className="mt-3 text-sm text-rose-600">Alasan penolakan: {advance.rejectionReason}</p>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Potongan dan Tunjangan"
        subtitle="Menampilkan seluruh potongan gaji per periode beserta rekap nominal per jenis dan histori tunjangan selama masa kerja."
      >
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 p-4">
              <p className="mb-3 text-sm font-semibold text-slate-800">Ringkasan Potongan per Jenis</p>
              {summaryByTypeEntries.length === 0 ? (
                <EmptyState message="Belum ada data potongan." />
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {summaryByTypeEntries.map(([type, amount]) => (
                    <div key={type} className="rounded-xl bg-slate-50 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{type}</p>
                      <p className="mt-2 text-lg font-semibold text-slate-900">{formatCurrency(amount)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 p-4">
              <p className="mb-3 text-sm font-semibold text-slate-800">Catatan Sistem</p>
              <div className="space-y-3">
                {data.additionalData.notes.map((note) => (
                  <div key={note} className="flex gap-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
                    <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                    <p>{note}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
                <Wallet className="h-4 w-4 text-rose-600" />
                Riwayat Potongan
              </div>
              {data.deductions.records.length === 0 ? (
                <EmptyState message="Belum ada riwayat potongan gaji." />
              ) : (
                <div className="space-y-3">
                  {data.deductions.records.map((record) => (
                    <div key={record.id} className="rounded-2xl border border-slate-200 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{record.type}</p>
                          <p className="text-sm text-slate-500">{record.reason}</p>
                        </div>
                        <p className="text-base font-semibold text-rose-600">{formatCurrency(record.amount)}</p>
                      </div>
                      <div className="mt-3 grid gap-2 text-sm text-slate-500 md:grid-cols-2">
                        <p>Periode: {formatMonthYear(record.month, record.year)}</p>
                        <p>Tanggal: {formatDate(record.date)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
                <Wallet className="h-4 w-4 text-emerald-600" />
                Riwayat Tunjangan
              </div>
              {data.allowances.records.length === 0 ? (
                <EmptyState message="Belum ada riwayat tunjangan." />
              ) : (
                <div className="space-y-3">
                  {data.allowances.records.map((record) => (
                    <div key={record.id} className="rounded-2xl border border-slate-200 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{record.type}</p>
                          <p className="text-sm text-slate-500">{formatMonthYear(record.month, record.year)}</p>
                        </div>
                        <p className="text-base font-semibold text-emerald-600">{formatCurrency(record.amount)}</p>
                      </div>
                      <p className="mt-3 text-sm text-slate-500">Tanggal pencatatan: {formatDate(record.date)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Data Terkait Lainnya"
        subtitle="Mencakup riwayat gaji, permintaan cuti, lembur, audit perubahan, serta status modul penilaian kinerja dan disiplin."
      >
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Total Gaji Bersih"
              value={formatCurrency(data.payroll.summary.totalNetSalaryPaid)}
              accent="border-blue-200 bg-blue-50 text-blue-700"
            />
            <StatCard
              label="Total Tunjangan"
              value={formatCurrency(data.payroll.summary.totalAllowances)}
              accent="border-emerald-200 bg-emerald-50 text-emerald-700"
            />
            <StatCard
              label="Total Potongan"
              value={formatCurrency(data.payroll.summary.totalDeductions)}
              accent="border-rose-200 bg-rose-50 text-rose-700"
            />
            <StatCard
              label="Nilai Lembur"
              value={formatCurrency(data.payroll.summary.totalOvertimeAmount)}
              accent="border-violet-200 bg-violet-50 text-violet-700"
            />
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
                <FileText className="h-4 w-4 text-blue-600" />
                Riwayat Gaji
              </div>
              {data.payroll.records.length === 0 ? (
                <EmptyState message="Belum ada riwayat payroll." />
              ) : (
                <div className="space-y-3">
                  {data.payroll.records.map((record) => (
                    <div key={record.id} className="rounded-2xl border border-slate-200 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{formatMonthYear(record.month, record.year)}</p>
                          <p className="text-sm text-slate-500">
                            Hadir {record.daysPresent} hari • Absen {record.daysAbsent} hari • Telat {record.daysLate} kali
                          </p>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusClasses(record.status)}`}>
                          {record.status}
                        </span>
                      </div>
                      <div className="mt-3 grid gap-2 text-sm text-slate-600 md:grid-cols-2">
                        <p>Gaji bersih: {formatCurrency(record.netSalary)}</p>
                        <p>Total potongan: {formatCurrency(record.totalDeductions)}</p>
                        <p>Total tunjangan: {formatCurrency(record.totalAllowances)}</p>
                        <p>Lembur: {record.overtimeHours} jam / {formatCurrency(record.overtimeAmount)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-6">
              <div>
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
                  <CalendarDays className="h-4 w-4 text-violet-600" />
                  Riwayat Cuti dan Izin
                </div>
                {data.related.leaveRequests.length === 0 ? (
                  <EmptyState message="Belum ada permintaan cuti/izin." />
                ) : (
                  <div className="space-y-3">
                    {data.related.leaveRequests.map((leave) => (
                      <div key={leave.id} className="rounded-2xl border border-slate-200 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">{leave.type}</p>
                            <p className="text-sm text-slate-500">
                              {formatDate(leave.startDate)} - {formatDate(leave.endDate)}
                            </p>
                          </div>
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusClasses(leave.status)}`}>
                            {leave.status}
                          </span>
                        </div>
                        <p className="mt-3 text-sm text-slate-600">{leave.reason}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
                  <CalendarDays className="h-4 w-4 text-amber-600" />
                  Riwayat Lembur
                </div>
                {data.related.overtimeRequests.length === 0 ? (
                  <EmptyState message="Belum ada permintaan lembur." />
                ) : (
                  <div className="space-y-3">
                    {data.related.overtimeRequests.map((request) => (
                      <div key={request.id} className="rounded-2xl border border-slate-200 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">{formatDate(request.date)}</p>
                            <p className="text-sm text-slate-500">
                              {formatDateTime(request.start)} - {formatDateTime(request.end)}
                            </p>
                          </div>
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusClasses(request.status)}`}>
                            {request.status}
                          </span>
                        </div>
                        <p className="mt-3 text-sm text-slate-600">{request.reason || "-"}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
                <ShieldAlert className="h-4 w-4 text-slate-700" />
                Audit Perubahan
              </div>
              {data.related.auditLogs.length === 0 ? (
                <EmptyState message="Belum ada audit log terkait karyawan." />
              ) : (
                <div className="space-y-3">
                  {data.related.auditLogs.map((log) => (
                    <div key={log.id} className="rounded-2xl border border-slate-200 p-4">
                      <p className="text-sm font-semibold text-slate-900">{log.action}</p>
                      <p className="mt-1 text-xs text-slate-500">{formatDateTime(log.createdAt)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="grid gap-4">
              <div className="rounded-2xl border border-slate-200 p-4">
                <p className="text-sm font-semibold text-slate-800">Penilaian Kinerja</p>
                {data.additionalData.performanceReviews.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-500">Belum ada modul atau data penilaian kinerja yang tersimpan.</p>
                ) : null}
              </div>
              <div className="rounded-2xl border border-slate-200 p-4">
                <p className="text-sm font-semibold text-slate-800">Catatan Disiplin</p>
                {data.additionalData.disciplineNotes.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-500">Belum ada modul atau data catatan disiplin yang tersimpan.</p>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
