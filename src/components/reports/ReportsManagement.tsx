"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";

type ReportType = "attendance" | "payroll" | "financial";

export default function ReportsManagement() {
  const { data: session } = useSession();
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
          throw new Error("Failed to fetch employees");
        }
        const data = await response.json();
        // Format the employee data to ensure name is accessible directly
        const formattedEmployees = data.map((employee: any) => ({
          ...employee,
          name: employee.user?.name || employee.name || "Unknown"
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
        throw new Error(errorData.error || "Failed to generate report");
      }

      const data = await response.json();
      setReportData(data);
    } catch (err: any) {
      console.error("Error generating report:", err);
      setError(err.message || "Failed to generate report");
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const formatDate = (date: string | Date): string => {
    return new Date(date).toLocaleDateString();
  };

  const getMonthName = (month: number): string => {
    const date = new Date();
    date.setMonth(month - 1);
    return date.toLocaleString('default', { month: 'long' });
  };

  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Reports</h1>
        <p className="mt-1 text-sm text-gray-500">
          Generate and view various reports
        </p>
      </div>

      {/* Report controls */}
      <div className="bg-white shadow sm:rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
            <div className="sm:col-span-2">
              <label htmlFor="reportType" className="block text-sm font-medium text-gray-700">
                Report Type
              </label>
              <select
                id="reportType"
                value={reportType}
                onChange={(e) => setReportType(e.target.value as ReportType)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              >
                <option value="attendance">Attendance Report</option>
                <option value="payroll">Payroll Report</option>
                <option value="financial">Financial Summary</option>
              </select>
            </div>

            <div className="sm:col-span-1">
              <label htmlFor="month" className="block text-sm font-medium text-gray-700">
                Month
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
                Year
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
                  Employee (Optional)
                </label>
                <select
                  id="employee"
                  value={selectedEmployeeId || ""}
                  onChange={(e) => setSelectedEmployeeId(e.target.value || null)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                >
                  <option value="">All Employees</option>
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
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-75"
              >
                {isLoading ? "Generating..." : "Generate Report"}
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
                {reportType === "attendance" && "Attendance Report"}
                {reportType === "payroll" && "Payroll Report"}
                {reportType === "financial" && "Financial Summary"}
              </h3>
              <p className="mt-1 max-w-2xl text-sm text-gray-500">
                {getMonthName(reportData.month)} {reportData.year}
              </p>
            </div>

            {reportType === "attendance" && (
              <div className="border-t border-gray-200">
                <div className="px-4 py-5 sm:p-6">
                  <p className="text-sm text-gray-700">
                    Working days in month: <span className="font-medium">{reportData.workingDays}</span>
                  </p>
                  
                  {reportData.employees.length === 0 ? (
                    <p className="mt-4 text-sm text-gray-700">No attendance records found.</p>
                  ) : (
                    <div className="mt-4">
                      {reportData.employees.map((employeeData: any) => (
                        <div key={employeeData.employee.id} className="mb-8">
                          <h4 className="text-md font-medium text-gray-900">
                            {employeeData.employee.name} ({employeeData.employee.employeeId})
                          </h4>
                          
                          <div className="mt-2 flex flex-wrap gap-4">
                            <div className="px-4 py-2 bg-gray-50 rounded-md">
                              <span className="text-xs text-gray-500">Present</span>
                              <p className="text-lg font-medium text-green-600">{employeeData.summary.present}</p>
                            </div>
                            <div className="px-4 py-2 bg-gray-50 rounded-md">
                              <span className="text-xs text-gray-500">Absent</span>
                              <p className="text-lg font-medium text-red-600">{employeeData.summary.absent}</p>
                            </div>
                            <div className="px-4 py-2 bg-gray-50 rounded-md">
                              <span className="text-xs text-gray-500">Late</span>
                              <p className="text-lg font-medium text-yellow-600">{employeeData.summary.late}</p>
                            </div>
                            <div className="px-4 py-2 bg-gray-50 rounded-md">
                              <span className="text-xs text-gray-500">Half Day</span>
                              <p className="text-lg font-medium text-orange-600">{employeeData.summary.halfday}</p>
                            </div>
                            <div className="px-4 py-2 bg-gray-50 rounded-md">
                              <span className="text-xs text-gray-500">Attendance Rate</span>
                              <p className="text-lg font-medium text-indigo-600">
                                {Math.round((employeeData.summary.present / reportData.workingDays) * 100)}%
                              </p>
                            </div>
                          </div>
                          
                          <div className="mt-4 overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-300">
                              <thead className="bg-gray-50">
                                <tr>
                                  <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Date</th>
                                  <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Status</th>
                                  <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Check In</th>
                                  <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Check Out</th>
                                  <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Notes</th>
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
                                        {record.status}
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
                    <p className="text-sm text-gray-700">No payroll records found.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-300">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Employee</th>
                            <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Base Salary</th>
                            <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Allowances</th>
                            <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Deductions</th>
                            <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Overtime</th>
                            <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Net Salary</th>
                            <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white">
                          {reportData.payroll.map((record: any) => (
                            <tr key={record.id}>
                              <td className="whitespace-nowrap px-3 py-4 text-sm font-medium text-gray-900">
                                {record.employee.name}
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
                              <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                {formatCurrency(record.overtimeAmount)}
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
                                      : "bg-red-100 text-red-800"
                                  }`}
                                >
                                  {record.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-gray-50">
                          <tr>
                            <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Total</th>
                            <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                              {formatCurrency(reportData.totals.baseSalary)}
                            </th>
                            <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                              {formatCurrency(reportData.totals.totalAllowances)}
                            </th>
                            <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                              {formatCurrency(reportData.totals.totalDeductions)}
                            </th>
                            <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                              {formatCurrency(reportData.totals.overtimeAmount)}
                            </th>
                            <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                              {formatCurrency(reportData.totals.netSalary)}
                            </th>
                            <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"></th>
                          </tr>
                        </tfoot>
                      </table>
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
                      <dt className="text-sm font-medium text-gray-500 truncate">Total Employees</dt>
                      <dd className="mt-1 text-3xl font-semibold text-gray-900">
                        {reportData.summary.totalEmployees}
                      </dd>
                    </div>

                    <div className="px-4 py-5 bg-white shadow rounded-lg overflow-hidden sm:p-6">
                      <dt className="text-sm font-medium text-gray-500 truncate">Total Salary Expense</dt>
                      <dd className="mt-1 text-3xl font-semibold text-gray-900">
                        {formatCurrency(reportData.summary.totalNetSalary)}
                      </dd>
                    </div>

                    <div className="px-4 py-5 bg-white shadow rounded-lg overflow-hidden sm:p-6">
                      <dt className="text-sm font-medium text-gray-500 truncate">Base Salary</dt>
                      <dd className="mt-1 text-3xl font-semibold text-gray-900">
                        {formatCurrency(reportData.summary.totalBaseSalary)}
                      </dd>
                    </div>

                    <div className="px-4 py-5 bg-white shadow rounded-lg overflow-hidden sm:p-6">
                      <dt className="text-sm font-medium text-gray-500 truncate">Allowances</dt>
                      <dd className="mt-1 text-3xl font-semibold text-gray-900">
                        {formatCurrency(reportData.summary.totalAllowances)}
                      </dd>
                    </div>

                    <div className="px-4 py-5 bg-white shadow rounded-lg overflow-hidden sm:p-6">
                      <dt className="text-sm font-medium text-gray-500 truncate">Deductions</dt>
                      <dd className="mt-1 text-3xl font-semibold text-gray-900">
                        {formatCurrency(reportData.summary.totalDeductions)}
                      </dd>
                    </div>

                    <div className="px-4 py-5 bg-white shadow rounded-lg overflow-hidden sm:p-6">
                      <dt className="text-sm font-medium text-gray-500 truncate">Overtime</dt>
                      <dd className="mt-1 text-3xl font-semibold text-gray-900">
                        {formatCurrency(reportData.summary.totalOvertimeAmount)}
                      </dd>
                    </div>
                  </dl>

                  <div className="mt-8">
                    <h4 className="text-lg font-medium text-gray-900">Payment Status</h4>
                    <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2">
                      <div className="px-4 py-5 bg-green-50 shadow rounded-lg overflow-hidden sm:p-6">
                        <dt className="text-sm font-medium text-green-800 truncate">Paid</dt>
                        <dd className="mt-1 text-3xl font-semibold text-green-800">
                          {formatCurrency(reportData.summary.totalPaid)}
                        </dd>
                      </div>

                      <div className="px-4 py-5 bg-yellow-50 shadow rounded-lg overflow-hidden sm:p-6">
                        <dt className="text-sm font-medium text-yellow-800 truncate">Pending</dt>
                        <dd className="mt-1 text-3xl font-semibold text-yellow-800">
                          {formatCurrency(reportData.summary.totalPending)}
                        </dd>
                      </div>
                    </div>
                  </div>

                  <div className="mt-8">
                    <h4 className="text-lg font-medium text-gray-900">Expense by Department</h4>
                    <div className="mt-4 overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-300">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Department</th>
                            <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Amount</th>
                            <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Percentage</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white">
                          {reportData.departmentExpenses.map((dept: any) => (
                            <tr key={dept.department}>
                              <td className="whitespace-nowrap px-3 py-4 text-sm font-medium text-gray-900">
                                {dept.department}
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
              Print Report
            </button>
          </div>
        </div>
      )}
    </div>
  );
} 