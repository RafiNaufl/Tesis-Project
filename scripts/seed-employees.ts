
import { PrismaClient } from '../src/generated/prisma';
import { hash } from 'bcrypt';
import { generateEmployeeId } from '../src/lib/employeeId';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding employees...');

  const employeesData = [
    {
      email: 'Johan@ctu.com',
      name: 'JOHAN IRAWAN',
      role: 'Foreman',
      salary: 25000,
      workSchedule: 'NON_SHIFT',
      password: 'johan123',
      division: 'Mekanik',
      organization: 'CTU',
      bpjsKetenagakerjaan: 80000,
      employmentStatus: 'Tetap'
    },
    {
      email: 'Edi@ctu.com',
      name: 'EDI SURYADI',
      role: 'Foreman',
      salary: 25000,
      workSchedule: 'NON_SHIFT',
      password: 'edi123',
      division: 'Elektrik',
      organization: 'CTU',
      bpjsKetenagakerjaan: 80000,
      employmentStatus: 'Tetap'
    },
    {
      email: 'Alirohimin@ctu.com',
      name: 'ALI ROHMAN',
      role: 'Operator',
      salary: 15800,
      workSchedule: 'NON_SHIFT',
      password: 'alir123',
      division: 'Mekanik',
      organization: 'CTU',
      bpjsKetenagakerjaan: 80000,
      employmentStatus: 'Tetap'
    },
    {
      email: 'AliSenimin@ctu.com',
      name: 'ALI SENIMIN',
      role: 'Operator',
      salary: 15800,
      workSchedule: 'NON_SHIFT',
      password: 'alis123',
      division: 'Mekanik',
      organization: 'CTU',
      bpjsKetenagakerjaan: 80000,
      employmentStatus: 'Tetap'
    },
    {
      email: 'Faijal@ctu.com',
      name: 'FAIJAL HAERONI',
      role: 'Operator',
      salary: 15800,
      workSchedule: 'NON_SHIFT',
      password: 'faijal123',
      division: 'Elektrik',
      organization: 'CTU',
      bpjsKetenagakerjaan: 80000,
      employmentStatus: 'Tetap'
    },
    {
      email: 'Hanan@ctu.com',
      name: 'HANANULLAH',
      role: 'Operator',
      salary: 5128000,
      workSchedule: 'SHIFT',
      password: 'hanan123',
      division: 'Crane',
      organization: 'CTU',
      bpjsKetenagakerjaan: 80000,
      employmentStatus: 'Tetap'
    },
    {
      email: 'Mashumi@ctu.com',
      name: 'MASHUMI',
      role: 'Operator',
      salary: 5128000,
      workSchedule: 'SHIFT',
      password: 'mashumi123',
      division: 'Mekanik',
      organization: 'CTU',
      bpjsKetenagakerjaan: 80000,
      employmentStatus: 'Tetap'
    },
    {
      email: 'Musadad@ctu.com',
      name: 'MUSADAD',
      role: 'Operator',
      salary: 15800,
      workSchedule: 'NON_SHIFT',
      password: 'musadad123',
      division: 'Mekanik',
      organization: 'CTU',
      bpjsKetenagakerjaan: 80000,
      employmentStatus: 'Tetap'
    },
    {
      email: 'Olim@ctu.com',
      name: 'OLIM MAWARDI',
      role: 'Operator',
      salary: 15800,
      workSchedule: 'NON_SHIFT',
      password: 'olim123',
      division: 'Mekanik',
      organization: 'CTU',
      bpjsKetenagakerjaan: 80000,
      employmentStatus: 'Tetap'
    },
    {
      email: 'Sofiyan@ctu.com',
      name: 'SUFIYAN',
      role: 'Operator',
      salary: 15800,
      workSchedule: 'NON_SHIFT',
      password: 'sufiyan123',
      division: 'Mekanik',
      organization: 'CTU',
      bpjsKetenagakerjaan: 80000,
      employmentStatus: 'Tetap'
    },
    {
      email: 'Sutarno@ctu.com',
      name: 'SUTARNO',
      role: 'Operator',
      salary: 15800,
      workSchedule: 'NON_SHIFT',
      password: 'sutarno123',
      division: 'Mekanik',
      organization: 'CTU',
      bpjsKetenagakerjaan: 80000,
      employmentStatus: 'Tetap'
    },
    {
      email: 'Syarif@ctu.com',
      name: 'SYARIF HIDAYATULLAH',
      role: 'Operator',
      salary: 5128000,
      workSchedule: 'SHIFT',
      password: 'syarif123',
      division: 'Mekanik',
      organization: 'CTU',
      bpjsKetenagakerjaan: 80000,
      employmentStatus: 'Tetap'
    },
    {
      email: 'Tarmuji@ctu.com',
      name: 'TARMUZI',
      role: 'Operator',
      salary: 15800,
      workSchedule: 'NON_SHIFT',
      password: 'tarmuji123',
      division: 'Mekanik',
      organization: 'CTU',
      bpjsKetenagakerjaan: 80000,
      employmentStatus: 'Tetap'
    },
    {
      email: 'Ilham@ctu.com',
      name: 'MUHAMMAD ILHAM MAULANA',
      role: 'Operator',
      salary: 5128000,
      workSchedule: 'SHIFT',
      password: 'ilham123',
      division: 'Crane',
      organization: 'CTU',
      bpjsKetenagakerjaan: 80000,
      employmentStatus: 'Tetap'
    },
    {
      email: 'Rifky@ctu.com',
      name: 'MUHAMMAD RIFKY AFRIZAL',
      role: 'Operator',
      salary: 15800,
      workSchedule: 'NON_SHIFT',
      password: 'rifky123',
      division: 'Mekanik',
      organization: 'CTU',
      bpjsKetenagakerjaan: 80000,
      employmentStatus: 'Tetap'
    },
    {
      email: 'Tedi@ctu.com',
      name: 'TEDDY NURROHMAN',
      role: 'Operator',
      salary: 15800,
      workSchedule: 'NON_SHIFT',
      password: 'teddy123',
      division: 'Mekanik',
      organization: 'CTU',
      bpjsKetenagakerjaan: 80000,
      employmentStatus: 'Tetap'
    },
    {
      email: 'Asmani@ctu.com',
      name: 'ASMANI',
      role: 'Operator',
      salary: 5128000,
      workSchedule: 'SHIFT',
      password: 'asmani123',
      division: 'Mekanik',
      organization: 'CTU',
      bpjsKetenagakerjaan: 80000,
      employmentStatus: 'Tetap'
    },
    {
      email: 'Asep@ctu.com',
      name: 'ASEP SAPUTRA',
      role: 'Operator',
      salary: 15800,
      workSchedule: 'NON_SHIFT',
      password: 'asep123',
      division: 'Elektrik',
      organization: 'CTU',
      bpjsKetenagakerjaan: 80000,
      employmentStatus: 'Tetap'
    },
    {
      email: 'Nur@ctu.com',
      name: 'NUR WIDIYANTO',
      role: 'Foreman',
      salary: 25000,
      workSchedule: 'NON_SHIFT',
      password: 'nur123',
      division: 'Mekanik',
      organization: 'CTU',
      bpjsKetenagakerjaan: 80000,
      employmentStatus: 'Tetap'
    },
    {
      email: 'Nawawi@ctu.com',
      name: 'NAWAWI',
      role: 'Operator',
      salary: 5128000,
      workSchedule: 'SHIFT',
      password: 'nawawi123',
      division: 'Mekanik',
      organization: 'CTU',
      bpjsKetenagakerjaan: 80000,
      employmentStatus: 'Tetap'
    },
    {
      email: 'Doni@ctu.com',
      name: 'DONI',
      role: 'Operator',
      salary: 5128000,
      workSchedule: 'SHIFT',
      password: 'doni123',
      division: 'Mekanik',
      organization: 'CTU',
      bpjsKetenagakerjaan: 80000,
      employmentStatus: 'Tetap'
    },
    {
      email: 'Lukman@ctu.com',
      name: 'LUKMAN',
      role: 'Operator',
      salary: 5128000,
      workSchedule: 'SHIFT',
      password: 'lukman123',
      division: 'Crane',
      organization: 'CTU',
      bpjsKetenagakerjaan: 80000,
      employmentStatus: 'Tetap'
    },
    {
      email: 'Amin@ctu.com',
      name: 'RIZKI AMIN',
      role: 'Operator',
      salary: 15800,
      workSchedule: 'NON_SHIFT',
      password: 'amin123',
      division: 'Mekanik',
      organization: 'CTU',
      bpjsKetenagakerjaan: 80000,
      employmentStatus: 'Tetap'
    }
  ];

  for (const empData of employeesData) {
    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: { email: { equals: empData.email, mode: 'insensitive' } }
    });

    if (existingUser) {
      console.log(`User with email ${empData.email} already exists, skipping...`);
      continue;
    }

    // Create user and employee in transaction
    await prisma.$transaction(async (tx) => {
      const employeeId = await generateEmployeeId(tx as any, empData.organization);
      const hashedPassword = await hash(empData.password, 10);

      const user = await tx.user.create({
        data: {
          name: empData.name,
          email: empData.email.toLowerCase(),
          hashedPassword,
          role:
            empData.role === 'Admin' ? 'ADMIN' :
            empData.role === 'Direktur' ? 'DIREKTUR' :
            empData.role === 'Manajer' ? 'MANAGER' :
            empData.role === 'Foreman' ? 'FOREMAN' :
            empData.role === 'Assisten Foreman' ? 'ASSISTANT_FOREMAN' :
            'EMPLOYEE',
        }
      });

      const employee = await tx.employee.create({
        data: {
          employeeId,
          userId: user.id,
          position: empData.role,
          division: empData.division,
          basicSalary: empData.workSchedule === 'SHIFT' ? empData.salary : 0,
          hourlyRate: empData.workSchedule === 'NON_SHIFT' ? empData.salary : undefined,
          workScheduleType: empData.workSchedule,
          organization: empData.organization,
          employmentStatus: empData.employmentStatus,
          joiningDate: new Date(),
          bpjsKesehatan: 0,
          bpjsKetenagakerjaan: empData.bpjsKetenagakerjaan,
        }
      });

      console.log(`Created employee: ${empData.name} (${employeeId})`);
    });
  }

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

