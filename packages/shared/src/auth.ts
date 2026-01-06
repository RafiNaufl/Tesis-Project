import { z } from "zod";

export const UserPayloadSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string(),
  role: z.string(),
  image: z.string().nullable().optional(),
  position: z.string().nullable().optional(),
  division: z.string().nullable().optional(),
  organization: z.string().nullable().optional(),
});

export type UserPayload = z.infer<typeof UserPayloadSchema>;

export const LoginResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string().optional(),
  user: UserPayloadSchema,
});

export type LoginResponse = z.infer<typeof LoginResponseSchema>;

export const RefreshResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  user: UserPayloadSchema,
});

export type RefreshResponse = z.infer<typeof RefreshResponseSchema>;

