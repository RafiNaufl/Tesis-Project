import { prisma } from "../src/lib/prisma";

async function main() {
  console.log("Starting verification of cascading delete logic...");

  const uniqueId = `test-${Date.now()}`;
  const email = `${uniqueId}@example.com`;
  const employeeId = `EMP-${uniqueId}`;

  // 1. Create User
  const user = await prisma.user.create({
    data: {
      name: "Test Delete User",
      email: email,
      hashedPassword: "password",
      role: "EMPLOYEE",
    },
  });

  console.log(`Created User: ${user.id}`);

  // 2. Create Employee
  const employee = await prisma.employee.create({
    data: {
      user: { connect: { id: user.id } },
      employeeId: employeeId,
      position: "Staff",
      division: "IT",
      basicSalary: 5000000,
      joiningDate: new Date(),
    },
  });

  console.log(`Created Employee: ${employee.id}`);

  // 3. Create Related Records

  // Allowance
  await prisma.allowance.create({
    data: {
      employeeId: employee.id,
      month: 1,
      year: 2024,
      type: "Transport",
      amount: 100000,
    },
  });
  console.log("Created Allowance");

  // Attendance
  const attendance = await prisma.attendance.create({
    data: {
      employeeId: employee.id,
      date: new Date(),
      status: "PRESENT",
    },
  });
  console.log(`Created Attendance: ${attendance.id}`);

  // ApprovalLog (linked to Attendance)
  await prisma.approvalLog.create({
    data: {
      attendanceId: attendance.id,
      action: "APPROVE",
      actorUserId: user.id,
    },
  });
  console.log("Created ApprovalLog");
  
  // AttendanceAuditLog (linked to Attendance)
  await prisma.attendanceAuditLog.create({
      data: {
          attendanceId: attendance.id,
          userId: user.id,
          action: "CREATE"
      }
  });
  console.log("Created AttendanceAuditLog");

  // AuditLog (linked to Employee directly)
  await prisma.auditLog.create({
    data: {
      actorUserId: user.id,
      action: "UPDATE_PROFILE",
      employeeId: employee.id,
    },
  });
  console.log("Created AuditLog (Employee linked)");
  
  // AuditLog (linked to Attendance)
   await prisma.auditLog.create({
    data: {
      actorUserId: user.id,
      action: "UPDATE_ATTENDANCE",
      attendanceId: attendance.id,
    },
  });
  console.log("Created AuditLog (Attendance linked)");

  // Deduction
  await prisma.deduction.create({
    data: {
      employeeId: employee.id,
      month: 1,
      year: 2024,
      reason: "Late",
      amount: 50000,
    },
  });
  console.log("Created Deduction");

  // Leave
  await prisma.leave.create({
    data: {
      employeeId: employee.id,
      startDate: new Date(),
      endDate: new Date(),
      reason: "Sick",
      type: "SICK",
    },
  });
  console.log("Created Leave");

  // Advance
  await prisma.advance.create({
    data: {
      employeeId: employee.id,
      amount: 500000,
      month: 1,
      year: 2024,
    },
  });
  console.log("Created Advance");

  // SoftLoan
  await prisma.softLoan.create({
    data: {
      employeeId: employee.id,
      totalAmount: 1000000,
      monthlyAmount: 100000,
      remainingAmount: 1000000,
      durationMonths: 10,
      startMonth: 1,
      startYear: 2024,
    },
  });
  console.log("Created SoftLoan");

  // OvertimeRequest
  await prisma.overtimeRequest.create({
    data: {
      employeeId: employee.id,
      date: new Date(),
      start: new Date(),
      end: new Date(),
    },
  });
  console.log("Created OvertimeRequest");

  // Payroll
  const payroll = await prisma.payroll.create({
    data: {
      employeeId: employee.id,
      month: 1,
      year: 2024,
      baseSalary: 5000000,
      netSalary: 4500000,
      daysPresent: 20,
      daysAbsent: 0,
    },
  });
  console.log(`Created Payroll: ${payroll.id}`);

  // PayrollAuditLog
  await prisma.payrollAuditLog.create({
    data: {
      payrollId: payroll.id,
      userId: user.id,
      action: "CREATE",
    },
  });
  console.log("Created PayrollAuditLog");

  console.log("All related records created. Attempting deletion logic...");

  // 4. Execute Deletion Logic (mimicking api/employees/[id]/route.ts)
  try {
    await prisma.$transaction(async (tx) => {
      console.log("  Deleting PayrollAuditLog...");
      await tx.payrollAuditLog.deleteMany({
        where: { payroll: { employeeId: employee.id } },
      });

      console.log("  Deleting Payroll...");
      await tx.payroll.deleteMany({ where: { employeeId: employee.id } });

      console.log("  Deleting Attendance...");
      await tx.attendance.deleteMany({ where: { employeeId: employee.id } });

      console.log("  Deleting Allowance...");
      await tx.allowance.deleteMany({ where: { employeeId: employee.id } });

      console.log("  Deleting Deduction...");
      await tx.deduction.deleteMany({ where: { employeeId: employee.id } });

      console.log("  Deleting Leave...");
      await tx.leave.deleteMany({ where: { employeeId: employee.id } });

      console.log("  Deleting Advance...");
      await tx.advance.deleteMany({ where: { employeeId: employee.id } });

      console.log("  Deleting SoftLoan...");
      await tx.softLoan.deleteMany({ where: { employeeId: employee.id } });

      console.log("  Deleting OvertimeRequest...");
      await tx.overtimeRequest.deleteMany({ where: { employeeId: employee.id } });

      console.log("  Deleting AuditLog (Employee linked)...");
      await tx.auditLog.deleteMany({ where: { employeeId: employee.id } });

      console.log("  Deleting User...");
      await tx.user.delete({ where: { id: user.id } });
    });

    console.log("Deletion transaction completed successfully.");
  } catch (error) {
    console.error("Deletion failed:", error);
    process.exit(1);
  }

  // 5. Verify Deletion
  const userCheck = await prisma.user.findUnique({ where: { id: user.id } });
  if (userCheck) {
    console.error("User still exists!");
    process.exit(1);
  } else {
    console.log("User successfully deleted.");
  }

  const employeeCheck = await prisma.employee.findUnique({ where: { id: employee.id } });
  if (employeeCheck) {
    console.error("Employee still exists!");
    process.exit(1);
  } else {
    console.log("Employee successfully deleted.");
  }
  
  // Verify AuditLog linked to employee is gone
  const auditLogCheck = await prisma.auditLog.findFirst({ where: { employeeId: employee.id } });
  if (auditLogCheck) {
      console.error("AuditLog (Employee linked) still exists!");
      process.exit(1);
  }

  console.log("Verification PASSED.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
