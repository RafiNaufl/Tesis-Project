"use client";

import { useState, useEffect, useCallback } from "react";
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
  const [selectedSoftLoanId, setSelectedSoftLoanId] = useState<string | null>(null);
  const [highlightSoftLoanId, setHighlightSoftLoanId] = useState<string | null>(null);
  
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

  const fetchSoftLoans = useCallback(async () => {
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
    fetchSoftLoans();
    if (session?.user?.role === "ADMIN") {
      fetchEmployees();
    }
  }, [session, fetchSoftLoans, fetchEmployees]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const sid = params.get('softLoanId');
      if (sid) setSelectedSoftLoanId(sid);
    }
  }, []);

  useEffect(() => {
    if (selectedSoftLoanId && softLoans.length > 0) {
      const el = document.getElementById(`softloan-row-${selectedSoftLoanId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setHighlightSoftLoanId(selectedSoftLoanId);
        setTimeout(() => setHighlightSoftLoanId(null), 3000);
      }
    }
  }, [selectedSoftLoanId, softLoans]);

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
  
  const calculateEstimatedEndDate = (loan: SoftLoan) => {
    // Hanya tampilkan tanda '-' jika sisa pinjaman sudah 0
    if (loan.remainingAmount <= 0) {
      return '-';
    }
    
    // Hitung sisa bulan berdasarkan sisa pinjaman dan cicilan bulanan
    const remainingMonths = Math.ceil(loan.remainingAmount / loan.monthlyAmount);
    
    // Hitung bulan dan tahun selesai
    // startMonth adalah 1-12, konversi ke 0-11 untuk perhitungan
    let endMonth = (loan.startMonth - 1) + remainingMonths; 
    let endYear = loan.startYear;
    
    // Sesuaikan tahun jika bulan melebihi 12
    while (endMonth > 11) {
      endMonth -= 12;
      endYear += 1;
    }
    
    // Gunakan array nama bulan dalam bahasa Indonesia
    const monthNames = [
      'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
      'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'
    ];
    
    // Tampilkan bulan dan tahun perkiraan selesai
    return `${monthNames[endMonth]} ${endYear}`;

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
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        {session?.user?.role === "ADMIN" && (
          <div className="flex w-full md:w-auto space-x-2">
            <button
              onClick={() => setShowAddForm(true)}
              className="flex-1 md:flex-none bg-blue-600 text-white px-4 py-3 md:py-2 rounded-md hover:bg-blue-700 min-h-[48px] md:min-h-0 flex items-center justify-center"
            >
              Tambah Pinjaman
            </button>
            {selectedLoans.length > 0 && (
              <button
                onClick={handleDelete}
                className="flex-1 md:flex-none bg-red-600 text-white px-4 py-3 md:py-2 rounded-md hover:bg-red-700 min-h-[48px] md:min-h-0 flex items-center justify-center"
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
                className="w-full border border-gray-300 rounded-md px-3 py-3 md:py-2 text-base md:text-sm min-h-[48px] md:min-h-0"
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
              className="w-full border border-gray-300 rounded-md px-3 py-3 md:py-2 text-base md:text-sm min-h-[48px] md:min-h-0"
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
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
                  className="w-full border border-gray-300 rounded-md px-3 py-3 md:py-2 text-base md:text-sm min-h-[48px] md:min-h-0"
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
                  className="w-full border border-gray-300 rounded-md px-3 py-3 md:py-2 text-base md:text-sm min-h-[48px] md:min-h-0"
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
                  className="w-full border border-gray-300 rounded-md px-3 py-3 md:py-2 text-base md:text-sm min-h-[48px] md:min-h-0"
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
                    className="w-full border border-gray-300 rounded-md px-3 py-3 md:py-2 text-base md:text-sm min-h-[48px] md:min-h-0"
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
                    className="w-full border border-gray-300 rounded-md px-3 py-3 md:py-2 text-base md:text-sm min-h-[48px] md:min-h-0"
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
                    className="w-full border border-gray-300 rounded-md px-3 py-3 md:py-2 text-base md:text-sm min-h-[48px] md:min-h-0"
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
              <div className="flex flex-col-reverse md:flex-row justify-end gap-2 md:space-x-2 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="w-full md:w-auto px-4 py-3 md:py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 min-h-[48px] md:min-h-0"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="w-full md:w-auto px-4 py-3 md:py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 min-h-[48px] md:min-h-0"
                >
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Soft Loans List */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        {/* Mobile View */}
        <div className="md:hidden">
          {softLoans.length === 0 ? (
            <div className="p-6 text-center">
              <div className="flex flex-col items-center justify-center">
                <svg className="h-12 w-12 text-gray-400 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-gray-500 text-lg font-medium">Tidak ada data pinjaman</p>
              </div>
            </div>
          ) : (
            <ul className="divide-y divide-gray-200">
              {softLoans.map((loan) => {
                const progress = calculateProgress(loan);
                return (
                  <li key={loan.id} className={`p-4 ${highlightSoftLoanId === loan.id ? 'bg-indigo-50' : ''}`}>
                    <div className="space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium text-gray-900">{loan.employeeName}</p>
                          <p className="text-sm text-gray-500">{loan.empId}</p>
                        </div>
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(loan.status)}`}>
                          {getStatusText(loan.status)}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <p className="text-gray-500">Total Pinjaman</p>
                          <p className="font-medium">{formatCurrency(loan.totalAmount)}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Cicilan/Bulan</p>
                          <p className="font-medium">{formatCurrency(loan.monthlyAmount)}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Sisa Pinjaman</p>
                          <p className="font-medium text-red-600">{formatCurrency(loan.remainingAmount)}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Durasi</p>
                          <p className="font-medium">{loan.durationMonths} Bulan</p>
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                          <span>Progress</span>
                          <span>{Math.round(progress)}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${
                              progress >= 90 ? "bg-green-500" : 
                              progress >= 50 ? "bg-blue-500" : 
                              progress >= 25 ? "bg-indigo-500" : "bg-blue-600"
                            }`}
                            style={{ width: `${progress}%` }}
                          ></div>
                        </div>
                      </div>

                      <div className="flex justify-between items-center pt-2 border-t border-gray-100 text-xs text-gray-500">
                        <div>
                          Mulai: {new Date(0, loan.startMonth - 1).toLocaleString('id-ID', { month: 'short' })} {loan.startYear}
                        </div>
                        <div>
                          Selesai: {calculateEstimatedEndDate(loan)}
                        </div>
                      </div>
                      
                      {session?.user?.role === "ADMIN" && (
                        <div className="pt-2 flex items-center justify-end">
                          <label className="flex items-center space-x-2 text-sm text-gray-700">
                            <input
                              type="checkbox"
                              checked={selectedLoans.includes(loan.id)}
                              onChange={() => handleSelectLoan(loan.id)}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-5 w-5"
                            />
                            <span>Pilih untuk dihapus</span>
                          </label>
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {session?.user?.role === "ADMIN" && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <input
                      type="checkbox"
                      checked={selectedLoans.length === softLoans.length && softLoans.length > 0}
                      onChange={handleSelectAll}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
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
                  Periode Mulai
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Perkiraan Selesai
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {softLoans.length === 0 ? (
                <tr>
                  <td colSpan={session?.user?.role === "ADMIN" ? 12 : 11} className="px-6 py-10 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <svg className="h-12 w-12 text-gray-400 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <p className="text-gray-500 text-lg font-medium">Tidak ada data pinjaman lunak</p>
                      <p className="text-gray-400 text-sm mt-1">Data pinjaman akan muncul di sini setelah ditambahkan</p>
                    </div>
                  </td>
                </tr>
              ) : (
                softLoans.map((loan) => {
                  const progress = calculateProgress(loan);
                  const paidAmount = loan.totalAmount - loan.remainingAmount;
                  
                  // Tentukan warna progress bar berdasarkan persentase
                  let progressColor = "bg-blue-600";
                  if (progress >= 90) {
                    progressColor = "bg-green-500";
                  } else if (progress >= 50) {
                    progressColor = "bg-blue-500";
                  } else if (progress >= 25) {
                    progressColor = "bg-indigo-500";
                  }
                  
                  return (
                    <tr key={loan.id} id={`softloan-row-${loan.id}`} className={`hover:bg-gray-50 transition-colors duration-150 ${highlightSoftLoanId === loan.id ? 'bg-indigo-50' : ''}`}>
                      {session?.user?.role === "ADMIN" && (
                        <td className="px-6 py-4 whitespace-nowrap">
                          <input
                            type="checkbox"
                            checked={selectedLoans.includes(loan.id)}
                            onChange={() => handleSelectLoan(loan.id)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                        </td>
                      )}
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {loan.empId}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {loan.employeeName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                        {formatCurrency(loan.totalAmount)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatCurrency(loan.monthlyAmount)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div>
                          <div className="font-medium">{formatCurrency(loan.remainingAmount)}</div>
                          <div className="text-xs text-gray-500 mt-1">
                            <span className="inline-flex items-center">
                              <svg className="h-3 w-3 text-green-500 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              Terbayar: {formatCurrency(paidAmount)}
                            </span>
                          </div>
                          <div className="text-xs text-gray-500 mt-0.5">
                            <span className="inline-flex items-center">
                              <svg className="h-3 w-3 text-blue-500 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              Sisa cicilan: {Math.ceil(loan.remainingAmount / loan.monthlyAmount)} bulan
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                          <div 
                            className={`${progressColor} h-2.5 rounded-full transition-all duration-500 ease-in-out`} 
                            style={{ width: `${progress}%` }}
                          ></div>
                        </div>
                        <div className="text-xs font-medium mt-1.5 flex items-center">
                          <span className={`${progress >= 50 ? 'text-green-600' : 'text-blue-600'}`}>
                            {progress.toFixed(1)}%
                          </span>
                          <span className="text-gray-400 ml-1">selesai</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <span className="font-medium">{loan.durationMonths}</span> Bulan
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <span className="inline-flex items-center">
                          <svg className="h-4 w-4 text-indigo-500 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          {['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'][loan.startMonth - 1]} {loan.startYear}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <span className="inline-flex items-center">
                          <svg className="h-4 w-4 text-purple-500 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                          </svg>
                          {calculateEstimatedEndDate(loan)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {loan.status === "ACTIVE" && (
                          <span className="inline-flex items-center px-2.5 py-1.5 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-600 mr-1.5 animate-pulse"></span>
                            {getStatusText(loan.status)}
                          </span>
                        )}
                        {loan.status === "COMPLETED" && (
                          <span className="inline-flex items-center px-2.5 py-1.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">
                            <svg className="h-3 w-3 text-blue-600 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            {getStatusText(loan.status)}
                          </span>
                        )}
                        {loan.status === "CANCELLED" && (
                          <span className="inline-flex items-center px-2.5 py-1.5 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-200">
                            <svg className="h-3 w-3 text-red-600 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                            {getStatusText(loan.status)}
                          </span>
                        )}
                        {loan.status !== "ACTIVE" && loan.status !== "COMPLETED" && loan.status !== "CANCELLED" && (
                          <span className={`inline-flex px-2.5 py-1.5 text-xs font-medium rounded-full ${getStatusColor(loan.status)}`}>
                            {getStatusText(loan.status)}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
