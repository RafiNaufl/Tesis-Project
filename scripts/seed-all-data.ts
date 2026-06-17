
import { PrismaClient } from '../src/generated/prisma';
import { hash } from 'bcrypt';
import { generateEmployeeId } from '../src/lib/employeeId';
import { generateMonthlyPayroll } from '../src/lib/payroll';

const prisma = new PrismaClient();

// Helper function to generate random integer in [min, max]
const randomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

// Helper function to create date object
const createDate = (year: number, month: number, day: number, hour: number, minute: number) => new Date(year, month - 1, day, hour, minute);

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

