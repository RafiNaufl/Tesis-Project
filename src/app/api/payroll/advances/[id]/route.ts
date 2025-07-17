import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

// PATCH: Update advance status (admin only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Unauthorized. Admin access required." },
        { status: 403 }
      );
    }
    
    const body = await request.json();
    const { status, rejectionReason } = body;
    
    if (!status || !['APPROVED', 'REJECTED'].includes(status)) {
      return NextResponse.json(
        { error: "Invalid status. Must be APPROVED or REJECTED" },
        { status: 400 }
      );
    }
    
    // Check if advance exists
    const existingAdvance = await db.advance.findUnique({
      where: { id },
      include: {
        employee: {
          include: {
            user: true
          }
        }
      }
    });
    
    if (!existingAdvance) {
      return NextResponse.json(
        { error: "Advance not found" },
        { status: 404 }
      );
    }
    
    if (existingAdvance.status !== "PENDING") {
      return NextResponse.json(
        { error: "Advance has already been processed" },
        { status: 400 }
      );
    }
    
    // Update advance status
    const updatedAdvance = await db.advance.update({
      where: { id },
      data: {
        status,
        rejectionReason: status === "REJECTED" ? rejectionReason : null,
        updatedAt: new Date()
      },
      include: {
        employee: {
          include: {
            user: true
          }
        }
      }
    });
    
    // Create notification for employee
    const notificationMessage = status === "APPROVED" 
      ? `Permohonan kasbon Anda sebesar Rp ${updatedAdvance.amount.toLocaleString('id-ID')} telah disetujui`
      : `Permohonan kasbon Anda sebesar Rp ${updatedAdvance.amount.toLocaleString('id-ID')} telah ditolak${rejectionReason ? `: ${rejectionReason}` : ''}`;
    
    await db.notification.create({
      data: {
        userId: updatedAdvance.employee.userId,
        title: status === "APPROVED" ? "Kasbon Disetujui" : "Kasbon Ditolak",
        message: notificationMessage,
        type: status === "APPROVED" ? "SUCCESS" : "WARNING",
        isRead: false
      }
    });
    
    return NextResponse.json({
      success: true,
      message: `Advance ${status === "APPROVED" ? "approved" : "rejected"} successfully`,
      advance: updatedAdvance
    });
  } catch (error) {
    console.error("Error updating advance status:", error);
    return NextResponse.json(
      { error: "Failed to update advance status" },
      { status: 500 }
    );
  }
}

// GET: Get specific advance details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }
    
    const advance = await db.advance.findUnique({
      where: { id },
      include: {
        employee: {
          include: {
            user: true
          }
        }
      }
    });
    
    if (!advance) {
      return NextResponse.json(
        { error: "Advance not found" },
        { status: 404 }
      );
    }
    
    // Check if user has permission to view this advance
    if (session.user.role !== "ADMIN" && advance.employee.userId !== session.user.id) {
      return NextResponse.json(
        { error: "Forbidden. You can only view your own advances." },
        { status: 403 }
      );
    }
    
    return NextResponse.json(advance);
  } catch (error) {
    console.error("Error fetching advance:", error);
    return NextResponse.json(
      { error: "Failed to fetch advance" },
      { status: 500 }
    );
  }
}