"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { formatCurrency } from "@/lib/utils";

interface SoftLoan {
  id: string;
  employeeId: string;
  empId: string;
  employeeName: string;
  totalAmount: number;
  monthlyAmount: number;
  remainingAmount: number;
  durationMonths: number;
  startMonth: number;
  startYear: number;
  status: string;
  createdAt: string;
  completedAt?: string;
}

interface Employee {
  id: string;
  employeeId: string;
  user: {
    name: string;
    email: string;
  };
}

export default function SoftLoanManagement() {
  const { data: session } = useSession();
  const [softLoans, setSoftLoans] = useState<SoftLoan[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedLoans, setSelectedLoans] = useState<string[]>([]);
  
  // Form state
  const [formData, setFormData] = useState({
    employeeId: "",
    totalAmount: "",
    durationMonths: 3,
    startMonth: new Date().getMonth() + 1,
    startYear: new Date().getFullYear(),
    reason: "",
  });

  // Filters
  const [filters, setFilters] = useState({
    employeeId: "",
    status: "",
  });

  useEffect(() => {
    fetchSoftLoans();
    if (session?.user?.role === "ADMIN") {
      fetchEmployees();
    }
  }, [session, filters]);

  const fetchSoftLoans = async () => {
    try {
      const params = new URLSearchParams();
      if (filters.employeeId) params.append("employeeId", filters.employeeId);
      if (filters.status) params.append("status", filters.status);

      const response = await fetch(`/api/payroll/soft-loans?${params}`);
      if (response.ok) {
        const data = await response.json();
        setSoftLoans(data);
      }
    } catch (error) {
      console.error("Error fetching soft loans:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployees = async () => {
    try {
      const response = await fetch("/api/employees");
      if (response.ok) {
        const data = await response.json();
        setEmployees(data);
      }
    } catch (error) {
      console.error("Error fetching employees:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const totalAmount = parseFloat(formData.totalAmount);
      const monthlyAmount = totalAmount / formData.durationMonths;

      const response = await fetch("/api/payroll/soft-loans", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...formData,
          totalAmount,
          monthlyAmount,
        }),
      });

      if (response.ok) {
        setShowAddForm(false);
        setFormData({
          employeeId: "",
          totalAmount: "",
          durationMonths: 3,
          startMonth: new Date().getMonth() + 1,
          startYear: new Date().getFullYear(),
          reason: "",
        });
        fetchSoftLoans();
        alert("Pinjaman lunak berhasil ditambahkan!");
      } else {
        const error = await response.json();
        alert(error.error || "Gagal menambahkan pinjaman lunak");
      }
    } catch (error) {
      console.error("Error creating soft loan:", error);
      alert("Terjadi kesalahan saat menambahkan pinjaman lunak");
    }
  };

  const handleDelete = async () => {
    if (selectedLoans.length === 0) {
      alert("Pilih pinjaman yang akan dihapus");
      return;
    }

    if (confirm(`Hapus ${selectedLoans.length} pinjaman yang dipilih?`)) {
      try {
        const response = await fetch("/api/payroll/soft-loans", {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ids: selectedLoans }),
        });

        if (response.ok) {
          setSelectedLoans([]);
          fetchSoftLoans();
          alert("Pinjaman berhasil dihapus!");
        } else {
          const error = await response.json();
          alert(error.error || "Gagal menghapus pinjaman");
        }
      } catch (error) {
        console.error("Error deleting soft loans:", error);
        alert("Terjadi kesalahan saat menghapus pinjaman");
      }
    }
  };

  const handleSelectLoan = (loanId: string) => {
    setSelectedLoans(prev => 
      prev.includes(loanId)
        ? prev.filter(id => id !== loanId)
        : [...prev, loanId]
    );
  };

  const handleSelectAll = () => {
    if (selectedLoans.length === softLoans.length) {
      setSelectedLoans([]);
    } else {
      setSelectedLoans(softLoans.map(loan => loan.id));
    }
  };

  const calculateProgress = (loan: SoftLoan) => {
    const paidAmount = loan.totalAmount - loan.remainingAmount;
    return (paidAmount / loan.totalAmount) * 100;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return "bg-green-100 text-green-800";
      case "COMPLETED":
        return "bg-blue-100 text-blue-800";
      case "CANCELLED":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return "Aktif";
      case "COMPLETED":
        return "Selesai";
      case "CANCELLED":
        return "Dibatalkan";
      default:
        return status;
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
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Manajemen Pinjaman Lunak</h2>
        {session?.user?.role === "ADMIN" && (
          <div className="flex space-x-2">
            <button
              onClick={() => setShowAddForm(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
            >
              Tambah Pinjaman
            </button>
            {selectedLoans.length > 0 && (
              <button
                onClick={handleDelete}
                className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700"
              >
                Hapus ({selectedLoans.length})
              </button>
            )}
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {session?.user?.role === "ADMIN" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Karyawan
              </label>
              <select
                value={filters.employeeId}
                onChange={(e) => setFilters(prev => ({ ...prev, employeeId: e.target.value }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
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
              Status
            </label>
            <select
              value={filters.status}
              onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="">Semua Status</option>
              <option value="ACTIVE">Aktif</option>
              <option value="COMPLETED">Selesai</option>
              <option value="CANCELLED">Dibatalkan</option>
            </select>
          </div>
        </div>
      </div>

      {/* Add Form Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Tambah Pinjaman Lunak</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Karyawan *
                </label>
                <select
                  value={formData.employeeId}
                  onChange={(e) => setFormData(prev => ({ ...prev, employeeId: e.target.value }))}
                  required
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
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
                  Total Pinjaman *
                </label>
                <input
                  type="number"
                  value={formData.totalAmount}
                  onChange={(e) => setFormData(prev => ({ ...prev, totalAmount: e.target.value }))}
                  required
                  min="0"
                  step="1000"
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  placeholder="Masukkan total pinjaman"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Durasi Pinjaman *
                </label>
                <select
                  value={formData.durationMonths}
                  onChange={(e) => setFormData(prev => ({ ...prev, durationMonths: parseInt(e.target.value) }))}
                  required
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                >
                  <option value={3}>3 Bulan</option>
                  <option value={6}>6 Bulan</option>
                  <option value={12}>12 Bulan</option>
                </select>
              </div>
              {session?.user?.role !== "ADMIN" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Alasan Pinjaman *
                  </label>
                  <textarea
                    value={formData.reason}
                    onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))}
                    required
                    rows={3}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                    placeholder="Masukkan alasan pinjaman lunak"
                  />
                </div>
              )}
              {formData.totalAmount && (
                <div className="bg-gray-50 p-3 rounded-md">
                  <p className="text-sm text-gray-600">
                    Cicilan per bulan: <span className="font-semibold">
                      {formatCurrency(parseFloat(formData.totalAmount) / formData.durationMonths)}
                    </span>
                  </p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Bulan Mulai *
                  </label>
                  <select
                    value={formData.startMonth}
                    onChange={(e) => setFormData(prev => ({ ...prev, startMonth: parseInt(e.target.value) }))}
                    required
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
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
                    Tahun Mulai *
                  </label>
                  <select
                    value={formData.startYear}
                    onChange={(e) => setFormData(prev => ({ ...prev, startYear: parseInt(e.target.value) }))}
                    required
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                  >
                    {Array.from({ length: 3 }, (_, i) => {
                      const year = new Date().getFullYear() + i;
                      return (
                        <option key={year} value={year}>
                          {year}
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>
              <div className="flex justify-end space-x-2 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Soft Loans Table */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {session?.user?.role === "ADMIN" && (
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <input
                    type="checkbox"
                    checked={selectedLoans.length === softLoans.length && softLoans.length > 0}
                    onChange={handleSelectAll}
                    className="rounded border-gray-300"
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
                Total Pinjaman
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Cicilan/Bulan
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Sisa Pinjaman
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Progress
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Durasi
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Periode
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {softLoans.length === 0 ? (
              <tr>
                <td colSpan={session?.user?.role === "ADMIN" ? 11 : 10} className="px-6 py-4 text-center text-gray-500">
                  Tidak ada data pinjaman lunak
                </td>
              </tr>
            ) : (
              softLoans.map((loan) => {
                const progress = calculateProgress(loan);
                const paidAmount = loan.totalAmount - loan.remainingAmount;
                
                return (
                  <tr key={loan.id} className="hover:bg-gray-50">
                    {session?.user?.role === "ADMIN" && (
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={selectedLoans.includes(loan.id)}
                          onChange={() => handleSelectLoan(loan.id)}
                          className="rounded border-gray-300"
                        />
                      </td>
                    )}
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {loan.empId}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {loan.employeeName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatCurrency(loan.totalAmount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatCurrency(loan.monthlyAmount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div>
                        <div className="font-medium">{formatCurrency(loan.remainingAmount)}</div>
                        <div className="text-xs text-gray-500">
                          Terbayar: {formatCurrency(paidAmount)}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full" 
                          style={{ width: `${progress}%` }}
                        ></div>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {progress.toFixed(1)}%
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {loan.durationMonths} Bulan
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(0, loan.startMonth - 1).toLocaleString('id-ID', { month: 'short' })} {loan.startYear}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(loan.status)}`}>
                        {getStatusText(loan.status)}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}