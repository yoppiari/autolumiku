/**
 * Debug script to check user registration
 * Run: npx tsx check-user.ts 6281310703754
 */

import { prisma } from './src/lib/prisma';

async function checkUser(phone: string) {
  console.log('🔍 Checking user with phone:', phone);

  // Try different formats
  const phones = [
    phone,
    phone.replace(/^62/, '0'),
    `62${phone.replace(/^0/, '')}`,
  ];

  for (const p of phones) {
    console.log(`\n📱 Trying phone format: ${p}`);

    const user = await prisma.user.findFirst({
      where: {
        phone: p,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        roleLevel: true,
        tenant: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (user) {
      console.log('✅ USER FOUND!');
      console.log('ID:', user.id);
      console.log('Name:', `${user.firstName} ${user.lastName}`);
      console.log('Phone:', user.phone);
      console.log('Role:', user.role);
      console.log('Role Level:', user.roleLevel);
      console.log('Tenant:', user.tenant?.name || 'N/A');
      console.log('\n✅ Can access PDF commands:', user.roleLevel >= 90);
      return;
    }
  }

  console.log('\n❌ USER NOT FOUND!');
  console.log('Please register this user at: https://primamobil.id/dashboard/users');
}

const phone = process.argv[2] || '6281310703754';
checkUser(phone)
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Error:', err);
    process.exit(1);
  });
