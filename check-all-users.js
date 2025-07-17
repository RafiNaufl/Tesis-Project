const { PrismaClient } = require('./src/generated/prisma');
const { compare } = require('bcrypt');

const prisma = new PrismaClient();

async function checkUser(credentials) {
  try {
    // Find the user
    const user = await prisma.user.findUnique({
      where: {
        email: credentials.email
      },
      include: {
        employee: true
      }
    });
    
    console.log('User found:', user ? 'Yes' : 'No');
    
    if (!user) {
      console.log('User not found');
      return null;
    }
    
    // Check if password is valid
    const isPasswordValid = await compare(credentials.password, user.hashedPassword);
    console.log('Password valid:', isPasswordValid);
    
    if (!isPasswordValid) {
      console.log('Invalid password');
      return null;
    }
    
    // Print user details
    console.log('User ID:', user.id);
    console.log('User Email:', user.email);
    console.log('User Name:', user.name);
    console.log('User Role:', user.role);
    
    if (user.employee) {
      console.log('\nEmployee Details:');
      console.log('Employee ID:', user.employee.employeeId);
      console.log('Position:', user.employee.position);
      console.log('Department:', user.employee.department);
      console.log('Basic Salary:', user.employee.basicSalary);
      console.log('Joining Date:', user.employee.joiningDate);
      console.log('Is Active:', user.employee.isActive);
    }
    
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      employee: user.employee
    };
  } catch (error) {
    console.error('Error:', error);
    return null;
  }
}

async function main() {
  try {
    console.log('\n=== Checking Admin User ===');
    await checkUser({
      email: 'admin@example.com',
      password: 'admin123'
    });
    
    console.log('\n=== Checking Employee User ===');
    await checkUser({
      email: 'employee@example.com',
      password: 'employee123'
    });
    
    console.log('\n=== Checking Invalid Password ===');
    await checkUser({
      email: 'admin@example.com',
      password: 'wrongpassword'
    });
    
    console.log('\n=== Checking Non-existent User ===');
    await checkUser({
      email: 'nonexistent@example.com',
      password: 'password123'
    });
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();