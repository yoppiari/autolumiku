import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function check() {
  const accounts = await prisma.aimeowAccount.findMany({
    include: { tenant: { select: { name: true, slug: true } } }
  });

  console.log('=== All Aimeow Accounts ===\n');
  for (const acc of accounts) {
    console.log('Tenant:', acc.tenant?.name || 'N/A', '(' + (acc.tenant?.slug || 'N/A') + ')');
    console.log('Phone:', acc.phoneNumber || 'N/A');
    console.log('ClientId:', acc.clientId);
    console.log('Status:', acc.connectionStatus);
    console.log('Active:', acc.isActive);
    console.log('---');
  }

  await prisma.$disconnect();
}

check();
