import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    // Ambil user dari database berdasarkan email
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { employee: true },
    });
    
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    
    // Hitung notifikasi yang belum dibaca
    const unreadCount = await prisma.notification.count({
      where: {
        userId: user.id,
        read: false,
      },
    });
    
    return NextResponse.json({ count: unreadCount });
  } catch (error) {
    console.error("Error fetching unread notification count:", error);
    return NextResponse.json(
      { error: "Failed to fetch unread notification count" },
      { status: 500 }
    );
  }
} 