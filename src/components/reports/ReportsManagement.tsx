"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";

type ReportType = "attendance" | "payroll" | "financial";

export default function ReportsManagement() {
  const { data: _session } = useSession();
  const [isLoading, setIsLoading] = useState(false);
  const [reportType, setReportType] = useState<ReportType>("attendance");
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [employees, setEmployees] = useState<any[]>([]);
  const [reportData, setReportData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch employees for select dropdown
  useEffect(() => {
    async function fetchEmployees() {
      try {
        const response = await fetch("/api/employees");
        if (!response.ok) {
          throw new Error("Gagal mengambil data karyawan");
        }
        const data = await response.json();
        // Format the employee data to ensure name is accessible directly
        const formattedEmployees = data.map((employee: any) => ({
          ...employee,
          name: employee.user?.name || employee.name || "Tidak Diketahui"
        }));
        setEmployees(formattedEmployees);
      } catch (err) {
        console.error("Error fetching employees:", err);
      }
    }

    fetchEmployees();
  }, []);

  const handleGenerateReport = async () => {
    setIsLoading(true);
    setError(null);
    setReportData(null);

    try {
      const queryParams = new URLSearchParams({
        type: reportType,
        month: selectedMonth.toString(),
        year: selectedYear.toString(),
      });

      if (selectedEmployeeId && (reportType === "attendance" || reportType === "payroll")) {
        queryParams.append("employeeId", selectedEmployeeId);
      }

      const response = await fetch(`/api/reports?${queryParams}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Gagal membuat laporan");
      }

      const data = await response.json();
      setReportData(data);
    } catch (err: any) {
      console.error("Error generating report:", err);
      setError(err.message || "Gagal membuat laporan");
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (date: string | Date): string => {
    return new Date(date).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  const getMonthName = (month: number): string => {
    const date = new Date();
    date.setMonth(month - 1);
    return date.toLocaleString('id-ID', { month: 'long' });
  };

  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Laporan</h1>
        <p className="mt-1 text-sm text-gray-500">
          Buat dan lihat berbagai laporan
        </p>
      </div>

      {/* Report controls */}
      <div className="bg-white shadow sm:rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
            <div className="sm:col-span-2">
              <label htmlFor="reportType" className="block text-sm font-medium text-gray-700">
                Jenis Laporan
              </label>
              <select
                id="reportType"
                value={reportType}
                onChange={(e) => setReportType(e.target.value as ReportType)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              >
                <option value="attendance">Laporan Absensi</option>
                <option value="payroll">Laporan Penggajian</option>
                <option value="financial">Ringkasan Keuangan</option>
              </select>
            </div>

            <div className="sm:col-span-1">
              <label htmlFor="month" className="block text-sm font-medium text-gray-700">
                Bulan
              </label>
              <select
                id="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              >
                {months.map((month) => (
                  <option key={month} value={month}>
                    {getMonthName(month)}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-1">
              <label htmlFor="year" className="block text-sm font-medium text-gray-700">
                Tahun
              </label>
              <select
                id="year"
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              >
                {years.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>

            {(reportType === "attendance" || reportType === "payroll") && (
              <div className="sm:col-span-2">
                <label htmlFor="employee" className="block text-sm font-medium text-gray-700">
                  Karyawan (Opsional)
                </label>
                <select
                  id="employee"
                  value={selectedEmployeeId || ""}
                  onChange={(e) => setSelectedEmployeeId(e.target.value || null)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                >
                  <option value="">Semua Karyawan</option>
                  {employees.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.name} ({employee.employeeId}) {employee.user?.role || employee.role || ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="sm:col-span-6">
              <button
                type="button"
                onClick={handleGenerateReport}
                disabled={isLoading}
                className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-75"
              >
                {isLoading ? "Membuat..." : "Buat Laporan"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-red-400"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Report content */}
      {reportData && (
        <div className="space-y-6">
          <div className="bg-white shadow overflow-hidden sm:rounded-lg">
            <div className="px-4 py-5 sm:px-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                {reportType === "attendance" && "Laporan Absensi"}
                {reportType === "payroll" && "Laporan Penggajian"}
                {reportType === "financial" && "Ringkasan Keuangan"}
              </h3>
              <p className="mt-1 max-w-2xl text-sm text-gray-500">
                {getMonthName(reportData.month)} {reportData.year}
              </p>
            </div>

            {reportType === "attendance" && (
              <div className="border-t border-gray-200">
                <div className="px-4 py-5 sm:p-6">
                  <p className="text-sm text-gray-700">
                    Hari kerja dalam bulan: <span className="font-medium">{reportData.workingDays}</span>
                  </p>
                  
                  {reportData.employees.length === 0 ? (
                    <p className="mt-4 text-sm text-gray-700">Tidak ada catatan absensi ditemukan.</p>
                  ) : (
                    <div className="mt-4">
                      {reportData.employees.map((employeeData: any) => (
                        <div key={employeeData.employee.id} className="mb-8">
                          <h4 className="text-md font-medium text-gray-900">
                            {employeeData.employee.name} ({employeeData.employee.employeeId})
                          </h4>
                          
                          <div className="mt-2 flex flex-wrap gap-4">
                            <div className="px-4 py-2 bg-gray-50 rounded-md">
                              <span className="text-xs text-gray-500">Hadir</span>
                              <p className="text-lg font-medium text-green-600">{employeeData.summary.present}</p>
                            </div>
                            <div className="px-4 py-2 bg-gray-50 rounded-md">
                              <span className="text-xs text-gray-500">Tidak Hadir</span>
                              <p className="text-lg font-medium text-red-600">{employeeData.summary.absent}</p>
                            </div>
                            <div className="px-4 py-2 bg-gray-50 rounded-md">
                              <span className="text-xs text-gray-500">Terlambat</span>
                              <p className="text-lg font-medium text-yellow-600">{employeeData.summary.late}</p>
                            </div>
                            <div className="px-4 py-2 bg-gray-50 rounded-md">
                              <span className="text-xs text-gray-500">Setengah Hari</span>
                              <p className="text-lg font-medium text-orange-600">{employeeData.summary.halfday}</p>
                            </div>
                            <div className="px-4 py-2 bg-gray-50 rounded-md">
                              <span className="text-xs text-gray-500">Tingkat Kehadiran</span>
                              <p className="text-lg font-medium text-indigo-600">
                                {Math.round((employeeData.summary.present / reportData.workingDays) * 100)}%
                              </p>
                            </div>
                          </div>
                          
                          <div className="mt-4">
                            {/* Mobile View (Cards) */}
                            <div className="block sm:hidden space-y-4">
                              {employeeData.records.map((record: any) => (
                                <div key={record.id} className="bg-gray-50 rounded-lg p-4 space-y-3">
                                  <div className="flex justify-between items-start">
                                    <span className="text-sm font-medium text-gray-900">{formatDate(record.date)}</span>
                                    <span
                                      className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${
                                        record.status === "PRESENT"
                                          ? "bg-green-100 text-green-800"
                                          : record.status === "ABSENT"
                                          ? "bg-red-100 text-red-800"
                                          : record.status === "LATE"
                                          ? "bg-yellow-100 text-yellow-800"
                                          : "bg-orange-100 text-orange-800"
                                      }`}
                                    >
                                      {record.status === "PRESENT" ? "Hadir" : 
                                       record.status === "ABSENT" ? "Absen" : 
                                       record.status === "LATE" ? "Terlambat" : record.status}
                                    </span>
                                  </div>
                                  <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                      <p className="text-xs text-gray-500">Masuk</p>
                                      <p className="font-medium text-gray-900">
                                        {record.checkIn ? new Date(record.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-xs text-gray-500">Keluar</p>
                                      <p className="font-medium text-gray-900">
                                        {record.checkOut ? new Date(record.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                                      </p>
                                    </div>
                                  </div>
                                  {record.notes && (
                                    <div>
                                      <p className="text-xs text-gray-500">Catatan</p>
                                      <p className="text-sm text-gray-700">{record.notes}</p>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>

                            {/* Desktop View (Table) */}
                            <div className="hidden sm:block overflow-x-auto">
                              <table className="min-w-full divide-y divide-gray-300">
                                <thead className="bg-gray-50">
                                  <tr>
                                    <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Tanggal</th>
                                    <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Status</th>
                                    <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Masuk</th>
                                    <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Keluar</th>
                                    <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Catatan</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 bg-white">
                                  {employeeData.records.map((record: any) => (
                                    <tr key={record.id}>
                                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                        {formatDate(record.date)}
                                      </td>
                                      <td className="whitespace-nowrap px-3 py-4 text-sm">
                                        <span
                                          className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${
                                            record.status === "PRESENT"
                                              ? "bg-green-100 text-green-800"
                                              : record.status === "ABSENT"
                                              ? "bg-red-100 text-red-800"
                                              : record.status === "LATE"
                                              ? "bg-yellow-100 text-yellow-800"
                                              : "bg-orange-100 text-orange-800"
                                          }`}
                                        >
                                          {record.status === "PRESENT" ? "Hadir" : 
                                           record.status === "ABSENT" ? "Absen" : 
                                           record.status === "LATE" ? "Terlambat" : record.status}
                                        </span>
                                      </td>
                                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                        {record.checkIn ? new Date(record.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                                      </td>
                                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                        {record.checkOut ? new Date(record.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                                      </td>
                                      <td className="px-3 py-4 text-sm text-gray-500">
                                        {record.notes || '-'}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {reportType === "payroll" && (
              <div className="border-t border-gray-200">
                <div className="px-4 py-5 sm:p-6">
                  {reportData.payroll.length === 0 ? (
                    <p className="text-sm text-gray-700">Tidak ada catatan penggajian ditemukan.</p>
                  ) : (
                    <div>
                      {/* Mobile View (Cards) */}
                      <div className="block sm:hidden space-y-4">
                        {reportData.payroll.map((record: any) => (
                          <div key={record.id} className="bg-gray-50 rounded-lg p-4 space-y-3">
                            <div className="flex justify-between items-start">
                              <span className="text-sm font-medium text-gray-900">{record.employee.name}</span>
                              <span
                                className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${
                                  record.status === "PAID"
                                    ? "bg-green-100 text-green-800"
                                    : record.status === "PENDING"
                                    ? "bg-yellow-100 text-yellow-800"
                                    : "bg-red-100 text-red-800"
                                }`}
                              >
                                {record.status === "PAID" ? "Dibayar" : record.status === "PENDING" ? "Menunggu" : record.status}
                              </span>
                            </div>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-gray-500">Gaji Pokok</span>
                                <span className="text-gray-900">{formatCurrency(record.baseSalary)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-500">Tunjangan</span>
                                <span className="text-gray-900">{formatCurrency(record.totalAllowances)}</span>
                              </div>
                              {/* Rincian Tunjangan */}
                              {(record.positionAllowance > 0 || record.mealAllowance > 0 || record.transportAllowance > 0 || record.shiftAllowance > 0) && (
                                <div className="pl-4 space-y-1 text-xs border-l-2 border-gray-200">
                                  {record.positionAllowance > 0 && (
                                    <div className="flex justify-between">
                                      <span className="text-gray-500">Jabatan</span>
                                      <span className="text-gray-700">{formatCurrency(record.positionAllowance)}</span>
                                    </div>
                                  )}
                                  {record.mealAllowance > 0 && (
                                    <div className="flex justify-between">
                                      <span className="text-gray-500">Makan</span>
                                      <span className="text-gray-700">{formatCurrency(record.mealAllowance)}</span>
                                    </div>
                                  )}
                                  {record.transportAllowance > 0 && (
                                    <div className="flex justify-between">
                                      <span className="text-gray-500">Transport</span>
                                      <span className="text-gray-700">{formatCurrency(record.transportAllowance)}</span>
                                    </div>
                                  )}
                                  {record.shiftAllowance > 0 && (
                                    <div className="flex justify-between">
                                      <span className="text-gray-500">Shift</span>
                                      <span className="text-gray-700">{formatCurrency(record.shiftAllowance)}</span>
                                    </div>
                                  )}
                                </div>
                              )}

                              <div className="flex justify-between">
                                <span className="text-gray-500">Potongan</span>
                                <span className="text-gray-900 text-red-600">-{formatCurrency(record.totalDeductions)}</span>
                              </div>
                              {/* Rincian Potongan */}
                              {(record.lateDeduction > 0 || record.absenceDeduction > 0 || record.bpjsKesehatanAmount > 0 || record.bpjsKetenagakerjaanAmount > 0 || record.advanceAmount > 0 || record.softLoanDeduction > 0 || record.otherDeductions > 0) && (
                                <div className="pl-4 space-y-1 text-xs border-l-2 border-red-200">
                                  {record.lateDeduction > 0 && (
                                    <div className="flex justify-between">
                                      <span className="text-gray-500">Terlambat</span>
                                      <span className="text-red-600">-{formatCurrency(record.lateDeduction)}</span>
                                    </div>
                                  )}
                                  {record.absenceDeduction > 0 && (
                                    <div className="flex justify-between">
                                      <span className="text-gray-500">Absen</span>
                                      <span className="text-red-600">-{formatCurrency(record.absenceDeduction)}</span>
                                    </div>
                                  )}
                                  {record.bpjsKesehatanAmount > 0 && (
                                    <div className="flex justify-between">
                                      <span className="text-gray-500">BPJS Kes</span>
                                      <span className="text-red-600">-{formatCurrency(record.bpjsKesehatanAmount)}</span>
                                    </div>
                                  )}
                                  {record.bpjsKetenagakerjaanAmount > 0 && (
                                    <div className="flex justify-between">
                                      <span className="text-gray-500">BPJS TK</span>
                                      <span className="text-red-600">-{formatCurrency(record.bpjsKetenagakerjaanAmount)}</span>
                                    </div>
                                  )}
                                  {record.advanceAmount > 0 && (
                                    <div className="flex justify-between">
                                      <span className="text-gray-500">Kasbon</span>
                                      <span className="text-red-600">-{formatCurrency(record.advanceAmount)}</span>
                                    </div>
                                  )}
                                  {record.softLoanDeduction > 0 && (
                                     <div className="flex justify-between">
                                       <span className="text-gray-500">Pinjaman</span>
                                       <span className="text-red-600">-{formatCurrency(record.softLoanDeduction)}</span>
                                     </div>
                                   )}
                                   {record.otherDeductions > 0 && (
                                     <div className="flex justify-between">
                                       <span className="text-gray-500">Lainnya</span>
                                       <span className="text-red-600">-{formatCurrency(record.otherDeductions)}</span>
                                     </div>
                                   )}
                                 </div>
                               )}
                              <div className="flex justify-between">
                                <span className="text-gray-500">Lembur</span>
                                <span className="text-gray-900">{formatCurrency(record.overtimeAmount)}</span>
                              </div>
                              <div className="pt-2 border-t border-gray-200 flex justify-between font-medium">
                                <span className="text-gray-900">Gaji Bersih</span>
                                <span className="text-indigo-600">{formatCurrency(record.netSalary)}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                        {/* Mobile Totals */}
                        <div className="bg-indigo-50 rounded-lg p-4 space-y-3 border border-indigo-100">
                          <h4 className="font-medium text-indigo-900">Total Ringkasan</h4>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-indigo-700">Gaji Pokok</span>
                              <span className="text-indigo-900">{formatCurrency(reportData.totals.baseSalary)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-indigo-700">Tunjangan</span>
                              <span className="text-indigo-900">{formatCurrency(reportData.totals.totalAllowances)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-indigo-700">Potongan</span>
                              <span className="text-indigo-900">-{formatCurrency(reportData.totals.totalDeductions)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-indigo-700">Lembur</span>
                              <span className="text-indigo-900">{formatCurrency(reportData.totals.overtimeAmount)}</span>
                            </div>
                            <div className="pt-2 border-t border-indigo-200 flex justify-between font-bold">
                              <span className="text-indigo-900">Total Gaji Bersih</span>
                              <span className="text-indigo-900">{formatCurrency(reportData.totals.netSalary)}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Desktop View (Table) */}
                      <div className="hidden sm:block overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-300">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-2 py-3.5 text-left text-xs font-semibold text-gray-900">Karyawan</th>
                              <th className="px-2 py-3.5 text-left text-xs font-semibold text-gray-900">Gaji Pokok</th>
                              <th className="px-2 py-3.5 text-left text-xs font-semibold text-gray-900">Tunj. Jabatan</th>
                              <th className="px-2 py-3.5 text-left text-xs font-semibold text-gray-900">Tunj. Makan</th>
                              <th className="px-2 py-3.5 text-left text-xs font-semibold text-gray-900">Tunj. Trans</th>
                              <th className="px-2 py-3.5 text-left text-xs font-semibold text-gray-900">Tunj. Shift</th>
                              <th className="px-2 py-3.5 text-left text-xs font-semibold text-gray-900">Lembur</th>
                              <th className="px-2 py-3.5 text-left text-xs font-semibold text-red-600">Pot. Telat</th>
                              <th className="px-2 py-3.5 text-left text-xs font-semibold text-red-600">Pot. Absen</th>
                              <th className="px-2 py-3.5 text-left text-xs font-semibold text-red-600">Pot. BPJS</th>
                              <th className="px-2 py-3.5 text-left text-xs font-semibold text-red-600">Pot. Kasbon</th>
                              <th className="px-2 py-3.5 text-left text-xs font-semibold text-red-600">Pot. Pinjam</th>
                              <th className="px-2 py-3.5 text-left text-xs font-semibold text-red-600">Pot. Lain</th>
                              <th className="px-2 py-3.5 text-left text-xs font-semibold text-gray-900">Gaji Bersih</th>
                              <th className="px-2 py-3.5 text-left text-xs font-semibold text-gray-900">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200 bg-white">
                            {reportData.payroll.map((record: any) => (
                              <tr key={record.id}>
                                <td className="whitespace-nowrap px-2 py-4 text-xs font-medium text-gray-900">
                                  {record.employee.name}
                                </td>
                                <td className="whitespace-nowrap px-2 py-4 text-xs text-gray-500">
                                  {formatCurrency(record.baseSalary)}
                                </td>
                                <td className="whitespace-nowrap px-2 py-4 text-xs text-gray-500">
                                  {formatCurrency(record.positionAllowance)}
                                </td>
                                <td className="whitespace-nowrap px-2 py-4 text-xs text-gray-500">
                                  {formatCurrency(record.mealAllowance)}
                                </td>
                                <td className="whitespace-nowrap px-2 py-4 text-xs text-gray-500">
                                  {formatCurrency(record.transportAllowance)}
                                </td>
                                <td className="whitespace-nowrap px-2 py-4 text-xs text-gray-500">
                                  {formatCurrency(record.shiftAllowance)}
                                </td>
                                <td className="whitespace-nowrap px-2 py-4 text-xs text-gray-500">
                                  {formatCurrency(record.overtimeAmount)}
                                </td>
                                <td className="whitespace-nowrap px-2 py-4 text-xs text-red-500">
                                  {record.lateDeduction > 0 ? `-${formatCurrency(record.lateDeduction)}` : '-'}
                                </td>
                                <td className="whitespace-nowrap px-2 py-4 text-xs text-red-500">
                                  {record.absenceDeduction > 0 ? `-${formatCurrency(record.absenceDeduction)}` : '-'}
                                </td>
                                <td className="whitespace-nowrap px-2 py-4 text-xs text-red-500">
                                  {(record.bpjsKesehatanAmount + record.bpjsKetenagakerjaanAmount) > 0 ? `-${formatCurrency(record.bpjsKesehatanAmount + record.bpjsKetenagakerjaanAmount)}` : '-'}
                                </td>
                                <td className="whitespace-nowrap px-2 py-4 text-xs text-red-500">
                                  {record.advanceAmount > 0 ? `-${formatCurrency(record.advanceAmount)}` : '-'}
                                </td>
                                <td className="whitespace-nowrap px-2 py-4 text-xs text-red-500">
                                  {record.softLoanDeduction > 0 ? `-${formatCurrency(record.softLoanDeduction)}` : '-'}
                                </td>
                                <td className="whitespace-nowrap px-2 py-4 text-xs text-red-500">
                                  {record.otherDeductions > 0 ? `-${formatCurrency(record.otherDeductions)}` : '-'}
                                </td>
                                <td className="whitespace-nowrap px-2 py-4 text-xs font-medium text-gray-900">
                                  {formatCurrency(record.netSalary)}
                                </td>
                                <td className="whitespace-nowrap px-2 py-4 text-xs">
                                  <span
                                    className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${
                                      record.status === "PAID"
                                        ? "bg-green-100 text-green-800"
                                        : record.status === "PENDING"
                                        ? "bg-yellow-100 text-yellow-800"
                                        : "bg-red-100 text-red-800"
                                    }`}
                                  >
                                    {record.status === "PAID" ? "Dibayar" : record.status === "PENDING" ? "Menunggu" : record.status}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot className="bg-gray-50">
                            <tr>
                              <th className="px-2 py-3.5 text-left text-xs font-semibold text-gray-900">Total</th>
                              <th className="px-2 py-3.5 text-left text-xs font-semibold text-gray-900">
                                {formatCurrency(reportData.totals.baseSalary)}
                              </th>
                              <th className="px-2 py-3.5 text-left text-xs font-semibold text-gray-900">
                                {formatCurrency(reportData.totals.totalPositionAllowance)}
                              </th>
                              <th className="px-2 py-3.5 text-left text-xs font-semibold text-gray-900">
                                {formatCurrency(reportData.totals.totalMealAllowance)}
                              </th>
                              <th className="px-2 py-3.5 text-left text-xs font-semibold text-gray-900">
                                {formatCurrency(reportData.totals.totalTransportAllowance)}
                              </th>
                              <th className="px-2 py-3.5 text-left text-xs font-semibold text-gray-900">
                                {formatCurrency(reportData.totals.totalShiftAllowance)}
                              </th>
                              <th className="px-2 py-3.5 text-left text-xs font-semibold text-gray-900">
                                {formatCurrency(reportData.totals.overtimeAmount)}
                              </th>
                              <th className="px-2 py-3.5 text-left text-xs font-semibold text-red-600">
                                -{formatCurrency(reportData.totals.totalLateDeduction)}
                              </th>
                              <th className="px-2 py-3.5 text-left text-xs font-semibold text-red-600">
                                -{formatCurrency(reportData.totals.totalAbsenceDeduction)}
                              </th>
                              <th className="px-2 py-3.5 text-left text-xs font-semibold text-red-600">
                                -{formatCurrency(reportData.totals.totalBpjsKesehatan + reportData.totals.totalBpjsKetenagakerjaan)}
                              </th>
                              <th className="px-2 py-3.5 text-left text-xs font-semibold text-red-600">
                                -{formatCurrency(reportData.totals.totalAdvanceAmount)}
                              </th>
                              <th className="px-2 py-3.5 text-left text-xs font-semibold text-red-600">
                                -{formatCurrency(reportData.totals.totalSoftLoanDeduction)}
                              </th>
                              <th className="px-2 py-3.5 text-left text-xs font-semibold text-red-600">
                                -{formatCurrency(reportData.totals.totalOtherDeductions)}
                              </th>
                              <th className="px-2 py-3.5 text-left text-xs font-semibold text-gray-900">
                                {formatCurrency(reportData.totals.netSalary)}
                              </th>
                              <th className="px-2 py-3.5 text-left text-xs font-semibold text-gray-900"></th>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {reportType === "financial" && (
              <div className="border-t border-gray-200">
                <div className="px-4 py-5 sm:p-6">
                  <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    <div className="px-4 py-5 bg-white shadow rounded-lg overflow-hidden sm:p-6">
                      <dt className="text-sm font-medium text-gray-500 truncate">Total Karyawan</dt>
                      <dd className="mt-1 text-3xl font-semibold text-gray-900">
                        {reportData.summary.totalEmployees}
                      </dd>
                    </div>

                    <div className="px-4 py-5 bg-white shadow rounded-lg overflow-hidden sm:p-6">
                      <dt className="text-sm font-medium text-gray-500 truncate">Total Beban Gaji</dt>
                      <dd className="mt-1 text-3xl font-semibold text-gray-900">
                        {formatCurrency(reportData.summary.totalNetSalary)}
                      </dd>
                    </div>

                    <div className="px-4 py-5 bg-white shadow rounded-lg overflow-hidden sm:p-6">
                      <dt className="text-sm font-medium text-gray-500 truncate">Gaji Pokok</dt>
                      <dd className="mt-1 text-3xl font-semibold text-gray-900">
                        {formatCurrency(reportData.summary.totalBaseSalary)}
                      </dd>
                    </div>

                    <div className="px-4 py-5 bg-white shadow rounded-lg overflow-hidden sm:p-6">
                      <dt className="text-sm font-medium text-gray-500 truncate">Tunjangan</dt>
                      <dd className="mt-1 text-3xl font-semibold text-gray-900">
                        {formatCurrency(reportData.summary.totalAllowances)}
                      </dd>
                    </div>

                    <div className="px-4 py-5 bg-white shadow rounded-lg overflow-hidden sm:p-6">
                      <dt className="text-sm font-medium text-gray-500 truncate">Potongan</dt>
                      <dd className="mt-1 text-3xl font-semibold text-gray-900">
                        {formatCurrency(reportData.summary.totalDeductions)}
                      </dd>
                    </div>

                    <div className="px-4 py-5 bg-white shadow rounded-lg overflow-hidden sm:p-6">
                      <dt className="text-sm font-medium text-gray-500 truncate">Lembur</dt>
                      <dd className="mt-1 text-3xl font-semibold text-gray-900">
                        {formatCurrency(reportData.summary.totalOvertimeAmount)}
                      </dd>
                    </div>
                  </dl>

                  <div className="mt-8">
                    <h4 className="text-lg font-medium text-gray-900">Status Pembayaran</h4>
                    <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2">
                      <div className="px-4 py-5 bg-green-50 shadow rounded-lg overflow-hidden sm:p-6">
                        <dt className="text-sm font-medium text-green-800 truncate">Dibayar</dt>
                        <dd className="mt-1 text-3xl font-semibold text-green-800">
                          {formatCurrency(reportData.summary.totalPaid)}
                        </dd>
                      </div>

                      <div className="px-4 py-5 bg-yellow-50 shadow rounded-lg overflow-hidden sm:p-6">
                        <dt className="text-sm font-medium text-yellow-800 truncate">Menunggu</dt>
                        <dd className="mt-1 text-3xl font-semibold text-yellow-800">
                          {formatCurrency(reportData.summary.totalPending)}
                        </dd>
                      </div>
                    </div>
                  </div>

                  <div className="mt-8">
                    <h4 className="text-lg font-medium text-gray-900">Pengeluaran per Divisi</h4>
                    <div className="mt-4">
                      {/* Mobile View (Cards) */}
                      <div className="block sm:hidden space-y-4">
                        {reportData.divisionExpenses.map((dept: any) => (
                          <div key={dept.division} className="bg-gray-50 rounded-lg p-4 space-y-2">
                            <div className="flex justify-between items-center font-medium">
                              <span className="text-gray-900">{dept.division}</span>
                              <span className="text-gray-900">{formatCurrency(dept.amount)}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm text-gray-500">
                              <span>Persentase</span>
                              <span>{((dept.amount / reportData.summary.totalNetSalary) * 100).toFixed(2)}%</span>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Desktop View (Table) */}
                      <div className="hidden sm:block overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-300">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Divisi</th>
                              <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Jumlah</th>
                              <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Persentase</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200 bg-white">
                            {reportData.divisionExpenses.map((dept: any) => (
                              <tr key={dept.division}>
                                <td className="whitespace-nowrap px-3 py-4 text-sm font-medium text-gray-900">
                                  {dept.division}
                                </td>
                                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                  {formatCurrency(dept.amount)}
                                </td>
                                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                  {((dept.amount / reportData.summary.totalNetSalary) * 100).toFixed(2)}%
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              <svg
                className="-ml-1 mr-2 h-5 w-5 text-gray-500"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M5 4v3H4a2 2 0 00-2 2v3a2 2 0 002 2h1v2a2 2 0 002 2h6a2 2 0 002-2v-2h1a2 2 0 002-2V9a2 2 0 00-2-2h-1V4a2 2 0 00-2-2H7a2 2 0 00-2 2zm8 0H7v3h6V4zm0 8H7v4h6v-4z"
                  clipRule="evenodd"
                />
              </svg>
              Cetak Laporan
            </button>
          </div>
        </div>
      )}
    </div>
  );
} 
