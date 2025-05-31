import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

// Definisikan tipe untuk notifikasi
type Notification = {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  createdAt: Date;
  updatedAt: Date;
};

// GET a single notification
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // Await the params first
    const { id } = await context.params;
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }
    
    const notification = await db.notification.findUnique({
      where: {
        id,
      },
    });
    
    if (!notification) {
      return NextResponse.json(
        { error: "Notification not found" },
        { status: 404 }
      );
    }
    
    // Check if the notification belongs to the requesting user
    if (notification.userId !== session.user.id && session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 403 }
      );
    }
    
    return NextResponse.json(notification);
  } catch (error) {
    console.error("Error fetching notification:", error);
    return NextResponse.json(
      { error: "Failed to fetch notification" },
      { status: 500 }
    );
  }
}

// PATCH: Update a notification (mark as read)
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // Await the params first
    const { id } = await context.params;
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }
    
    const body = await request.json();
    
    // Tambahkan timeout untuk database query
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("Database query timeout")), 3000);
    });
    
    // Find the notification first dengan timeout
    let notification: Notification | null;
    try {
      notification = await Promise.race([
        db.notification.findUnique({
          where: {
            id,
          },
        }),
        timeoutPromise
      ]) as Notification | null;
    } catch (error) {
      console.error(`Error finding notification ${id}:`, error);
      return NextResponse.json(
        { 
          error: "Database timeout while finding notification", 
          success: false 
        },
        { status: 408 }
      );
    }
    
    if (!notification) {
      return NextResponse.json(
        { error: "Notification not found" },
        { status: 404 }
      );
    }
    
    // Check if the notification belongs to the requesting user
    if (notification.userId !== session.user.id && session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 403 }
      );
    }
    
    // Jika notifikasi sudah dibaca dan pengguna mencoba membacanya lagi, kembalikan notifikasi tanpa update
    if (notification.read === body.read) {
      return NextResponse.json({
        ...notification,
        alreadyUpdated: true
      });
    }
    
    // Update the notification dengan timeout
    let updatedNotification;
    try {
      updatedNotification = await Promise.race([
        db.notification.update({
          where: {
            id,
          },
          data: {
            read: body.read,
          },
        }),
        timeoutPromise
      ]);
    } catch (error) {
      console.error(`Error updating notification ${id}:`, error);
      
      // Jika gagal update, kembalikan notifikasi asli dengan flag error
      return NextResponse.json(
        { 
          ...notification, 
          read: body.read,  // Kembalikan nilai yang diinginkan oleh klien
          actuallyUpdated: false,
          error: "Failed to update in database, but UI can show as updated" 
        },
        { status: 200 }  // Tetap berikan 200 agar UI tidak error
      );
    }
    
    return NextResponse.json(updatedNotification);
  } catch (error) {
    console.error("Error updating notification:", error);
    return NextResponse.json(
      { 
        error: "Failed to update notification",
        success: false
      },
      { status: 500 }
    );
  }
}

// DELETE: Delete a notification
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // Await the params first
    const { id } = await context.params;
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }
    
    // Find the notification first
    const notification = await db.notification.findUnique({
      where: {
        id,
      },
    });
    
    if (!notification) {
      return NextResponse.json(
        { error: "Notification not found" },
        { status: 404 }
      );
    }
    
    // Check if the notification belongs to the requesting user or if user is admin
    if (notification.userId !== session.user.id && session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 403 }
      );
    }
    
    // Delete the notification
    await db.notification.delete({
      where: {
        id,
      },
    });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting notification:", error);
    return NextResponse.json(
      { error: "Failed to delete notification" },
      { status: 500 }
    );
  }
} 