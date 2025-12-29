import { prisma } from '../src/lib/prisma';
import { generateMonthlyPayroll } from '../src/lib/payroll';
import { Status } from '../src/generated/prisma/enums';

// Helper to create date object (Month is 0-indexed in JS Date)
const createDate = (day: number, hour: number, minute: number) => {
    // December 2025
    return new Date(2025, 11, day, hour, minute);
};

async function simulateNonShiftPayroll() {
    console.log("=== SIMULASI GAJI NON-SHIFT ===");
    
    // 1. Data Dummy Employees
    const employeesData = [
        {
            employeeId: "SIM-FOREMAN-01",
            name: "Budi Mandor",
            role: "Foreman",
            email: "budi.mandor@sim.com",
            position: "Foreman",
            workScheduleType: "NON_SHIFT",
            basicSalary: 3500000, // Not used for calculation, but required
            hourlyRate: 15000,
        },
        {
            employeeId: "SIM-OPERATOR-01",
            name: "Andi Operator",
            role: "Employee",
            email: "andi.operator@sim.com",
            position: "Operator",
            workScheduleType: "NON_SHIFT",
            basicSalary: 3000000,
            hourlyRate: 15000,
        }
    ];

    for (const empData of employeesData) {
        console.log(`\nProcessing Employee: ${empData.name} (${empData.position})`);
        
        // Upsert User
        const user = await prisma.user.upsert({
            where: { email: empData.email },
            update: { name: empData.name },
            create: {
                name: empData.name,
                email: empData.email,
                hashedPassword: "dummy_password",
                role: "EMPLOYEE"
            }
        });

        // Upsert Employee
        const employee = await prisma.employee.upsert({
            where: { employeeId: empData.employeeId },
            update: {
                position: empData.position,
                workScheduleType: empData.workScheduleType,
                hourlyRate: empData.hourlyRate,
                userId: user.id
            },
            create: {
                employeeId: empData.employeeId,
                userId: user.id,
                position: empData.position,
                division: "Operations",
                basicSalary: empData.basicSalary,
                joiningDate: new Date(),
                workScheduleType: empData.workScheduleType,
                hourlyRate: empData.hourlyRate,
            }
        });

        // Clear existing data for simulation (Attendance, Deduction, Allowance, Payroll) for Dec 2025
        const startDate = new Date(2025, 11, 1);
        const endDate = new Date(2025, 11, 31);
        
        await prisma.attendance.deleteMany({
            where: { employeeId: employee.id, date: { gte: startDate, lte: endDate } }
        });
        await prisma.deduction.deleteMany({
            where: { employeeId: employee.id, month: 12, year: 2025 }
        });
        await prisma.allowance.deleteMany({
            where: { employeeId: employee.id, month: 12, year: 2025 }
        });
        await prisma.payroll.deleteMany({
            where: { employeeId: employee.id, month: 12, year: 2025 }
        });

        // Generate Attendance Records
        // Skenario FOREMAN: 20 Weekdays (18 Normal, 2 Late), 2 Saturdays (4 hours)
        // Skenario OPERATOR: 20 Weekdays (19 Normal, 1 No Checkout)
        
        const attendanceData = [];
        
        if (empData.position === "Foreman") {
            // Weekdays (Mon-Fri) dates in Dec 2025: 1-5, 8-12, 15-19, 22-26
            // Total 20 days.
            // Let's take 1-5, 8-12, 15-19, 22-26.
            
            // 18 Normal Days (08:00 - 16:00)
            for (let i = 1; i <= 18; i++) {
                let day = i; // Simplified day mapping
                // Map simply: 1-5 -> Dec 1-5, 6-10 -> Dec 8-12, etc.
                // Actually let's just use specific dates
                
                // Normal Days: Dec 1, 2, 3, 4, 5, 8, 9, 10, 11, 12, 15, 16, 17, 18, 19, 22, 23, 24
                // Late Days: Dec 25, 26
                // Weekend Days: Dec 6, 13 (Saturdays)
            }
            
            // Normal Days (Dec 1-5, 8-12, 15-19, 22-24) = 18 days
            const normalDays = [1,2,3,4,5, 8,9,10,11,12, 15,16,17,18,19, 22,23,24];
            for (const d of normalDays) {
                await prisma.attendance.create({
                    data: {
                        employeeId: employee.id,
                        date: createDate(d, 0, 0),
                        checkIn: createDate(d, 8, 0),
                        checkOut: createDate(d, 16, 0),
                        status: Status.PRESENT
                    }
                });
            }
            
            // Late Days (Dec 25, 26) = 2 days (> 08:15)
            const lateDays = [25, 26];
            for (const d of lateDays) {
                await prisma.attendance.create({
                    data: {
                        employeeId: employee.id,
                        date: createDate(d, 0, 0),
                        checkIn: createDate(d, 8, 30), // Late
                        checkOut: createDate(d, 16, 30),
                        status: Status.LATE,
                        isLate: true,
                        lateMinutes: 15
                    }
                });
            }
            
            // Weekend Days (Dec 6, 13) = 2 days (Saturdays, 4 hours: 08:00 - 12:00)
            const weekendDays = [6, 13];
            for (const d of weekendDays) {
                await prisma.attendance.create({
                    data: {
                        employeeId: employee.id,
                        date: createDate(d, 0, 0),
                        checkIn: createDate(d, 8, 0),
                        checkOut: createDate(d, 12, 0),
                        status: Status.PRESENT
                    }
                });
            }
            
        } else {
            // OPERATOR
            // 20 Weekdays total
            // 19 Normal, 1 No Checkout
            
            const normalDays = [1,2,3,4,5, 8,9,10,11,12, 15,16,17,18,19, 22,23,24, 25];
            for (const d of normalDays) {
                await prisma.attendance.create({
                    data: {
                        employeeId: employee.id,
                        date: createDate(d, 0, 0),
                        checkIn: createDate(d, 8, 0),
                        checkOut: createDate(d, 16, 0),
                        status: Status.PRESENT
                    }
                });
            }
            
            // No Checkout Day (Dec 26)
            await prisma.attendance.create({
                data: {
                    employeeId: employee.id,
                    date: createDate(26, 0, 0),
                    checkIn: createDate(26, 8, 0),
                    checkOut: null, // No Checkout
                    status: Status.PRESENT // Or whatever status system assigns for checkin only, usually PRESENT/LATE
                }
            });
        }
        
        console.log("Generating Payroll...");
        try {
            const payroll = await generateMonthlyPayroll(employee.id, 12, 2025);
            
            console.log("------------------------------------------------");
            console.log(`SLIP GAJI: ${empData.name}`);
            console.log(`Periode: Desember 2025`);
            console.log(`Role: ${empData.position}`);
            console.log("------------------------------------------------");
            console.log(`Gaji Pokok (Work Earnings): Rp ${payroll.baseSalary.toLocaleString('id-ID')}`);
            console.log(`Tunjangan (Total):          Rp ${payroll.totalAllowances.toLocaleString('id-ID')}`);
            console.log(`Potongan (Total):           Rp ${payroll.totalDeductions.toLocaleString('id-ID')}`);
            console.log(`Lembur (Overtime):          Rp ${payroll.overtimeAmount.toLocaleString('id-ID')}`);
            console.log("------------------------------------------------");
            console.log(`GAJI BERSIH (NET):          Rp ${payroll.netSalary.toLocaleString('id-ID')}`);
            console.log("------------------------------------------------");
            
            // Detail Breakdown
            const allowances = await prisma.allowance.findMany({ where: { employeeId: employee.id, month: 12, year: 2025 } });
            const deductions = await prisma.deduction.findMany({ where: { employeeId: employee.id, month: 12, year: 2025 } });
            
            console.log("\nDetail Tunjangan:");
            allowances.forEach(a => console.log(`- ${a.type}: Rp ${a.amount.toLocaleString('id-ID')}`));
            
            console.log("\nDetail Potongan:");
            deductions.forEach(d => console.log(`- ${d.reason}: Rp ${d.amount.toLocaleString('id-ID')}`));
            
        } catch (error) {
            console.error("Error generating payroll:", error);
        }
    }
    
    console.log("\n=== SIMULASI SELESAI ===");
}

simulateNonShiftPayroll()
    .catch(e => {
        console.error(e);
        // process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
