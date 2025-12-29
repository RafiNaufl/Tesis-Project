"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
// import { useSession } from "next-auth/react";
import { formatCurrency } from "@/lib/utils";
import SoftLoanManagement from "./softloanmanagement";

interface SoftLoanRequestProps {
  onSuccess?: () => void;
}

export default function SoftLoanRequest({ onSuccess }: SoftLoanRequestProps) {
  // const { data: session } = useSession();
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
      
      // Call onSuccess callback if provided
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
    <div className="bg-white shadow rounded-lg p-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Pinjaman Lunak</h2>
        <p className="mt-2 text-sm text-gray-600">
          Ajukan pinjaman lunak yang akan dipotong secara bertahap sesuai periode yang dipilih. 
          Pinjaman lunak adalah fasilitas yang disediakan perusahaan untuk membantu kebutuhan karyawan.
        </p>
      </div>
      
      {/* Tab Navigation */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex overflow-x-auto space-x-4 md:space-x-8 pb-1">
          <button
            onClick={() => setActiveTab("pengajuan")}
            className={`${activeTab === "pengajuan" 
              ? "border-indigo-500 text-indigo-600" 
              : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"} 
              whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center min-w-fit`}
          >
            <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            Pengajuan Pinjaman
          </button>
          <button
            onClick={() => setActiveTab("histori")}
            className={`${activeTab === "histori" 
              ? "border-indigo-500 text-indigo-600" 
              : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"} 
              whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center min-w-fit`}
          >
            <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Histori Pinjaman
          </button>
        </nav>
      </div>
      
      {/* Tab Content */}
      {activeTab === "pengajuan" ? (
        <div>
          <div className="mb-6">
            <h3 className="text-lg font-medium text-gray-900">Pengajuan Pinjaman Lunak</h3>
          </div>
      
      <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
          <div className="flex items-center mb-2">
            <svg className="h-6 w-6 text-blue-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <h3 className="font-medium text-blue-800">Pengajuan</h3>
          </div>
          <p className="text-sm text-blue-700">Isi formulir dengan lengkap dan jelaskan alasan pengajuan</p>
        </div>
        
        <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100">
          <div className="flex items-center mb-2">
            <svg className="h-6 w-6 text-indigo-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="font-medium text-indigo-800">Persetujuan</h3>
          </div>
          <p className="text-sm text-indigo-700">Admin akan meninjau dan menyetujui pengajuan Anda</p>
        </div>
        
        <div className="bg-green-50 p-4 rounded-lg border border-green-100">
          <div className="flex items-center mb-2">
            <svg className="h-6 w-6 text-green-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2z" />
            </svg>
            <h3 className="font-medium text-green-800">Pencairan</h3>
          </div>
          <p className="text-sm text-green-700">Dana akan dicairkan setelah persetujuan</p>
        </div>
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

      <form onSubmit={rhfHandleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Detail Pinjaman */}
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
            <h3 className="text-md font-medium text-gray-800 mb-3 flex items-center">
              <svg className="h-5 w-5 text-indigo-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2z" />
              </svg>
              Detail Pinjaman
            </h3>
            
            <div>
              <label htmlFor="totalAmount" className="block text-sm font-medium text-gray-700 flex items-center">
                Jumlah Pinjaman Lunak <span className="text-red-500 ml-1">*</span>
                <span className="ml-2 text-xs text-gray-500">(dalam Rupiah)</span>
              </label>
              <div className="mt-2 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="text-gray-700 sm:text-sm font-bold">Rp</span>
                </div>
                <input
                  type="number"
                  id="totalAmount"
                  {...register("totalAmount")}
                  className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-12 pr-12 text-base sm:text-sm border-gray-300 rounded-md bg-white shadow-md transition-all duration-200 hover:border-indigo-300 hover:shadow-lg focus:shadow-lg min-h-[48px] sm:min-h-0 py-3 sm:py-2"
                  placeholder="0"
                  step="1000"
                  required
                />
                {errors.totalAmount && (
                  <p className="mt-1 text-xs text-red-600">{errors.totalAmount.message as string}</p>
                )}
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2z" />
                  </svg>
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <div className="flex items-center">
                  <svg className="h-4 w-4 text-indigo-400 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-xs text-gray-500">Masukkan jumlah tanpa titik atau koma</span>
                </div>
                {watch("totalAmount") && (
                  <p className="text-sm text-indigo-600 font-medium">
                    {formatCurrency(parseFloat(watch("totalAmount")))}
                  </p>
                )}
              </div>
              
              <div className="mt-2 flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-4 w-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="ml-1 text-xs text-gray-500">
                  Masukkan jumlah pinjaman lunak yang dibutuhkan (dalam Rupiah)
                </p>
              </div>
              {watch("totalAmount") && (
                <p className="mt-1 text-xs text-indigo-600 font-medium">
                  {formatCurrency(parseFloat(watch("totalAmount")))}
                </p>
              )}
            </div>

            <div className="mt-4">
              <label htmlFor="durationMonths" className="block text-sm font-medium text-gray-700">
                Periode Potongan <span className="text-red-500">*</span>
              </label>
              <div className="mt-2">
                <div className="flex space-x-2">
                  {durationOptions.map((option) => (
                    <div key={option.value} className="flex-1">
                      <input 
                        type="radio" 
                        id={`duration-${option.value}`}
                        value={option.value}
                        {...register("durationMonths")}
                        className="sr-only peer"
                      />
                      <label 
                        htmlFor={`duration-${option.value}`}
                        className="flex flex-col items-center justify-center p-4 w-full text-gray-500 bg-white border border-gray-200 rounded-lg cursor-pointer peer-checked:border-indigo-500 peer-checked:bg-indigo-50 peer-checked:text-indigo-600 hover:bg-gray-50 min-h-[48px]"
                      >
                        <span className="text-lg font-semibold">{option.value}</span>
                        <span className="text-xs">Bulan</span>
                      </label>
                    </div>
                  ))}
                </div>
              </div>
              {errors.durationMonths && (
                <p className="mt-1 text-xs text-red-600">Durasi harus dipilih</p>
              )}
              <p className="mt-1 text-xs text-gray-500">
                Pilih periode potongan pinjaman dari gaji bulanan
              </p>
            </div>
          </div>

          {/* Rincian Pembayaran */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-5 shadow-sm h-full flex flex-col justify-center">
            <h3 className="text-md font-semibold text-gray-800 mb-4 flex items-center">
              <svg className="h-5 w-5 text-blue-500 mr-2" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              Rincian Pembayaran
            </h3>
            
            {watch("totalAmount") ? (
              <div className="grid grid-cols-1 gap-4">
                <div className="bg-white p-3 rounded-lg border border-blue-100">
                  <p className="text-xs text-gray-500 mb-1">Total Pinjaman</p>
                  <p className="text-lg font-bold text-gray-800">{formatCurrency(parseFloat(watch("totalAmount")))}</p>
                </div>
                
                <div className="bg-white p-3 rounded-lg border border-blue-100">
                  <p className="text-xs text-gray-500 mb-1">Periode</p>
                  <p className="text-lg font-bold text-gray-800">{parseInt(watch("durationMonths") || "0")} bulan</p>
                </div>
                
                <div className="bg-white p-3 rounded-lg border border-blue-100">
                  <p className="text-xs text-gray-500 mb-1">Potongan per Bulan</p>
                  <p className="text-lg font-bold text-gray-800">{formatCurrency(calculateMonthlyPayment())}</p>
                </div>
                
                <div className="mt-3 text-xs text-gray-600 italic">
                  Potongan akan dimulai dari bulan berikutnya setelah persetujuan
                </div>
              </div>
            ) : (
              <div className="flex flex-col justify-center items-center text-center h-full py-6">
                <svg className="h-12 w-12 text-blue-400 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                <p className="text-blue-500 text-sm font-medium mb-2">Simulasi Pembayaran</p>
                <p className="text-gray-500 text-sm">Masukkan jumlah pinjaman untuk melihat rincian pembayaran</p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-gradient-to-r from-gray-50 to-gray-100 p-5 rounded-lg border border-gray-200 shadow-sm">
          <h3 className="text-md font-semibold text-gray-800 mb-3 flex items-center">
            <svg className="h-5 w-5 text-indigo-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Alasan Permohonan
          </h3>
          
          <label htmlFor="reason" className="block text-sm font-medium text-gray-700 flex items-center">
            Jelaskan Alasan Permohonan <span className="text-red-500 ml-1">*</span>
            <div className="relative ml-2 group">
              <svg className="h-4 w-4 text-gray-400 cursor-pointer" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="absolute left-0 bottom-6 w-64 bg-black text-white text-xs rounded p-2 hidden group-hover:block z-10">
                Jelaskan secara detail alasan Anda mengajukan pinjaman lunak. Informasi ini akan digunakan dalam proses persetujuan.
              </div>
            </div>
          </label>
          <div className="mt-2">
            <textarea
              id="reason"
              rows={4}
              {...register("reason")}
              className="focus:ring-indigo-500 focus:border-indigo-500 block w-full text-base sm:text-sm border-gray-300 rounded-md shadow-sm transition-all duration-200 hover:border-indigo-300 focus:shadow-md min-h-[100px]"
              placeholder="Jelaskan alasan mengajukan pinjaman lunak (contoh: renovasi rumah, biaya pendidikan, kebutuhan mendesak, dll.)"
              maxLength={500}
              required
            />
            {errors.reason && (
              <p className="mt-1 text-xs text-red-600">{errors.reason.message as string}</p>
            )}
            <div className="flex justify-between mt-2">
              <div className="text-xs text-gray-500 flex items-center">
                <svg className="h-4 w-4 text-indigo-400 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Semakin detail alasan Anda, semakin tinggi kemungkinan persetujuan</span>
              </div>
              <div className="text-xs text-gray-500">
                {watch("reason")?.length || 0}/500 karakter
              </div>
            </div>
          </div>
          
          <div className="mt-3 flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="ml-2 text-xs text-gray-600">
              Berikan penjelasan yang jelas dan detail mengenai alasan permohonan pinjaman lunak. 
              Informasi ini akan membantu proses persetujuan oleh admin.
            </p>
          </div>
        </div>

        <div className="mt-6">
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full inline-flex justify-center items-center py-3 px-4 border border-transparent shadow-sm text-sm font-medium rounded-lg text-white bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-200"
          >
            {isSubmitting ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Memproses...
              </>
            ) : (
              <>
                <svg className="-ml-1 mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Ajukan Pinjaman Lunak
              </>
            )}
          </button>
          <p className="mt-2 text-xs text-center text-gray-500">
            Dengan mengajukan pinjaman, Anda menyetujui ketentuan yang berlaku
          </p>
        </div>
      </form>
      </div>
      ) : (
        <div>
          <div className="mb-6">
            <h3 className="text-lg font-medium text-gray-900">Histori Pinjaman Lunak</h3>
          </div>
          <SoftLoanManagement />
        </div>
      )}
      
      {/* Modal Informasi Penting */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
          <div className="relative mx-auto p-5 border w-full max-w-md shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-center">
                <svg className="h-12 w-12 text-amber-500" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              
              <h3 className="text-lg leading-6 font-medium text-gray-900 text-center mt-2">
                Informasi Penting
              </h3>
              
              <div className="mt-4 px-2">
                <div className="bg-white p-3 rounded-lg border border-yellow-100 mb-3">
                  <h4 className="text-sm font-medium text-gray-800 mb-2">Proses Persetujuan</h4>
                  <ul className="text-sm text-gray-600 space-y-1 pl-5 list-disc">
                    <li>Permohonan akan ditinjau oleh admin</li>
                    <li>Anda akan mendapat notifikasi setelah diproses</li>
                    <li>Status dapat dilihat di halaman histori pinjaman</li>
                  </ul>
                </div>
                
                <div className="bg-white p-3 rounded-lg border border-yellow-100">
                  <h4 className="text-sm font-medium text-gray-800 mb-2">Pembayaran Pinjaman</h4>
                  <ul className="text-sm text-gray-600 space-y-1 pl-5 list-disc">
                    <li>Pinjaman akan dipotong secara bertahap sesuai periode</li>
                    <li>Potongan dimulai dari bulan berikutnya setelah persetujuan</li>
                    <li>Tidak ada bunga yang dikenakan pada pinjaman lunak</li>
                  </ul>
                </div>
                
                <div className="bg-amber-50 p-3 rounded-lg border border-amber-100 mt-3">
                  <div className="flex items-start">
                    <svg className="h-5 w-5 text-amber-500 mt-0.5 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <p className="text-sm text-amber-700">
                      Dengan mengkonfirmasi, Anda menyetujui untuk melakukan pembayaran pinjaman sesuai dengan ketentuan yang berlaku.
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center justify-between mt-5 gap-3">
                <button
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-3 px-4 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-gray-400 min-h-[48px]"
                >
                  Batal
                </button>
                <button
                  onClick={handleConfirmSubmit}
                  className="flex-1 py-3 px-4 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[48px]"
                >
                  Konfirmasi
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
