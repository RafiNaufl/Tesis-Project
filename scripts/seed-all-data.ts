
import { PrismaClient } from '../src/generated/prisma';
import { hash } from 'bcrypt';
import { generateEmployeeId } from '../src/lib/employeeId';
import { generateMonthlyPayroll } from '../src/lib/payroll';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DIRECT_URL || process.env.DATABASE_URL
    }
  }
});

// Helper function to generate random integer in [min, max]
const randomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

// Helper function to create date object
const createDate = (year: number, month: number, day: number, hour: number, minute: number, second: number = 0) => new Date(year, month - 1, day, hour, minute, second);

async function main() {
  console.log('=== SEEDING ALL DATA (Attendance, Overtime, Payroll) ===');
  
  // Get all employees
  const employees = await prisma.employee.findMany({ include: { user: true } });
  console.log(`Found ${employees.length} employees.`);
  
  // Get admin user for approvals
  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  if (!admin) {
    console.error('Admin user not found!');
    return;
  }
  
  // Define date range: Jan 1 to Jun 16, 2026
  const startDate = new Date(2026, 0, 1);
  const endDate = new Date(2026, 5, 16);
  
  // Clean up existing data in this range
  console.log('Cleaning up existing data...');
  for (const emp of employees) {
    await prisma.approvalLog.deleteMany({
      where: { attendance: { employeeId: emp.id } }
    });
    await prisma.attendanceAuditLog.deleteMany({
      where: { attendance: { employeeId: emp.id } }
    });
    await prisma.overtimeRequest.deleteMany({
      where: { employeeId: emp.id }
    });
    await prisma.attendance.deleteMany({
      where: {
        employeeId: emp.id,
        date: { gte: startDate, lte: endDate }
      }
    });
    for (let m = 1; m <= 6; m++) {
      await prisma.payroll.deleteMany({
        where: { employeeId: emp.id, month: m, year: 2026 }
      });
      await prisma.allowance.deleteMany({
        where: { employeeId: emp.id, month: m, year: 2026 }
      });
      await prisma.deduction.deleteMany({
        where: { employeeId: emp.id, month: m, year: 2026 }
      });
    }
  }
  console.log('Cleanup complete!');
  
  // Process each employee
  for (const emp of employees) {
    console.log(`\nProcessing employee: ${emp.user?.name} (${emp.employeeId})`);
    
    let currentDate = new Date(startDate);
    let overtimeRequests = [];
    
    while (currentDate <= endDate) {
      const day = currentDate.getDay(); // 0 = Sunday, 6 = Saturday
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth() + 1;
      const date = currentDate.getDate();
      
      // Special case for employee Rahmat R (CTU-006) whose internal id is cmk6tni7m0002l504cexzrboq in May 2026
      if (emp.id === 'cmk6tni7m0002l504cexzrboq' && month === 5 && year === 2026) {
        const specialData: Record<number, { in: string, out: string }> = {
          4: { in: "08:01:15", out: "16:21:01" },
          5: { in: "08:12:50", out: "16:06:24" },
          6: { in: "08:09:27", out: "16:06:24" },
          7: { in: "08:10:21", out: "16:21:01" },
          8: { in: "08:06:10", out: "16:21:01" },
          12: { in: "08:12:09", out: "16:28:40" },
          13: { in: "08:11:18", out: "16:21:01" },
          18: { in: "08:09:15", out: "16:30:19" },
          19: { in: "08:00:53", out: "16:05:45" },
          20: { in: "08:13:27", out: "16:05:45" },
          21: { in: "08:01:32", out: "16:15:19" },
          22: { in: "08:12:17", out: "16:09:53" },
          25: { in: "08:14:17", out: "16:06:28" },
          29: { in: "08:13:35", out: "16:06:04" },
        };

        if (specialData[date]) {
          const [inH, inM, inS] = specialData[date].in.split(':').map(Number);
          const [outH, outM, outS] = specialData[date].out.split(':').map(Number);
          const checkInDate = createDate(year, month, date, inH, inM, inS);
          const checkOutDate = createDate(year, month, date, outH, outM, outS);
          const isLate = inH > 8 || (inH === 8 && inM > 30);
          
          const att = await prisma.attendance.create({
            data: {
              employeeId: emp.id,
              date: new Date(currentDate),
              checkIn: checkInDate,
              checkOut: checkOutDate,
              status: isLate ? 'LATE' : 'PRESENT',
              isLate: isLate,
              lateMinutes: isLate ? (inH - 8) * 60 + inM : 0
            }
          });

          if (isLate) {
            await prisma.approvalLog.create({
              data: {
                attendanceId: att.id,
                action: 'LATE_REQUEST_SUBMITTED',
                actorUserId: emp.userId,
                note: 'Macet di jalan'
              }
            });
          }
        } else if (day !== 0 && day !== 6) {
          // Weekday but no record in special data = ABSENT
          await prisma.attendance.create({
            data: {
              employeeId: emp.id,
              date: new Date(currentDate),
              status: 'ABSENT'
            }
          });
        }
        currentDate.setDate(currentDate.getDate() + 1);
        continue;
      }

      // Randomize: decide what kind of day
      const isPresent = Math.random() > 0.05; // 95% present
      const isLate = isPresent && Math.random() > 0.75; // 25% late
      const hasOvertime = isPresent && Math.random() > 0.6; // 40% overtime
      
      if (!isPresent) {
        // Absent
        await prisma.attendance.create({
          data: {
            employeeId: emp.id,
            date: currentDate,
            status: 'ABSENT'
          }
        });
        currentDate.setDate(currentDate.getDate() + 1);
        continue;
      }
      
      // Generate check-in and check-out times
      let checkInHour, checkInMinute, checkOutHour, checkOutMinute;
      if (emp.workScheduleType === 'SHIFT') {
        // Shift: flexible hours
        checkInHour = randomInt(6, 9);
        checkInMinute = randomInt(0, 59);
        checkOutHour = checkInHour + randomInt(8, 10);
        checkOutMinute = randomInt(0, 59);
      } else {
        // Non-Shift: regular hours
        checkInHour = isLate ? randomInt(8, 10) : randomInt(7, 8);
        checkInMinute = isLate ? randomInt(15, 45) : randomInt(0, 30);
        checkOutHour = randomInt(16, 18);
        checkOutMinute = randomInt(0, 59);
      }
      
      const checkInDate = createDate(year, month, date, checkInHour, checkInMinute);
      const checkOutDate = createDate(year, month, date, checkOutHour, checkOutMinute);
      
      // Create attendance
      const att = await prisma.attendance.create({
        data: {
          employeeId: emp.id,
          date: currentDate,
          checkIn: checkInDate,
          checkOut: checkOutDate,
          status: isLate ? 'LATE' : 'PRESENT',
          isLate: isLate,
          lateMinutes: isLate ? randomInt(15, 60) : 0
        }
      });
      
      // Create overtime if needed
      if (hasOvertime) {
        const otStartHour = checkOutHour;
        const otStartMinute = randomInt(0, 30);
        const otDuration = randomInt(1, 4);
        const otEndHour = otStartHour + otDuration;
        const otEndMinute = randomInt(0, 59);
        
        const otStartDate = createDate(year, month, date, otStartHour, otStartMinute);
        const otEndDate = createDate(year, month, date, otEndHour, otEndMinute);
        
        const otRequest = await prisma.overtimeRequest.create({
          data: {
            employeeId: emp.id,
            date: currentDate,
            start: otStartDate,
            end: otEndDate,
            reason: ['Maintenance', 'Extra Shift', 'Urgent Work', 'Project Deadline'][randomInt(0, 3)],
            status: 'APPROVED',
            approvedBy: admin.id,
            approvedAt: new Date()
          }
        });
        
        overtimeRequests.push(otRequest);
        
        // Update attendance with overtime
        await prisma.attendance.update({
          where: { id: att.id },
          data: {
            overtimeStart: otStartDate,
            overtimeEnd: otEndDate,
            overtime: otDuration,
            isOvertimeApproved: true
          }
        });
        
        // Create approval log
        await prisma.approvalLog.create({
          data: {
            attendanceId: att.id,
            action: 'OVERTIME_APPROVED',
            actorUserId: admin.id
          }
        });
      }
      
      // Add late approval log if late
      if (isLate) {
        await prisma.approvalLog.create({
          data: {
            attendanceId: att.id,
            action: 'LATE_REQUEST_SUBMITTED',
            actorUserId: emp.userId,
            note: ['Traffic jam', 'Overslept', 'Family matter'][randomInt(0, 2)]
          }
        });
      }
      
      // Next day
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    // Generate payroll for Jan-Jun 2026
    console.log('Generating payroll for Jan-Jun 2026...');
    for (let month = 1; month <= 6; month++) {
      try {
        const payroll = await generateMonthlyPayroll(emp.id, month, 2026);
        console.log(`✓ Generated payroll for ${month}/2026: Rp ${payroll.netSalary.toLocaleString('id-ID')}`);
      } catch (err) {
        console.error(`✗ Failed to generate payroll for ${month}/2026:`, err);
      }
    }
  }
  
  console.log('\n=== SEEDING COMPLETE! ===');
}

main()
  .catch((e) => {
    console.error('Error seeding data:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

