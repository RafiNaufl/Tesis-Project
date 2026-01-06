import { z } from "zod";

export const AttendanceStatusSchema = z.enum(["PRESENT", "ABSENT", "LATE", "HALFDAY", "LEAVE"]);

export const AttendanceRecordSchema = z.object({
  id: z.string(),
  employeeId: z.string(),
  date: z.coerce.date(),
  checkIn: z.coerce.date().nullable(),
  checkOut: z.coerce.date().nullable(),
  status: AttendanceStatusSchema,
  notes: z.string().nullable().optional(),
});

export type AttendanceRecord = z.infer<typeof AttendanceRecordSchema>;

export const AttendanceListResponseSchema = z.object({
  items: z.array(AttendanceRecordSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
});

export type AttendanceListResponse = z.infer<typeof AttendanceListResponseSchema>;
