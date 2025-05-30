import { PrismaClient } from '../src/generated/prisma';
import { hash } from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create admin user
  const adminPassword = await hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      name: 'Admin User',
      hashedPassword: adminPassword,
      role: 'ADMIN',
    },
  });

  console.log('Admin user created:', admin.id);

  // Create a demo employee user
  const employeePassword = await hash('employee123', 10);
  const employee = await prisma.user.upsert({
    where: { email: 'employee@example.com' },
    update: {},
    create: {
      email: 'employee@example.com',
      name: 'John Employee',
      hashedPassword: employeePassword,
      role: 'EMPLOYEE',
      employee: {
        create: {
          employeeId: 'EMP001',
          position: 'Software Developer',
          department: 'Engineering',
          basicSalary: 5000,
          joiningDate: new Date('2023-01-15'),
          contactNumber: '555-123-4567',
          address: '123 Main St, Anytown, USA',
        },
      },
    },
    include: {
      employee: true,
    },
  });

  console.log('Employee user created:', employee.id);

  // Add some attendance records for the employee
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  
  // Yesterday's attendance
  await prisma.attendance.create({
    data: {
      employeeId: employee.employee!.id,
      date: yesterday,
      checkIn: new Date(yesterday.setHours(9, 0, 0)),
      checkOut: new Date(yesterday.setHours(17, 30, 0)),
      status: 'PRESENT',
    },
  });

  console.log('Seeding complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 