import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getUserFromAuthHeader } from "@/lib/mobileAuth";

export async function POST(req: NextRequest) {
  const user = getUserFromAuthHeader(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const id: string | undefined = body?.id;
  if (!id) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const notification = await db.notification.findUnique({ where: { id } });
  if (!notification || notification.userId !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updated = await db.notification.update({ where: { id }, data: { read: true } });
  const unreadCount = await db.notification.count({ where: { userId: user.id, read: false } });
  return NextResponse.json({ notification: updated, unreadCount });
}
