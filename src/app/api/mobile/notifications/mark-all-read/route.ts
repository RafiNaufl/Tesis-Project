import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getUserFromAuthHeader } from "@/lib/mobileAuth";

export async function POST(req: NextRequest) {
  const user = getUserFromAuthHeader(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const result = await db.notification.updateMany({
      where: { userId: user.id, read: false },
      data: { read: true },
    });
    const unreadCount = await db.notification.count({ where: { userId: user.id, read: false } });
    return NextResponse.json({ success: true, count: result.count, unreadCount });
  } catch (error) {
    console.error("Error marking all as read (mobile):", error);
    return NextResponse.json({ success: false, count: 0, unreadCount: 0 });
  }
}
