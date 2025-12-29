"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  registrationSchemaBase,
  organizations,
  organizationNames,
  employmentStatuses,
  roles,
  divisions,
  workSchedules,
} from "@/lib/registrationValidation";
import axios from "axios";
import toast from "react-hot-toast";

type FormValues = z.infer<typeof registrationSchemaBase>;

const clientSchema = registrationSchemaBase.superRefine((data, ctx) => {
  if (data.workSchedule === "SHIFT" && typeof data.monthlySalary !== "number") {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Gaji bulanan wajib diisi untuk Shift" });
  }
  if (data.workSchedule === "NON_SHIFT" && typeof data.hourlyRate !== "number") {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Rate gaji per jam wajib diisi untuk Non Shift" });
  }
});

export default function RegistrationForm() {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      name: "",
      phone: "",
      password: "",
      email: "",
      organization: undefined as any,
      employmentStatus: undefined as any,
      role: undefined as any,
      division: undefined as any,
      workSchedule: undefined as any,
    },
    mode: "onBlur",
  });

  const workSchedule = watch("workSchedule");

  const steps = [
    { title: "Formulir Pendaftaran" },
    { title: "Klasifikasi Karyawan" },
    { title: "Detail Pekerjaan" },
    { title: "Sistem Penggajian" },
  ];

  async function onSubmit(values: FormValues) {
    setLoading(true);
    try {
      await axios.post("/api/register", values);
      toast.success("Pendaftaran berhasil");
    } catch (e: any) {
      const msg = e?.response?.data?.error ?? "Gagal mendaftar";
      toast.error(Array.isArray(msg) ? msg.join(", ") : msg);
    } finally {
      setLoading(false);
    }
  }

  function nextStep() { setStep((s) => Math.min(s + 1, steps.length - 1)); }
  function prevStep() { setStep((s) => Math.max(s - 1, 0)); }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="w-full max-w-2xl mx-auto p-4 space-y-6">
      <div className="flex items-center gap-2">
        {steps.map((st, idx) => (
          <div key={st.title} className={`flex-1 h-2 rounded ${idx <= step ? "bg-indigo-600" : "bg-gray-300"}`} />
        ))}
      </div>
      <h2 className="text-xl font-semibold">{steps[step].title}</h2>

      {step === 0 && (
        <div className="grid grid-cols-1 gap-4">
          <div>
            <label className="block text-sm font-medium">Nama Lengkap</label>
            <input className="mt-1 w-full border rounded p-2" {...register("name")} />
            {errors.name && <p className="text-red-600 text-sm mt-1">{errors.name.message as any}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium">Nomor HP</label>
            <input className="mt-1 w-full border rounded p-2" {...register("phone")} />
            {errors.phone && <p className="text-red-600 text-sm mt-1">{errors.phone.message as any}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium">Email (opsional)</label>
            <input className="mt-1 w-full border rounded p-2" type="email" {...register("email")} />
            {errors.email && <p className="text-red-600 text-sm mt-1">{errors.email.message as any}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium">Password</label>
            <input className="mt-1 w-full border rounded p-2" type="password" {...register("password")} />
            {errors.password && <p className="text-red-600 text-sm mt-1">{errors.password.message as any}</p>}
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium">Organisasi</label>
            <select className="mt-1 w-full border rounded p-2" {...register("organization")}>
              <option value="">Pilih</option>
              {organizations.map(o => <option key={o} value={o}>{organizationNames[o]}</option>)}
            </select>
            {errors.organization && <p className="text-red-600 text-sm mt-1">{errors.organization.message as any}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium">Status Karyawan</label>
            <div className="mt-2 flex gap-4">
              {employmentStatuses.map(s => (
                <label key={s} className="flex items-center gap-2">
                  <input type="radio" value={s} {...register("employmentStatus")} /> {s}
                </label>
              ))}
            </div>
            {errors.employmentStatus && <p className="text-red-600 text-sm mt-1">{errors.employmentStatus.message as any}</p>}
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium">Role Jabatan</label>
            <select className="mt-1 w-full border rounded p-2" {...register("role")}>
              <option value="">Pilih</option>
              {roles.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            {errors.role && <p className="text-red-600 text-sm mt-1">{errors.role.message as any}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium">Divisi</label>
            <select className="mt-1 w-full border rounded p-2" {...register("division")}>
              <option value="">Pilih</option>
              {divisions.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            {errors.division && <p className="text-red-600 text-sm mt-1">{errors.division.message as any}</p>}
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="grid grid-cols-1 gap-4">
          <div>
            <label className="block text-sm font-medium">Jadwal Kerja</label>
            <div className="mt-2 flex gap-4">
              {workSchedules.map(w => (
                <label key={w} className="flex items-center gap-2">
                  <input type="radio" value={w} {...register("workSchedule")} /> {w === "SHIFT" ? "Shift" : "Non Shift/Harian"}
                </label>
              ))}
            </div>
            {errors.workSchedule && <p className="text-red-600 text-sm mt-1">{errors.workSchedule.message as any}</p>}
          </div>
          {workSchedule === "SHIFT" && (
            <div>
              <label htmlFor="monthlySalary" className="block text-sm font-medium">Gaji Bulanan</label>
              <input id="monthlySalary" aria-label="Gaji Bulanan" type="number" step="0.01" className="mt-1 w-full border rounded p-2" {...register("monthlySalary", { valueAsNumber: true })} />
            </div>
          )}
          {workSchedule === "NON_SHIFT" && (
            <div>
              <label htmlFor="hourlyRate" className="block text-sm font-medium">Rate Gaji Per Jam</label>
              <input id="hourlyRate" aria-label="Rate Gaji Per Jam" type="number" step="0.01" className="mt-1 w-full border rounded p-2" {...register("hourlyRate", { valueAsNumber: true })} />
            </div>
          )}
        </div>
      )}

      <div className="flex justify-between">
        <button type="button" onClick={prevStep} disabled={step === 0} className="rounded bg-gray-200 px-4 py-2">Sebelumnya</button>
        {step < steps.length - 1 ? (
          <button type="button" onClick={nextStep} className="rounded bg-indigo-600 text-white px-4 py-2">Berikutnya</button>
        ) : (
          <button type="submit" disabled={loading} className="rounded bg-green-600 text-white px-4 py-2">{loading ? "Mendaftar..." : "Daftar"}</button>
        )}
      </div>
    </form>
  );
}
