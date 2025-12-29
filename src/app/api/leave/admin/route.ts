import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { db } from "@/lib/db";
import { authOptions } from "@/lib/auth";

export async function GET(_req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    // Check if user is admin
    const user = await db.user.findUnique({
      where: { email: session.user.email! },
    });
    
    if (user?.role !== "ADMIN" && user?.role !== "MANAGER") {
      return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
    }
    
    // Get all leave requests
    const leaves = await db.leave.findMany({
      orderBy: [
        { status: "asc" }, // PENDING first, then APPROVED, then REJECTED
        { createdAt: "desc" }, // Newest first
      ],
      include: {
        employee: {
          include: {
            user: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });
    
    return NextResponse.json(leaves);
  } catch (error) {
    console.error("Error getting leave requests:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan saat memuat data cuti" },
      { status: 500 }
    );
  }
} 
