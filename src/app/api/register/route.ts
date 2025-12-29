import { NextRequest, NextResponse } from "next/server";
import { registerEmployee } from "@/lib/registerEmployee";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (session.user.role !== "ADMIN" && session.user.role !== "MANAGER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const body = await req.json();
    const res = await registerEmployee(body);
    if (!res.ok) {
      return NextResponse.json({ error: res.error }, { status: 400 });
    }
    return NextResponse.json({ id: res.id, employeeId: res.employeeId }, { status: 201 });
  } catch (error) {
    console.error("Error registering employee:", error);
    return NextResponse.json({ error: "Gagal mendaftarkan karyawan" }, { status: 500 });
  }
}
