"use client";

import { useState } from "react";
import Image from "next/image";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { 
  X, Upload, User, Mail, Phone, Lock, Briefcase, 
  CreditCard, Building, Users, FileText,
  ChevronDown
} from "lucide-react";
import {
  registrationSchemaBase,
  organizations,
  employmentStatuses,
  roles,
  divisions,
  workSchedules,
} from "@/lib/registrationValidation";

const employeeFormSchema = registrationSchemaBase.superRefine((data, ctx) => {
  if (data.workSchedule === "SHIFT" && typeof data.monthlySalary !== "number") {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Gaji bulanan wajib diisi untuk Shift" });
  }
  if (data.workSchedule === "NON_SHIFT" && typeof data.hourlyRate !== "number") {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Rate gaji per jam wajib diisi untuk Non Shift" });
  }
});

type EmployeeFormValues = z.infer<typeof employeeFormSchema>;

type AddEmployeeModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: EmployeeFormValues) => void;
};

export default function AddEmployeeModal({
  isOpen,
  onClose,
  onSubmit,
}: AddEmployeeModalProps) {
  const [profileFile, setProfileFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    control,
    formState: { errors, isSubmitting },
  } = useForm<EmployeeFormValues>({
    resolver: zodResolver(employeeFormSchema),
    defaultValues: {
      name: "",
      phone: "",
      email: "",
      password: "",
      organization: undefined as any,
      employmentStatus: undefined as any,
      role: undefined as any,
      division: undefined as any,
      workSchedule: undefined as any,
      monthlySalary: undefined,
      hourlyRate: undefined,
      bpjsKesehatan: 0,
      bpjsKetenagakerjaan: 0,
    },
  });

  const bpjsKesehatan = useWatch({ control, name: "bpjsKesehatan" });
  const bpjsKetenagakerjaan = useWatch({ control, name: "bpjsKetenagakerjaan" });
  const totalBpjs = (Number(bpjsKesehatan) || 0) + (Number(bpjsKetenagakerjaan) || 0);

  const handleFormSubmit = (data: EmployeeFormValues) => {
    const proceed = async () => {
      let profileImageUrl: string | undefined;
      if (profileFile) {
        if (!["image/jpeg", "image/png"].includes(profileFile.type)) {
          alert("Format gambar harus JPG/PNG");
          return;
        }
        if (profileFile.size > 2 * 1024 * 1024) {
          alert("Ukuran gambar maksimal 2MB");
          return;
        }
        const fd = new FormData();
        fd.append("file", profileFile);
        const res = await fetch("/api/upload", { method: "POST", body: fd });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          alert(err.error || "Gagal upload gambar");
          return;
        }
        const j = await res.json();
        profileImageUrl = j.url;
      }
      onSubmit({ ...(data as any), profileImageUrl });
    };
    proceed();
    reset();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] sm:flex sm:items-center sm:justify-center">
      {/* Backdrop for Desktop */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity hidden sm:block"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Container */}
      <div className="relative w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-3xl bg-white sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4 border-b border-gray-100 bg-white sticky top-0 z-10">
          <div>
            <h3 className="text-lg font-bold text-gray-900 leading-tight">
              Tambah Karyawan
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Isi data lengkap karyawan baru
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full bg-gray-50 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-gray-50/50">
          <form id="add-employee-form" onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
            
            {/* Section: Profile Image */}
            <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
              <div className="flex flex-col sm:flex-row items-center gap-6">
                <div className="relative group">
                  <div className="h-24 w-24 rounded-full overflow-hidden bg-gray-100 ring-4 ring-white shadow-md">
                    {previewUrl ? (
                      <Image 
                        src={previewUrl} 
                        alt="Preview" 
                        width={96} 
                        height={96} 
                        className="h-full w-full object-cover" 
                      />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center text-gray-300">
                        <User className="w-10 h-10" />
                      </div>
                    )}
                  </div>
                  <label 
                    htmlFor="profileImage" 
                    className="absolute bottom-0 right-0 p-1.5 bg-indigo-600 rounded-full text-white cursor-pointer shadow-lg hover:bg-indigo-700 transition-colors"
                  >
                    <Upload className="w-4 h-4" />
                  </label>
                  <input
                    type="file"
                    accept="image/png,image/jpeg"
                    onChange={(e) => {
                      const f = e.target.files?.[0] || null;
                      setProfileFile(f);
                      setPreviewUrl(f ? URL.createObjectURL(f) : null);
                    }}
                    id="profileImage"
                    className="hidden"
                  />
                </div>
                <div className="flex-1 text-center sm:text-left">
                  <h4 className="text-sm font-semibold text-gray-900">Foto Profil</h4>
                  <p className="text-xs text-gray-500 mt-1">
                    Upload foto format JPG/PNG, maks 2MB.
                  </p>
                </div>
              </div>
            </div>

            {/* Section: Personal Info */}
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider px-1">Informasi Pribadi</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-700">Nama Lengkap <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <User className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                    <input 
                      type="text" 
                      {...register("name")} 
                      className="block w-full rounded-lg border-gray-200 pl-9 focus:border-indigo-500 focus:ring-indigo-500 text-sm py-2.5 bg-white shadow-sm" 
                      placeholder="Nama Lengkap" 
                    />
                  </div>
                  {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-700">Nomor HP <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                    <input 
                      type="text" 
                      {...register("phone")} 
                      className="block w-full rounded-lg border-gray-200 pl-9 focus:border-indigo-500 focus:ring-indigo-500 text-sm py-2.5 bg-white shadow-sm" 
                      placeholder="0812..." 
                    />
                  </div>
                  {errors.phone && <p className="text-xs text-red-500">{errors.phone.message}</p>}
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-700">Email (Opsional)</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                    <input 
                      type="email" 
                      {...register("email")} 
                      className="block w-full rounded-lg border-gray-200 pl-9 focus:border-indigo-500 focus:ring-indigo-500 text-sm py-2.5 bg-white shadow-sm" 
                      placeholder="email@company.com" 
                    />
                  </div>
                  {errors.email && <p className="text-xs text-red-500">{errors.email.message}</p>}
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-700">Password <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                    <input 
                      type="password" 
                      {...register("password")} 
                      className="block w-full rounded-lg border-gray-200 pl-9 focus:border-indigo-500 focus:ring-indigo-500 text-sm py-2.5 bg-white shadow-sm" 
                      placeholder="••••••••" 
                    />
                  </div>
                  {errors.password && <p className="text-xs text-red-500">{errors.password.message}</p>}
                </div>
              </div>
            </div>

            {/* Section: Employment Details */}
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider px-1">Detail Pekerjaan</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-700">Organisasi <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <Building className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                    <select {...register("organization")} className="block w-full rounded-lg border-gray-200 pl-9 focus:border-indigo-500 focus:ring-indigo-500 text-sm py-2.5 bg-white shadow-sm appearance-none">
                      <option value="">Pilih Organisasi</option>
                      {organizations.map((o) => (<option key={o} value={o}>{o}</option>))}
                    </select>
                    <ChevronDown className="absolute right-3 top-3 h-4 w-4 text-gray-400 pointer-events-none" />
                  </div>
                  {errors.organization && <p className="text-xs text-red-500">{errors.organization.message}</p>}
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-700">Divisi <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <Briefcase className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                    <select {...register("division")} className="block w-full rounded-lg border-gray-200 pl-9 focus:border-indigo-500 focus:ring-indigo-500 text-sm py-2.5 bg-white shadow-sm appearance-none">
                      <option value="">Pilih Divisi</option>
                      {divisions.map((d) => (<option key={d} value={d}>{d}</option>))}
                    </select>
                    <ChevronDown className="absolute right-3 top-3 h-4 w-4 text-gray-400 pointer-events-none" />
                  </div>
                  {errors.division && <p className="text-xs text-red-500">{errors.division.message}</p>}
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-700">Role Jabatan <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <Users className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                    <select {...register("role")} className="block w-full rounded-lg border-gray-200 pl-9 focus:border-indigo-500 focus:ring-indigo-500 text-sm py-2.5 bg-white shadow-sm appearance-none">
                      <option value="">Pilih Role</option>
                      {roles.map((r) => (<option key={r} value={r}>{r}</option>))}
                    </select>
                    <ChevronDown className="absolute right-3 top-3 h-4 w-4 text-gray-400 pointer-events-none" />
                  </div>
                  {errors.role && <p className="text-xs text-red-500">{errors.role.message}</p>}
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-700">Status <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <FileText className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                    <select {...register("employmentStatus")} className="block w-full rounded-lg border-gray-200 pl-9 focus:border-indigo-500 focus:ring-indigo-500 text-sm py-2.5 bg-white shadow-sm appearance-none">
                      <option value="">Pilih Status</option>
                      {employmentStatuses.map((s) => (<option key={s} value={s}>{s}</option>))}
                    </select>
                    <ChevronDown className="absolute right-3 top-3 h-4 w-4 text-gray-400 pointer-events-none" />
                  </div>
                  {errors.employmentStatus && <p className="text-xs text-red-500">{errors.employmentStatus.message}</p>}
                </div>
              </div>
            </div>

            {/* Section: Schedule & Salary */}
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider px-1">Jadwal & Gaji</h4>
              
              <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-gray-700 block">Tipe Jadwal <span className="text-red-500">*</span></label>
                  <div className="grid grid-cols-2 gap-3">
                    {workSchedules.map((w) => (
                      <label key={w} className={`
                        relative flex items-center justify-center gap-2 p-3 rounded-lg border cursor-pointer transition-all
                        ${watch("workSchedule") === w 
                          ? 'border-indigo-500 bg-indigo-50 text-indigo-700 ring-1 ring-indigo-500' 
                          : 'border-gray-200 hover:border-gray-300 text-gray-600'}
                      `}>
                        <input type="radio" value={w} {...register("workSchedule")} className="sr-only" />
                        <span className="text-sm font-medium">{w === "SHIFT" ? "Shift" : "Non-Shift"}</span>
                      </label>
                    ))}
                  </div>
                  {errors.workSchedule && <p className="text-xs text-red-500">{errors.workSchedule.message}</p>}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-700">Gaji Bulanan (Shift)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-xs font-semibold text-gray-400">Rp</span>
                      <input 
                        type="number" 
                        step="0.01" 
                        {...register("monthlySalary", { valueAsNumber: true })} 
                        className="block w-full rounded-lg border-gray-200 pl-9 focus:border-indigo-500 focus:ring-indigo-500 text-sm py-2.5 bg-white shadow-sm"
                        placeholder="0.00"
                      />
                    </div>
                    {errors.monthlySalary && <p className="text-xs text-red-500">{errors.monthlySalary.message}</p>}
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-700">Rate Per Jam (Non-Shift)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-xs font-semibold text-gray-400">Rp</span>
                      <input 
                        type="number" 
                        step="0.01" 
                        {...register("hourlyRate", { valueAsNumber: true })} 
                        className="block w-full rounded-lg border-gray-200 pl-9 focus:border-indigo-500 focus:ring-indigo-500 text-sm py-2.5 bg-white shadow-sm"
                        placeholder="0.00"
                      />
                    </div>
                    {errors.hourlyRate && <p className="text-xs text-red-500">{errors.hourlyRate.message}</p>}
                  </div>
                </div>
              </div>
            </div>

            {/* Section: BPJS */}
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider px-1">Potongan BPJS</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-700">BPJS Kesehatan</label>
                  <div className="relative">
                    <CreditCard className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                    <input 
                      type="number" 
                      step="100" 
                      {...register("bpjsKesehatan")} 
                      className="block w-full rounded-lg border-gray-200 pl-9 focus:border-indigo-500 focus:ring-indigo-500 text-sm py-2.5 bg-white shadow-sm"
                      placeholder="0"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-700">BPJS Ketenagakerjaan</label>
                  <div className="relative">
                    <CreditCard className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                    <input 
                      type="number" 
                      step="100" 
                      {...register("bpjsKetenagakerjaan")} 
                      className="block w-full rounded-lg border-gray-200 pl-9 focus:border-indigo-500 focus:ring-indigo-500 text-sm py-2.5 bg-white shadow-sm"
                      placeholder="0"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-indigo-900">Total Potongan</p>
                  <p className="text-xs text-indigo-600">Dikurangkan dari gaji gross</p>
                </div>
                <p className="text-xl font-bold text-indigo-700">
                  {new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR" }).format(totalBpjs)}
                </p>
              </div>
            </div>

          </form>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 sm:px-6 sm:py-4 border-t border-gray-100 bg-gray-50 flex flex-col-reverse sm:flex-row sm:justify-end gap-3 sticky bottom-0 z-10">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto inline-flex justify-center items-center px-4 py-2.5 border border-gray-300 shadow-sm text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
          >
            Batal
          </button>
          <button
            type="submit"
            form="add-employee-form"
            disabled={isSubmitting}
            className="w-full sm:w-auto inline-flex justify-center items-center px-4 py-2.5 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-300 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Menyimpan...
              </>
            ) : (
              "Simpan Karyawan"
            )}
          </button>
        </div>
      </div>
    </div>
  );
} 
