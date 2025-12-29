
import { PrismaClient } from '../src/generated/prisma';

const prisma = new PrismaClient();

async function main() {
  const organizations = [
    { name: 'Catur Teknik Utama', code: 'CTU' },
    { name: 'Manunggal Teknik', code: 'MT' },
  ];

  for (const org of organizations) {
    const existing = await prisma.organization.findUnique({
      where: { code: org.code },
    });

    if (!existing) {
      await prisma.organization.create({
        data: {
          name: org.name,
          code: org.code,
          currentSequence: 0,
        },
      });
      console.log(`Created organization: ${org.name} (${org.code})`);
    } else {
      // Update name if it exists but is different
      if (existing.name !== org.name) {
        await prisma.organization.update({
          where: { code: org.code },
          data: { name: org.name },
        });
        console.log(`Updated organization name: ${existing.name} -> ${org.name} (${org.code})`);
      } else {
        console.log(`Organization correct: ${org.name} (${org.code})`);
      }
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    // process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
