import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getUserFromAuthHeader } from "@/lib/mobileAuth";
import { NotificationListResponseSchema } from "@shared/notification";

export async function GET(req: NextRequest) {
  const user = getUserFromAuthHeader(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limit = req.nextUrl.searchParams.get("limit") ? parseInt(req.nextUrl.searchParams.get("limit")!) : 20;

  const [items, unreadCount] = await Promise.all([
    db.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        userId: true,
        title: true,
        message: true,
        type: true,
        read: true,
        createdAt: true,
      },
    }),
    db.notification.count({ where: { userId: user.id, read: false } }),
  ]);

  const payload = { items, unreadCount };
  const parsed = NotificationListResponseSchema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: "Invalid data" }, { status: 500 });
  return NextResponse.json(parsed.data);
}
