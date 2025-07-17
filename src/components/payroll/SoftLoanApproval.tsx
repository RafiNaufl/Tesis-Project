"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { formatCurrency, formatDate } from "@/lib/utils";

interface SoftLoan {
  id: string;
  employeeId: string;
  employee: {
    name: string;
    employeeId: string;
  };
  totalAmount: number;
  monthlyAmount: number;
  remainingAmount: number;
  durationMonths: number;
  startMonth: number;
  startYear: number;
  reason: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export default function SoftLoanApproval() {
  const { data: session } = useSession();
  const [softLoans, setSoftLoans] = useState<SoftLoan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [selectedLoans, setSelectedLoans] = useState<string[]>([]);
  const [filterStatus, setFilterStatus] = useState("PENDING");

  const fetchSoftLoans = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filterStatus) {
        params.append("status", filterStatus);
      }
      
      const response = await fetch(`/api/payroll/soft-loans?${params.toString()}`);
      if (!response.ok) {
        throw new Error("Gagal mengambil data pinjaman lunak");
      }
      
      const data = await response.json();
      setSoftLoans(data);
    } catch (err: any) {
      setError(err.message || "Terjadi kesalahan saat mengambil data pinjaman lunak");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (session?.user?.role === "ADMIN") {
      fetchSoftLoans();
    }
  }, [session, filterStatus]);

  const handleApproval = async (loanId: string, action: "APPROVED" | "REJECTED", reason?: string) => {
    try {
      setProcessingId(loanId);
      setError(null);

      const response = await fetch(`/api/payroll/soft-loans/${loanId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: action,
          rejectionReason: reason,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Gagal ${action === "APPROVED" ? "menyetujui" : "menolak"} pinjaman lunak`);
      }

      // Refresh data
      await fetchSoftLoans();
      
      // Remove from selected if it was selected
      setSelectedLoans(prev => prev.filter(id => id !== loanId));
    } catch (err: any) {
      setError(err.message || `Terjadi kesalahan saat ${action === "APPROVED" ? "menyetujui" : "menolak"} pinjaman lunak`);
    } finally {
      setProcessingId(null);
    }
  };

  const handleBulkApproval = async (action: "APPROVED" | "REJECTED") => {
    if (selectedLoans.length === 0) {
      setError("Pilih minimal satu pinjaman lunak untuk diproses");
      return;
    }

    try {
      setError(null);
      const promises = selectedLoans.map(id => 
        handleApproval(id, action)
      );
      
      await Promise.all(promises);
      setSelectedLoans([]);
    } catch (err: any) {
      setError(err.message || `Terjadi kesalahan saat memproses pinjaman lunak secara massal`);
    }
  };

  const handleSelectAll = () => {
    if (selectedLoans.length === softLoans.length) {
      setSelectedLoans([]);
    } else {
      setSelectedLoans(softLoans.map(loan => loan.id));
    }
  };

  const handleSelectLoan = (loanId: string) => {
    setSelectedLoans(prev => {
      if (prev.includes(loanId)) {
        return prev.filter(id => id !== loanId);
      } else {
        return [...prev, loanId];
      }
    });
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      PENDING: { bg: "bg-yellow-100", text: "text-yellow-800", label: "Menunggu Persetujuan" },
      APPROVED: { bg: "bg-green-100", text: "text-green-800", label: "Disetujui" },
      REJECTED: { bg: "bg-red-100", text: "text-red-800", label: "Ditolak" },
      COMPLETED: { bg: "bg-blue-100", text: "text-blue-800", label: "Selesai" },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.PENDING;
    
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
        {config.label}
      </span>
    );
  };

  const getMonthName = (month: number) => {
    const months = [
      "Januari", "Februari", "Maret", "April", "Mei", "Juni",
      "Juli", "Agustus", "September", "Oktober", "November", "Desember"
    ];
    return months[month - 1] || "";
  };

  if (session?.user?.role !== "ADMIN") {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Anda tidak memiliki akses untuk melihat halaman ini.</p>
      </div>
    );
  }

  return (
    <div className="bg-white shadow rounded-lg">
      <div className="px-4 py-5 sm:p-6">
        <div className="sm:flex sm:items-center sm:justify-between mb-6">
          <div>
            <h2 className="text-lg font-medium text-gray-900">Persetujuan Pinjaman Lunak</h2>
            <p className="mt-1 text-sm text-gray-500">
              Kelola permohonan pinjaman lunak dari karyawan
            </p>
          </div>
          
          <div className="mt-4 sm:mt-0 sm:flex sm:space-x-3">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="block w-full sm:w-auto rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            >
              <option value="">Semua Status</option>
              <option value="PENDING">Menunggu Persetujuan</option>
              <option value="APPROVED">Disetujui</option>
              <option value="REJECTED">Ditolak</option>
              <option value="COMPLETED">Selesai</option>
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

        {selectedLoans.length > 0 && filterStatus === "PENDING" && (
          <div className="mb-4 bg-blue-50 border border-blue-200 rounded-md p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-blue-700">
                {selectedLoans.length} pinjaman lunak dipilih
              </p>
              <div className="flex space-x-2">
                <button
                  onClick={() => handleBulkApproval("APPROVED")}
                  className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                >
                  Setujui Semua
                </button>
                <button
                  onClick={() => handleBulkApproval("REJECTED")}
                  className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                >
                  Tolak Semua
                </button>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            <p className="mt-2 text-sm text-gray-500">Memuat data pinjaman lunak...</p>
          </div>
        ) : softLoans.length === 0 ? (
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">Tidak ada pinjaman lunak</h3>
            <p className="mt-1 text-sm text-gray-500">
              {filterStatus ? `Tidak ada pinjaman lunak dengan status ${filterStatus.toLowerCase()}` : "Belum ada permohonan pinjaman lunak dari karyawan"}
            </p>
          </div>
        ) : (
          <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
            <table className="min-w-full divide-y divide-gray-300">
              <thead className="bg-gray-50">
                <tr>
                  {filterStatus === "PENDING" && (
                    <th scope="col" className="relative w-12 px-6 sm:w-16 sm:px-8">
                      <input
                        type="checkbox"
                        className="absolute left-4 top-1/2 -mt-2 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        checked={selectedLoans.length === softLoans.length && softLoans.length > 0}
                        onChange={handleSelectAll}
                      />
                    </th>
                  )}
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Karyawan
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total Pinjaman
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Potongan/Bulan
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Durasi
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Mulai
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Alasan
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tanggal Pengajuan
                  </th>
                  {filterStatus === "PENDING" && (
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Aksi
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {softLoans.map((loan) => (
                  <tr key={loan.id} className={selectedLoans.includes(loan.id) ? "bg-gray-50" : ""}>
                    {filterStatus === "PENDING" && (
                      <td className="relative w-12 px-6 sm:w-16 sm:px-8">
                        <input
                          type="checkbox"
                          className="absolute left-4 top-1/2 -mt-2 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                          checked={selectedLoans.includes(loan.id)}
                          onChange={() => handleSelectLoan(loan.id)}
                        />
                      </td>
                    )}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{loan.employee.name}</div>
                          <div className="text-sm text-gray-500">ID: {loan.employee.employeeId}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div>
                        <div className="font-medium">{formatCurrency(loan.totalAmount)}</div>
                        {loan.status === "APPROVED" && loan.remainingAmount < loan.totalAmount && (
                          <div className="text-xs text-gray-500">
                            Sisa: {formatCurrency(loan.remainingAmount)}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatCurrency(loan.monthlyAmount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {loan.durationMonths} bulan
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {getMonthName(loan.startMonth)} {loan.startYear}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 max-w-xs">
                      <div className="truncate" title={loan.reason}>
                        {loan.reason}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(loan.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(loan.createdAt)}
                    </td>
                    {filterStatus === "PENDING" && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleApproval(loan.id, "APPROVED")}
                            disabled={processingId === loan.id}
                            className="text-green-600 hover:text-green-900 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {processingId === loan.id ? "Memproses..." : "Setujui"}
                          </button>
                          <button
                            onClick={() => handleApproval(loan.id, "REJECTED")}
                            disabled={processingId === loan.id}
                            className="text-red-600 hover:text-red-900 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Tolak
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}