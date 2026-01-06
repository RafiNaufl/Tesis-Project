import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { compare } from "bcrypt";
import jwt from "jsonwebtoken";
import { UserPayload } from "@shared/auth";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const identifier = typeof body.identifier === "string" ? body.identifier.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!identifier || !password) {
      return NextResponse.json({ error: "Missing credentials" }, { status: 400 });
    }

    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier);
    let user: any = null;

    if (isEmail) {
      user = await db.user.findFirst({
        where: { email: { equals: identifier, mode: "insensitive" } },
        include: { employee: true },
      });
    } else {
      const employee = await db.employee.findFirst({ where: { contactNumber: identifier }, select: { userId: true } });
      if (employee?.userId) {
        user = await db.user.findUnique({ where: { id: employee.userId }, include: { employee: true } });
      }
    }

    if (!user) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const ok = await compare(password, user.hashedPassword);
    if (!ok) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const secret = process.env.NEXTAUTH_SECRET || "";
    if (!secret) {
      return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
    }

    const payload: UserPayload = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      image: user.profileImageUrl || null,
      position: user.employee?.position || null,
      division: user.employee?.division || null,
      organization: user.employee?.organization || null,
    };

    const accessToken = jwt.sign(payload, secret, { expiresIn: "15m" });

    const refreshToken = crypto.randomUUID();
    const refreshExpires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await db.session.create({
      data: {
        sessionToken: refreshToken,
        userId: user.id,
        expires: refreshExpires,
      },
    });

    return NextResponse.json({ accessToken, refreshToken, user: payload });
  } catch {
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
