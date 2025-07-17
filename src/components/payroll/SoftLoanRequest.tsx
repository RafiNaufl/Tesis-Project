"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { formatCurrency } from "@/lib/utils";

interface SoftLoanRequestProps {
  onSuccess?: () => void;
}

export default function SoftLoanRequest({ onSuccess }: SoftLoanRequestProps) {
  const { data: session } = useSession();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    totalAmount: "",
    durationMonths: 3,
    reason: "",
  });

  const durationOptions = [
    { value: 3, label: "3 Bulan" },
    { value: 6, label: "6 Bulan" },
    { value: 12, label: "12 Bulan" },
  ];

  const calculateMonthlyPayment = () => {
    const amount = parseFloat(formData.totalAmount);
    if (amount > 0) {
      return amount / formData.durationMonths;
    }
    return 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const totalAmount = parseFloat(formData.totalAmount);
      
      if (totalAmount <= 0) {
        throw new Error("Jumlah pinjaman harus lebih dari 0");
      }

      if (!formData.reason.trim()) {
        throw new Error("Alasan permohonan harus diisi");
      }

      const monthlyAmount = totalAmount / formData.durationMonths;

      const response = await fetch("/api/payroll/soft-loans", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          totalAmount,
          monthlyAmount,
          durationMonths: formData.durationMonths,
          reason: formData.reason,
          startMonth: new Date().getMonth() + 1,
          startYear: new Date().getFullYear(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Gagal mengajukan pinjaman lunak");
      }

      setSuccess("Permohonan pinjaman lunak berhasil diajukan dan menunggu persetujuan admin");
      setFormData({ totalAmount: "", durationMonths: 3, reason: "" });
      
      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      setError(err.message || "Terjadi kesalahan saat mengajukan pinjaman lunak");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ 
      ...prev, 
      [name]: name === 'durationMonths' ? parseInt(value) : value 
    }));
  };

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <div className="mb-6">
        <h2 className="text-lg font-medium text-gray-900">Pengajuan Pinjaman Lunak</h2>
        <p className="mt-1 text-sm text-gray-500">
          Ajukan pinjaman lunak yang akan dipotong secara bertahap sesuai periode yang dipilih
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-4">
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

      {success && (
        <div className="mb-4 rounded-md bg-green-50 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-green-700">{success}</p>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="totalAmount" className="block text-sm font-medium text-gray-700">
            Jumlah Pinjaman Lunak *
          </label>
          <div className="mt-1 relative rounded-md shadow-sm">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <span className="text-gray-500 sm:text-sm">Rp</span>
            </div>
            <input
              type="number"
              name="totalAmount"
              id="totalAmount"
              value={formData.totalAmount}
              onChange={handleInputChange}
              className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-12 pr-12 sm:text-sm border-gray-300 rounded-md"
              placeholder="0"
              min="1"
              step="1000"
              required
            />
          </div>
          <p className="mt-1 text-xs text-gray-500">
            Masukkan jumlah pinjaman lunak yang dibutuhkan
          </p>
        </div>

        <div>
          <label htmlFor="durationMonths" className="block text-sm font-medium text-gray-700">
            Periode Potongan *
          </label>
          <div className="mt-1">
            <select
              name="durationMonths"
              id="durationMonths"
              value={formData.durationMonths}
              onChange={handleInputChange}
              className="focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
              required
            >
              {durationOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <p className="mt-1 text-xs text-gray-500">
            Pilih periode potongan pinjaman dari gaji bulanan
          </p>
        </div>

        {formData.totalAmount && (
          <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-blue-800">Rincian Pembayaran</h3>
                <div className="mt-2 text-sm text-blue-700">
                  <p><strong>Total Pinjaman:</strong> {formatCurrency(parseFloat(formData.totalAmount))}</p>
                  <p><strong>Periode:</strong> {formData.durationMonths} bulan</p>
                  <p><strong>Potongan per Bulan:</strong> {formatCurrency(calculateMonthlyPayment())}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        <div>
          <label htmlFor="reason" className="block text-sm font-medium text-gray-700">
            Alasan Permohonan *
          </label>
          <div className="mt-1">
            <textarea
              name="reason"
              id="reason"
              rows={4}
              value={formData.reason}
              onChange={handleInputChange}
              className="focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
              placeholder="Jelaskan alasan mengajukan pinjaman lunak (contoh: renovasi rumah, biaya pendidikan, dll.)"
              required
            />
          </div>
          <p className="mt-1 text-xs text-gray-500">
            Berikan penjelasan yang jelas mengenai alasan permohonan pinjaman lunak
          </p>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">Informasi Penting</h3>
              <div className="mt-2 text-sm text-yellow-700">
                <ul className="list-disc pl-5 space-y-1">
                  <li>Pinjaman lunak yang disetujui akan dipotong secara bertahap sesuai periode yang dipilih</li>
                  <li>Potongan akan dimulai dari bulan berikutnya setelah persetujuan</li>
                  <li>Permohonan akan ditinjau oleh admin sebelum disetujui</li>
                  <li>Anda akan mendapat notifikasi setelah permohonan diproses</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? "Mengajukan..." : "Ajukan Pinjaman Lunak"}
          </button>
        </div>
      </form>
    </div>
  );
}