import { z } from "zod";

export const organizations = ["CTU", "MT"] as const;
export const organizationNames: Record<typeof organizations[number], string> = {
  CTU: "Catur Teknik Utama",
  MT: "Manunggal Teknik"
};
export const employmentStatuses = ["Tetap", "Tidak Tetap"] as const;
export const roles = [
  "Manajer",
  "Admin",
  "Foreman",
  "Assisten Foreman",
  "Operator",
] as const;
export const divisions = ["Mekanik", "Elektrik", "AGV", "Crane"] as const;

export const workSchedules = ["SHIFT", "NON_SHIFT"] as const;

export const phoneRegex = /^[+]?\d{8,15}$/;
export const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/;

const emailOptional = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  z.string().email("Email tidak valid").optional()
);

export const optionalNumber = (message?: string) =>
  z.preprocess(
    (v) => {
      if (typeof v === "number" && Number.isNaN(v)) return undefined;
      if (typeof v === "string") {
        if (v.trim() === "") return undefined;
        const parsed = Number(v);
        return Number.isNaN(parsed) ? v : parsed;
      }
      return v;
    },
    z.number({ invalid_type_error: message || "Nilai harus angka" }).optional()
  );

export const registrationSchemaBase = z.object({
  name: z.string().min(3, "Nama minimal 3 karakter"),
  phone: z.string().regex(phoneRegex, "Nomor HP tidak valid"),
  password: z.string().regex(passwordRegex, "Password minimal 8 karakter dan kombinasi huruf dan angka"),
  email: emailOptional,
  profileImageUrl: z.union([
    z.string().url(),
    z.string().regex(/^\/uploads\/profiles\/[^\s]+$/,
      "URL gambar tidak valid")
  ]).optional(),
  organization: z.enum(organizations, { required_error: "Organisasi wajib dipilih" }),
  employmentStatus: z.enum(employmentStatuses, { required_error: "Status karyawan wajib dipilih" }),
  role: z.enum(roles, { required_error: "Role jabatan wajib dipilih" }),
  division: z.enum(divisions, { required_error: "Divisi wajib dipilih" }),
  workSchedule: z.enum(workSchedules, { required_error: "Jadwal kerja wajib dipilih" }),
  monthlySalary: optionalNumber("Gaji bulanan harus angka"),
  hourlyRate: optionalNumber("Rate per jam harus angka"),
  bpjsKesehatan: optionalNumber("Potongan BPJS Kesehatan harus angka"),
  bpjsKetenagakerjaan: optionalNumber("Potongan BPJS Ketenagakerjaan harus angka"),
});

export type RegistrationInput = z.infer<typeof registrationSchemaBase>;
