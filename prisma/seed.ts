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

  // Create demo employee users
  const employees = [];

  // First employee
  const employee1Password = await hash('employee123', 10);
  const employee1 = await prisma.user.upsert({
    where: { email: 'employee@example.com' },
    update: {},
    create: {
      email: 'employee@example.com',
      name: 'John Employee',
      hashedPassword: employee1Password,
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
          isActive: true,
        },
      },
    },
    include: {
      employee: true,
    },
  });

  employees.push(employee1);
  console.log('Employee 1 created:', employee1.id);

  // Second employee
  const employee2Password = await hash('employee123', 10);
  const employee2 = await prisma.user.upsert({
    where: { email: 'jane@example.com' },
    update: {},
    create: {
      email: 'jane@example.com',
      name: 'Jane Smith',
      hashedPassword: employee2Password,
      role: 'EMPLOYEE',
      employee: {
        create: {
          employeeId: 'EMP002',
          position: 'UI/UX Designer',
          department: 'Design',
          basicSalary: 4500,
          joiningDate: new Date('2023-02-20'),
          contactNumber: '555-234-5678',
          address: '456 Oak Ave, Anytown, USA',
          isActive: true,
        },
      },
    },
    include: {
      employee: true,
    },
  });

  employees.push(employee2);
  console.log('Employee 2 created:', employee2.id);

  // Third employee
  const employee3Password = await hash('employee123', 10);
  const employee3 = await prisma.user.upsert({
    where: { email: 'robert@example.com' },
    update: {},
    create: {
      email: 'robert@example.com',
      name: 'Robert Johnson',
      hashedPassword: employee3Password,
      role: 'EMPLOYEE',
      employee: {
        create: {
          employeeId: 'EMP003',
          position: 'Project Manager',
          department: 'Management',
          basicSalary: 6000,
          joiningDate: new Date('2022-11-05'),
          contactNumber: '555-345-6789',
          address: '789 Pine St, Anytown, USA',
          isActive: true,
        },
      },
    },
    include: {
      employee: true,
    },
  });

  employees.push(employee3);
  console.log('Employee 3 created:', employee3.id);

  // Generate dates for the records
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const dayBefore = new Date(today);
  dayBefore.setDate(today.getDate() - 2);
  
  const currentMonth = today.getMonth() + 1;
  const currentYear = today.getFullYear();
  
  const lastMonth = currentMonth === 1 ? 12 : currentMonth - 1;
  const lastMonthYear = currentMonth === 1 ? currentYear - 1 : currentYear;

  // Create attendance records for all employees
  console.log('Creating attendance records...');
  
  for (const employee of employees) {
    // Last 5 days attendance for current employee
    for (let i = 1; i <= 5; i++) {
      const recordDate = new Date(today);
      recordDate.setDate(today.getDate() - i);
      
      // Skip weekends
      if (recordDate.getDay() === 0 || recordDate.getDay() === 6) {
        continue;
      }
      
      const checkInHour = 8 + Math.floor(Math.random() * 2); // Random check in between 8 and 9 AM
      const checkOutHour = 17 + Math.floor(Math.random() * 2); // Random check out between 5 and 6 PM
      
      // Random status with more weight on PRESENT
      const statuses = ['PRESENT', 'PRESENT', 'PRESENT', 'PRESENT', 'LATE', 'HALFDAY'];
      const status = statuses[Math.floor(Math.random() * statuses.length)] as 'PRESENT' | 'LATE' | 'HALFDAY' | 'ABSENT';
      
      await prisma.attendance.create({
        data: {
          employeeId: employee.employee!.id,
          date: new Date(recordDate),
          checkIn: new Date(recordDate.setHours(checkInHour, Math.floor(Math.random() * 60), 0)),
          checkOut: new Date(recordDate.setHours(checkOutHour, Math.floor(Math.random() * 60), 0)),
          status: status,
        },
      });
    }
  }

  console.log('Attendance records created');

  // Create allowances for employees
  console.log('Creating allowances...');
  
  const allowanceTypes = ['Transport', 'Meal', 'Housing', 'Performance Bonus'];
  
  for (const employee of employees) {
    // Current month allowances
    for (let i = 0; i < 2; i++) {
      const type = allowanceTypes[Math.floor(Math.random() * allowanceTypes.length)];
      const amount = (100 + Math.floor(Math.random() * 10) * 50); // Random amount between 100 and 550
      
      await prisma.allowance.create({
        data: {
          employeeId: employee.employee!.id,
          month: currentMonth,
          year: currentYear,
          type: type,
          amount: amount,
          date: today,
        },
      });
    }
    
    // Last month allowances
    for (let i = 0; i < 2; i++) {
      const type = allowanceTypes[Math.floor(Math.random() * allowanceTypes.length)];
      const amount = (100 + Math.floor(Math.random() * 10) * 50);
      const lastMonthDate = new Date(lastMonthYear, lastMonth - 1, 15);
      
      await prisma.allowance.create({
        data: {
          employeeId: employee.employee!.id,
          month: lastMonth,
          year: lastMonthYear,
          type: type,
          amount: amount,
          date: lastMonthDate,
        },
      });
    }
  }
  
  console.log('Allowances created');
  
  // Create deductions for employees
  console.log('Creating deductions...');
  
  const deductionReasons = ['Tax', 'Insurance', 'Advance Payment', 'Late Penalty'];
  
  for (const employee of employees) {
    // Current month deductions
    for (let i = 0; i < 2; i++) {
      const reason = deductionReasons[Math.floor(Math.random() * deductionReasons.length)];
      const amount = (50 + Math.floor(Math.random() * 10) * 25); // Random amount between 50 and 300
      
      await prisma.deduction.create({
        data: {
          employeeId: employee.employee!.id,
          month: currentMonth,
          year: currentYear,
          reason: reason,
          amount: amount,
          date: today,
        },
      });
    }
    
    // Last month deductions
    for (let i = 0; i < 2; i++) {
      const reason = deductionReasons[Math.floor(Math.random() * deductionReasons.length)];
      const amount = (50 + Math.floor(Math.random() * 10) * 25);
      const lastMonthDate = new Date(lastMonthYear, lastMonth - 1, 15);
      
      await prisma.deduction.create({
        data: {
          employeeId: employee.employee!.id,
          month: lastMonth,
          year: lastMonthYear,
          reason: reason,
          amount: amount,
          date: lastMonthDate,
        },
      });
    }
  }
  
  console.log('Deductions created');
  
  // Create payroll records for last month (all paid)
  console.log('Creating payroll records...');
  
  for (const employee of employees) {
    // Calculate last month's attendance data (mock values)
    const daysPresent = 18 + Math.floor(Math.random() * 4); // 18-21 days present
    const daysAbsent = 22 - daysPresent; // Assuming 22 working days
    const overtimeHours = Math.floor(Math.random() * 20); // 0-19 hours overtime
    
    // Get employee's basic salary
    const baseSalary = employee.employee!.basicSalary;
    
    // Calculate overtime amount (1.5 times hourly rate)
    const hourlyRate = baseSalary / 176; // Assuming 22 working days, 8 hours per day
    const overtimeAmount = overtimeHours * hourlyRate * 1.5;
    
    // Get allowances total for last month (actual values from DB)
    const allowances = await prisma.allowance.findMany({
      where: {
        employeeId: employee.employee!.id,
        month: lastMonth,
        year: lastMonthYear,
      },
    });
    
    const totalAllowances = allowances.reduce((sum, a) => sum + Number(a.amount), 0);
    
    // Get deductions total for last month (actual values from DB)
    const deductions = await prisma.deduction.findMany({
      where: {
        employeeId: employee.employee!.id,
        month: lastMonth,
        year: lastMonthYear,
      },
    });
    
    const totalDeductions = deductions.reduce((sum, d) => sum + Number(d.amount), 0);
    
    // Calculate net salary
    const netSalary = baseSalary + totalAllowances + overtimeAmount - totalDeductions;
    
    // Create payroll record for last month (paid)
    await prisma.payroll.upsert({
      where: {
        employeeId_month_year: {
          employeeId: employee.employee!.id,
          month: lastMonth,
          year: lastMonthYear
        }
      },
      update: {
        baseSalary: baseSalary,
        totalAllowances: totalAllowances,
        totalDeductions: totalDeductions,
        netSalary: netSalary,
        daysPresent: daysPresent,
        daysAbsent: daysAbsent,
        overtimeHours: overtimeHours,
        overtimeAmount: overtimeAmount,
        status: 'PAID',
        paidAt: new Date(lastMonthYear, lastMonth, 28), // Paid on the 28th of last month
      },
      create: {
        employeeId: employee.employee!.id,
        month: lastMonth,
        year: lastMonthYear,
        baseSalary: baseSalary,
        totalAllowances: totalAllowances,
        totalDeductions: totalDeductions,
        netSalary: netSalary,
        daysPresent: daysPresent,
        daysAbsent: daysAbsent,
        overtimeHours: overtimeHours,
        overtimeAmount: overtimeAmount,
        status: 'PAID',
        paidAt: new Date(lastMonthYear, lastMonth, 28), // Paid on the 28th of last month
      },
    });
    
    // Current month payroll - only for first employee (pending)
    if (employee.id === employee1.id) {
      const currMonthDaysPresent = 10 + Math.floor(Math.random() * 5); // 10-14 days present so far
      const currMonthDaysAbsent = 15 - currMonthDaysPresent; // Assuming 15 working days so far
      const currMonthOvertimeHours = Math.floor(Math.random() * 10); // 0-9 hours overtime
      const currMonthOvertimeAmount = currMonthOvertimeHours * hourlyRate * 1.5;
      
      // Get allowances total for current month
      const currAllowances = await prisma.allowance.findMany({
        where: {
          employeeId: employee.employee!.id,
          month: currentMonth,
          year: currentYear,
        },
      });
      
      const currTotalAllowances = currAllowances.reduce((sum, a) => sum + Number(a.amount), 0);
      
      // Get deductions total for current month
      const currDeductions = await prisma.deduction.findMany({
        where: {
          employeeId: employee.employee!.id,
          month: currentMonth,
          year: currentYear,
        },
      });
      
      const currTotalDeductions = currDeductions.reduce((sum, d) => sum + Number(d.amount), 0);
      
      // Calculate current month's net salary (pro-rated)
      const currNetSalary = (baseSalary * currMonthDaysPresent / 22) + currTotalAllowances + currMonthOvertimeAmount - currTotalDeductions;
      
      // Create payroll record for current month (pending)
      await prisma.payroll.upsert({
        where: {
          employeeId_month_year: {
            employeeId: employee.employee!.id,
            month: currentMonth,
            year: currentYear
          }
        },
        update: {
          baseSalary: baseSalary,
          totalAllowances: currTotalAllowances,
          totalDeductions: currTotalDeductions,
          netSalary: currNetSalary,
          daysPresent: currMonthDaysPresent,
          daysAbsent: currMonthDaysAbsent,
          overtimeHours: currMonthOvertimeHours,
          overtimeAmount: currMonthOvertimeAmount,
          status: 'PENDING',
        },
        create: {
          employeeId: employee.employee!.id,
          month: currentMonth,
          year: currentYear,
          baseSalary: baseSalary,
          totalAllowances: currTotalAllowances,
          totalDeductions: currTotalDeductions,
          netSalary: currNetSalary,
          daysPresent: currMonthDaysPresent,
          daysAbsent: currMonthDaysAbsent,
          overtimeHours: currMonthOvertimeHours,
          overtimeAmount: currMonthOvertimeAmount,
          status: 'PENDING',
        },
      });
    }
  }
  
  console.log('Payroll records created');

  // Add sample notifications for the admin
  await prisma.notification.create({
    data: {
      userId: admin.id,
      title: 'Welcome to the Admin Dashboard',
      message: 'You can manage employees, payroll, and more from here.',
      type: 'info',
      read: false,
      createdAt: new Date()
    }
  });
  
  await prisma.notification.create({
    data: {
      userId: admin.id,
      title: 'New Employee Joined',
      message: 'John Employee has joined the Engineering department.',
      type: 'success',
      read: false,
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) // 2 days ago
    }
  });
  
  await prisma.notification.create({
    data: {
      userId: admin.id,
      title: 'Payroll Processing Due',
      message: 'Monthly payroll processing is due in 3 days.',
      type: 'warning',
      read: false,
      createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) // 1 day ago
    }
  });
  
  await prisma.notification.create({
    data: {
      userId: admin.id,
      title: 'New Reports Available',
      message: 'Financial summary reports for last month are now available.',
      type: 'info',
      read: false,
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) // 2 days ago
    }
  });
  
  await prisma.notification.create({
    data: {
      userId: admin.id,
      title: 'System Update',
      message: 'System will undergo maintenance this weekend.',
      type: 'warning',
      read: true,
      createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000) // 4 days ago
    }
  });

  // Add sample notifications for each employee
  for (const employee of employees) {
    await prisma.notification.create({
      data: {
        userId: employee.id,
        title: 'Welcome to the Employee Portal',
        message: 'You can view your attendance, payroll, and more.',
        type: 'info',
        read: false,
        createdAt: new Date()
      }
    });
    
    await prisma.notification.create({
      data: {
        userId: employee.id,
        title: 'Attendance Confirmed',
        message: 'Your attendance for yesterday has been recorded.',
        type: 'success',
        read: false,
        createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) // 1 day ago
      }
    });
    
    await prisma.notification.create({
      data: {
        userId: employee.id,
        title: 'Payslip Available',
        message: 'Your payslip for the last month is now available for download.',
        type: 'info',
        read: Math.random() > 0.5,
        createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000) // 15 days ago
      }
    });
    
    await prisma.notification.create({
      data: {
        userId: employee.id,
        title: 'Profile Update Reminder',
        message: 'Please ensure your contact details are up to date.',
        type: 'info',
        read: Math.random() > 0.5,
        createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // 7 days ago
      }
    });
    
    // Add a late check-in notification randomly to some employees
    if (Math.random() > 0.3) {
      await prisma.notification.create({
        data: {
          userId: employee.id,
          title: 'Late Check-in Recorded',
          message: 'You were marked late for your check-in on Monday.',
          type: 'warning',
          read: false,
          createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) // 5 days ago
        }
      });
    }
  }

  console.log('Sample notifications created');
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