import { z } from "zod";

export const AllowanceSchema = z.object({
  id: z.string(),
  employeeId: z.string(),
  type: z.string(),
  amount: z.number(),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(1900),
  createdAt: z.coerce.date(),
});

export type Allowance = z.infer<typeof AllowanceSchema>;

export const AllowanceListResponseSchema = z.object({
  items: z.array(AllowanceSchema),
});

export type AllowanceListResponse = z.infer<typeof AllowanceListResponseSchema>;
