import prisma from "@/lib/prisma";
import { z } from "zod";
import { registrationSchemaBase, workSchedules } from "@/lib/registrationValidation";
import { hash } from "bcrypt";
import { sendAdminNotification } from "@/lib/email";

function buildSchemaWithUMR(minMonthly: number, minHourly: number) {
  return registrationSchemaBase.superRefine((data, ctx) => {
    if (data.workSchedule === workSchedules[0]) {
      if (typeof data.monthlySalary !== "number") {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Gaji bulanan wajib diisi untuk Shift" });
      } else if (data.monthlySalary <= minMonthly) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Gaji bulanan harus > UMR (${minMonthly})` });
      }
    } else if (data.workSchedule === workSchedules[1]) {
      if (typeof data.hourlyRate !== "number") {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Rate gaji per jam wajib diisi untuk Non Shift" });
      } else if (data.hourlyRate <= minHourly) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Rate per jam harus > UMR per jam (${minHourly})` });
      }
    }
  });
}

import { generateEmployeeId } from "@/lib/employeeId";

export async function registerEmployee(input: any) {
  let minMonthly = 0;
  let minHourly = 0;
  try {
    const cfg = await (prisma as any).payrollConfig?.findFirst({ orderBy: { effectiveDate: "desc" } });
    minMonthly = cfg?.minMonthlyWage ?? 0;
    minHourly = cfg?.minHourlyWage ?? 0;
  } catch (e) {
    console.warn("PayrollConfig model not available; using defaults", e as any);
  }
  const schema = buildSchemaWithUMR(minMonthly, minHourly);

  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    const messages = parsed.error.errors.map(e => e.message);
    return { ok: false, error: messages } as const;
  }

  const data = parsed.data;

  if (data.email) {
    const existingUser = await prisma.user.findFirst({
      where: { email: { equals: data.email, mode: "insensitive" } },
    });
    if (existingUser) {
      return { ok: false, error: "Email sudah digunakan" } as const;
    }
  }

  if (data.phone) {
    const existingEmployee = await prisma.employee.findFirst({ where: { contactNumber: data.phone } });
    if (existingEmployee) {
      return { ok: false, error: "Nomor HP sudah digunakan" } as const;
    }
  }

  const hashedPassword = await hash(data.password, 10);

  // Transaction to ensure atomic ID generation
  const result = await prisma.$transaction(async (tx) => {
    // Generate Employee ID
    const employeeId = await generateEmployeeId(tx, data.organization);

    const user = await tx.user.create({
      data: {
        name: data.name,
        email: data.email ? data.email.toLowerCase() : `${employeeId}@example.local`.toLowerCase(),
        hashedPassword,
        profileImageUrl: typeof data.profileImageUrl === "string" ? data.profileImageUrl : undefined,
        role:
          data.role === "Admin" ? "ADMIN" :
          data.role === "Manajer" ? "MANAGER" :
          data.role === "Foreman" ? "FOREMAN" :
          data.role === "Assisten Foreman" ? "ASSISTANT_FOREMAN" :
          "EMPLOYEE",
      },
    });

    const employee = await tx.employee.create({
      data: {
        employeeId,
        userId: user.id,
        position: data.role,
        division: data.division,
        basicSalary: data.workSchedule === "SHIFT" ? (data.monthlySalary as number) : 0,
        hourlyRate: data.workSchedule === "NON_SHIFT" ? (data.hourlyRate as number) : undefined,
        workScheduleType: data.workSchedule,
        organization: data.organization,
        employmentStatus: data.employmentStatus,
        contactNumber: data.phone,
        address: undefined,
        joiningDate: new Date(),
        bpjsKesehatan: data.bpjsKesehatan || 0,
        bpjsKetenagakerjaan: data.bpjsKetenagakerjaan || 0,
      },
    });

    return { user, employee };
  });

  const admins = await prisma.user.findMany({ where: { role: { in: ["ADMIN", "MANAGER"] } }, select: { email: true } });
  const adminEmails = admins.map(a => a.email).filter(Boolean) as string[];
  if (adminEmails.length > 0) {
    const subject = `Pendaftaran Karyawan Baru: ${result.user.name}`;
    const html = `
      <p>Karyawan baru berhasil mendaftar.</p>
      <ul>
        <li>Nama: ${result.user.name}</li>
        <li>Employee ID: ${result.employee.employeeId}</li>
        <li>Organisasi: ${result.employee.organization}</li>
        <li>Status: ${result.employee.employmentStatus}</li>
        <li>Jadwal: ${result.employee.workScheduleType}</li>
      </ul>
    `;
    try { await sendAdminNotification(subject, html, adminEmails); } catch (e) { console.warn(e as any); }
  }

  return { ok: true, id: result.employee.id, employeeId: result.employee.employeeId, userId: result.user.id } as const;
}
