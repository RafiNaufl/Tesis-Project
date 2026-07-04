
import { PrismaClient } from '../src/generated/prisma';

const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });

// Default office location from check-in route.ts
const OFFICE_LAT = -6.001741;
const OFFICE_LNG = 106.012622;
const MAX_RADIUS = 50; // meters

// Helper to generate random coordinates within radius
function getRandomCoordinatesInRadius(centerLat: number, centerLng: number, radiusMeters: number) {
    const radiusInDegrees = radiusMeters / 111300; // Convert meters to degrees
    const u = Math.random();
    const v = Math.random();
    const w = radiusInDegrees * Math.sqrt(u);
    const t = 2 * Math.PI * v;
    const x = w * Math.cos(t);
    const y = w * Math.sin(t);

    const newLat = centerLat + y;
    const newLng = centerLng + x / Math.cos(centerLat * Math.PI / 180);

    return {
        latitude: parseFloat(newLat.toFixed(6)),
        longitude: parseFloat(newLng.toFixed(6))
    };
}

// Helper to generate random time (hours, minutes, seconds)
function randomTime(baseHour: number, varianceMinutes: number = 30) {
    const minutes = Math.floor(Math.random() * varianceMinutes);
    const seconds = Math.floor(Math.random() * 60);
    return { hours: baseHour, minutes, seconds };
}

async function main() {
    console.log('=== Seeding July 2026 Attendance (1-7) for ALL EMPLOYEES ===');

    const startDate = new Date(2026, 6, 1); // July 1, 2026
    const endDate = new Date(2026, 6, 7); // July 7, 2026

    // Get all employees
    const allEmployees = await prisma.employee.findMany({ include: { user: true } });

    console.log(`Found ${allEmployees.length} employees: ${allEmployees.map(emp => emp.user?.name).join(', ')}`);

    // Clean existing attendance for July 1-7 for ALL employees
    console.log('Cleaning existing July 1-7 2026 data for all employees...');
    for (const emp of allEmployees) {
        await prisma.approvalLog.deleteMany({
            where: { attendance: { employeeId: emp.id, date: { gte: startDate, lte: endDate } } }
        });
        await prisma.attendanceAuditLog.deleteMany({
            where: { attendance: { employeeId: emp.id, date: { gte: startDate, lte: endDate } } }
        });
        await prisma.attendance.deleteMany({
            where: { employeeId: emp.id, date: { gte: startDate, lte: endDate } }
        });
    }

    // Generate data for each employee
    for (const emp of allEmployees) {
        console.log(`\nGenerating data for ${emp.user?.name}...`);
        
        let currentDate = new Date(startDate);

        while (currentDate <= endDate) {
            const dayOfWeek = currentDate.getDay(); // 0 Sun, 6 Sat
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

            if (isWeekend) {
                // Weekend: skip
                console.log(`  ${currentDate.toDateString()}: Weekend, skipping`);
            } else {
                // Weekday: generate attendance
                const dateStr = currentDate.toDateString();

                // Randomize: absent chance, late chance, overtime chance
                const absentRoll = Math.random();
                if (absentRoll < 0.08) { // 8% absent
                    console.log(`  ${dateStr}: ABSENT`);
                    await prisma.attendance.create({
                        data: {
                            employeeId: emp.id,
                            date: new Date(currentDate),
                            status: 'ABSENT'
                        }
                    });
                } else {
                    // PRESENT
                    const lateRoll = Math.random();
                    const isLate = lateRoll < 0.2; // 20% late

                    // Generate check-in time
                    let checkInTime;
                    if (isLate) {
                        // Late: 08:30 - 09:30
                        checkInTime = randomTime(8, 60);
                        checkInTime.minutes += 30; // Make it after 08:30
                        if (checkInTime.minutes >= 60) {
                            checkInTime.hours += 1;
                            checkInTime.minutes -= 60;
                        }
                    } else {
                        // On time: 07:35 - 08:25
                        checkInTime = randomTime(7, 50);
                        checkInTime.minutes += 35;
                        if (checkInTime.minutes >= 60) {
                            checkInTime.hours += 1;
                            checkInTime.minutes -= 60;
                        }
                    }

                    // Generate check-out time: 16:00 - 17:30, some overtime
                    const overtimeRoll = Math.random();
                    const hasOvertime = overtimeRoll < 0.3; // 30% overtime

                    let checkOutTime;
                    let overtimeHours = 0;
                    let overtimeStart = null;
                    let overtimeEnd = null;

                    if (hasOvertime) {
                        // Overtime: check out 17:30 - 19:00
                        checkOutTime = randomTime(17, 90);
                        overtimeHours = Math.floor(Math.random() * 2) + 1; // 1-2 hours
                        overtimeStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), 16, 30 + Math.floor(Math.random() * 30), Math.floor(Math.random() * 60));
                        overtimeEnd = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), 16, 30, 0);
                        overtimeEnd.setHours(overtimeEnd.getHours() + overtimeHours + Math.random(), Math.floor(Math.random() * 60), Math.floor(Math.random() * 60));
                    } else {
                        // Normal check out: 16:05 - 16:50
                        checkOutTime = randomTime(16, 45);
                        checkOutTime.minutes += 5;
                    }

                    const checkInDate = new Date(
                        currentDate.getFullYear(),
                        currentDate.getMonth(),
                        currentDate.getDate(),
                        checkInTime.hours,
                        checkInTime.minutes,
                        checkInTime.seconds
                    );
                    const checkOutDate = new Date(
                        currentDate.getFullYear(),
                        currentDate.getMonth(),
                        currentDate.getDate(),
                        checkOutTime.hours,
                        checkOutTime.minutes,
                        checkOutTime.seconds
                    );

                    // Calculate late minutes
                    const lateThreshold = 8 * 60 + 30; // 08:30 in minutes
                    const checkInMinutes = checkInTime.hours * 60 + checkInTime.minutes;
                    const lateMinutes = Math.max(0, checkInMinutes - lateThreshold);

                    // Generate location coordinates
                    const checkInLoc = getRandomCoordinatesInRadius(OFFICE_LAT, OFFICE_LNG, MAX_RADIUS);
                    const checkOutLoc = getRandomCoordinatesInRadius(OFFICE_LAT, OFFICE_LNG, MAX_RADIUS);

                    const overtimeStartLoc = hasOvertime ? getRandomCoordinatesInRadius(OFFICE_LAT, OFFICE_LNG, MAX_RADIUS) : null;
                    const overtimeEndLoc = hasOvertime ? getRandomCoordinatesInRadius(OFFICE_LAT, OFFICE_LNG, MAX_RADIUS) : null;

                    console.log(`  ${dateStr}: ${isLate ? 'LATE' : 'PRESENT'}${hasOvertime ? ' + OVERTIME' : ''}`);

                    const attendance = await prisma.attendance.create({
                        data: {
                            employeeId: emp.id,
                            date: new Date(currentDate),
                            checkIn: checkInDate,
                            checkOut: checkOutDate,
                            status: isLate ? 'LATE' : 'PRESENT',
                            isLate: isLate,
                            lateMinutes: lateMinutes,
                            overtime: hasOvertime ? overtimeHours : 0,
                            overtimeStart: overtimeStart,
                            overtimeEnd: overtimeEnd,
                            isOvertimeApproved: hasOvertime,
                            checkInLatitude: checkInLoc.latitude,
                            checkInLongitude: checkInLoc.longitude,
                            checkOutLatitude: checkOutLoc.latitude,
                            checkOutLongitude: checkOutLoc.longitude,
                            overtimeStartLatitude: overtimeStartLoc?.latitude,
                            overtimeStartLongitude: overtimeStartLoc?.longitude,
                            overtimeEndLatitude: overtimeEndLoc?.latitude,
                            overtimeEndLongitude: overtimeEndLoc?.longitude,
                            overtimeStartAddressNote: hasOvertime ? 'Lembur di kantor' : null,
                            overtimeEndAddressNote: hasOvertime ? 'Selesai lembur' : null
                        }
                    });

                    // Create approval logs if needed
                    if (isLate) {
                        await prisma.approvalLog.create({
                            data: {
                                attendanceId: attendance.id,
                                action: 'LATE_REQUEST_SUBMITTED',
                                actorUserId: emp.userId,
                                note: ['Macet di jalan', 'Kendaraan mogok', 'Bangun kesiangan', 'Keluarga sakit'][Math.floor(Math.random() * 4)]
                            }
                        });
                    }
                    if (hasOvertime) {
                        // Find admin
                        const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
                        if (admin) {
                            await prisma.approvalLog.create({
                                data: {
                                    attendanceId: attendance.id,
                                    action: 'OVERTIME_APPROVED',
                                    actorUserId: admin.id
                                }
                            });
                        }
                    }
                }
            }

            currentDate.setDate(currentDate.getDate() + 1);
        }
    }

    console.log('\n=== Seeding complete! ===');
}

main()
    .catch(e => { console.error('Error seeding:', e); process.exit(1); })
    .finally(async () => await prisma.$disconnect());
