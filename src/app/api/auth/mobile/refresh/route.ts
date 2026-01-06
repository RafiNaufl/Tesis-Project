import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import jwt from "jsonwebtoken";
import { UserPayload } from "@shared/auth";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  try {
    const { refreshToken } = await req.json();
    if (!refreshToken || typeof refreshToken !== "string") {
      return NextResponse.json({ error: "Missing refresh token" }, { status: 400 });
    }

    const session = await db.session.findUnique({ where: { sessionToken: refreshToken } });
    if (!session || session.expires < new Date()) {
      return NextResponse.json({ error: "Invalid or expired refresh token" }, { status: 401 });
    }

    const user = await db.user.findUnique({ where: { id: session.userId }, include: { employee: true } });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
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

    const newRefreshToken = crypto.randomUUID();
    const newExpires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await db.session.update({
      where: { sessionToken: refreshToken },
      data: { sessionToken: newRefreshToken, expires: newExpires },
    });

    return NextResponse.json({ accessToken, refreshToken: newRefreshToken, user: payload });
  } catch {
    return NextResponse.json({ error: "Refresh failed" }, { status: 500 });
  }
}
