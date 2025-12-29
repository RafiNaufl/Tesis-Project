"use client";

import { useForm, useWatch } from "react-hook-form";
import { useState } from "react";
import Image from "next/image";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
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
  const [profileFile, setProfileFile] = useState<File | null>(null as any);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
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
    <div className="fixed inset-0 z-[100] overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        {/* Background overlay */}
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-md transition-opacity"
          aria-hidden="true"
          onClick={onClose}
        ></div>

        {/* Modal positioning */}
        <span
          className="hidden sm:inline-block sm:h-screen sm:align-middle"
          aria-hidden="true"
        >
          &#8203;
        </span>

        {/* Modal content */}
        <div className="relative inline-block transform overflow-hidden rounded-lg bg-white text-left align-bottom shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:align-middle">
          {/* Modal header */}
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="sm:flex sm:items-start">
              <div className="mt-3 w-full text-center sm:mt-0 sm:text-left">
                <div className="flex items-center justify-between">
                  <h3
                    className="text-lg font-medium leading-6 text-gray-900"
                    id="modal-title"
                  >
                    Tambah Karyawan Baru
                  </h3>
                  <button
                    type="button"
                    className="rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                    onClick={onClose}
                  >
                    <span className="sr-only">Close</span>
                    <svg
                      className="h-6 w-6"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth="1.5"
                      stroke="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>

                <div className="mt-4">
                  <form onSubmit={handleSubmit(handleFormSubmit)}>
                    <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-2">
                      <div className="sm:col-span-2">
                        <label htmlFor="profileImage" className="block text-sm font-medium text-gray-700">Profile Image</label>
                        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center">
                          <div className="h-12 w-12 overflow-hidden rounded-full bg-gray-100">
                            {previewUrl ? (
                              <Image src={previewUrl} alt="Preview" width={48} height={48} className="h-12 w-12 object-cover" />
                            ) : (
                              <div className="flex h-12 w-12 items-center justify-center text-xs text-gray-400">No Image</div>
                            )}
                          </div>
                          <input
                            type="file"
                            accept="image/png,image/jpeg"
                            onChange={(e) => {
                              const f = e.target.files?.[0] || null;
                              setProfileFile(f);
                              setPreviewUrl(f ? URL.createObjectURL(f) : null);
                            }}
                            id="profileImage"
                            aria-describedby="profileImageHelp"
                            className="block w-full sm:flex-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                          />
                          <div id="profileImageHelp" className="text-xs text-gray-500">JPG/PNG maks 2MB</div>
                        </div>
                      </div>
                      <div>
                        <label htmlFor="name" className="block text-sm font-medium text-gray-700">Nama Lengkap <span className="text-red-500">*</span></label>
                        <div className="mt-1">
                          <input type="text" id="name" {...register("name")} className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm" placeholder="John Doe" />
                          {errors.name && (<p className="mt-2 text-sm text-red-600">{errors.name.message as any}</p>)}
                        </div>
                      </div>

                      <div>
                        <label htmlFor="phone" className="block text-sm font-medium text-gray-700">Nomor HP <span className="text-red-500">*</span></label>
                        <div className="mt-1">
                          <input type="text" id="phone" {...register("phone")} className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm" placeholder="+628123456789" />
                          {errors.phone && (<p className="mt-2 text-sm text-red-600">{errors.phone.message as any}</p>)}
                        </div>
                      </div>

                      <div>
                        <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email (opsional)</label>
                        <div className="mt-1">
                          <input type="email" id="email" {...register("email")} className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm" placeholder="johndoe@example.com" />
                          {errors.email && (<p className="mt-2 text-sm text-red-600">{errors.email.message as any}</p>)}
                        </div>
                      </div>

                      <div>
                        <label htmlFor="password" className="block text-sm font-medium text-gray-700">Password <span className="text-red-500">*</span></label>
                        <div className="mt-1">
                          <input type="password" id="password" {...register("password")} className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm" placeholder="••••••••" />
                          {errors.password && (<p className="mt-2 text-sm text-red-600">{errors.password.message as any}</p>)}
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700">Organisasi <span className="text-red-500">*</span></label>
                        <div className="mt-1">
                          <select {...register("organization")} className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm">
                            <option value="">Pilih</option>
                            {organizations.map((o) => (<option key={o} value={o}>{o}</option>))}
                          </select>
                          {errors.organization && (<p className="mt-2 text-sm text-red-600">{errors.organization.message as any}</p>)}
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700">Status Karyawan <span className="text-red-500">*</span></label>
                        <div className="mt-2 flex gap-4">
                          {employmentStatuses.map((s) => (
                            <label key={s} className="flex items-center gap-2"><input type="radio" value={s} {...register("employmentStatus")} /> {s}</label>
                          ))}
                        </div>
                        {errors.employmentStatus && (<p className="mt-2 text-sm text-red-600">{errors.employmentStatus.message as any}</p>)}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700">Role Jabatan <span className="text-red-500">*</span></label>
                        <div className="mt-1">
                          <select {...register("role")} className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm">
                            <option value="">Pilih</option>
                            {roles.map((r) => (<option key={r} value={r}>{r}</option>))}
                          </select>
                          {errors.role && (<p className="mt-2 text-sm text-red-600">{errors.role.message as any}</p>)}
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700">Divisi <span className="text-red-500">*</span></label>
                        <div className="mt-1">
                          <select {...register("division")} className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm">
                            <option value="">Pilih</option>
                            {divisions.map((d) => (<option key={d} value={d}>{d}</option>))}
                          </select>
                          {errors.division && (<p className="mt-2 text-sm text-red-600">{errors.division.message as any}</p>)}
                        </div>
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-sm font-medium text-gray-700">Jadwal Kerja <span className="text-red-500">*</span></label>
                        <div className="mt-2 flex gap-4">
                          {workSchedules.map((w) => (
                            <label key={w} className="flex items-center gap-2"><input type="radio" value={w} {...register("workSchedule")} /> {w === "SHIFT" ? "Shift" : "Non Shift/Daily"}</label>
                          ))}
                        </div>
                        {errors.workSchedule && (<p className="mt-2 text-sm text-red-600">{errors.workSchedule.message as any}</p>)}
                      </div>

                      <div className="sm:col-span-1">
                        <label htmlFor="monthlySalary" className="block text-sm font-medium text-gray-700">Gaji Bulanan (untuk Shift)</label>
                        <div className="mt-1">
                          <input id="monthlySalary" type="number" step="0.01" {...register("monthlySalary", { valueAsNumber: true })} className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm" />
                          {errors.monthlySalary && (<p className="mt-2 text-sm text-red-600">{errors.monthlySalary.message as any}</p>)}
                        </div>
                      </div>

                      <div className="sm:col-span-1">
                        <label htmlFor="hourlyRate" className="block text-sm font-medium text-gray-700">Rate Per Jam (untuk Non Shift)</label>
                        <div className="mt-1">
                          <input id="hourlyRate" type="number" step="0.01" {...register("hourlyRate", { valueAsNumber: true })} className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm" />
                          {errors.hourlyRate && (<p className="mt-2 text-sm text-red-600">{errors.hourlyRate.message as any}</p>)}
                        </div>
                      </div>

                      <div className="sm:col-span-1">
                        <label htmlFor="bpjsKesehatan" className="block text-sm font-medium text-gray-700">Potongan BPJS Kesehatan</label>
                        <div className="mt-1">
                          <input id="bpjsKesehatan" type="number" step="100" min="0" {...register("bpjsKesehatan")} className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm" placeholder="0" />
                          {errors.bpjsKesehatan && (<p className="mt-2 text-sm text-red-600">{errors.bpjsKesehatan.message as any}</p>)}
                        </div>
                      </div>

                      <div className="sm:col-span-1">
                        <label htmlFor="bpjsKetenagakerjaan" className="block text-sm font-medium text-gray-700">Potongan BPJS Ketenagakerjaan</label>
                        <div className="mt-1">
                          <input id="bpjsKetenagakerjaan" type="number" step="100" min="0" {...register("bpjsKetenagakerjaan")} className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm" placeholder="0" />
                          {errors.bpjsKetenagakerjaan && (<p className="mt-2 text-sm text-red-600">{errors.bpjsKetenagakerjaan.message as any}</p>)}
                        </div>
                      </div>

                      <div className="sm:col-span-2 mt-2 bg-gray-50 p-4 rounded-md border border-gray-200">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium text-gray-700">Total Potongan BPJS:</span>
                          <span className="text-lg font-bold text-gray-900">
                            {new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR" }).format(totalBpjs)}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">Potongan ini akan mengurangi Gross Salary setiap bulan secara otomatis.</p>
                      </div>
                    </div>

                    <div className="mt-6 sm:mt-8 sm:flex sm:flex-row-reverse">
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="inline-flex w-full justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:bg-indigo-300 disabled:cursor-not-allowed sm:ml-3 sm:w-auto sm:text-sm transition-colors duration-200"
                      >
                        {isSubmitting ? "Adding..." : "Add Employee"}
                      </button>
                      <button
                        type="button"
                        onClick={onClose}
                        className="mt-3 inline-flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:mt-0 sm:w-auto sm:text-sm transition-colors duration-200"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 
