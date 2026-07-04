
import { PrismaClient } from '../src/generated/prisma';

const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });

async function main() {
    console.log('=== Updating July 7 2026 Attendance Data ===');

    const targetDate = new Date(2026, 6, 7); // July 7, 2026

    // Find the target employees by name
    const targetNames = [
        "HANANULLAH",
        "MASHUMI",
        "SYARIF HIDAYATULLAH",
        "MUHAMMAD ILHAM MAULANA",
        "ASMANI",
        "NAWAWI",
        "DONI",
        "LUKMAN",
        "ASEP SAPUTRA",
        "ALI ROHMAN",
        "ALI SENIMIN",
        "FAIJAL HAERONI",
        "MUSADAD",
        "OLIM MAWARDI",
        "SUFIYAN",
        "SUTARNO",
        "TARMUZI",
        "MUHAMMAD RIFKY AFRIZAL",
        "TEDDY NURROHMAN",
        "RIZKI AMIN",
        "EDI SURYADI",
        "NUR WIDIYANTO"
    ];

    const targetEmployees = await prisma.employee.findMany({
        where: { user: { name: { in: targetNames } } },
        include: { user: true }
    });

    console.log(`Found ${targetEmployees.length} target employees`);

    // Update their attendance for July 7
    for (const emp of targetEmployees) {
        console.log(`Updating ${emp.user?.name}...`);

        const attendance = await prisma.attendance.findFirst({
            where: { employeeId: emp.id, date: targetDate }
        });

        if (attendance) {
            await prisma.attendance.update({
                where: { id: attendance.id },
                data: {
                    checkOut: null,
                    overtime: 0,
                    overtimeStart: null,
                    overtimeEnd: null,
                    isOvertimeApproved: false,
                    overtimeStartAddressNote: null,
                    overtimeEndAddressNote: null,
                    overtimeStartLatitude: null,
                    overtimeStartLongitude: null,
                    overtimeEndLatitude: null,
                    overtimeEndLongitude: null
                }
            });
            console.log(`  Updated!`);
        } else {
            console.log(`  No attendance record found for this date`);
        }
    }

    console.log('\n=== Update complete! ===');
}

main()
    .catch(e => { console.error('Error updating:', e); process.exit(1); })
    .finally(async () => await prisma.$disconnect());
