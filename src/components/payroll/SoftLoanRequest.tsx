"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { formatCurrency } from "@/lib/utils";
import SoftLoanManagement from "./SoftLoanManagement";
import { 
  Wallet, 
  History, 
  CreditCard, 
  AlertCircle, 
  CheckCircle2, 
  Info,
  CalendarClock,
  FileText,
  Loader2,
  ChevronRight,
  Calculator
} from "lucide-react";

interface SoftLoanRequestProps {
  onSuccess?: () => void;
}

export default function SoftLoanRequest({ onSuccess }: SoftLoanRequestProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [activeTab, setActiveTab] = useState("pengajuan");
  
  const schema = z.object({
    totalAmount: z
      .string()
      .refine((v) => !isNaN(parseFloat(v)) && parseFloat(v) > 0 && parseFloat(v) % 1 === 0, {
        message: "Jumlah pinjaman harus bilangan bulat lebih dari 0",
      }),
    durationMonths: z.enum(["3", "6", "12"]),
    reason: z.string().min(10, { message: "Alasan minimal 10 karakter" }),
  });

  const {
    register,
    handleSubmit: rhfHandleSubmit,
    formState: { errors },
    reset,
    watch,
  } = useForm<{ totalAmount: string; durationMonths: string; reason: string }>({
    resolver: zodResolver(schema),
    defaultValues: { totalAmount: "", durationMonths: "3", reason: "" },
  });

  const durationOptions = [
    { value: 3, label: "3 Bulan" },
    { value: 6, label: "6 Bulan" },
    { value: 12, label: "12 Bulan" },
  ];

  const calculateMonthlyPayment = () => {
    const amount = parseFloat(watch("totalAmount"));
    if (amount > 0) {
      return amount / parseInt(watch("durationMonths") || "0");
    }
    return 0;
  };

  const onSubmit = async () => {
    setError(null);
    setShowModal(true);
  };
  
  const handleConfirmSubmit = async () => {
    setIsSubmitting(true);
    setError(null);
    setSuccess(null);
    setShowModal(false);

    try {
      const totalAmount = parseFloat(watch("totalAmount"));
      const monthlyAmount = totalAmount / parseInt(watch("durationMonths") || "0");

      const response = await fetch("/api/payroll/soft-loans", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          totalAmount,
          monthlyAmount,
          durationMonths: parseInt(watch("durationMonths") || "0"),
          reason: watch("reason"),
          startMonth: new Date().getMonth() + 1,
          startYear: new Date().getFullYear(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Gagal mengajukan pinjaman lunak");
      }

      setSuccess("Permohonan pinjaman lunak berhasil diajukan dan menunggu persetujuan admin");
      reset();
      
      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      setError(err.message || "Terjadi kesalahan saat mengajukan pinjaman lunak");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white shadow-sm rounded-xl overflow-hidden border border-gray-100">
      <div className="p-6 border-b border-gray-100 bg-white">
        <h2 className="text-xl font-bold text-gray-900 flex items-center">
          <Wallet className="w-6 h-6 mr-2 text-indigo-600" />
          Pinjaman Lunak
        </h2>
        <p className="mt-2 text-sm text-gray-600">
          Fasilitas pinjaman perusahaan dengan potongan gaji bertahap tanpa bunga.
        </p>
      </div>
      
      {/* Segmented Control Tab Navigation */}
      <div className="p-4 border-b border-gray-100 bg-gray-50/50">
        <div className="flex bg-gray-200/50 p-1 rounded-lg max-w-md mx-auto sm:mx-0">
          <button
            onClick={() => setActiveTab("pengajuan")}
            className={`flex-1 flex items-center justify-center py-2 text-sm font-medium rounded-md transition-all duration-200 ${
              activeTab === "pengajuan" 
                ? "bg-white text-indigo-600 shadow-sm ring-1 ring-black/5" 
                : "text-gray-500 hover:text-gray-700 hover:bg-gray-200/50"
            }`}
          >
            <CreditCard className="w-4 h-4 mr-2" />
            Pengajuan
          </button>
          <button
            onClick={() => setActiveTab("histori")}
            className={`flex-1 flex items-center justify-center py-2 text-sm font-medium rounded-md transition-all duration-200 ${
              activeTab === "histori" 
                ? "bg-white text-indigo-600 shadow-sm ring-1 ring-black/5" 
                : "text-gray-500 hover:text-gray-700 hover:bg-gray-200/50"
            }`}
          >
            <History className="w-4 h-4 mr-2" />
            Histori
          </button>
        </div>
      </div>
      
      {/* Tab Content */}
      <div className="p-6">
      {activeTab === "pengajuan" ? (
        <div className="max-w-4xl mx-auto">
          {/* Info Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100/50">
              <div className="flex items-center mb-2">
                <div className="p-2 bg-blue-100 rounded-lg mr-3">
                  <FileText className="h-5 w-5 text-blue-600" />
                </div>
                <h3 className="font-semibold text-blue-900 text-sm">1. Pengajuan</h3>
              </div>
              <p className="text-xs text-blue-700 leading-relaxed pl-12">Isi formulir lengkap dengan alasan yang jelas</p>
            </div>
            
            <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100/50">
              <div className="flex items-center mb-2">
                <div className="p-2 bg-indigo-100 rounded-lg mr-3">
                  <CheckCircle2 className="h-5 w-5 text-indigo-600" />
                </div>
                <h3 className="font-semibold text-indigo-900 text-sm">2. Persetujuan</h3>
              </div>
              <p className="text-xs text-indigo-700 leading-relaxed pl-12">Admin meninjau dan menyetujui pengajuan</p>
            </div>
            
            <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-100/50">
              <div className="flex items-center mb-2">
                <div className="p-2 bg-emerald-100 rounded-lg mr-3">
                  <Wallet className="h-5 w-5 text-emerald-600" />
                </div>
                <h3 className="font-semibold text-emerald-900 text-sm">3. Pencairan</h3>
              </div>
              <p className="text-xs text-emerald-700 leading-relaxed pl-12">Dana dicairkan setelah disetujui admin</p>
            </div>
          </div>

          {error && (
            <div className="mb-6 rounded-xl bg-red-50 p-4 border border-red-100 flex items-start">
              <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 mr-3 flex-shrink-0" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {success && (
            <div className="mb-6 rounded-xl bg-green-50 p-4 border border-green-100 flex items-start">
              <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 mr-3 flex-shrink-0" />
              <p className="text-sm text-green-700">{success}</p>
            </div>
          )}

          <form onSubmit={rhfHandleSubmit(onSubmit)} className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Form Section */}
              <div className="space-y-6">
                <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                  <h3 className="text-base font-semibold text-gray-900 mb-5 flex items-center">
                    <CreditCard className="w-5 h-5 mr-2 text-indigo-500" />
                    Detail Pinjaman
                  </h3>
                  
                  <div className="space-y-5">
                    <div>
                      <label htmlFor="totalAmount" className="block text-sm font-medium text-gray-700 mb-1">
                        Jumlah Pinjaman <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                          <span className="text-gray-500 font-semibold">Rp</span>
                        </div>
                        <input
                          type="number"
                          id="totalAmount"
                          {...register("totalAmount")}
                          className="block w-full pl-12 pr-4 py-3 text-lg font-semibold text-gray-900 border-gray-300 rounded-xl focus:ring-indigo-500 focus:border-indigo-500 shadow-sm transition-all"
                          placeholder="0"
                          step="1000"
                        />
                      </div>
                      {errors.totalAmount && (
                        <p className="mt-1.5 text-sm text-red-600 flex items-center">
                          <AlertCircle className="w-3 h-3 mr-1" />
                          {errors.totalAmount.message as string}
                        </p>
                      )}
                      <p className="mt-2 text-xs text-gray-500 flex items-center">
                        <Info className="w-3 h-3 mr-1" />
                        Masukkan nominal tanpa titik atau koma
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-3">
                        Durasi Cicilan <span className="text-red-500">*</span>
                      </label>
                      <div className="grid grid-cols-3 gap-3">
                        {durationOptions.map((option) => (
                          <label key={option.value} className="relative cursor-pointer group">
                            <input 
                              type="radio" 
                              value={option.value}
                              {...register("durationMonths")}
                              className="peer sr-only"
                            />
                            <div className="flex flex-col items-center justify-center p-3 text-gray-500 bg-white border border-gray-200 rounded-xl peer-checked:border-indigo-500 peer-checked:bg-indigo-50 peer-checked:text-indigo-600 transition-all hover:border-gray-300 hover:shadow-md h-full">
                              <CalendarClock className="w-5 h-5 mb-1 opacity-50 peer-checked:opacity-100" />
                              <span className="text-lg font-bold">{option.value}</span>
                              <span className="text-xs font-medium">Bulan</span>
                            </div>
                            <div className="absolute inset-0 border-2 border-indigo-500 rounded-xl opacity-0 peer-checked:opacity-100 pointer-events-none transition-opacity" />
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                  <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center">
                    <FileText className="w-5 h-5 mr-2 text-indigo-500" />
                    Alasan Pengajuan
                  </h3>
                  
                  <div>
                    <textarea
                      id="reason"
                      rows={4}
                      {...register("reason")}
                      className="block w-full text-sm border-gray-300 rounded-xl focus:ring-indigo-500 focus:border-indigo-500 shadow-sm resize-none py-3 px-4"
                      placeholder="Jelaskan alasan pengajuan pinjaman secara detail..."
                      maxLength={500}
                    />
                    {errors.reason && (
                      <p className="mt-1.5 text-sm text-red-600 flex items-center">
                        <AlertCircle className="w-3 h-3 mr-1" />
                        {errors.reason.message as string}
                      </p>
                    )}
                    <div className="flex justify-between mt-2 text-xs text-gray-500">
                      <span>Minimal 10 karakter</span>
                      <span>{watch("reason")?.length || 0}/500</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Summary Section */}
              <div className="lg:pl-4">
                <div className="sticky top-6">
                  <div className="bg-gradient-to-br from-indigo-600 to-blue-700 rounded-2xl p-6 text-white shadow-xl">
                    <h3 className="text-lg font-bold mb-6 flex items-center text-white/90">
                      <Calculator className="w-5 h-5 mr-2" />
                      Simulasi Cicilan
                    </h3>
                    
                    <div className="space-y-6">
                      <div className="flex justify-between items-center border-b border-white/20 pb-4">
                        <span className="text-indigo-100 text-sm">Total Pinjaman</span>
                        <span className="text-xl font-bold">
                          {watch("totalAmount") ? formatCurrency(parseFloat(watch("totalAmount"))) : "Rp 0"}
                        </span>
                      </div>
                      
                      <div className="flex justify-between items-center border-b border-white/20 pb-4">
                        <span className="text-indigo-100 text-sm">Durasi</span>
                        <span className="text-xl font-bold">
                          {parseInt(watch("durationMonths") || "0")} Bulan
                        </span>
                      </div>
                      
                      <div className="pt-2">
                        <span className="text-indigo-100 text-sm block mb-1">Estimasi Potongan/Bulan</span>
                        <span className="text-3xl font-bold text-white tracking-tight">
                          {formatCurrency(calculateMonthlyPayment())}
                        </span>
                        <p className="text-indigo-200 text-xs mt-2">
                          *Potongan dimulai bulan depan setelah disetujui
                        </p>
                      </div>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="mt-6 w-full flex justify-center items-center py-4 px-6 border border-transparent text-sm font-semibold rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 shadow-lg shadow-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:-translate-y-0.5 active:translate-y-0"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="animate-spin -ml-1 mr-2 h-5 w-5" />
                        Memproses...
                      </>
                    ) : (
                      <>
                        Ajukan Pinjaman
                        <ChevronRight className="ml-2 h-5 w-5" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </form>
        </div>
      ) : (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-gray-900">Histori Pinjaman</h3>
              <p className="text-sm text-gray-500">Riwayat dan status pengajuan pinjaman Anda</p>
            </div>
          </div>
          <SoftLoanManagement embedded={true} />
        </div>
      )}
      </div>
      
      {/* Confirmation Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm transition-opacity" onClick={() => setShowModal(false)} />
          
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden transform transition-all scale-100">
            <div className="bg-indigo-50 px-6 py-4 border-b border-indigo-100 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-indigo-900 flex items-center">
                <AlertCircle className="w-5 h-5 mr-2 text-indigo-600" />
                Konfirmasi Pengajuan
              </h3>
              <button 
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-500 transition-colors"
              >
                <span className="sr-only">Close</span>
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-100">
                <h4 className="font-medium text-yellow-800 mb-2 flex items-center text-sm">
                  <Info className="w-4 h-4 mr-2" />
                  Penting untuk diketahui
                </h4>
                <ul className="text-sm text-yellow-700 space-y-2 pl-1">
                  <li className="flex items-start">
                    <span className="mr-2">•</span>
                    Pinjaman akan dipotong otomatis dari gaji bulanan
                  </li>
                  <li className="flex items-start">
                    <span className="mr-2">•</span>
                    Tidak ada bunga yang dibebankan (0%)
                  </li>
                  <li className="flex items-start">
                    <span className="mr-2">•</span>
                    Persetujuan tergantung kebijakan perusahaan
                  </li>
                </ul>
              </div>

              <div className="space-y-3 pt-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Total Pinjaman</span>
                  <span className="font-semibold text-gray-900">{formatCurrency(parseFloat(watch("totalAmount")))}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Cicilan per Bulan</span>
                  <span className="font-semibold text-gray-900">{formatCurrency(calculateMonthlyPayment())}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Durasi</span>
                  <span className="font-semibold text-gray-900">{parseInt(watch("durationMonths"))} Bulan</span>
                </div>
              </div>
              
              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 px-4 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleConfirmSubmit}
                  className="flex-1 py-2.5 px-4 border border-transparent rounded-xl text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 shadow-lg shadow-indigo-100 transition-colors"
                >
                  Ya, Ajukan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}