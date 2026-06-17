
import { PrismaClient } from '../src/generated/prisma';

const prisma = new PrismaClient({
  log: ['error']
});

async function main() {
  console.log('=== Checking Seeded Data ===\n');

  // Count employees
  const employeeCount = await prisma.employee.count();
  console.log(`Total Employees: ${employeeCount}`);

  // Count attendance records
  const attendanceCount = await prisma.attendance.count();
  console.log(`Total Attendance Records: ${attendanceCount}`);

  // Count overtime requests
  const overtimeCount = await prisma.overtimeRequest.count();
  console.log(`Total Overtime Requests: ${overtimeCount}`);

  // Count payroll records
  const payrollCount = await prisma.payroll.count();
  console.log(`Total Payroll Records: ${payrollCount}`);

  // Sample employees
  console.log('\n=== Sample Employees ===');
  const employees = await prisma.employee.findMany({
    take: 5,
    include: { user: true }
  });

  employees.forEach(emp => {
    console.log(`- ${emp.employeeId}: ${emp.user?.name} (${emp.workScheduleType})`);
  });

  // Sample attendance
  console.log('\n=== Sample Attendance ===');
  const attendances = await prisma.attendance.findMany({
    take: 5,
    include: { employee: { include: { user: true } } }
  });

  attendances.forEach(att => {
    const dateStr = new Date(att.date).toLocaleDateString();
    const status = att.status;
    console.log(`- ${att.employee?.user?.name} (${dateStr}): ${status}`);
  });
}

main()
  .catch((e) => {
    console.error('Error checking seed data:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

