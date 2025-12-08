import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🔐 Creating Super Admin user...\n');

  // Hash password
  const passwordHash = await bcrypt.hash('admin123', 10);

  // Create or update super admin
  const superAdmin = await prisma.user.upsert({
    where: { email: 'admin@autolumiku.com' },
    update: {
      passwordHash,
      role: 'super_admin',
      emailVerified: true,
    },
    create: {
      email: 'admin@autolumiku.com',
      passwordHash,
      firstName: 'Super',
      lastName: 'Admin',
      phone: '+62-800-000-0000',
      role: 'super_admin',
      emailVerified: true,
    },
  });

  console.log('✅ Super Admin created successfully!\n');
  console.log('================================================================');
  console.log('📝 SUPER ADMIN CREDENTIALS');
  console.log('================================================================\n');
  console.log('   Email:     admin@autolumiku.com');
  console.log('   Password:  admin123');
  console.log('   Role:      super_admin\n');
  console.log('   Login URL: http://localhost:3000/admin/login');
  console.log('================================================================\n');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
