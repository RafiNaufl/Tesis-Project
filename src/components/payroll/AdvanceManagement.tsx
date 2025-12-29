"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { formatCurrency } from "@/lib/utils";

interface Advance {
  id: string;
  employeeId: string;
  empId: string;
  employeeName: string;
  amount: number;
  month: number;
  year: number;
  status: string;
  createdAt: string;
  deductedAt?: string;
}

interface Employee {
  id: string;
  employeeId: string;
  user: {
    name: string;
    email: string;
  };
}

export default function AdvanceManagement() {
  const { data: session } = useSession();
  const [advances, setAdvances] = useState<Advance[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedAdvances, setSelectedAdvances] = useState<string[]>([]);
  const [selectedAdvanceId, setSelectedAdvanceId] = useState<string | null>(null);
  const [highlightAdvanceId, setHighlightAdvanceId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(10);
  
  // Form state
  const [formData, setFormData] = useState({
    employeeId: "",
    amount: "",
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    reason: "",
  });

  // Filters
  const [filters, setFilters] = useState({
    employeeId: "",
    month: "",
    year: "",
    status: "",
  });

  const fetchAdvances = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filters.employeeId) params.append("employeeId", filters.employeeId);
      if (filters.month) params.append("month", filters.month);
      if (filters.year) params.append("year", filters.year);
      if (filters.status) params.append("status", filters.status);

      const response = await fetch(`/api/payroll/advances?${params}`);
      if (response.ok) {
        const data = await response.json();
        setAdvances(data);
      }
    } catch (error) {
      console.error("Error fetching advances:", error);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const fetchEmployees = useCallback(async () => {
    try {
      const response = await fetch("/api/employees");
      if (response.ok) {
        const data = await response.json();
        setEmployees(data);
      }
    } catch (error) {
      console.error("Error fetching employees:", error);
    }
  }, []);

  useEffect(() => {
    fetchAdvances();
    if (session?.user?.role === "ADMIN") {
      fetchEmployees();
    }
  }, [session, fetchAdvances, fetchEmployees]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const aid = params.get('advanceId');
      if (aid) setSelectedAdvanceId(aid);
    }
  }, []);

  useEffect(() => {
    if (selectedAdvanceId && advances.length > 0) {
      const el = document.getElementById(`advance-row-${selectedAdvanceId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setHighlightAdvanceId(selectedAdvanceId);
        setTimeout(() => setHighlightAdvanceId(null), 3000);
      }
    }
  }, [selectedAdvanceId, advances]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const requestData = {
        ...formData,
        amount: parseFloat(formData.amount),
      };
      
      console.log("Submitting advance request:", requestData);
      
      const response = await fetch("/api/payroll/advances", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestData),
      });

      console.log("Response status:", response.status);
      
      if (response.ok) {
        setShowAddForm(false);
        setFormData({
          employeeId: "",
          amount: "",
          month: new Date().getMonth() + 1,
          year: new Date().getFullYear(),
          reason: "",
        });
        fetchAdvances();
        alert("Kasbon berhasil ditambahkan!");
      } else {
        const error = await response.json();
        console.error("API Error Response:", error);
        alert(error.error || "Gagal menambahkan kasbon");
      }
    } catch (error) {
      console.error("Error creating advance:", error);
      alert("Terjadi kesalahan saat menambahkan kasbon");
    }
  };

  const handleDelete = async () => {
    if (selectedAdvances.length === 0) {
      alert("Pilih kasbon yang akan dihapus");
      return;
    }

    if (confirm(`Hapus ${selectedAdvances.length} kasbon yang dipilih?`)) {
      try {
        const response = await fetch("/api/payroll/advances", {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ids: selectedAdvances }),
        });

        if (response.ok) {
          setSelectedAdvances([]);
          fetchAdvances();
          alert("Kasbon berhasil dihapus!");
        } else {
          const error = await response.json();
          alert(error.error || "Gagal menghapus kasbon");
        }
      } catch (error) {
        console.error("Error deleting advances:", error);
        alert("Terjadi kesalahan saat menghapus kasbon");
      }
    }
  };

  const handleSelectAdvance = (advanceId: string) => {
    setSelectedAdvances(prev => 
      prev.includes(advanceId)
        ? prev.filter(id => id !== advanceId)
        : [...prev, advanceId]
    );
  };

  const handleSelectAll = () => {
    if (selectedAdvances.length === advances.length) {
      setSelectedAdvances([]);
    } else {
      setSelectedAdvances(advances.map(advance => advance.id));
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold text-gray-900">Manajemen Kasbon</h2>
        {session?.user?.role === "ADMIN" && (
          <div className="flex w-full sm:w-auto space-x-2">
            <button
              onClick={() => setShowAddForm(true)}
              className="flex-1 sm:flex-none justify-center items-center bg-blue-600 text-white px-4 py-3 sm:py-2 rounded-md hover:bg-blue-700 text-sm font-medium touch-manipulation min-h-[48px]"
            >
              Tambah Kasbon
            </button>
            {selectedAdvances.length > 0 && (
              <button
                onClick={handleDelete}
                className="flex-1 sm:flex-none justify-center items-center bg-red-600 text-white px-4 py-3 sm:py-2 rounded-md hover:bg-red-700 text-sm font-medium touch-manipulation min-h-[48px]"
              >
                Hapus ({selectedAdvances.length})
              </button>
            )}
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {session?.user?.role === "ADMIN" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Karyawan
              </label>
              <select
                value={filters.employeeId}
                onChange={(e) => setFilters(prev => ({ ...prev, employeeId: e.target.value }))}
                className="w-full border border-gray-300 rounded-md px-3 py-3 sm:py-2 text-base sm:text-sm min-h-[48px]"
              >
                <option value="">Semua Karyawan</option>
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.employeeId} - {employee.user.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Bulan
            </label>
            <select
              value={filters.month}
              onChange={(e) => setFilters(prev => ({ ...prev, month: e.target.value }))}
              className="w-full border border-gray-300 rounded-md px-3 py-3 sm:py-2 text-base sm:text-sm min-h-[48px]"
            >
              <option value="">Semua Bulan</option>
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {new Date(0, i).toLocaleString('id-ID', { month: 'long' })}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tahun
            </label>
            <select
              value={filters.year}
              onChange={(e) => setFilters(prev => ({ ...prev, year: e.target.value }))}
              className="w-full border border-gray-300 rounded-md px-3 py-3 sm:py-2 text-base sm:text-sm min-h-[48px]"
            >
              <option value="">Semua Tahun</option>
              {Array.from({ length: 5 }, (_, i) => {
                const year = new Date().getFullYear() - i;
                return (
                  <option key={year} value={year}>
                    {year}
                  </option>
                );
              })}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              value={filters.status}
              onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
              className="w-full border border-gray-300 rounded-md px-3 py-3 sm:py-2 text-base sm:text-sm min-h-[48px]"
            >
              <option value="">Semua Status</option>
              <option value="ACTIVE">Aktif</option>
              <option value="DEDUCTED">Sudah Dipotong</option>
            </select>
          </div>
        </div>
      </div>

      {/* Add Form Modal */}
      {showAddForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 transition-opacity" 
            onClick={() => setShowAddForm(false)}
          ></div>

          {/* Modal Content */}
          <div className="bg-white w-full h-full sm:h-auto sm:max-w-md sm:rounded-lg overflow-y-auto flex flex-col z-10">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900">Tambah Kasbon</h3>
              <button
                onClick={() => setShowAddForm(false)}
                className="text-gray-400 hover:text-gray-500 p-2 min-h-[48px] min-w-[48px] flex items-center justify-center"
              >
                <span className="sr-only">Tutup</span>
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-4 sm:p-6 flex-1 overflow-y-auto">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Karyawan *
                  </label>
                  <select
                    value={formData.employeeId}
                    onChange={(e) => setFormData(prev => ({ ...prev, employeeId: e.target.value }))}
                    required
                    className="w-full border border-gray-300 rounded-md px-3 py-3 text-base min-h-[48px]"
                  >
                    <option value="">Pilih Karyawan</option>
                    {employees.map((employee) => (
                      <option key={employee.id} value={employee.id}>
                        {employee.employeeId} - {employee.user.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Jumlah Kasbon *
                  </label>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={formData.amount}
                    onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                    required
                    min="0"
                    step="1000"
                    className="w-full border border-gray-300 rounded-md px-3 py-3 text-base min-h-[48px]"
                    placeholder="Masukkan jumlah kasbon"
                  />
                </div>
                {session?.user?.role !== "ADMIN" && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Alasan Kasbon *
                    </label>
                    <textarea
                      value={formData.reason}
                      onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))}
                      required
                      rows={3}
                      className="w-full border border-gray-300 rounded-md px-3 py-3 text-base min-h-[48px]"
                      placeholder="Jelaskan alasan pengajuan kasbon"
                    />
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Bulan Potong
                    </label>
                    <select
                      value={formData.month}
                      onChange={(e) => setFormData(prev => ({ ...prev, month: parseInt(e.target.value) }))}
                      className="w-full border border-gray-300 rounded-md px-3 py-3 text-base min-h-[48px]"
                    >
                      {Array.from({ length: 12 }, (_, i) => (
                        <option key={i + 1} value={i + 1}>
                          {new Date(0, i).toLocaleString('id-ID', { month: 'long' })}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tahun Potong
                    </label>
                    <select
                      value={formData.year}
                      onChange={(e) => setFormData(prev => ({ ...prev, year: parseInt(e.target.value) }))}
                      className="w-full border border-gray-300 rounded-md px-3 py-3 text-base min-h-[48px]"
                    >
                      {Array.from({ length: 5 }, (_, i) => {
                        const year = new Date().getFullYear() + 1 - i;
                        return (
                          <option key={year} value={year}>
                            {year}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </div>

                <div className="flex gap-3 pt-4 sm:pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="flex-1 px-4 py-3 sm:py-2 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50 text-sm font-medium min-h-[48px]"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-3 sm:py-2 border border-transparent rounded-md text-white bg-blue-600 hover:bg-blue-700 text-sm font-medium min-h-[48px]"
                  >
                    Simpan
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Card View */}
      <div className="md:hidden space-y-4">
        {session?.user?.role === "ADMIN" && (
          <div className="flex items-center justify-between bg-white p-4 rounded-lg shadow">
             <label className="flex items-center space-x-3">
              <input
                type="checkbox"
                checked={selectedAdvances.length === advances.length && advances.length > 0}
                onChange={handleSelectAll}
                className="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-700">Pilih Semua</span>
            </label>
          </div>
        )}
        
        {advances.length === 0 ? (
          <div className="bg-white p-6 rounded-lg shadow text-center text-gray-500">
            Tidak ada data kasbon
          </div>
        ) : (
          advances.slice(0, visibleCount).map((advance) => (
            <div 
              key={advance.id} 
              id={`advance-card-${advance.id}`}
              className={`bg-white p-4 rounded-lg shadow space-y-3 ${highlightAdvanceId === advance.id ? 'ring-2 ring-indigo-500 bg-indigo-50' : ''}`}
            >
              <div className="flex justify-between items-start">
                <div className="flex items-start space-x-3 w-full">
                  {session?.user?.role === "ADMIN" && (
                    <div className="pt-1">
                      <input
                        type="checkbox"
                        checked={selectedAdvances.includes(advance.id)}
                        onChange={() => handleSelectAdvance(advance.id)}
                        className="h-6 w-6 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </div>
                  )}
                  <div className="flex-1">
                    <h3 className="text-base font-bold text-gray-900">{advance.employeeName}</h3>
                    <p className="text-sm text-gray-500">{advance.empId}</p>
                  </div>
                </div>
                <span className={`flex-shrink-0 inline-flex px-2.5 py-1 text-xs font-semibold rounded-full ${
                  advance.status === "ACTIVE" 
                    ? "bg-green-100 text-green-800" 
                    : "bg-gray-100 text-gray-800"
                }`}>
                  {advance.status === "ACTIVE" ? "Aktif" : "Sudah Dipotong"}
                </span>
              </div>
              
              <div className="grid grid-cols-2 gap-3 text-sm border-t pt-3 mt-2">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Jumlah</p>
                  <p className="font-semibold text-gray-900 text-base">{formatCurrency(advance.amount)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Periode</p>
                  <p className="font-medium text-gray-900">
                    {new Date(0, advance.month - 1).toLocaleString('id-ID', { month: 'short' })} {advance.year}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Dibuat</p>
                  <p className="text-gray-700">{new Date(advance.createdAt).toLocaleDateString('id-ID')}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Dipotong</p>
                  <p className="text-gray-700">
                    {advance.deductedAt ? new Date(advance.deductedAt).toLocaleDateString('id-ID') : '-'}
                  </p>
                </div>
              </div>
            </div>
          ))
        )}
        
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
      <div className="hidden md:block bg-white shadow rounded-lg overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {session?.user?.role === "ADMIN" && (
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <input
                    type="checkbox"
                    checked={selectedAdvances.length === advances.length && advances.length > 0}
                    onChange={handleSelectAll}
                    className="rounded border-gray-300 focus:ring-blue-500"
                  />
                </th>
              )}
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                ID Karyawan
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Nama Karyawan
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Jumlah
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Periode
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Tanggal Dibuat
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Tanggal Dipotong
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {advances.length === 0 ? (
              <tr>
                <td colSpan={session?.user?.role === "ADMIN" ? 8 : 7} className="px-6 py-4 text-center text-gray-500">
                  Tidak ada data kasbon
                </td>
              </tr>
            ) : (
              advances.map((advance) => (
                <tr key={advance.id} id={`advance-row-${advance.id}`} className={`hover:bg-gray-50 ${highlightAdvanceId === advance.id ? 'bg-indigo-50' : ''}`}>
                  {session?.user?.role === "ADMIN" && (
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={selectedAdvances.includes(advance.id)}
                        onChange={() => handleSelectAdvance(advance.id)}
                        className="rounded border-gray-300 focus:ring-blue-500"
                      />
                    </td>
                  )}
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {advance.empId}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {advance.employeeName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatCurrency(advance.amount)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {new Date(0, advance.month - 1).toLocaleString('id-ID', { month: 'long' })} {advance.year}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      advance.status === "ACTIVE" 
                        ? "bg-green-100 text-green-800" 
                        : "bg-gray-100 text-gray-800"
                    }`}>
                      {advance.status === "ACTIVE" ? "Aktif" : "Sudah Dipotong"}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {new Date(advance.createdAt).toLocaleDateString('id-ID')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {advance.deductedAt ? new Date(advance.deductedAt).toLocaleDateString('id-ID') : '-'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

}
