"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";

type PayrollRecord = {
  id: string;
  month: number;
  year: number;
  baseSalary: number;
  totalAllowances: number;
  totalDeductions: number;
  netSalary: number;
  daysPresent: number;
  daysAbsent: number;
  overtimeHours: number;
  overtimeAmount: number;
  status: "PENDING" | "PAID" | "CANCELLED";
  createdAt: string;
  paidAt: string | null;
  employeeName: string;
  empId: string;
  position?: string;
  department?: string;
};

export default function PayrollManagement() {
  const { data: session } = useSession();
  const [isLoading, setIsLoading] = useState(true);
  const [payrollRecords, setPayrollRecords] = useState<PayrollRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [generatingPayroll, setGeneratingPayroll] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const isAdmin = session?.user?.role === "ADMIN";

  useEffect(() => {
    const fetchPayroll = async () => {
      if (!session) return;
      
      setIsLoading(true);
      setError(null);
      
      try {
        // Fetch payroll data from API
        const response = await fetch(
          `/api/payroll?month=${selectedMonth}&year=${selectedYear}`
        );
        
        if (!response.ok) {
          throw new Error("Gagal mengambil data penggajian");
        }
        
        const data = await response.json();
        setPayrollRecords(data);
      } catch (err) {
        console.error("Error fetching payroll:", err);
        setError("Gagal memuat data penggajian");
      } finally {
        setIsLoading(false);
      }
    };

    fetchPayroll();
  }, [session, selectedMonth, selectedYear]);

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (date: string | null): string => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString('id-ID');
  };

  const getMonthName = (month: number): string => {
    const date = new Date();
    date.setMonth(month - 1);
    return date.toLocaleString('id-ID', { month: 'long' });
  };

  const handleGeneratePayroll = async () => {
    if (!isAdmin) return;
    
    setGeneratingPayroll(true);
    setError(null);
    
    try {
      const response = await fetch("/api/payroll/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          month: selectedMonth,
          year: selectedYear,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Gagal membuat penggajian");
      }
      
      // Refresh payroll data
      const refreshResponse = await fetch(
        `/api/payroll?month=${selectedMonth}&year=${selectedYear}`
      );
      
      if (!refreshResponse.ok) {
        throw new Error("Gagal menyegarkan data penggajian");
      }
      
      const refreshData = await refreshResponse.json();
      setPayrollRecords(refreshData);
      
    } catch (err: any) {
      console.error("Error generating payroll:", err);
      setError(err.message || "Gagal membuat penggajian");
    } finally {
      setGeneratingPayroll(false);
    }
  };

  const handleMarkAsPaid = async (id: string) => {
    setProcessingId(id);
    setError("");
    
    try {
      const response = await fetch("/api/payroll", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ids: [id],
          status: "PAID",
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || "Gagal memperbarui status penggajian");
      }
      
      // Update local state
      setPayrollRecords(
        payrollRecords.map((record) =>
          record.id === id
            ? { ...record, status: "PAID", paidAt: new Date().toISOString() }
            : record
        )
      );
      
      // Show success message or toast notification here if desired
    } catch (err: any) {
      console.error("Error updating payroll:", err);
      setError(err.message || "Gagal memperbarui penggajian");
    } finally {
      setProcessingId(null);
    }
  };

  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const years = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 5 + i);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Penggajian</h1>
        <p className="mt-1 text-sm text-gray-500">
          {isAdmin
            ? "Kelola penggajian karyawan"
            : "Lihat informasi penggajian Anda"}
        </p>
      </div>

      <div className="mt-8">
        <div className="sm:flex sm:items-center">
          <div className="sm:flex-auto">
            <h2 className="text-xl font-semibold text-gray-900">
              Data Penggajian
            </h2>
            <p className="mt-2 text-sm text-gray-700">
              {isAdmin
                ? "Lihat dan kelola data penggajian karyawan"
                : "Lihat data penggajian Anda"}
            </p>
          </div>
          <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none space-x-2">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              className="rounded-md border border-gray-300 py-2 pl-3 pr-10 text-base focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
            >
              {months.map((month) => (
                <option key={month} value={month}>
                  {getMonthName(month)}
                </option>
              ))}
            </select>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="rounded-md border border-gray-300 py-2 pl-3 pr-10 text-base focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
            >
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
            {isAdmin && (
              <button
                onClick={handleGeneratePayroll}
                disabled={generatingPayroll}
                className="inline-flex items-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
              >
                {generatingPayroll ? "Memproses..." : "Buat Penggajian"}
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-md bg-red-50 p-4">
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

        <div className="mt-4 flex flex-col">
          <div className="-my-2 -mx-4 overflow-x-auto sm:-mx-6 lg:-mx-8">
            <div className="inline-block min-w-full py-2 align-middle md:px-6 lg:px-8">
              <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
                {isLoading ? (
                  <div className="flex justify-center items-center h-24 bg-white">
                    <p className="text-gray-500">Memuat data penggajian...</p>
                  </div>
                ) : payrollRecords.length === 0 ? (
                  <div className="flex justify-center items-center h-24 bg-white">
                    <p className="text-gray-500">Tidak ada data penggajian untuk periode ini</p>
                  </div>
                ) : (
                  <table className="min-w-full divide-y divide-gray-300">
                    <thead className="bg-gray-50">
                      <tr>
                        {isAdmin && (
                          <th
                            scope="col"
                            className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6"
                          >
                            Karyawan
                          </th>
                        )}
                        <th
                          scope="col"
                          className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                        >
                          Periode
                        </th>
                        <th
                          scope="col"
                          className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                        >
                          Gaji Pokok
                        </th>
                        <th
                          scope="col"
                          className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                        >
                          Tunjangan
                        </th>
                        <th
                          scope="col"
                          className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                        >
                          Potongan
                        </th>
                        <th
                          scope="col"
                          className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                        >
                          Gaji Bersih
                        </th>
                        <th
                          scope="col"
                          className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                        >
                          Status
                        </th>
                        <th
                          scope="col"
                          className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                        >
                          Tanggal Bayar
                        </th>
                        {isAdmin && (
                          <th
                            scope="col"
                            className="relative py-3.5 pl-3 pr-4 sm:pr-6"
                          >
                            <span className="sr-only">Tindakan</span>
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      {payrollRecords.map((record) => (
                        <tr key={record.id}>
                          {isAdmin && (
                            <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">
                              {record.employeeName}
                              <div className="text-xs text-gray-500">
                                {record.empId}
                              </div>
                            </td>
                          )}
                          <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                            {getMonthName(record.month)} {record.year}
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                            {formatCurrency(record.baseSalary)}
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                            {formatCurrency(record.totalAllowances)}
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                            {formatCurrency(record.totalDeductions)}
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm font-medium text-gray-900">
                            {formatCurrency(record.netSalary)}
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm">
                            <span
                              className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${
                                record.status === "PAID"
                                  ? "bg-green-100 text-green-800"
                                  : record.status === "PENDING"
                                  ? "bg-yellow-100 text-yellow-800"
                                  : "bg-gray-100 text-gray-800"
                              }`}
                            >
                              {record.status === "PAID" ? "DIBAYAR" : 
                               record.status === "PENDING" ? "TERTUNDA" : 
                               record.status === "CANCELLED" ? "DIBATALKAN" : record.status}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                            {formatDate(record.paidAt)}
                          </td>
                          {isAdmin && (
                            <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                              {record.status === "PENDING" && (
                                <button
                                  onClick={() => handleMarkAsPaid(record.id)}
                                  disabled={processingId === record.id}
                                  className="text-indigo-600 hover:text-indigo-900 disabled:opacity-50"
                                >
                                  {processingId === record.id ? "Memproses..." : "Tandai Dibayar"}
                                </button>
                              )}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 