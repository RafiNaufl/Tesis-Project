import { NextRequest } from "next/server";
import jwt from "jsonwebtoken";
import { UserPayload } from "@shared/auth";

export function getUserFromAuthHeader(req: NextRequest): UserPayload | null {
  const auth = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!auth || !auth.toLowerCase().startsWith("bearer ")) return null;
  const token = auth.slice(7).trim();
  const secret = process.env.NEXTAUTH_SECRET || "";
  if (!secret) return null;
  try {
    const payload = jwt.verify(token, secret) as UserPayload;
    return payload;
  } catch {
    return null;
  }
}
