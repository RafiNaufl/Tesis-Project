import { formatCurrency, formatDate } from "@/lib/utils";
import { Advance } from "./types";
import { useState } from "react";
import { ChevronDown, ChevronUp, Check, X, Trash2 } from "lucide-react";

interface AdvanceListProps {
  advances: Advance[];
  role: string;
  onSelect?: (id: string) => void;
  selectedIds?: string[];
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
  onDelete?: (id: string) => void;
  loading?: boolean;
}

export default function AdvanceList({
  advances,
  role,
  onSelect,
  selectedIds = [],
  onApprove,
  onReject,
  onDelete,
  loading
}: AdvanceListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      PENDING: "bg-yellow-100 text-yellow-800",
      APPROVED: "bg-blue-100 text-blue-800",
      REJECTED: "bg-red-100 text-red-800",
      ACTIVE: "bg-green-100 text-green-800",
      DEDUCTED: "bg-gray-100 text-gray-800",
      PAID: "bg-gray-100 text-gray-800",
    };
    const labels = {
      PENDING: "Menunggu",
      APPROVED: "Disetujui",
      REJECTED: "Ditolak",
      ACTIVE: "Aktif",
      DEDUCTED: "Dipotong",
      PAID: "Lunas",
    };
    return (
      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status as keyof typeof styles] || "bg-gray-100 text-gray-800"}`}>
        {labels[status as keyof typeof labels] || status}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (advances.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="mx-auto h-12 w-12 text-gray-400 flex items-center justify-center bg-gray-50 rounded-full mb-4">
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <h3 className="text-sm font-medium text-gray-900">Tidak ada data kasbon</h3>
        <p className="mt-1 text-sm text-gray-500">Belum ada pengajuan kasbon yang ditemukan.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      {/* Desktop Table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {role === "ADMIN" && onSelect && (
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-10">
                  <input
                    type="checkbox"
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    checked={advances.length > 0 && selectedIds.length === advances.length}
                    onChange={(e) => {
                      if (e.target.checked) {
                        advances.forEach(a => !selectedIds.includes(a.id) && onSelect(a.id));
                      } else {
                        selectedIds.forEach(id => onSelect(id)); // Toggle off
                      }
                    }}
                  />
                </th>
              )}
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Karyawan</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Jumlah</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Alasan</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Periode Potong</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tanggal</th>
              {role === "ADMIN" && <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Aksi</th>}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {advances.map((advance) => (
              <tr key={advance.id} className="hover:bg-gray-50 transition-colors">
                {role === "ADMIN" && onSelect && (
                  <td className="px-6 py-4 whitespace-nowrap">
                    <input
                      type="checkbox"
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      checked={selectedIds.includes(advance.id)}
                      onChange={() => onSelect(advance.id)}
                    />
                  </td>
                )}
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs">
                      {(advance.employeeName || advance.employee?.user?.name || "U").charAt(0)}
                    </div>
                    <div className="ml-3">
                      <div className="text-sm font-medium text-gray-900">{advance.employeeName || advance.employee?.user?.name || "Unknown"}</div>
                      <div className="text-xs text-gray-500">{advance.empId || advance.employee?.employeeId}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                  {formatCurrency(advance.amount)}
                </td>
                <td className="px-6 py-4 text-sm text-gray-900">
                  {advance.reason || "-"}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(0, advance.month - 1).toLocaleString('id-ID', { month: 'long' })} {advance.year}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {getStatusBadge(advance.status)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {formatDate(advance.createdAt)}
                </td>
                {role === "ADMIN" && (
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end space-x-2">
                      {advance.status === "PENDING" && (
                        <>
                          <button
                            onClick={() => onApprove?.(advance.id)}
                            className="text-green-600 hover:text-green-900 bg-green-50 p-1.5 rounded-full hover:bg-green-100 transition-colors"
                            title="Setujui"
                          >
                            <Check className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => onReject?.(advance.id)}
                            className="text-red-600 hover:text-red-900 bg-red-50 p-1.5 rounded-full hover:bg-red-100 transition-colors"
                            title="Tolak"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => onDelete?.(advance.id)}
                        className="text-gray-400 hover:text-red-600 p-1.5 rounded-full hover:bg-gray-100 transition-colors"
                        title="Hapus"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden divide-y divide-gray-100">
        {advances.map((advance) => (
          <div key={advance.id} className="p-4 bg-white">
            <div className="flex justify-between items-start mb-2">
              <div className="flex items-center space-x-3">
                 {role === "ADMIN" && onSelect && (
                    <input
                      type="checkbox"
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-5 w-5"
                      checked={selectedIds.includes(advance.id)}
                      onChange={() => onSelect(advance.id)}
                    />
                  )}
                <div>
                  <h3 className="text-sm font-medium text-gray-900">{advance.employee?.user?.name}</h3>
                  <p className="text-xs text-gray-500">{formatDate(advance.createdAt)}</p>
                </div>
              </div>
              {getStatusBadge(advance.status)}
            </div>
            
            <div className="mt-3 flex justify-between items-center">
              <div>
                <p className="text-xs text-gray-500">Jumlah</p>
                <p className="text-lg font-bold text-gray-900">{formatCurrency(advance.amount)}</p>
              </div>
              <button 
                onClick={() => toggleExpand(advance.id)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                {expandedId === advance.id ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
              </button>
            </div>

            {expandedId === advance.id && (
              <div className="mt-4 pt-4 border-t border-gray-100 text-sm space-y-3 animate-in slide-in-from-top-2 duration-200">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-xs text-gray-500">Bulan Potong</p>
                    <p className="font-medium">{new Date(0, advance.month - 1).toLocaleString('id-ID', { month: 'long' })} {advance.year}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">ID Karyawan</p>
                    <p className="font-medium">{advance.empId || advance.employee?.employeeId}</p>
                  </div>
                </div>
                
                {advance.reason && (
                  <div>
                    <p className="text-xs text-gray-500">Alasan</p>
                    <p className="text-gray-700 mt-1">{advance.reason}</p>
                  </div>
                )}

                {role === "ADMIN" && (
                  <div className="flex justify-end space-x-3 pt-2">
                     {advance.status === "PENDING" && (
                        <>
                          <button
                            onClick={() => onReject?.(advance.id)}
                            className="flex-1 py-2 px-4 border border-red-200 text-red-700 rounded-lg text-sm font-medium hover:bg-red-50"
                          >
                            Tolak
                          </button>
                          <button
                            onClick={() => onApprove?.(advance.id)}
                            className="flex-1 py-2 px-4 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
                          >
                            Setujui
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => onDelete?.(advance.id)}
                        className="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-gray-100"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
