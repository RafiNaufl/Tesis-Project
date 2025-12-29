"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { formatCurrency, formatDate } from "@/lib/utils";

interface Advance {
  id: string;
  employeeId: string;
  employeeName: string;
  empId: string;
  amount: number;
  reason: string;
  month: number;
  year: number;
  status: string;
  deductionMonth?: number;
  deductionYear?: number;
  rejectionReason?: string;
  createdAt: string;
  deductedAt?: string;
}

export default function AdvanceReport() {
  const { data: session } = useSession();
  const [advances, setAdvances] = useState<Advance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [monthFilter, setMonthFilter] = useState<number>(0);
  const [yearFilter, setYearFilter] = useState<number>(new Date().getFullYear());
  const [queryAdvanceId, setQueryAdvanceId] = useState<string | null>(null);
  const [highlightAdvanceId, setHighlightAdvanceId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(10);

  const fetchAdvances = useCallback(async () => {
    try {
      setLoading(true);
      let url = `/api/payroll/advances?`;
      
      if (statusFilter !== "all") {
        url += `status=${statusFilter}&`;
      }
      
      if (monthFilter > 0) {
        url += `month=${monthFilter}&`;
      }
      
      url += `year=${yearFilter}`;
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error("Gagal mengambil data laporan kasbon");
      }
      
      const data = await response.json();
      setAdvances(data);
    } catch (err: any) {
      setError(err.message || "Terjadi kesalahan saat mengambil data laporan kasbon");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, monthFilter, yearFilter]);

  useEffect(() => {
    if (session?.user) {
      fetchAdvances();
    }
  }, [session, fetchAdvances]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const aid = params.get('advanceId');
      if (aid) setQueryAdvanceId(aid);
    }
  }, []);

  useEffect(() => {
    if (queryAdvanceId && advances.length > 0) {
      const el = document.getElementById(`advance-report-row-${queryAdvanceId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setHighlightAdvanceId(queryAdvanceId);
        setTimeout(() => setHighlightAdvanceId(null), 3000);
      }
    }
  }, [queryAdvanceId, advances]);

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      PENDING: { bg: "bg-yellow-100", text: "text-yellow-800", label: "Menunggu Persetujuan" },
      APPROVED: { bg: "bg-green-100", text: "text-green-800", label: "Disetujui" },
      REJECTED: { bg: "bg-red-100", text: "text-red-800", label: "Ditolak" },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.PENDING;
    
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
        {config.label}
      </span>
    );
  };

  const getMonthName = (month: number) => {
    const monthNames = [
      "Januari", "Februari", "Maret", "April", "Mei", "Juni",
      "Juli", "Agustus", "September", "Oktober", "November", "Desember"
    ];
    return monthNames[month - 1];
  };

  const generateMonthOptions = () => {
    const monthNames = [
      "Januari", "Februari", "Maret", "April", "Mei", "Juni",
      "Juli", "Agustus", "September", "Oktober", "November", "Desember"
    ];
    
    return [
      <option key="all" value="0">Semua Bulan</option>,
      ...monthNames.map((month, index) => (
        <option key={index + 1} value={index + 1}>
          {month}
        </option>
      ))
    ];
  };

  const generateYearOptions = () => {
    const currentYear = new Date().getFullYear();
    const years = [];
    
    for (let i = currentYear - 2; i <= currentYear + 1; i++) {
      years.push(i);
    }
    
    return years.map(year => (
      <option key={year} value={year}>
        {year}
      </option>
    ));
  };

  const exportToCSV = () => {
    if (advances.length === 0) return;

    const headers = [
      "ID Karyawan", 
      "Nama Karyawan", 
      "Jumlah", 
      "Alasan", 
      "Periode", 
      "Status", 
      "Bulan Pemotongan", 
      "Tahun Pemotongan", 
      "Alasan Penolakan", 
      "Tanggal Pengajuan"
    ];

    const statusMap: Record<string, string> = {
      PENDING: "Menunggu Persetujuan",
      APPROVED: "Disetujui",
      REJECTED: "Ditolak"
    };

    const csvRows = [];
    csvRows.push(headers.join(","));

    for (const advance of advances) {
      const row = [
        advance.empId || "",
        `"${advance.employeeName || ""}"`,
        advance.amount,
        `"${advance.reason.replace(/"/g, '""')}"`,
        `${getMonthName(advance.month)} ${advance.year}`,
        statusMap[advance.status] || "",
        advance.deductionMonth ? getMonthName(advance.deductionMonth) : "",
        advance.deductionYear || "",
        `"${advance.rejectionReason?.replace(/"/g, '""') || ""}"`,
        formatDate(advance.createdAt)
      ];
      csvRows.push(row.join(","));
    }

    const csvString = csvRows.join("\n");
    const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    
    link.setAttribute("href", url);
    link.setAttribute("download", `laporan_kasbon_${yearFilter}_${monthFilter > 0 ? getMonthName(monthFilter) : 'semua_bulan'}.csv`);
    link.style.visibility = "hidden";
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!session?.user) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Silakan login untuk melihat laporan kasbon.</p>
      </div>
    );
  }

  return (
    <div className="bg-white shadow rounded-lg">
      <div className="px-4 py-5 sm:p-6">
        <div className="sm:flex sm:items-center sm:justify-between mb-6">
          <div>
            <h2 className="text-lg font-medium text-gray-900">Laporan Kasbon</h2>
            <p className="mt-1 text-sm text-gray-500">
              Lihat dan unduh laporan pengajuan kasbon karyawan
            </p>
          </div>
          <div className="mt-4 sm:mt-0">
            <button
              onClick={exportToCSV}
              disabled={advances.length === 0 || loading}
              className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white ${advances.length === 0 || loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'}`}
            >
              <svg className="-ml-1 mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Unduh CSV
            </button>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-y-4 sm:grid-cols-3 sm:gap-x-4">
          <div>
            <label htmlFor="status-filter" className="block text-sm font-medium text-gray-700">
              Status
            </label>
            <select
              id="status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
            >
              <option value="all">Semua Status</option>
              <option value="PENDING">Menunggu Persetujuan</option>
              <option value="APPROVED">Disetujui</option>
              <option value="REJECTED">Ditolak</option>
            </select>
          </div>

          <div>
            <label htmlFor="month-filter" className="block text-sm font-medium text-gray-700">
              Bulan
            </label>
            <select
              id="month-filter"
              value={monthFilter}
              onChange={(e) => setMonthFilter(parseInt(e.target.value))}
              className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
            >
              {generateMonthOptions()}
            </select>
          </div>

          <div>
            <label htmlFor="year-filter" className="block text-sm font-medium text-gray-700">
              Tahun
            </label>
            <select
              id="year-filter"
              value={yearFilter}
              onChange={(e) => setYearFilter(parseInt(e.target.value))}
              className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
            >
              {generateYearOptions()}
            </select>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-md bg-red-50 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            <p className="mt-2 text-sm text-gray-500">Memuat data kasbon...</p>
          </div>
        ) : advances.length === 0 ? (
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">Tidak ada data kasbon</h3>
            <p className="mt-1 text-sm text-gray-500">
              Tidak ada data kasbon yang sesuai dengan filter yang dipilih
            </p>
          </div>
        ) : (
          <>
            {/* Mobile Card View */}
            <div className="md:hidden space-y-4">
              {advances.slice(0, visibleCount).map((advance) => (
                <div 
                  key={advance.id} 
                  id={`advance-report-card-${advance.id}`}
                  className={`bg-white border rounded-lg shadow-sm p-4 space-y-3 border-gray-200 ${highlightAdvanceId === advance.id ? 'ring-2 ring-indigo-500' : ''}`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-base font-bold text-gray-900">{advance.employeeName}</h3>
                      <p className="text-sm text-gray-500">{advance.empId}</p>
                    </div>
                    <div className="flex-shrink-0">
                      {getStatusBadge(advance.status)}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-gray-500 text-xs">Jumlah</p>
                      <p className="font-semibold text-gray-900">{formatCurrency(advance.amount)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">Periode</p>
                      <p className="font-medium">{getMonthName(advance.month)} {advance.year}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-gray-500 text-xs">Alasan</p>
                      <p className="text-gray-700">{advance.reason}</p>
                    </div>
                    {advance.status === "REJECTED" && advance.rejectionReason && (
                      <div className="col-span-2 bg-red-50 p-2 rounded text-xs text-red-700">
                        <strong>Ditolak:</strong> {advance.rejectionReason}
                      </div>
                    )}
                    {advance.status === "APPROVED" && advance.deductionMonth && (
                      <div className="col-span-2">
                        <p className="text-gray-500 text-xs">Jadwal Potong</p>
                        <p className="font-medium">{getMonthName(advance.deductionMonth)} {advance.deductionYear}</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              
              {advances.length > visibleCount && (
                <button
                  onClick={() => setVisibleCount(prev => prev + 10)}
                  className="w-full py-3 bg-gray-50 text-gray-600 font-medium rounded-lg border border-gray-200 hover:bg-gray-100 active:bg-gray-200 transition-colors min-h-[48px]"
                >
                  Muat Lebih Banyak ({advances.length - visibleCount} lagi)
                </button>
              )}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
              <table className="min-w-full divide-y divide-gray-300">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Karyawan
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Jumlah
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Alasan
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Periode
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Pemotongan
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tanggal Pengajuan
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {advances.map((advance) => (
                    <tr key={advance.id} id={`advance-report-row-${advance.id}`} className={highlightAdvanceId === advance.id ? 'bg-indigo-50' : ''}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div className="font-medium">{advance.employeeName}</div>
                        <div className="text-xs text-gray-500">{advance.empId}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatCurrency(advance.amount)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 max-w-xs">
                        <div className="truncate" title={advance.reason}>
                          {advance.reason}
                        </div>
                        {advance.status === "REJECTED" && advance.rejectionReason && (
                          <div className="mt-1 text-xs text-red-600">
                            Alasan penolakan: {advance.rejectionReason}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {getMonthName(advance.month)} {advance.year}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(advance.status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {advance.status === "APPROVED" && advance.deductionMonth && advance.deductionYear ? (
                          <span>{getMonthName(advance.deductionMonth)} {advance.deductionYear}</span>
                        ) : (
                          <span className="text-gray-500">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDate(advance.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
