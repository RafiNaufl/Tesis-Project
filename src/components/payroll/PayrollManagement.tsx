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
  createdAt: Date;
  paidAt: Date | null;
  employee: {
    id: string;
    employeeId: string;
    user: {
      name: string;
    };
  };
};

export default function PayrollManagement() {
  const { data: session } = useSession();
  const [isLoading, setIsLoading] = useState(true);
  const [payrollRecords, setPayrollRecords] = useState<PayrollRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const isAdmin = session?.user?.role === "ADMIN";

  // Mock data for now - in a real app, you would fetch this from your API
  useEffect(() => {
    const fetchPayroll = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        // Simulate API call with mock data
        setTimeout(() => {
          const mockPayrollData: PayrollRecord[] = [
            {
              id: "1",
              month: selectedMonth,
              year: selectedYear,
              baseSalary: 5000,
              totalAllowances: 500,
              totalDeductions: 800,
              netSalary: 4700,
              daysPresent: 22,
              daysAbsent: 1,
              overtimeHours: 5,
              overtimeAmount: 250,
              status: "PAID",
              createdAt: new Date(),
              paidAt: new Date(),
              employee: {
                id: "1",
                employeeId: "EMP001",
                user: {
                  name: "John Doe",
                },
              },
            },
            {
              id: "2",
              month: selectedMonth,
              year: selectedYear,
              baseSalary: 6000,
              totalAllowances: 600,
              totalDeductions: 1000,
              netSalary: 5600,
              daysPresent: 20,
              daysAbsent: 3,
              overtimeHours: 0,
              overtimeAmount: 0,
              status: "PENDING",
              createdAt: new Date(),
              paidAt: null,
              employee: {
                id: "2",
                employeeId: "EMP002",
                user: {
                  name: "Jane Smith",
                },
              },
            },
          ];
          
          setPayrollRecords(mockPayrollData);
          setIsLoading(false);
        }, 1000);
      } catch (err) {
        console.error("Error fetching payroll:", err);
        setError("Failed to load payroll records");
        setIsLoading(false);
      }
    };

    if (session) {
      fetchPayroll();
    }
  }, [session, selectedMonth, selectedYear]);

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const formatDate = (date: Date | null): string => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString();
  };

  const getMonthName = (month: number): string => {
    const date = new Date();
    date.setMonth(month - 1);
    return date.toLocaleString('default', { month: 'long' });
  };

  const handleGeneratePayroll = () => {
    // In a real app, this would call an API to generate payroll
    alert("This would generate payroll for the selected month and year");
  };

  const handleMarkAsPaid = (id: string) => {
    // In a real app, this would call an API to mark a payroll as paid
    setPayrollRecords(
      payrollRecords.map((record) =>
        record.id === id
          ? { ...record, status: "PAID", paidAt: new Date() }
          : record
      )
    );
  };

  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const years = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 5 + i);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Payroll</h1>
        <p className="mt-1 text-sm text-gray-500">
          {isAdmin
            ? "Manage employee payroll"
            : "View your payroll information"}
        </p>
      </div>

      <div className="mt-8">
        <div className="sm:flex sm:items-center">
          <div className="sm:flex-auto">
            <h2 className="text-xl font-semibold text-gray-900">
              Payroll Records
            </h2>
            <p className="mt-2 text-sm text-gray-700">
              {isAdmin
                ? "View and manage employee payroll records"
                : "View your payroll records"}
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
                className="inline-flex items-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              >
                Generate Payroll
              </button>
            )}
          </div>
        </div>
        <div className="mt-4 flex flex-col">
          <div className="-my-2 -mx-4 overflow-x-auto sm:-mx-6 lg:-mx-8">
            <div className="inline-block min-w-full py-2 align-middle md:px-6 lg:px-8">
              <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
                <table className="min-w-full divide-y divide-gray-300">
                  <thead className="bg-gray-50">
                    <tr>
                      {isAdmin && (
                        <th
                          scope="col"
                          className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6"
                        >
                          Employee
                        </th>
                      )}
                      <th
                        scope="col"
                        className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                      >
                        Period
                      </th>
                      <th
                        scope="col"
                        className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                      >
                        Base Salary
                      </th>
                      <th
                        scope="col"
                        className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                      >
                        Allowances
                      </th>
                      <th
                        scope="col"
                        className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                      >
                        Deductions
                      </th>
                      <th
                        scope="col"
                        className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                      >
                        Net Salary
                      </th>
                      <th
                        scope="col"
                        className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                      >
                        Status
                      </th>
                      <th
                        scope="col"
                        className="relative py-3.5 pl-3 pr-4 sm:pr-6"
                      >
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {isLoading ? (
                      <tr>
                        <td
                          colSpan={isAdmin ? 8 : 7}
                          className="whitespace-nowrap py-4 px-3 text-sm text-gray-500 text-center"
                        >
                          Loading...
                        </td>
                      </tr>
                    ) : payrollRecords.length === 0 ? (
                      <tr>
                        <td
                          colSpan={isAdmin ? 8 : 7}
                          className="whitespace-nowrap py-4 px-3 text-sm text-gray-500 text-center"
                        >
                          No payroll records found
                        </td>
                      </tr>
                    ) : (
                      payrollRecords.map((record) => (
                        <tr key={record.id}>
                          {isAdmin && (
                            <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">
                              {record.employee.user.name}
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
                                  : "bg-red-100 text-red-800"
                              }`}
                            >
                              {record.status}
                            </span>
                          </td>
                          <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                            {isAdmin && record.status === "PENDING" ? (
                              <button
                                onClick={() => handleMarkAsPaid(record.id)}
                                className="text-indigo-600 hover:text-indigo-900 mr-4"
                              >
                                Mark as Paid
                              </button>
                            ) : (
                              <button
                                className="text-indigo-600 hover:text-indigo-900"
                              >
                                View Details
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      {!isAdmin && (
        <div className="mt-8">
          <div className="overflow-hidden bg-white shadow sm:rounded-lg">
            <div className="px-4 py-5 sm:px-6">
              <h3 className="text-lg font-medium leading-6 text-gray-900">
                Payroll Summary
              </h3>
              <p className="mt-1 max-w-2xl text-sm text-gray-500">
                Summary of your payroll information for {getMonthName(selectedMonth)} {selectedYear}
              </p>
            </div>
            <div className="border-t border-gray-200 px-4 py-5 sm:p-0">
              <dl className="sm:divide-y sm:divide-gray-200">
                <div className="py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:py-5 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">Base Salary</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:col-span-2 sm:mt-0">
                    {payrollRecords.length > 0 
                      ? formatCurrency(payrollRecords[0].baseSalary) 
                      : "-"}
                  </dd>
                </div>
                <div className="py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:py-5 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">Days Present</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:col-span-2 sm:mt-0">
                    {payrollRecords.length > 0 ? payrollRecords[0].daysPresent : "-"}
                  </dd>
                </div>
                <div className="py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:py-5 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">Days Absent</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:col-span-2 sm:mt-0">
                    {payrollRecords.length > 0 ? payrollRecords[0].daysAbsent : "-"}
                  </dd>
                </div>
                <div className="py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:py-5 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">Overtime Hours</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:col-span-2 sm:mt-0">
                    {payrollRecords.length > 0 ? payrollRecords[0].overtimeHours : "-"}
                  </dd>
                </div>
                <div className="py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:py-5 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">Overtime Amount</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:col-span-2 sm:mt-0">
                    {payrollRecords.length > 0 
                      ? formatCurrency(payrollRecords[0].overtimeAmount) 
                      : "-"}
                  </dd>
                </div>
                <div className="py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:py-5 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">Total Allowances</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:col-span-2 sm:mt-0">
                    {payrollRecords.length > 0 
                      ? formatCurrency(payrollRecords[0].totalAllowances) 
                      : "-"}
                  </dd>
                </div>
                <div className="py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:py-5 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">Total Deductions</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:col-span-2 sm:mt-0">
                    {payrollRecords.length > 0 
                      ? formatCurrency(payrollRecords[0].totalDeductions) 
                      : "-"}
                  </dd>
                </div>
                <div className="py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:py-5 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">Net Salary</dt>
                  <dd className="mt-1 text-sm font-semibold text-gray-900 sm:col-span-2 sm:mt-0">
                    {payrollRecords.length > 0 
                      ? formatCurrency(payrollRecords[0].netSalary) 
                      : "-"}
                  </dd>
                </div>
                <div className="py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:py-5 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">Payment Status</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:col-span-2 sm:mt-0">
                    {payrollRecords.length > 0 ? (
                      <span
                        className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${
                          payrollRecords[0].status === "PAID"
                            ? "bg-green-100 text-green-800"
                            : payrollRecords[0].status === "PENDING"
                            ? "bg-yellow-100 text-yellow-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {payrollRecords[0].status}
                      </span>
                    ) : (
                      "-"
                    )}
                  </dd>
                </div>
                <div className="py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:py-5 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">Payment Date</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:col-span-2 sm:mt-0">
                    {payrollRecords.length > 0 && payrollRecords[0].paidAt
                      ? formatDate(payrollRecords[0].paidAt)
                      : "Pending"}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 