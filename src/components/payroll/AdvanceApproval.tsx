"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { formatCurrency, formatDate } from "@/lib/utils";

interface Advance {
  id: string;
  employeeId: string;
  employee?: {
    name: string;
    employeeId: string;
  };
  employeeName?: string; // For raw query results
  empId?: string; // For raw query results
  amount: number;
  reason: string;
  month: number;
  year: number;
  status: string;
  deductionMonth?: number;
  deductionYear?: number;
  createdAt: string;
  updatedAt: string;
}

export default function AdvanceApproval() {
  const { data: session } = useSession();
  const [advances, setAdvances] = useState<Advance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [selectedAdvances, setSelectedAdvances] = useState<string[]>([]);
  const [filterStatus, setFilterStatus] = useState("PENDING");
  const [showDeductionModal, setShowDeductionModal] = useState(false);
  const [currentAdvance, setCurrentAdvance] = useState<string | null>(null);
  const [deductionMonth, setDeductionMonth] = useState<number>(new Date().getMonth() + 1);
  const [deductionYear, setDeductionYear] = useState<number>(new Date().getFullYear());
  const [rejectionReason, setRejectionReason] = useState<string>("");
  const [showRejectionModal, setShowRejectionModal] = useState(false);
  const [queryAdvanceId, setQueryAdvanceId] = useState<string | null>(null);
  const [highlightAdvanceId, setHighlightAdvanceId] = useState<string | null>(null);

  const fetchAdvances = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filterStatus) {
        params.append("status", filterStatus);
      }
      
      const response = await fetch(`/api/payroll/advances?${params.toString()}`);
      if (!response.ok) {
        throw new Error("Gagal mengambil data kasbon");
      }
      
      const data = await response.json();
      setAdvances(data);
    } catch (err: any) {
      setError(err.message || "Terjadi kesalahan saat mengambil data kasbon");
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => {
    if (session?.user?.role === "ADMIN") {
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
      const el = document.getElementById(`advance-approval-row-${queryAdvanceId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setHighlightAdvanceId(queryAdvanceId);
        setTimeout(() => setHighlightAdvanceId(null), 3000);
      }
    }
  }, [queryAdvanceId, advances]);

  const handleApproval = async (advanceId: string, action: "APPROVED" | "REJECTED", reason?: string) => {
    try {
      setProcessingId(advanceId);
      setError(null);

      const requestBody: any = {
        status: action,
      };

      if (action === "APPROVED") {
        requestBody.deductionMonth = deductionMonth;
        requestBody.deductionYear = deductionYear;
      } else if (action === "REJECTED") {
        requestBody.rejectionReason = reason || rejectionReason;
      }

      const response = await fetch(`/api/payroll/advances/${advanceId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Gagal ${action === "APPROVED" ? "menyetujui" : "menolak"} kasbon`);
      }

      // Reset modals
      setShowDeductionModal(false);
      setShowRejectionModal(false);
      setRejectionReason("");
      setCurrentAdvance(null);

      // Refresh data
      await fetchAdvances();
      
      // Remove from selected if it was selected
      setSelectedAdvances(prev => prev.filter(id => id !== advanceId));
    } catch (err: any) {
      setError(err.message || `Terjadi kesalahan saat ${action === "APPROVED" ? "menyetujui" : "menolak"} kasbon`);
    } finally {
      setProcessingId(null);
    }
  };

  const handleBulkApproval = async (action: "APPROVED" | "REJECTED") => {
    if (selectedAdvances.length === 0) {
      setError("Pilih minimal satu kasbon untuk diproses");
      return;
    }

    try {
      setError(null);
      const promises = selectedAdvances.map(id => 
        handleApproval(id, action)
      );
      
      await Promise.all(promises);
      setSelectedAdvances([]);
    } catch (err: any) {
      setError(err.message || `Terjadi kesalahan saat memproses kasbon secara massal`);
    }
  };

  const openApprovalModal = (advanceId: string) => {
    setCurrentAdvance(advanceId);
    setShowDeductionModal(true);
  };

  const openRejectionModal = (advanceId: string) => {
    setCurrentAdvance(advanceId);
    setShowRejectionModal(true);
  };

  const handleConfirmApproval = () => {
    if (currentAdvance) {
      handleApproval(currentAdvance, "APPROVED");
    }
  };

  const handleConfirmRejection = () => {
    if (currentAdvance) {
      handleApproval(currentAdvance, "REJECTED");
    }
  };

  const generateMonthOptions = () => {
    const months = [
      { value: 1, label: "Januari" },
      { value: 2, label: "Februari" },
      { value: 3, label: "Maret" },
      { value: 4, label: "April" },
      { value: 5, label: "Mei" },
      { value: 6, label: "Juni" },
      { value: 7, label: "Juli" },
      { value: 8, label: "Agustus" },
      { value: 9, label: "September" },
      { value: 10, label: "Oktober" },
      { value: 11, label: "November" },
      { value: 12, label: "Desember" },
    ];
    return months;
  };

  const generateYearOptions = () => {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let i = 0; i < 3; i++) {
      years.push(currentYear + i);
    }
    return years;
  };

  const handleSelectAll = () => {
    if (selectedAdvances.length === advances.length) {
      setSelectedAdvances([]);
    } else {
      setSelectedAdvances(advances.map(advance => advance.id));
    }
  };

  const handleSelectAdvance = (advanceId: string) => {
    setSelectedAdvances(prev => {
      if (prev.includes(advanceId)) {
        return prev.filter(id => id !== advanceId);
      } else {
        return [...prev, advanceId];
      }
    });
  };

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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
          <div>
            <h2 className="text-lg font-medium text-gray-900">Persetujuan Kasbon</h2>
            <p className="mt-1 text-sm text-gray-500">
              Kelola permohonan kasbon dari karyawan
            </p>
          </div>
          
          <div className="w-full sm:w-auto">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="block w-full sm:w-auto rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-base sm:text-sm min-h-[48px] py-2"
            >
              <option value="">Semua Status</option>
              <option value="PENDING">Menunggu Persetujuan</option>
              <option value="APPROVED">Disetujui</option>
              <option value="REJECTED">Ditolak</option>
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

        {selectedAdvances.length > 0 && filterStatus === "PENDING" && (
          <div className="mb-4 bg-blue-50 border border-blue-200 rounded-md p-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <p className="text-sm text-blue-700 font-medium">
                {selectedAdvances.length} kasbon dipilih
              </p>
              <div className="flex w-full sm:w-auto space-x-2">
                <button
                  onClick={() => handleBulkApproval("APPROVED")}
                  className="flex-1 sm:flex-none justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 min-h-[48px] touch-manipulation"
                >
                  Setujui Semua
                </button>
                <button
                  onClick={() => handleBulkApproval("REJECTED")}
                  className="flex-1 sm:flex-none justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 min-h-[48px] touch-manipulation"
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
            <p className="mt-2 text-sm text-gray-500">Memuat data kasbon...</p>
          </div>
        ) : advances.length === 0 ? (
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">Tidak ada kasbon</h3>
            <p className="mt-1 text-sm text-gray-500">
              {filterStatus ? `Tidak ada kasbon dengan status ${filterStatus.toLowerCase()}` : "Belum ada permohonan kasbon dari karyawan"}
            </p>
          </div>
        ) : (
          <>
            {/* Mobile Card View */}
            <div className="md:hidden space-y-4">
              {filterStatus === "PENDING" && (
                <div className="flex items-center justify-between bg-white p-4 rounded-lg border border-gray-200">
                  <label className="flex items-center space-x-3 w-full">
                    <input
                      type="checkbox"
                      className="h-5 w-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      checked={selectedAdvances.length === advances.length && advances.length > 0}
                      onChange={handleSelectAll}
                    />
                    <span className="text-sm font-medium text-gray-700">Pilih Semua</span>
                  </label>
                </div>
              )}
              
              {advances.map((advance) => (
                <div 
                  key={advance.id} 
                  id={`advance-approval-card-${advance.id}`}
                  className={`bg-white border rounded-lg shadow-sm p-4 space-y-3 ${selectedAdvances.includes(advance.id) ? 'bg-indigo-50 border-indigo-200' : 'border-gray-200'} ${highlightAdvanceId === advance.id ? 'ring-2 ring-indigo-500' : ''}`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex items-start space-x-3">
                      {filterStatus === "PENDING" && (
                        <input
                          type="checkbox"
                          className="mt-1 h-5 w-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                          checked={selectedAdvances.includes(advance.id)}
                          onChange={() => handleSelectAdvance(advance.id)}
                        />
                      )}
                      <div>
                        <h3 className="text-sm font-bold text-gray-900">{advance.employee?.name || advance.employeeName}</h3>
                        <p className="text-xs text-gray-500">{advance.employee?.employeeId || advance.empId}</p>
                      </div>
                    </div>
                    {getStatusBadge(advance.status)}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 text-sm border-t border-gray-100 pt-2">
                    <div>
                      <p className="text-xs text-gray-500">Jumlah</p>
                      <p className="font-semibold text-gray-900">{formatCurrency(advance.amount)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Periode</p>
                      <p className="font-medium text-gray-900">{advance.month}/{advance.year}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-xs text-gray-500">Alasan</p>
                      <p className="text-gray-700 text-sm italic">"{advance.reason}"</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-xs text-gray-500">Diajukan</p>
                      <p className="text-gray-700">{formatDate(advance.createdAt)}</p>
                    </div>
                  </div>

                  {filterStatus === "PENDING" && (
                    <div className="flex space-x-2 pt-2 border-t border-gray-100">
                      <button
                        onClick={() => openApprovalModal(advance.id)}
                        disabled={processingId === advance.id}
                        className="flex-1 justify-center items-center px-3 py-2 border border-transparent text-sm font-medium rounded text-white bg-green-600 hover:bg-green-700 focus:outline-none min-h-[48px] touch-manipulation disabled:opacity-50"
                      >
                        {processingId === advance.id ? "..." : "Setujui"}
                      </button>
                      <button
                        onClick={() => openRejectionModal(advance.id)}
                        disabled={processingId === advance.id}
                        className="flex-1 justify-center items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded text-red-700 bg-white hover:bg-red-50 focus:outline-none min-h-[48px] touch-manipulation disabled:opacity-50"
                      >
                        Tolak
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
              <table className="min-w-full divide-y divide-gray-300">
                <thead className="bg-gray-50">
                  <tr>
                    {filterStatus === "PENDING" && (
                      <th scope="col" className="relative w-12 px-6 sm:w-16 sm:px-8">
                        <input
                          type="checkbox"
                          className="absolute left-4 top-1/2 -mt-2 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                          checked={selectedAdvances.length === advances.length && advances.length > 0}
                          onChange={handleSelectAll}
                        />
                      </th>
                    )}
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
                  {advances.map((advance) => (
                    <tr key={advance.id} id={`advance-approval-row-${advance.id}`} className={`${selectedAdvances.includes(advance.id) ? 'bg-gray-50' : ''} ${highlightAdvanceId === advance.id ? 'bg-indigo-50' : ''}`}>
                      {filterStatus === "PENDING" && (
                        <td className="relative w-12 px-6 sm:w-16 sm:px-8">
                          <input
                            type="checkbox"
                            className="absolute left-4 top-1/2 -mt-2 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                            checked={selectedAdvances.includes(advance.id)}
                            onChange={() => handleSelectAdvance(advance.id)}
                          />
                        </td>
                      )}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {advance.employee?.name || advance.employeeName}
                            </div>
                            <div className="text-sm text-gray-500">
                              ID: {advance.employee?.employeeId || advance.empId}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatCurrency(advance.amount)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 max-w-xs">
                        <div className="truncate" title={advance.reason}>
                          {advance.reason}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {advance.month}/{advance.year}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(advance.status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDate(advance.createdAt)}
                      </td>
                      {filterStatus === "PENDING" && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex space-x-2">
                            <button
                              onClick={() => openApprovalModal(advance.id)}
                              disabled={processingId === advance.id}
                              className="text-green-600 hover:text-green-900 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {processingId === advance.id ? "Memproses..." : "Setujui"}
                            </button>
                            <button
                              onClick={() => openRejectionModal(advance.id)}
                              disabled={processingId === advance.id}
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
          </>
        )}
      </div>

      {/* Modal untuk pemilihan bulan dan tahun pemotongan */}
      {showDeductionModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
          <div className="relative mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3 text-center">
              <h3 className="text-lg leading-6 font-medium text-gray-900">Tentukan Tanggal Pemotongan</h3>
              <div className="mt-4 px-4 py-2">
                <p className="text-sm text-gray-500 mb-4">
                  Pilih bulan dan tahun untuk pemotongan kasbon ini
                </p>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1 text-left">Bulan Pemotongan</label>
                  <select
                    value={deductionMonth}
                    onChange={(e) => setDeductionMonth(parseInt(e.target.value))}
                    className="mt-1 block w-full pl-3 pr-10 py-3 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md min-h-[48px]"
                  >
                    {generateMonthOptions().map((month) => (
                      <option key={month.value} value={month.value}>
                        {month.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1 text-left">Tahun Pemotongan</label>
                  <select
                    value={deductionYear}
                    onChange={(e) => setDeductionYear(parseInt(e.target.value))}
                    className="mt-1 block w-full pl-3 pr-10 py-3 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md min-h-[48px]"
                  >
                    {generateYearOptions().map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex justify-end space-x-3 px-4 py-3 bg-gray-50 text-right sm:px-6 rounded-b-md">
                <button
                  onClick={() => setShowDeductionModal(false)}
                  className="inline-flex justify-center py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 min-h-[48px] items-center"
                >
                  Batal
                </button>
                <button
                  onClick={handleConfirmApproval}
                  className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 min-h-[48px] items-center"
                >
                  Setujui
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal untuk alasan penolakan */}
      {showRejectionModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-md overflow-y-auto h-full w-full z-50 flex items-center justify-center">
          <div className="relative mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3 text-center">
              <h3 className="text-lg leading-6 font-medium text-gray-900">Alasan Penolakan</h3>
              <div className="mt-4 px-4 py-2">
                <p className="text-sm text-gray-500 mb-4">
                  Berikan alasan mengapa kasbon ini ditolak
                </p>
                <div className="mb-4">
                  <textarea
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    rows={4}
                    className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 mt-1 block w-full text-base sm:text-sm border border-gray-300 rounded-md"
                    placeholder="Alasan penolakan..."
                  />
                </div>
              </div>
              <div className="flex justify-end space-x-3 px-4 py-3 bg-gray-50 text-right sm:px-6 rounded-b-md">
                <button
                  onClick={() => setShowRejectionModal(false)}
                  className="inline-flex justify-center py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  Batal
                </button>
                <button
                  onClick={handleConfirmRejection}
                  className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                >
                  Tolak
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
