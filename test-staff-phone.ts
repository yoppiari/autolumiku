import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    where: {
      phone: { not: null },
      role: { in: ['SALES', 'STAFF', 'ADMIN', 'OWNER'] }
    },
    select: {
      firstName: true,
      lastName: true,
      role: true,
      roleLevel: true,
      phone: true,
    },
    orderBy: {
      roleLevel: 'asc'
    },
    take: 10
  });

  console.log('='.repeat(80));
  console.log('REGISTERED USERS WITH PHONE NUMBERS:');
  console.log('='.repeat(80));

  users.forEach((user, idx) => {
    console.log(`${idx + 1}. ${user.firstName} ${user.lastName || ''}`);
    console.log(`   Role: ${user.role} (Level: ${user.roleLevel})`);
    console.log(`   Phone: ${user.phone}`);
    console.log(`   Test URL: https://primamobil.id/api/v1/debug/check-user?phone=${user.phone}`);
    console.log('');
  });

  await prisma.$disconnect();
}

main().catch(console.error);
