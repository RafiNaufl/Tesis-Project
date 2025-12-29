import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { startOvertime } from "@/lib/attendance";
import crypto from "crypto";

function decrypt(body: any, key?: string) {
  try {
    if (!key) return body;
    const { iv, tag, data } = body || {};
    if (!iv || !tag || !data) return body;
    const decipher = crypto.createDecipheriv("aes-256-gcm", Buffer.from(key, "hex"), Buffer.from(iv, "hex"));
    decipher.setAuthTag(Buffer.from(tag, "hex"));
    const decrypted = Buffer.concat([decipher.update(Buffer.from(data, "hex")), decipher.final()]).toString("utf8");
    return JSON.parse(decrypted);
  } catch {
    return body;
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Tidak diizinkan" }, { status: 401 });
    }

    const employee = await prisma.employee.findFirst({
      where: { userId: session.user.id },
    });
    if (!employee) {
      return NextResponse.json({ error: "Data karyawan tidak ditemukan" }, { status: 404 });
    }

    const encHeader = req.headers.get("x-encrypted");
    const key = process.env.DATA_ENCRYPTION_KEY;
    const rawBody = await req.json().catch(() => ({}));
    const body = encHeader === "aes-256-gcm" ? decrypt(rawBody, key) : rawBody;
    const { photoUrl, latitude, longitude, reason, consentConfirmed } = body || {};
    if (!photoUrl || typeof latitude !== 'number' || typeof longitude !== 'number') {
      return NextResponse.json({ error: "Foto dan lokasi wajib" }, { status: 400 });
    }
    if (typeof reason !== 'string' || reason.trim().length < 20) {
      return NextResponse.json({ error: "Alasan lembur minimal 20 karakter" }, { status: 400 });
    }
    if (consentConfirmed !== true) {
      return NextResponse.json({ error: "Anda harus menyetujui kebijakan lembur perusahaan" }, { status: 400 });
    }

    const updated = await startOvertime(employee.id, photoUrl, latitude, longitude, undefined, reason);

    await prisma.auditLog.create({
      data: {
        actorUserId: session.user.id,
        action: "OVERTIME_START",
        attendanceId: updated.id,
        employeeId: employee.id,
        ip: req.headers.get("x-forwarded-for") || undefined,
        userAgent: req.headers.get("user-agent") || undefined,
        metadata: body || {},
      },
    });

    await prisma.approvalLog.create({
      data: {
        attendanceId: updated.id,
        action: "REQUEST_SUBMITTED",
        actorUserId: session.user.id,
        note: (reason || '').slice(0, 255) || null,
      },
    });
    await prisma.attendanceAuditLog.create({
      data: {
        attendanceId: updated.id,
        userId: session.user.id,
        action: "OVERTIME_REQUESTED",
        oldValue: { overtimeStart: null },
        newValue: { overtimeStart: updated.overtimeStart },
      },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error("[OvertimeStart] Error:", error);
    return NextResponse.json({ error: error.message || "Gagal memulai lembur" }, { status: 400 });
  }
}
