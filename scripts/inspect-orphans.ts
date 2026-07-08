import { PrismaClient } from "../src/generated/prisma";

const prisma = new PrismaClient();

function toNumber(value: unknown) {
  if (typeof value === "bigint") return Number(value);
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

async function getCount(query: Promise<any>) {
  const rows = await query;
  const row = rows?.[0] ?? {};
  return toNumber(row.count);
}

async function run() {
  const results: Array<{ table: string; count: number; samples?: any[] }> = [];

  const attendanceCount = await getCount(
    prisma.$queryRaw<{ count: bigint }[]>`SELECT COUNT(*)::bigint as count FROM attendances a LEFT JOIN employees e ON e.id = a."employeeId" WHERE e.id IS NULL`
  );
  const attendanceSamples =
    attendanceCount > 0
      ? await prisma.$queryRaw<any[]>`SELECT a.id, a."employeeId", a.date FROM attendances a LEFT JOIN employees e ON e.id = a."employeeId" WHERE e.id IS NULL ORDER BY a.date DESC LIMIT 10`
      : [];
  results.push({ table: "attendances", count: attendanceCount, samples: attendanceSamples });

  const payrollCount = await getCount(
    prisma.$queryRaw<{ count: bigint }[]>`SELECT COUNT(*)::bigint as count FROM payrolls p LEFT JOIN employees e ON e.id = p."employeeId" WHERE e.id IS NULL`
  );
  const payrollSamples =
    payrollCount > 0
      ? await prisma.$queryRaw<any[]>`SELECT p.id, p."employeeId", p.month, p.year FROM payrolls p LEFT JOIN employees e ON e.id = p."employeeId" WHERE e.id IS NULL ORDER BY p.year DESC, p.month DESC LIMIT 10`
      : [];
  results.push({ table: "payrolls", count: payrollCount, samples: payrollSamples });

  const allowanceCount = await getCount(
    prisma.$queryRaw<{ count: bigint }[]>`SELECT COUNT(*)::bigint as count FROM allowances a LEFT JOIN employees e ON e.id = a."employeeId" WHERE e.id IS NULL`
  );
  const allowanceSamples =
    allowanceCount > 0
      ? await prisma.$queryRaw<any[]>`SELECT a.id, a."employeeId", a.month, a.year, a.type, a.amount FROM allowances a LEFT JOIN employees e ON e.id = a."employeeId" WHERE e.id IS NULL ORDER BY a.year DESC, a.month DESC LIMIT 10`
      : [];
  results.push({ table: "allowances", count: allowanceCount, samples: allowanceSamples });

  const deductionCount = await getCount(
    prisma.$queryRaw<{ count: bigint }[]>`SELECT COUNT(*)::bigint as count FROM deductions d LEFT JOIN employees e ON e.id = d."employeeId" WHERE e.id IS NULL`
  );
  const deductionSamples =
    deductionCount > 0
      ? await prisma.$queryRaw<any[]>`SELECT d.id, d."employeeId", d.month, d.year, d.type, d.amount FROM deductions d LEFT JOIN employees e ON e.id = d."employeeId" WHERE e.id IS NULL ORDER BY d.year DESC, d.month DESC LIMIT 10`
      : [];
  results.push({ table: "deductions", count: deductionCount, samples: deductionSamples });

  const leaveCount = await getCount(
    prisma.$queryRaw<{ count: bigint }[]>`SELECT COUNT(*)::bigint as count FROM leaves l LEFT JOIN employees e ON e.id = l."employeeId" WHERE e.id IS NULL`
  );
  const leaveSamples =
    leaveCount > 0
      ? await prisma.$queryRaw<any[]>`SELECT l.id, l."employeeId", l."startDate", l."endDate", l.status FROM leaves l LEFT JOIN employees e ON e.id = l."employeeId" WHERE e.id IS NULL ORDER BY l."startDate" DESC LIMIT 10`
      : [];
  results.push({ table: "leaves", count: leaveCount, samples: leaveSamples });

  const advanceCount = await getCount(
    prisma.$queryRaw<{ count: bigint }[]>`SELECT COUNT(*)::bigint as count FROM advances a LEFT JOIN employees e ON e.id = a."employeeId" WHERE e.id IS NULL`
  );
  const advanceSamples =
    advanceCount > 0
      ? await prisma.$queryRaw<any[]>`SELECT a.id, a."employeeId", a.month, a.year, a.amount, a.status FROM advances a LEFT JOIN employees e ON e.id = a."employeeId" WHERE e.id IS NULL ORDER BY a.year DESC, a.month DESC LIMIT 10`
      : [];
  results.push({ table: "advances", count: advanceCount, samples: advanceSamples });

  const overtimeRequestCount = await getCount(
    prisma.$queryRaw<{ count: bigint }[]>`SELECT COUNT(*)::bigint as count FROM overtime_requests o LEFT JOIN employees e ON e.id = o."employeeId" WHERE e.id IS NULL`
  );
  const overtimeRequestSamples =
    overtimeRequestCount > 0
      ? await prisma.$queryRaw<any[]>`SELECT o.id, o."employeeId", o.date, o.status, o.hours FROM overtime_requests o LEFT JOIN employees e ON e.id = o."employeeId" WHERE e.id IS NULL ORDER BY o.date DESC LIMIT 10`
      : [];
  results.push({ table: "overtime_requests", count: overtimeRequestCount, samples: overtimeRequestSamples });

  const softLoanCount = await getCount(
    prisma.$queryRaw<{ count: bigint }[]>`SELECT COUNT(*)::bigint as count FROM soft_loans s LEFT JOIN employees e ON e.id = s."employeeId" WHERE e.id IS NULL`
  );
  const softLoanSamples =
    softLoanCount > 0
      ? await prisma.$queryRaw<any[]>`SELECT s.id, s."employeeId", s.amount, s.status, s."startDate" FROM soft_loans s LEFT JOIN employees e ON e.id = s."employeeId" WHERE e.id IS NULL ORDER BY s."startDate" DESC LIMIT 10`
      : [];
  results.push({ table: "soft_loans", count: softLoanCount, samples: softLoanSamples });

  const employeeIdLogCount = await getCount(
    prisma.$queryRaw<{ count: bigint }[]>`SELECT COUNT(*)::bigint as count FROM employee_id_logs l LEFT JOIN employees e ON e.id = l."employeeId" WHERE e.id IS NULL`
  );
  const employeeIdLogSamples =
    employeeIdLogCount > 0
      ? await prisma.$queryRaw<any[]>`SELECT l.id, l."employeeId", l."oldEmployeeId", l."newEmployeeId", l."createdAt" FROM employee_id_logs l LEFT JOIN employees e ON e.id = l."employeeId" WHERE e.id IS NULL ORDER BY l."createdAt" DESC LIMIT 10`
      : [];
  results.push({ table: "employee_id_logs", count: employeeIdLogCount, samples: employeeIdLogSamples });

  const auditLogCount = await getCount(
    prisma.$queryRaw<{ count: bigint }[]>`SELECT COUNT(*)::bigint as count FROM audit_logs a LEFT JOIN employees e ON e.id = a."employeeId" WHERE a."employeeId" IS NOT NULL AND e.id IS NULL`
  );
  const auditLogSamples =
    auditLogCount > 0
      ? await prisma.$queryRaw<any[]>`SELECT a.id, a."employeeId", a.action, a."createdAt" FROM audit_logs a LEFT JOIN employees e ON e.id = a."employeeId" WHERE a."employeeId" IS NOT NULL AND e.id IS NULL ORDER BY a."createdAt" DESC LIMIT 10`
      : [];
  results.push({ table: "audit_logs(employeeId)", count: auditLogCount, samples: auditLogSamples });

  console.log(JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2));
}

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
