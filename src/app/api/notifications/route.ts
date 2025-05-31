import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

// Fallback data untuk respons saat terjadi error
const getFallbackData = () => {
  return {
    notifications: [],
    unreadCount: 0,
    error: "Terjadi kesalahan saat mengambil notifikasi",
    fromFallback: true
  };
};

// GET: Fetch notifications for the current user
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }
    
    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const unreadOnly = searchParams.get("unreadOnly") === "true";
    const limit = parseInt(searchParams.get("limit") || "20");
    
    // Tambahkan timeout untuk database query
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("Database query timeout")), 5000);
    });
    
    // Fetch notifications dengan timeout
    const notificationsPromise = Promise.race([
      db.notification.findMany({
        where: {
          userId: session.user.id,
          ...(unreadOnly ? { read: false } : {}),
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: limit,
      }),
      timeoutPromise
    ]);
    
    // Count unread notifications dengan timeout
    const unreadCountPromise = Promise.race([
      db.notification.count({
        where: {
          userId: session.user.id,
          read: false,
        },
      }),
      timeoutPromise
    ]);
    
    // Gunakan Promise.allSettled untuk menangani kegagalan masing-masing promise
    const [notificationsResult, unreadCountResult] = await Promise.allSettled([
      notificationsPromise,
      unreadCountPromise
    ]);
    
    // Periksa hasil promise dan gunakan fallback jika perlu
    const notifications = notificationsResult.status === 'fulfilled' 
      ? notificationsResult.value 
      : [];
    
    const unreadCount = unreadCountResult.status === 'fulfilled'
      ? unreadCountResult.value
      : 0;
    
    // Jika salah satu promise gagal, catat log error
    if (notificationsResult.status === 'rejected') {
      console.error("Error fetching notifications:", notificationsResult.reason);
    }
    
    if (unreadCountResult.status === 'rejected') {
      console.error("Error counting unread notifications:", unreadCountResult.reason);
    }
    
    // Tetap berikan respons meskipun terjadi kesalahan parsial
    return NextResponse.json({
      notifications,
      unreadCount,
      hasError: notificationsResult.status === 'rejected' || unreadCountResult.status === 'rejected'
    });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    
    // Gunakan fallback data untuk respons
    return NextResponse.json(
      getFallbackData(),
      { status: 200 } // Tetap berikan status 200 untuk mencegah kesalahan di klien
    );
  }
}

// POST: Create a new notification
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }
    
    const body = await request.json();
    const { userId, title, message, type } = body;
    
    if (!userId || !title || !message || !type) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }
    
    // Tambahkan timeout untuk database query
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("Database query timeout")), 5000);
    });
    
    // Check if the user exists dengan timeout
    const userPromise = Promise.race([
      db.user.findUnique({
        where: { id: userId },
      }),
      timeoutPromise
    ]);
    
    let user;
    try {
      user = await userPromise;
    } catch (error) {
      console.error("Error checking user existence:", error);
      return NextResponse.json(
        { error: "Failed to verify user" },
        { status: 500 }
      );
    }
    
    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }
    
    // Create the notification using Prisma client
    let notification;
    try {
      notification = await Promise.race([
        db.notification.create({
          data: {
            userId,
            title,
            message,
            type,
            read: false,
          },
        }),
        timeoutPromise
      ]);
    } catch (error) {
      console.error("Error creating notification:", error);
      return NextResponse.json(
        { error: "Failed to create notification" },
        { status: 500 }
      );
    }
    
    return NextResponse.json(notification, { status: 201 });
  } catch (error) {
    console.error("Error creating notification:", error);
    return NextResponse.json(
      { error: "Failed to create notification" },
      { status: 500 }
    );
  }
} 