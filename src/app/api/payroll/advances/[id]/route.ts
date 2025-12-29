import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAdvanceById, updateAdvanceStatus } from "@/lib/advance";
import { createEmployeeSuccessNotification, createEmployeeWarningNotification } from "@/lib/notification";

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
    const { status, rejectionReason, deductionMonth, deductionYear } = body;
    
    // Use the centralized function to update advance status
    const updatedAdvance = await updateAdvanceStatus(id, {
      status,
      rejectionReason,
      deductionMonth,
      deductionYear
    });
    
    // Create notification for employee
    const monthNames = [
      "Januari", "Februari", "Maret", "April", "Mei", "Juni",
      "Juli", "Agustus", "September", "Oktober", "November", "Desember"
    ];
    
    const notificationMessage = status === "APPROVED" && updatedAdvance.deductionMonth && updatedAdvance.deductionYear
      ? `Permohonan kasbon Anda sebesar Rp ${updatedAdvance.amount.toLocaleString('id-ID')} telah disetujui. Pemotongan akan dilakukan pada ${monthNames[updatedAdvance.deductionMonth - 1]} ${updatedAdvance.deductionYear}`
      : status === "APPROVED"
        ? `Permohonan kasbon Anda sebesar Rp ${updatedAdvance.amount.toLocaleString('id-ID')} telah disetujui.`
        : `Permohonan kasbon Anda sebesar Rp ${updatedAdvance.amount.toLocaleString('id-ID')} telah ditolak${rejectionReason ? `: ${rejectionReason}` : ''}`;
    
    const title = status === "APPROVED" ? "Kasbon Disetujui" : "Kasbon Ditolak";
    
    if (status === "APPROVED") {
      await createEmployeeSuccessNotification(
        updatedAdvance.employeeId,
        title,
        notificationMessage
      );
    } else {
      await createEmployeeWarningNotification(
        updatedAdvance.employeeId,
        title,
        notificationMessage
      );
    }
    
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
    
    // Use the centralized function to get advance by ID
    const advance = await getAdvanceById(
      id,
      session.user.role === "ADMIN",
      session.user.id
    );
    
    return NextResponse.json(advance);
  } catch (error) {
    console.error("Error fetching advance:", error);
    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Failed to fetch advance" },
      { status: 500 }
    );
  }
}
