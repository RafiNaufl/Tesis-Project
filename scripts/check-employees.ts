
import { PrismaClient } from '../src/generated/prisma';

const prisma = new PrismaClient();

async function main() {
  console.log('Listing all employees...');
  const employees = await prisma.employee.findMany({ include: { user: true } });
  console.log('Total employees:', employees.length);
  for (const emp of employees) {
    console.log(`- ${emp.employeeId}: ${emp.user?.name} (${emp.user?.email}) - ${emp.workScheduleType}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

