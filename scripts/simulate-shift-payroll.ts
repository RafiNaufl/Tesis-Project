
import { PrismaClient } from "../src/generated/prisma";
import { generateMonthlyPayroll } from "../src/lib/payroll";

const prisma = new PrismaClient();

async function main() {
    console.log("Starting Shift Payroll Simulation...");

    // 1. Cleanup old data
    await prisma.payroll.deleteMany({ where: { employeeId: "SIM-SHIFT-01" } });
    await prisma.deduction.deleteMany({ where: { employeeId: "SIM-SHIFT-01" } });
    await prisma.allowance.deleteMany({ where: { employeeId: "SIM-SHIFT-01" } });
    await prisma.overtimeRequest.deleteMany({ where: { employeeId: "SIM-SHIFT-01" } });
    await prisma.attendance.deleteMany({ where: { employeeId: "SIM-SHIFT-01" } });
    await prisma.employee.deleteMany({ where: { id: "SIM-SHIFT-01" } });
    await prisma.user.deleteMany({ where: { id: "user-shift-01" } });

    // 2. Create Shift Employee
    const employee = await prisma.employee.create({
        data: {
            id: "SIM-SHIFT-01",
            employeeId: "SHIFT-001",
            position: "Operator",
            division: "Production",
            workScheduleType: "SHIFT",
            basicSalary: 3500000,
            joiningDate: new Date(),
            user: {
                create: {
                    id: "user-shift-01",
                    name: "Budi Shift",
                    email: "budi.shift@test.com",
                    hashedPassword: "dummy",
                }
            }
        },
        include: { user: true }
    });

    console.log("Created Employee:", employee.user.name);

    // Helper for dates (Month 1 = Jan 2025)
    // Year 2025
    const year = 2025;
    const month = 1;
    
    const createDate = (day: number, hour: number, minute: number) => {
        return new Date(year, month - 1, day, hour, minute);
    };

    // 3. Create Attendances
    
    // Day 1: Normal (08:00 - 16:30)
    // Monday Jan 6, 2025
    await prisma.attendance.create({
        data: {
            employeeId: employee.id,
            date: createDate(6, 0, 0),
            checkIn: createDate(6, 8, 0),
            checkOut: createDate(6, 16, 30),
            status: "PRESENT"
        }
    });

    // Day 2: Late > 15 mins (08:20 - 16:30)
    // Tuesday Jan 7, 2025
    await prisma.attendance.create({
        data: {
            employeeId: employee.id,
            date: createDate(7, 0, 0),
            checkIn: createDate(7, 8, 20),
            checkOut: createDate(7, 16, 30),
            status: "LATE"
        }
    });

    // Day 3: No Checkout (08:00 - null) -> Treat as 16:30
    // Wednesday Jan 8, 2025
    await prisma.attendance.create({
        data: {
            employeeId: employee.id,
            date: createDate(8, 0, 0),
            checkIn: createDate(8, 8, 0),
            checkOut: null,
            status: "PRESENT" // or LATE/PRESENT depending on checkin, here PRESENT
        }
    });

    // Day 4: Absent (No record here, but we need to mark it ABSENT if we want deduction)
    // Thursday Jan 9, 2025
    // Payroll generator usually counts absent based on Attendance records with status ABSENT
    // So we must create an ABSENT record.
    await prisma.attendance.create({
        data: {
            employeeId: employee.id,
            date: createDate(9, 0, 0),
            status: "ABSENT"
        }
    });

    // 4. Overtime Requests

    // Weekday Overtime: 16:30 - 19:30 (Monday Jan 6)
    // Expect: 4.5 paid hours * 14300
    await prisma.overtimeRequest.create({
        data: {
            employeeId: employee.id,
            date: createDate(6, 0, 0),
            start: createDate(6, 16, 30),
            end: createDate(6, 19, 30),
            status: "APPROVED",
            reason: "Weekday OT",
        }
    });

    // Saturday Overtime: 14:00 - 20:00 (Saturday Jan 11)
    // Expect: 11 paid hours * 14300
    await prisma.overtimeRequest.create({
        data: {
            employeeId: employee.id,
            date: createDate(11, 0, 0),
            start: createDate(11, 14, 0),
            end: createDate(11, 20, 0),
            status: "APPROVED",
            reason: "Saturday OT",
        }
    });

    // Sunday Overtime: 08:00 - 16:30 (Sunday Jan 12)
    // Expect: 15 paid hours * 14300
    await prisma.overtimeRequest.create({
        data: {
            employeeId: employee.id,
            date: createDate(12, 0, 0),
            start: createDate(12, 8, 0),
            end: createDate(12, 16, 30),
            status: "APPROVED",
            reason: "Sunday OT",
        }
    });

    // 5. Generate Payroll
    await generateMonthlyPayroll(employee.id, month, year);

    // 6. Check Results
    const payroll = await prisma.payroll.findFirst({
        where: { employeeId: employee.id, month, year }
    });

    if (!payroll) {
        console.error("Failed to generate payroll");
        return;
    }

    const deductions = await prisma.deduction.findMany({
        where: { employeeId: employee.id, month, year }
    });

    console.log("Payroll Generated:");
    console.log("Basic Salary:", payroll.baseSalary);
    console.log("Total Deductions:", payroll.totalDeductions);
    console.log("Total Overtime:", payroll.overtimeAmount);
    
    // Verifications
    const expectedLatePenalty = 40000;
    const expectedAbsencePenalty = 97500;
    const expectedDeductions = expectedLatePenalty + expectedAbsencePenalty; // No Checkout deduction should be 0

    console.log(`Expected Deductions: ${expectedDeductions} (Late 40k + Absent 97.5k)`);
    if (payroll.totalDeductions === expectedDeductions) {
        console.log("✅ Deductions Match");
    } else {
        console.error("❌ Deductions Mismatch:", payroll.totalDeductions);
        console.log("Details:", deductions);
    }

    const rate = 14300;
    const otWeekday = ((1 * 1.5) + (1.5 * 2.0)) * rate; // 4.5 * 14300 = 64350
    const otSaturday = (5.5 * 2.0) * rate; // 11 * 14300 = 157300
    const otSunday = (7.5 * 2.0) * rate; // 15 * 14300 = 214500
    const expectedOvertime = otWeekday + otSaturday + otSunday;

    console.log(`Expected Overtime: ${expectedOvertime} (Weekday ${otWeekday} + Sat ${otSaturday} + Sun ${otSunday})`);
    if (Math.abs(payroll.overtimeAmount - expectedOvertime) < 100) { // Tolerance for floating point
        console.log("✅ Overtime Matches");
    } else {
        console.error("❌ Overtime Mismatch:", payroll.overtimeAmount);
    }

}

main()
    .catch(e => {
        console.error(e);
        // process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
