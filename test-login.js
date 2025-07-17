const { PrismaClient } = require('./src/generated/prisma');
const { compare } = require('bcrypt');

const prisma = new PrismaClient();

async function testLogin(email, password) {
  try {
    console.log(`Testing login for ${email}...`);
    
    // Find the user
    const user = await prisma.user.findUnique({
      where: { email }
    });
    
    if (!user) {
      console.log('User not found');
      return null;
    }
    
    // Check password
    const isPasswordValid = await compare(password, user.hashedPassword);
    
    if (!isPasswordValid) {
      console.log('Invalid password');
      return null;
    }
    
    console.log('Login successful');
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role
    };
  } catch (error) {
    console.error('Error during login:', error);
    return null;
  }
}

async function main() {
  try {
    // Test admin login
    await testLogin('admin@example.com', 'admin123');
    
    // Test employee login
    await testLogin('employee@example.com', 'employee123');
    
    // Test with wrong password
    await testLogin('admin@example.com', 'wrongpassword');
    
    // Test with non-existent user
    await testLogin('nonexistent@example.com', 'password');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();