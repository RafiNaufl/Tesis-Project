"use client";

import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import { id } from "date-fns/locale";
// import { useRouter } from "next/navigation";
// import { useSession } from "next-auth/react";
import { toast } from "react-hot-toast";

type LeaveStatus = "PENDING" | "APPROVED" | "REJECTED";

interface Leave {
  id: string;
  employee: {
    id: string;
    employeeId: string;
    user: {
      name: string;
    };
  };
  startDate: string;
  endDate: string;
  reason: string;
  type: string;
  status: LeaveStatus;
  createdAt: string;
  approvedBy: string | null;
  approvedAt: string | null;
}

interface LeaveListProps {
  isAdmin?: boolean;
  refreshTrigger?: number; // Prop untuk memicu refresh data
}

export default function LeaveList({ isAdmin = false, refreshTrigger = 0 }: LeaveListProps) {
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<LeaveStatus | "ALL">("ALL");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  // const router = useRouter();
  // const { data: session } = useSession();

  const fetchLeaves = useCallback(async () => {
    setIsLoading(true);
    try {
      const endpoint = isAdmin ? "/api/leave/admin" : "/api/leave";
      const response = await fetch(endpoint, {
        // Menambahkan cache: 'no-store' untuk memastikan data selalu fresh
        cache: 'no-store',
      });
      
      if (!response.ok) {
        throw new Error("Gagal mengambil data cuti");
      }
      
      const data = await response.json();
      setLeaves(data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Terjadi kesalahan");
    } finally {
      setIsLoading(false);
    }
  }, [isAdmin]);

  // Menggunakan effect untuk memantau perubahan refreshTrigger
  useEffect(() => {
    fetchLeaves();
  }, [fetchLeaves, refreshTrigger]);

  useEffect(() => {
    try {
      const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
      const id = params.get('selectedId');
      if (id) setSelectedId(id);
    } catch (error) {
      console.warn('Failed to parse selectedId from query', error);
    }
  }, []);

  useEffect(() => {
    if (selectedId && leaves.length > 0) {
      const el = document.getElementById(`leave-row-${selectedId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setHighlightId(selectedId);
        setTimeout(() => setHighlightId(null), 3000);
      }
    }
  }, [selectedId, leaves]);

  const handleUpdateStatus = async (id: string, status: LeaveStatus) => {
    try {
      const response = await fetch(`/api/leave/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) {
        throw new Error("Gagal memperbarui status cuti");
      }

      toast.success(`Permohonan cuti berhasil ${status === "APPROVED" ? "disetujui" : "ditolak"}`);
      fetchLeaves(); // Refresh data setelah update
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Terjadi kesalahan");
    }
  };

  const formatDateRange = (start: string, end: string) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    
    if (startDate.toDateString() === endDate.toDateString()) {
      return format(startDate, "dd MMMM yyyy", { locale: id });
    }
    
    return `${format(startDate, "dd MMM yyyy", { locale: id })} - ${format(endDate, "dd MMM yyyy", { locale: id })}`;
  };

  const calculateDuration = (start: string, end: string) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return `${diffDays} hari`;
  };

  const getLeaveTypeName = (type: string) => {
    const typeMap: Record<string, string> = {
      SICK: "Sakit",
      VACATION: "Liburan",
      PERSONAL: "Pribadi",
      OTHER: "Lainnya",
    };
    return typeMap[type] || type;
  };

  const getStatusBadgeColor = (status: LeaveStatus) => {
    const colorMap: Record<LeaveStatus, string> = {
      PENDING: "bg-yellow-100 text-yellow-800",
      APPROVED: "bg-green-100 text-green-800",
      REJECTED: "bg-red-100 text-red-800",
    };
    return colorMap[status];
  };

  const filteredLeaves = filter === "ALL" 
    ? leaves 
    : leaves.filter(leave => leave.status === filter);

  if (isLoading && leaves.length === 0) {
    return (
      <div className="flex justify-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="p-4 border-b flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-lg font-semibold">
          {isAdmin ? "Permohonan Cuti Karyawan" : "Riwayat Permohonan Cuti"}
        </h2>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <button
            onClick={() => setFilter("ALL")}
            className={`px-3 py-1 text-sm rounded-full transition-colors ${
              filter === "ALL" ? "bg-blue-600 text-white" : "bg-gray-100 hover:bg-gray-200"
            }`}
          >
            Semua
          </button>
          <button
            onClick={() => setFilter("PENDING")}
            className={`px-3 py-1 text-sm rounded-full ${
              filter === "PENDING" ? "bg-yellow-600 text-white" : "bg-gray-100"
            }`}
          >
            Menunggu
          </button>
          <button
            onClick={() => setFilter("APPROVED")}
            className={`px-3 py-1 text-sm rounded-full ${
              filter === "APPROVED" ? "bg-green-600 text-white" : "bg-gray-100"
            }`}
          >
            Disetujui
          </button>
          <button
            onClick={() => setFilter("REJECTED")}
            className={`px-3 py-1 text-sm rounded-full ${
              filter === "REJECTED" ? "bg-red-600 text-white" : "bg-gray-100"
            }`}
          >
            Ditolak
          </button>
          
          {/* Button untuk refresh manual */}
          <button
            onClick={() => fetchLeaves()}
            className="px-3 py-1 text-sm rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
            title="Segarkan data"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      {isLoading && (
        <div className="p-4 text-center text-sm text-gray-500">
          <div className="inline-block animate-pulse">Memperbarui data...</div>
        </div>
      )}

      {!isLoading && filteredLeaves.length === 0 ? (
        <div className="p-8 text-center text-gray-500">
          Tidak ada permohonan cuti {filter !== "ALL" ? `dengan status ${filter.toLowerCase()}` : ""}
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {isAdmin && <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Karyawan</th>}
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tanggal</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Durasi</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Jenis</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Alasan</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  {isAdmin && <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Aksi</th>}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredLeaves.map((leave) => (
                  <tr key={leave.id} id={`leave-row-${leave.id}`} className={highlightId === leave.id ? 'bg-indigo-50' : ''}>
                    {isAdmin && (
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{leave.employee.user.name}</div>
                        <div className="text-sm text-gray-500">{leave.employee.employeeId}</div>
                      </td>
                    )}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{formatDateRange(leave.startDate, leave.endDate)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{calculateDuration(leave.startDate, leave.endDate)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{getLeaveTypeName(leave.type)}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900 line-clamp-2">{leave.reason}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadgeColor(leave.status)}`}>
                        {leave.status === "PENDING" && "Menunggu"}
                        {leave.status === "APPROVED" && "Disetujui"}
                        {leave.status === "REJECTED" && "Ditolak"}
                      </span>
                    </td>
                    {isAdmin && leave.status === "PENDING" && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleUpdateStatus(leave.id, "APPROVED")}
                            className="text-green-600 hover:text-green-900 bg-green-100 px-2 py-1 rounded"
                          >
                            Setujui
                          </button>
                          <button
                            onClick={() => handleUpdateStatus(leave.id, "REJECTED")}
                            className="text-red-600 hover:text-red-900 bg-red-100 px-2 py-1 rounded"
                          >
                            Tolak
                          </button>
                        </div>
                      </td>
                    )}
                    {isAdmin && leave.status !== "PENDING" && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {leave.approvedAt && (
                          <span>
                            {leave.status === "APPROVED" ? "Disetujui" : "Ditolak"} pada{" "}
                            {format(new Date(leave.approvedAt), "dd MMM yyyy", { locale: id })}
                          </span>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden space-y-4 p-4">
            {filteredLeaves.map((leave) => (
              <div 
                key={leave.id} 
                className={`bg-white border rounded-lg shadow-sm p-4 ${highlightId === leave.id ? 'ring-2 ring-indigo-500' : ''}`}
                id={`leave-card-${leave.id}`}
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    {isAdmin && (
                      <div className="mb-1">
                        <div className="font-semibold text-gray-900">{leave.employee.user.name}</div>
                        <div className="text-xs text-gray-500">{leave.employee.employeeId}</div>
                      </div>
                    )}
                    <div className="text-sm font-medium text-gray-900">
                      {getLeaveTypeName(leave.type)}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {formatDateRange(leave.startDate, leave.endDate)} ({calculateDuration(leave.startDate, leave.endDate)})
                    </div>
                  </div>
                  <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadgeColor(leave.status)}`}>
                    {leave.status === "PENDING" && "Menunggu"}
                    {leave.status === "APPROVED" && "Disetujui"}
                    {leave.status === "REJECTED" && "Ditolak"}
                  </span>
                </div>
                
                <div className="text-sm text-gray-700 mb-3 bg-gray-50 p-2 rounded">
                  {leave.reason}
                </div>

                {isAdmin && leave.status === "PENDING" ? (
                  <div className="flex space-x-2 mt-3 pt-3 border-t">
                    <button
                      onClick={() => handleUpdateStatus(leave.id, "APPROVED")}
                      className="flex-1 text-center text-green-700 bg-green-100 hover:bg-green-200 py-2 rounded text-sm font-medium transition-colors"
                    >
                      Setujui
                    </button>
                    <button
                      onClick={() => handleUpdateStatus(leave.id, "REJECTED")}
                      className="flex-1 text-center text-red-700 bg-red-100 hover:bg-red-200 py-2 rounded text-sm font-medium transition-colors"
                    >
                      Tolak
                    </button>
                  </div>
                ) : (
                  isAdmin && leave.approvedAt && (
                    <div className="text-xs text-gray-500 mt-2 text-right">
                      {leave.status === "APPROVED" ? "Disetujui" : "Ditolak"} pada{" "}
                      {format(new Date(leave.approvedAt), "dd MMM yyyy", { locale: id })}
                    </div>
                  )
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
} 
