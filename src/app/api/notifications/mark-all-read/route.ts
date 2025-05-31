import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * POST: Menandai semua notifikasi pengguna sebagai dibaca
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }
    
    // Tambahkan timeout untuk database query
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("Database query timeout")), 5000);
    });
    
    let updatedCount;
    try {
      // Update semua notifikasi pengguna yang belum dibaca
      const result = await Promise.race([
        db.notification.updateMany({
          where: {
            userId: session.user.id,
            read: false,
          },
          data: {
            read: true,
          },
        }),
        timeoutPromise
      ]);
      
      // Dapatkan jumlah notifikasi yang diperbarui
      updatedCount = (result as { count: number }).count;
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
      
      // Jika gagal, tetap berikan respons sukses untuk UX yang lebih baik
      return NextResponse.json({
        success: false,
        message: "Failed to mark all notifications as read in database, but UI can show as updated",
        actuallyUpdated: false,
        count: 0
      });
    }
    
    return NextResponse.json({
      success: true,
      message: `${updatedCount} notifications marked as read`,
      count: updatedCount
    });
  } catch (error) {
    console.error("Error marking all notifications as read:", error);
    return NextResponse.json(
      { 
        error: "Failed to mark all notifications as read",
        success: false
      },
      { status: 500 }
    );
  }
} 