"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { formatCurrency, formatDate } from "@/lib/utils";

interface Advance {
  id: string;
  employeeId: string;
  employee?: {
    name: string;
    employeeId: string;
  };
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

export default function AdvanceHistory() {
  const { data: session } = useSession();
  const [advances, setAdvances] = useState<Advance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [queryAdvanceId, setQueryAdvanceId] = useState<string | null>(null);
  const [highlightAdvanceId, setHighlightAdvanceId] = useState<string | null>(null);

  const fetchAdvances = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/payroll/advances`);
      if (!response.ok) {
        throw new Error("Gagal mengambil data riwayat kasbon");
      }
      
      const data = await response.json();
      setAdvances(data);
    } catch (err: any) {
      setError(err.message || "Terjadi kesalahan saat mengambil data riwayat kasbon");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (session?.user) {
      fetchAdvances();
    }
  }, [session]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const aid = params.get('advanceId');
      if (aid) setQueryAdvanceId(aid);
    }
  }, []);

  useEffect(() => {
    if (queryAdvanceId && advances.length > 0) {
      const el = document.getElementById(`advance-history-row-${queryAdvanceId}`);
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

  if (!session?.user) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Silakan login untuk melihat riwayat kasbon Anda.</p>
      </div>
    );
  }

  return (
    <div className="bg-white shadow rounded-lg">
      <div className="px-4 py-5 sm:p-6">
        <div className="sm:flex sm:items-center sm:justify-between mb-6">
          <div>
            <h2 className="text-lg font-medium text-gray-900">Riwayat Kasbon</h2>
            <p className="mt-1 text-sm text-gray-500">
              Lihat riwayat pengajuan dan status kasbon Anda
            </p>
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
            <h3 className="mt-2 text-sm font-medium text-gray-900">Tidak ada riwayat kasbon</h3>
            <p className="mt-1 text-sm text-gray-500">
              Anda belum pernah mengajukan kasbon
            </p>
          </div>
        ) : (
          <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
            {/* Desktop Table View */}
            <table className="min-w-full divide-y divide-gray-300 hidden md:table">
              <thead className="bg-gray-50">
                <tr>
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
                  <tr key={advance.id} id={`advance-history-row-${advance.id}`} className={highlightAdvanceId === advance.id ? 'bg-indigo-50' : ''}>
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

            {/* Mobile Card View */}
            <div className="md:hidden space-y-4 p-4 bg-gray-50">
              {advances.map((advance) => (
                <div 
                  key={advance.id} 
                  id={`advance-history-card-${advance.id}`}
                  className={`bg-white p-4 rounded-lg shadow space-y-3 ${highlightAdvanceId === advance.id ? 'ring-2 ring-indigo-500 bg-indigo-50' : ''}`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-lg font-bold text-gray-900">{formatCurrency(advance.amount)}</span>
                      <p className="text-xs text-gray-500 mt-1">
                        {formatDate(advance.createdAt)}
                      </p>
                    </div>
                    {getStatusBadge(advance.status)}
                  </div>
                  
                  <div className="border-t border-gray-100 pt-3 space-y-2">
                    <div>
                      <p className="text-xs font-medium text-gray-500 uppercase">Alasan</p>
                      <p className="text-sm text-gray-900 mt-0.5">{advance.reason}</p>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs font-medium text-gray-500 uppercase">Periode</p>
                        <p className="text-sm text-gray-900 mt-0.5">{getMonthName(advance.month)} {advance.year}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-gray-500 uppercase">Pemotongan</p>
                        <p className="text-sm text-gray-900 mt-0.5">
                          {advance.status === "APPROVED" && advance.deductionMonth && advance.deductionYear ? (
                            <span>{getMonthName(advance.deductionMonth)} {advance.deductionYear}</span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </p>
                      </div>
                    </div>
                    
                    {advance.status === "REJECTED" && advance.rejectionReason && (
                      <div className="bg-red-50 p-2 rounded text-xs text-red-700 mt-2">
                        <span className="font-semibold">Alasan Penolakan:</span> {advance.rejectionReason}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
