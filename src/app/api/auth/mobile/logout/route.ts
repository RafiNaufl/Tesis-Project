import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const { refreshToken } = await req.json();
    if (!refreshToken || typeof refreshToken !== "string") {
      return NextResponse.json({ error: "Missing refresh token" }, { status: 400 });
    }

    await db.session.delete({ where: { sessionToken: refreshToken } }).catch(() => {});
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Logout failed" }, { status: 500 });
  }
}
