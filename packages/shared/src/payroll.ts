import { z } from "zod";

export const PayrollRecordSchema = z.object({
  id: z.string(),
  employeeId: z.string(),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(1900),
  baseSalary: z.number(),
  allowancesTotal: z.number(),
  deductionsTotal: z.number(),
  netSalary: z.number(),
});

export type PayrollRecord = z.infer<typeof PayrollRecordSchema>;

export const PayrollResponseSchema = z.object({
  item: PayrollRecordSchema.nullable(),
});

export type PayrollResponse = z.infer<typeof PayrollResponseSchema>;
