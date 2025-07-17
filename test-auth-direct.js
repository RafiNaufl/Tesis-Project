const { PrismaClient } = require('./src/generated/prisma');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function testDirectAuth() {
  console.log('Testing authentication directly with Prisma and bcrypt...');
  
  const credentials = [
    { email: 'admin@example.com', password: 'admin123', label: 'Admin (correct credentials)' },
    { email: 'employee@example.com', password: 'employee123', label: 'Employee (correct credentials)' },
    { email: 'admin@example.com', password: 'wrongpassword', label: 'Admin (wrong password)' },
    { email: 'nonexistent@example.com', password: 'password', label: 'Non-existent user' }
  ];
  
  for (const cred of credentials) {
    console.log(`\nTesting: ${cred.label}`);
    console.log(`Email: ${cred.email}, Password: ${cred.password}`);
    
    try {
      // Find the user
      const user = await prisma.user.findUnique({
        where: { email: cred.email }
      });
      
      if (!user) {
        console.log('Result: User not found');
        continue;
      }
      
      // Check password
      const isPasswordValid = await bcrypt.compare(cred.password, user.hashedPassword);
      
      if (!isPasswordValid) {
        console.log('Result: Invalid password');
        continue;
      }
      
      console.log('Result: Authentication successful');
      console.log('User details:', {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      });
    } catch (error) {
      console.error('Error:', error.message);
    }
  }
  
  await prisma.$disconnect();
}

testDirectAuth();