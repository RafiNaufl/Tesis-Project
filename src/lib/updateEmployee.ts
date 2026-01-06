import prisma from "@/lib/prisma";
import { z } from "zod";
import { roles, divisions, organizations, employmentStatuses, workSchedules, phoneRegex, optionalNumber } from "@/lib/registrationValidation";
import { generateEmployeeId } from "@/lib/employeeId";

function buildEditSchema(minMonthly: number, minHourly: number) {
  const base = z.object({
    name: z.string().min(3, "Nama minimal 3 karakter"),
    email: z.string().email("Email tidak valid"),
    role: z.enum(roles),
    division: z.enum(divisions),
    organization: z.enum(organizations),
    employmentStatus: z.enum(employmentStatuses),
    workSchedule: z.enum(workSchedules),
    monthlySalary: optionalNumber("Gaji bulanan harus angka"),
    hourlyRate: optionalNumber("Rate per jam harus angka"),
    contactNumber: z.string().regex(phoneRegex, "Nomor HP tidak valid").optional(),
    address: z.string().optional(),
    isActive: z.boolean().optional(),
    bpjsKesehatan: optionalNumber("BPJS Kesehatan harus angka"),
    bpjsKetenagakerjaan: optionalNumber("BPJS Ketenagakerjaan harus angka"),
    profileImageUrl: z.union([
      z.string().url(),
      z.string().regex(/^\/uploads\/profiles\/[^\s]+$/)
    ]).optional(),
  });

  return base.superRefine((data, ctx) => {
    if (data.workSchedule === "SHIFT") {
      if (typeof data.monthlySalary !== "number") {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Gaji bulanan wajib diisi untuk Shift" });
      } else if (data.monthlySalary <= minMonthly) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Gaji bulanan harus > UMR (${minMonthly})` });
      }
    } else if (data.workSchedule === "NON_SHIFT") {
      if (typeof data.hourlyRate !== "number") {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Rate gaji per jam wajib diisi untuk Non Shift" });
      } else if (data.hourlyRate <= minHourly) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Rate per jam harus > UMR per jam (${minHourly})` });
      }
    }
  });
}

export async function updateEmployee(employeeId: string, data: any, changedByUserId: string) {
  let minMonthly = 0;
  let minHourly = 0;
  try {
    const cfg = await (prisma as any).payrollConfig?.findFirst({ orderBy: { effectiveDate: "desc" } });
    minMonthly = cfg?.minMonthlyWage ?? 0;
    minHourly = cfg?.minHourlyWage ?? 0;
  } catch (e) {
    console.warn("PayrollConfig unavailable for update; using defaults", e as any);
  }

  const schema = buildEditSchema(minMonthly, minHourly);
  const parsed = schema.safeParse(data);
  
  if (!parsed.success) {
    const messages = parsed.error.errors.map(e => e.message);
    return { ok: false, error: messages } as const;
  }

  const validatedData = parsed.data;

  // Find the employee
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    include: { user: true },
  });

  if (!employee) {
    return { ok: false, error: "Employee not found" } as const;
  }

  // Check if email already exists (if changing email)
  if (validatedData.email !== employee.user.email) {
    const existingUser = await prisma.user.findFirst({
      where: { email: { equals: validatedData.email, mode: "insensitive" } },
    });

    if (existingUser) {
      return { ok: false, error: "Email already in use" } as const;
    }
  }

  // Check contact number uniqueness if changed
  if (validatedData.contactNumber && validatedData.contactNumber !== employee.contactNumber) {
    const existingEmployee = await prisma.employee.findFirst({ where: { contactNumber: validatedData.contactNumber } });
    if (existingEmployee) {
      return { ok: false, error: "Nomor HP sudah digunakan" } as const;
    }
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const mappedRole =
        validatedData.role === "Admin" ? "ADMIN" :
        validatedData.role === "Manajer" ? "MANAGER" :
        validatedData.role === "Foreman" ? "FOREMAN" :
        validatedData.role === "Assisten Foreman" ? "ASSISTANT_FOREMAN" :
        "EMPLOYEE";

      // Update user
      const user = await tx.user.update({
        where: { id: employee.userId },
        data: {
          name: validatedData.name,
          email: validatedData.email,
          role: mappedRole,
          profileImageUrl: validatedData.profileImageUrl,
        },
      });

      let newEmployeeId = undefined;

      // Check if organization changed
      if (validatedData.organization !== employee.organization) {
        // Generate new Employee ID
        newEmployeeId = await generateEmployeeId(tx, validatedData.organization);

        // Log the change
        await tx.employeeIdLog.create({
          data: {
            employeeId: employee.id,
            oldEmployeeId: employee.employeeId,
            newEmployeeId: newEmployeeId,
            changedBy: changedByUserId,
            reason: "Organization Change",
          },
        });
      }

      // Prepare update data
      const newBpjsKesehatan = validatedData.bpjsKesehatan ?? 0;
      const newBpjsKetenagakerjaan = validatedData.bpjsKetenagakerjaan ?? 0;

      const updateData: any = {
        position: validatedData.role,
        division: validatedData.division,
        basicSalary: validatedData.workSchedule === "SHIFT" ? (validatedData.monthlySalary as number) : 0,
        hourlyRate: validatedData.workSchedule === "NON_SHIFT" ? (validatedData.hourlyRate as number) : undefined,
        workScheduleType: validatedData.workSchedule,
        organization: validatedData.organization,
        employmentStatus: validatedData.employmentStatus,
        contactNumber: validatedData.contactNumber,
        address: validatedData.address,
        isActive: validatedData.isActive,
        bpjsKesehatan: newBpjsKesehatan,
        bpjsKetenagakerjaan: newBpjsKetenagakerjaan,
      };

      // Audit Log for BPJS changes
      if (newBpjsKesehatan !== employee.bpjsKesehatan) {
        await (tx as any).auditLog?.create({
          data: {
            actorUserId: changedByUserId,
            action: "UPDATE_BPJS_KESEHATAN",
            employeeId: employee.id,
            metadata: {
              oldValue: employee.bpjsKesehatan,
              newValue: newBpjsKesehatan
            }
          }
        });
      }

      if (newBpjsKetenagakerjaan !== employee.bpjsKetenagakerjaan) {
        await (tx as any).auditLog?.create({
          data: {
            actorUserId: changedByUserId,
            action: "UPDATE_BPJS_KETENAGAKERJAAN",
            employeeId: employee.id,
            metadata: {
              oldValue: employee.bpjsKetenagakerjaan,
              newValue: newBpjsKetenagakerjaan
            }
          }
        });
      }

      if (newEmployeeId) {
        updateData.employeeId = newEmployeeId;
      }

      // Update employee
      const updatedEmployee = await tx.employee.update({
        where: { id: employeeId },
        data: updateData,
      });

      return { user, employee: updatedEmployee };
    });

    return { ok: true, data: result.employee };
  } catch (error) {
    console.error("Error updating employee:", error);
    return { ok: false, error: "Failed to update employee" } as const;
  }
}
