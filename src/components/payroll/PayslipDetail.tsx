"use client";

import { useState, useEffect, useCallback } from "react";
 
import { formatCurrency } from "@/lib/utils";
import { getEmployeeSoftLoanInfo } from "@/lib/softloan";

interface PayslipDetailProps {
  payrollId: string;
  onClose: () => void;
}

interface PayrollDetail {
  id: string;
  month: number;
  year: number;
  baseSalary: number;
  totalAllowances: number;
  totalDeductions: number;
  lateDeduction: number;
  netSalary: number;
  daysPresent: number;
  daysAbsent: number;
  overtimeHours: number;
  overtimeAmount: number;
  status: string;
  createdAt: string;
  paidAt: string | null;
  employee: {
    id: string;
    employeeId: string;
    user: {
      name: string;
    };
    position: string;
    division: string;
  };
  attendance?: {
    id: string;
    date: string;
    status: string;
    checkIn: string | null;
    checkOut: string | null;
    notes: string | null;
  }[];
  allowances?: {
    type: string;
    amount: number;
  }[];
}

interface DeductionBreakdown {
  advanceDeduction: number;
  softLoanDeduction: number;
  bpjsKesehatan: number;
  bpjsKetenagakerjaan: number;
  lateDeduction: number;
  absenceDeduction: number;
  otherDeductions: number;
  totalDeductions: number;
}

interface SoftLoanInfo {
  activeLoan: any;
  totalRemaining: number;
  monthlyPayment: number;
}

export default function PayslipDetail({ payrollId, onClose }: PayslipDetailProps) {
  const [payroll, setPayroll] = useState<PayrollDetail | null>(null);
  const [deductionBreakdown, setDeductionBreakdown] = useState<DeductionBreakdown | null>(null);
  const [softLoanInfo, setSoftLoanInfo] = useState<SoftLoanInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPayrollDetail = useCallback(async () => {
    try {
      setLoading(true);
      
      // Fetch payroll detail
      const payrollResponse = await fetch(`/api/payroll/${payrollId}`);
      if (!payrollResponse.ok) {
        throw new Error("Gagal mengambil detail slip gaji");
      }
      const payrollData = await payrollResponse.json();
      setPayroll(payrollData);

      // Fetch deduction breakdown
      const deductionResponse = await fetch(`/api/payroll/${payrollId}/deductions`);
      if (deductionResponse.ok) {
        const deductionData = await deductionResponse.json();
        setDeductionBreakdown(deductionData);
      }

      // Fetch soft loan info if employee has active loan
      if (payrollData.employee?.id) {
        try {
          const loanInfo = await getEmployeeSoftLoanInfo(payrollData.employee.id);
          setSoftLoanInfo(loanInfo);
        } catch {
          // No active loan, which is fine
          setSoftLoanInfo(null);
        }
      }
    } catch (err) {
      console.error("Error fetching payroll detail:", err);
      setError("Gagal memuat detail slip gaji");
    } finally {
      setLoading(false);
    }
  }, [payrollId]);

  useEffect(() => {
    fetchPayrollDetail();
  }, [fetchPayrollDetail]);

  const getMonthName = (month: number): string => {
    const date = new Date();
    date.setMonth(month - 1);
    return date.toLocaleString('id-ID', { month: 'long' });
  };

  const formatDate = (date: string | null): string => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString('id-ID', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const printPayslip = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-md flex items-center justify-center z-50">
        <div className="bg-white p-6 rounded-lg">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-center text-gray-600">Memuat slip gaji...</p>
        </div>
      </div>
    );
  }

  if (error || !payroll) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-md flex items-center justify-center z-50">
        <div className="bg-white p-6 rounded-lg max-w-md w-full mx-4">
          <h3 className="text-lg font-semibold text-red-600 mb-2">Error</h3>
          <p className="text-gray-600 mb-4">{error || "Slip gaji tidak ditemukan"}</p>
          <button
            onClick={onClose}
            className="w-full bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700"
          >
            Tutup
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-200 print:hidden">
          <h2 className="text-xl font-semibold text-gray-900">Slip Gaji Karyawan</h2>
          <div className="flex space-x-2">
            <button
              onClick={printPayslip}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex items-center space-x-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              <span>Cetak</span>
            </button>
            <button
              onClick={onClose}
              className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700"
            >
              Tutup
            </button>
          </div>
        </div>

        {/* Payslip Content */}
        <div className="p-6 print:p-8">
          {/* Company Header */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-gray-900">CV. Catur Teknik Utama</h1>
            <p className="text-gray-600">Kmp Jerang Baru Permai, Jl, Cendana Raya No 26</p>
            <h2 className="text-xl font-semibold mt-4 text-gray-800">SLIP GAJI KARYAWAN</h2>
          </div>

          {/* Employee Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="font-medium text-gray-700">ID Karyawan:</span>
                <span className="text-gray-900">{payroll.employee.employeeId}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium text-gray-700">Nama:</span>
                <span className="text-gray-900">{payroll.employee.user.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium text-gray-700">Jabatan:</span>
                <span className="text-gray-900">{payroll.employee.position}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium text-gray-700">Divisi:</span>
                <span className="text-gray-900">{payroll.employee.division}</span>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="font-medium text-gray-700">Periode:</span>
                <span className="text-gray-900">{getMonthName(payroll.month)} {payroll.year}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium text-gray-700">Tanggal Cetak:</span>
                <span className="text-gray-900">{formatDate(new Date().toISOString())}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium text-gray-700">Status:</span>
                <span className={`font-semibold ${
                  payroll.status === "PAID" ? "text-green-600" : 
                  payroll.status === "PENDING" ? "text-yellow-600" : "text-gray-600"
                }`}>
                  {payroll.status === "PAID" ? "DIBAYAR" : 
                   payroll.status === "PENDING" ? "DALAM PROSES" : payroll.status}
                </span>
              </div>
              {payroll.paidAt && (
                <div className="flex justify-between">
                  <span className="font-medium text-gray-700">Tanggal Bayar:</span>
                  <span className="text-gray-900">{formatDate(payroll.paidAt)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Attendance Info */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Informasi Kehadiran</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-green-50 p-4 rounded-lg">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{payroll.daysPresent}</div>
                  <div className="text-sm text-gray-600">Hari Masuk</div>
                </div>
              </div>
              <div className="bg-red-50 p-4 rounded-lg">
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">{payroll.daysAbsent}</div>
                  <div className="text-sm text-gray-600">Hari Tidak Masuk</div>
                </div>
              </div>
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{payroll.overtimeHours}</div>
                  <div className="text-sm text-gray-600">Jam Lembur</div>
                </div>
              </div>
            </div>
          </div>

          {/* Detailed Absence List */}
          {payroll.attendance && payroll.attendance.some(a => a.status === "ABSENT") && (
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Rincian Ketidakhadiran</h3>
              <div className="bg-white border rounded-lg overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tanggal</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Keterangan</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {payroll.attendance
                      .filter(a => a.status === "ABSENT")
                      .map((record) => (
                        <tr key={record.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {formatDate(record.date)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                              Tidak Hadir (A)
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {record.notes || "-"}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Salary Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {/* Income */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Pendapatan</h3>
              <div className="bg-gray-50 p-4 rounded-lg space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-700">Gaji Pokok</span>
                  <span className="font-medium text-gray-900">{formatCurrency(payroll.baseSalary)}</span>
                </div>
                {payroll.allowances && payroll.allowances.length > 0 ? (
                  payroll.allowances.map((allowance, index) => (
                    <div key={index} className="flex justify-between">
                      <span className="text-gray-700">
                        {allowance.type === "NON_SHIFT_MEAL_ALLOWANCE" ? "Tunjangan Makan" :
                         allowance.type === "NON_SHIFT_TRANSPORT_ALLOWANCE" ? "Tunjangan Transport" :
                         allowance.type === "SHIFT_FIXED_ALLOWANCE" ? "Tunjangan Shift" :
                         allowance.type.startsWith("TUNJANGAN_JABATAN") ? "Tunjangan Jabatan" :
                         "Tunjangan Lainnya"}
                      </span>
                      <span className="font-medium text-gray-900">{formatCurrency(allowance.amount)}</span>
                    </div>
                  ))
                ) : (
                  payroll.totalAllowances > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-700">Total Tunjangan</span>
                      <span className="font-medium text-gray-900">{formatCurrency(payroll.totalAllowances)}</span>
                    </div>
                  )
                )}
                <div className="flex justify-between">
                  <span className="text-gray-700">Lembur</span>
                  <span className="font-medium text-gray-900">{formatCurrency(payroll.overtimeAmount)}</span>
                </div>
                <div className="border-t pt-3">
                  <div className="flex justify-between font-semibold">
                    <span className="text-gray-900">Total Pendapatan</span>
                    <span className="text-green-600">
                      {formatCurrency(payroll.baseSalary + payroll.totalAllowances + payroll.overtimeAmount)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Deductions */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Potongan</h3>
              <div className="bg-gray-50 p-4 rounded-lg space-y-3">
                {deductionBreakdown ? (
                  <>
                    {deductionBreakdown.advanceDeduction > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-700">Potongan Kasbon</span>
                        <span className="font-medium text-red-600">{formatCurrency(deductionBreakdown.advanceDeduction)}</span>
                      </div>
                    )}
                    {deductionBreakdown.softLoanDeduction > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-700">Potongan Pinjaman Lunak</span>
                        <span className="font-medium text-red-600">{formatCurrency(deductionBreakdown.softLoanDeduction)}</span>
                      </div>
                    )}
                    {deductionBreakdown.bpjsKesehatan > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-700">BPJS Kesehatan</span>
                        <span className="font-medium text-red-600">{formatCurrency(deductionBreakdown.bpjsKesehatan)}</span>
                      </div>
                    )}
                    {deductionBreakdown.bpjsKetenagakerjaan > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-700">BPJS Ketenagakerjaan</span>
                        <span className="font-medium text-red-600">{formatCurrency(deductionBreakdown.bpjsKetenagakerjaan)}</span>
                      </div>
                    )}
                    {deductionBreakdown.lateDeduction > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-700">Potongan Terlambat</span>
                        <span className="font-medium text-red-600">{formatCurrency(deductionBreakdown.lateDeduction)}</span>
                      </div>
                    )}
                    {deductionBreakdown.absenceDeduction > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-700">Potongan Tidak Masuk</span>
                        <span className="font-medium text-red-600">{formatCurrency(deductionBreakdown.absenceDeduction)}</span>
                      </div>
                    )}
                    {deductionBreakdown.otherDeductions > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-700">Potongan Lainnya</span>
                        <span className="font-medium text-red-600">{formatCurrency(deductionBreakdown.otherDeductions)}</span>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex justify-between">
                    <span className="text-gray-700">Total Potongan</span>
                    <span className="font-medium text-red-600">{formatCurrency(payroll.totalDeductions)}</span>
                  </div>
                )}
                <div className="border-t pt-3">
                  <div className="flex justify-between font-semibold">
                    <span className="text-gray-900">Total Potongan</span>
                    <span className="text-red-600">{formatCurrency(payroll.totalDeductions)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Soft Loan Info - hanya tampilkan jika ada potongan pinjaman lunak */}
          {deductionBreakdown && deductionBreakdown.softLoanDeduction > 0 && (
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Informasi Pinjaman Lunak</h3>
              {softLoanInfo && softLoanInfo.activeLoan && softLoanInfo.activeLoan.totalAmount > 0 ? (
                <div className="bg-blue-50 p-4 rounded-lg">
                  {/* Pastikan nilai tidak undefined atau null */}
                  {(() => {
                    const totalAmount = softLoanInfo.activeLoan.totalAmount || 0;
                    const remainingAmount = softLoanInfo.totalRemaining || 0;
                    const paidAmount = totalAmount - remainingAmount;
                    const progressPercentage = totalAmount > 0 ? ((paidAmount / totalAmount) * 100).toFixed(1) : '0.0';
                    
                    // Log untuk debugging
                    console.log("Soft Loan Info in PayslipDetail:", {
                      totalAmount,
                      paidAmount,
                      remainingAmount,
                      progressPercentage
                    });
                    
                    return (
                      <>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="text-center">
                            <div className="text-lg font-bold text-blue-600">{formatCurrency(totalAmount)}</div>
                            <div className="text-sm text-gray-600">Total Pinjaman</div>
                          </div>
                          <div className="text-center">
                            <div className="text-lg font-bold text-green-600">{formatCurrency(paidAmount)}</div>
                            <div className="text-sm text-gray-600">Sudah Dibayar</div>
                          </div>
                          <div className="text-center">
                            <div className="text-lg font-bold text-orange-600">{formatCurrency(remainingAmount)}</div>
                            <div className="text-sm text-gray-600">Sisa Pinjaman</div>
                          </div>
                        </div>
                        <div className="mt-4">
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-blue-600 h-2 rounded-full" 
                              style={{ width: `${progressPercentage}%` }}
                            ></div>
                          </div>
                          <div className="text-center text-sm text-gray-600 mt-2">
                            Progress Pembayaran: {progressPercentage}%
                          </div>
                        </div>
                      </>
                    );
                  })()} 
                </div>
              ) : (
                <div className="bg-gray-50 p-4 rounded-lg text-center">
                  <p className="text-gray-600">Pinjaman lunak telah dilunasi atau tidak ada pinjaman aktif.</p>
                  <p className="text-gray-600 mt-2">Cicilan bulan ini: {formatCurrency(deductionBreakdown.softLoanDeduction)}</p>
                </div>
              )}
            </div>
          )}

          {/* Cash Advance Info - hanya tampilkan jika ada potongan kasbon */}
          {deductionBreakdown && deductionBreakdown.advanceDeduction > 0 && (
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Informasi Kasbon</h3>
              <div className="bg-yellow-50 p-4 rounded-lg">
                <div className="text-center">
                  <div className="text-lg font-bold text-yellow-600">{formatCurrency(deductionBreakdown.advanceDeduction)}</div>
                  <div className="text-sm text-gray-600">Jumlah Kasbon</div>
                </div>
              </div>
            </div>
          )}

          {/* Net Salary */}
          <div className="border-t-2 border-gray-300 pt-6">
            <div className="bg-green-50 p-6 rounded-lg">
              <div className="flex justify-between items-center">
                <span className="text-xl font-bold text-gray-900">GAJI BERSIH</span>
                <span className="text-2xl font-bold text-green-600">{formatCurrency(payroll.netSalary)}</span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-8 text-center text-sm text-gray-500">
            <p>Slip gaji ini dicetak secara otomatis oleh sistem</p>
            <p>Tanggal cetak: {formatDate(new Date().toISOString())}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
