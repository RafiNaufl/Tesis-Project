const { PrismaClient } = require('./src/generated/prisma');
const { compare } = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  try {
    // Find the employee user
    const user = await prisma.user.findUnique({
      where: {
        email: 'employee@example.com'
      }
    });
    
    console.log('User found:', user ? 'Yes' : 'No');
    
    if (user) {
      // Check if password is valid
      const isPasswordValid = await compare('employee123', user.hashedPassword);
      console.log('Password valid:', isPasswordValid);
      
      // Print user details
      console.log('User ID:', user.id);
      console.log('User Email:', user.email);
      console.log('User Role:', user.role);
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();