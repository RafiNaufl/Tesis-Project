"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { divisions, employmentStatuses, organizations, roles, workSchedules, phoneRegex, optionalNumber } from "@/lib/registrationValidation";

const employeeEditFormSchema = z.object({
  name: z.string().min(3, { message: "Nama minimal 3 karakter" }),
  email: z.string().email({ message: "Email tidak valid" }),
  role: z.enum(roles, { required_error: "Role jabatan wajib dipilih" }),
  division: z.enum(divisions, { required_error: "Divisi wajib dipilih" }),
  organization: z.enum(organizations, { required_error: "Organisasi wajib dipilih" }),
  employmentStatus: z.enum(employmentStatuses, { required_error: "Status karyawan wajib dipilih" }),
  workSchedule: z.enum(workSchedules, { required_error: "Jadwal kerja wajib dipilih" }),
  monthlySalary: optionalNumber("Gaji bulanan harus angka"),
  hourlyRate: optionalNumber("Rate per jam harus angka"),
  contactNumber: z.string().regex(phoneRegex, { message: "Nomor HP tidak valid" }).optional(),
  address: z.string().optional(),
  isActive: z.boolean(),
  bpjsKesehatan: optionalNumber("BPJS Kesehatan harus angka"),
  bpjsKetenagakerjaan: optionalNumber("BPJS Ketenagakerjaan harus angka"),
  profileImageUrl: z.union([
    z.string().url(),
    z.string().regex(/^\/uploads\/profiles\/[^\s]+$/)
  ]).optional(),
}).superRefine((data, ctx) => {
  if (data.workSchedule === "SHIFT" && typeof data.monthlySalary !== "number") {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Gaji bulanan wajib diisi untuk Shift" });
  }
  if (data.workSchedule === "NON_SHIFT" && typeof data.hourlyRate !== "number") {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Rate gaji per jam wajib diisi untuk Non Shift" });
  }
});

type EmployeeEditFormValues = z.infer<typeof employeeEditFormSchema>;

type Employee = {
  id: string;
  employeeId: string;
  name?: string;
  position: string;
  division: string;
  isActive: boolean;
  email?: string;
  basicSalary?: number;
  contactNumber?: string;
  address?: string;
  organization?: string | null;
  employmentStatus?: string | null;
  workScheduleType?: "SHIFT" | "NON_SHIFT" | null;
  hourlyRate?: number | null;
  bpjsKesehatan?: number;
  bpjsKetenagakerjaan?: number;
  user?: {
    name: string;
    email: string;
  };
};

type EditEmployeeModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (id: string, data: EmployeeEditFormValues) => void;
  employee: Employee | null;
};


export default function EditEmployeeModal({
  isOpen,
  onClose,
  onSubmit,
  employee,
}: EditEmployeeModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [profileFile, setProfileFile] = useState<File | null>(null as any);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<EmployeeEditFormValues>({
    resolver: zodResolver(employeeEditFormSchema),
    defaultValues: {
      name: "",
      email: "",
      role: roles[0],
      division: divisions[0],
      organization: organizations[0],
      employmentStatus: employmentStatuses[0],
      workSchedule: workSchedules[0],
      monthlySalary: 0,
      hourlyRate: undefined,
      contactNumber: "",
      address: "",
      isActive: true,
    },
  });

  // Update form when employee changes
  useEffect(() => {
    if (employee) {
      reset({
        name: employee.user?.name || employee.name || "",
        email: employee.user?.email || employee.email || "",
        role: employee.position as any,
        division: (employee.division as any) || divisions[0],
        organization: (employee.organization as any) || organizations[0],
        employmentStatus: (employee.employmentStatus as any) || employmentStatuses[0],
        workSchedule: (employee.workScheduleType as any) || workSchedules[0],
        monthlySalary: employee.workScheduleType === "SHIFT" ? (employee.basicSalary || 0) : undefined,
        hourlyRate: employee.workScheduleType === "NON_SHIFT" ? (employee.hourlyRate ?? undefined) : undefined,
        contactNumber: employee.contactNumber || "",
        address: employee.address || "",
        isActive: employee.isActive,
        bpjsKesehatan: employee.bpjsKesehatan || 0,
        bpjsKetenagakerjaan: employee.bpjsKetenagakerjaan || 0,
        profileImageUrl: (employee as any)?.user?.profileImageUrl,
      });
      setPreviewUrl((employee as any)?.user?.profileImageUrl || null);
    }
  }, [employee, reset]);

  // Calculate total BPJS
  const bpjsKesehatan = watch("bpjsKesehatan");
  const bpjsKetenagakerjaan = watch("bpjsKetenagakerjaan");
  const totalBpjs = (Number(bpjsKesehatan) || 0) + (Number(bpjsKetenagakerjaan) || 0);

  const handleFormSubmit = async (data: EmployeeEditFormValues) => {
    if (employee) {
      setIsSubmitting(true);
      try {
        let profileImageUrl = data.profileImageUrl;
        if (profileFile) {
          if (!["image/jpeg", "image/png"].includes(profileFile.type)) {
            alert("Format gambar harus JPG/PNG");
            setIsSubmitting(false);
            return;
          }
          if (profileFile.size > 2 * 1024 * 1024) {
            alert("Ukuran gambar maksimal 2MB");
            setIsSubmitting(false);
            return;
          }
          const fd = new FormData();
          fd.append("file", profileFile);
          const res = await fetch("/api/upload", { method: "POST", body: fd });
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            alert(err.error || "Gagal upload gambar");
            setIsSubmitting(false);
            return;
          }
          const j = await res.json();
          profileImageUrl = j.url;
        }
        await onSubmit(employee.id, { ...data, profileImageUrl });
      } finally {
        setIsSubmitting(false);
        onClose();
      }
    }
  };

  if (!isOpen || !employee) return null;

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
                  <div>
                    <h3
                      className="text-lg font-medium leading-6 text-gray-900"
                      id="modal-title"
                    >
                      Edit Employee: {employee.user?.name || employee.name}
                    </h3>
                    <p className="mt-1 text-sm text-gray-500">
                      Employee ID: {employee.employeeId}
                    </p>
                  </div>
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
                              setPreviewUrl(f ? URL.createObjectURL(f) : previewUrl);
                            }}
                            id="profileImage"
                            aria-describedby="profileImageHelp"
                            className="block w-full sm:flex-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                          />
                          <div id="profileImageHelp" className="text-xs text-gray-500">JPG/PNG maks 2MB</div>
                        </div>
                      </div>
                      <div>
                        <label
                          htmlFor="name"
                          className="block text-sm font-medium text-gray-700"
                        >
                          Full Name <span className="text-red-500">*</span>
                        </label>
                        <div className="mt-1">
                          <input
                            type="text"
                            id="name"
                            {...register("name")}
                            className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                            placeholder="John Doe"
                          />
                          {errors.name && (
                            <p className="mt-2 text-sm text-red-600">
                              {errors.name.message}
                            </p>
                          )}
                        </div>
                      </div>

                      <div>
                        <label
                          htmlFor="email"
                          className="block text-sm font-medium text-gray-700"
                        >
                          Email <span className="text-red-500">*</span>
                        </label>
                        <div className="mt-1">
                          <input
                            type="email"
                            id="email"
                            {...register("email")}
                            className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                            placeholder="johndoe@example.com"
                          />
                          {errors.email && (
                            <p className="mt-2 text-sm text-red-600">
                              {errors.email.message}
                            </p>
                          )}
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Role <span className="text-red-500">*</span>
                        </label>
                        <div className="mt-1">
                          <select {...register("role")} className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm">
                            {roles.map((r) => (
                              <option key={r} value={r}>{r}</option>
                            ))}
                          </select>
                          {errors.role && (
                            <p className="mt-2 text-sm text-red-600">{errors.role.message as any}</p>
                          )}
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Organisasi <span className="text-red-500">*</span>
                        </label>
                        <div className="mt-1">
                          <select {...register("organization")} className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm">
                            {organizations.map((o) => (
                              <option key={o} value={o}>{o}</option>
                            ))}
                          </select>
                          {errors.organization && (
                            <p className="mt-2 text-sm text-red-600">{errors.organization.message as any}</p>
                          )}
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Divisi <span className="text-red-500">*</span>
                        </label>
                        <div className="mt-1">
                          <select {...register("division")} className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm">
                            {divisions.map((d) => (
                              <option key={d} value={d}>{d}</option>
                            ))}
                          </select>
                          {errors.division && (
                            <p className="mt-2 text-sm text-red-600">{errors.division.message as any}</p>
                          )}
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Jadwal Kerja <span className="text-red-500">*</span>
                        </label>
                        <div className="mt-2 flex space-x-4">
                          {workSchedules.map((ws) => (
                            <label key={ws} className="inline-flex items-center space-x-2">
                              <input type="radio" value={ws} {...register("workSchedule")} />
                              <span>{ws === "SHIFT" ? "Shift" : "Non Shift"}</span>
                            </label>
                          ))}
                        </div>
                        {errors.workSchedule && (
                          <p className="mt-2 text-sm text-red-600">{errors.workSchedule.message as any}</p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Gaji Bulanan (Shift)
                        </label>
                        <div className="mt-1">
                          <input type="number" {...register("monthlySalary")} className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm" />
                          {errors.monthlySalary && (
                            <p className="mt-2 text-sm text-red-600">{errors.monthlySalary.message as any}</p>
                          )}
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Rate Per Jam (Non Shift)
                        </label>
                        <div className="mt-1">
                          <input type="number" {...register("hourlyRate")} className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm" />
                          {errors.hourlyRate && (
                            <p className="mt-2 text-sm text-red-600">{errors.hourlyRate.message as any}</p>
                          )}
                        </div>
                      </div>

                      <div>
                        <label htmlFor="bpjsKesehatan" className="block text-sm font-medium text-gray-700">Potongan BPJS Kesehatan</label>
                        <div className="mt-1">
                          <input id="bpjsKesehatan" type="number" step="100" min="0" {...register("bpjsKesehatan")} className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm" placeholder="0" />
                          {errors.bpjsKesehatan && (<p className="mt-2 text-sm text-red-600">{errors.bpjsKesehatan.message as any}</p>)}
                        </div>
                      </div>

                      <div>
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

                      <div>
                        <label
                          htmlFor="contactNumber"
                          className="block text-sm font-medium text-gray-700"
                        >
                          Nomor HP
                        </label>
                        <div className="mt-1">
                          <input
                            type="text"
                            id="contactNumber"
                            {...register("contactNumber")}
                            className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                            placeholder="08123456789"
                          />
                          {errors.contactNumber && (
                            <p className="mt-2 text-sm text-red-600">
                              {errors.contactNumber.message}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="sm:col-span-2">
                        <label
                          htmlFor="address"
                          className="block text-sm font-medium text-gray-700"
                        >
                          Alamat
                        </label>
                        <div className="mt-1">
                          <textarea
                            id="address"
                            rows={3}
                            {...register("address")}
                            className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                            placeholder="123 Main St, Anytown, ST 12345"
                          />
                          {errors.address && (
                            <p className="mt-2 text-sm text-red-600">
                              {errors.address.message}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="sm:col-span-2">
                        <div className="flex items-center">
                          <input
                            id="isActive"
                            type="checkbox"
                            {...register("isActive")}
                            className="h-4 w-4 rounded border-gray-300 bg-white text-indigo-600 focus:ring-indigo-500"
                          />
                          <label
                            htmlFor="isActive"
                            className="ml-2 block text-sm text-gray-700"
                          >
                            Aktif
                          </label>
                        </div>
                        <p className="mt-1 text-sm text-gray-500">
                          Karyawan tidak aktif tidak dapat login ke sistem
                        </p>
                      </div>
                    </div>

                    <div className="mt-6 sm:mt-8 sm:flex sm:flex-row-reverse">
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="inline-flex w-full justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:bg-indigo-300 disabled:cursor-not-allowed sm:ml-3 sm:w-auto sm:text-sm transition-colors duration-200"
                      >
                        {isSubmitting ? "Saving..." : "Save Changes"}
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
