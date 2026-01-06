import { z } from "zod";

export const DeductionSchema = z.object({
  id: z.string(),
  employeeId: z.string(),
  type: z.string(),
  amount: z.number(),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(1900),
  createdAt: z.coerce.date(),
});

export type Deduction = z.infer<typeof DeductionSchema>;

export const DeductionListResponseSchema = z.object({
  items: z.array(DeductionSchema),
});

export type DeductionListResponse = z.infer<typeof DeductionListResponseSchema>;
