import { NextRequest, NextResponse } from "next/server";
import { getEmployeeSoftLoanInfo } from "@/lib/softloan";
import { requireAuth } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const user = await requireAuth();
    
    // Hanya admin atau karyawan yang bersangkutan yang dapat mengakses
    if (user.role !== "ADMIN") {
      const employee = await prisma.employee.findUnique({
        where: { id },
        select: { userId: true },
      });
      
      if (!employee || employee.userId !== user.id) {
        return NextResponse.json(
          { message: "Unauthorized" },
          { status: 403 }
        );
      }
    }
    
    // Gunakan fungsi yang sudah ada untuk mendapatkan informasi pinjaman lunak aktif
    const softLoanInfo = await getEmployeeSoftLoanInfo(id);
    
    return NextResponse.json(softLoanInfo);
  } catch (error) {
    console.error('Error fetching active soft loan:', error);
    if (error instanceof Error && error.message === "Tidak ada pinjaman lunak aktif") {
      return NextResponse.json({ message: error.message }, { status: 404 });
    }
    return NextResponse.json({ message: 'Error fetching active soft loan' }, { status: 500 });
  }
}
