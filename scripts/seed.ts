import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Create Test Tenant First
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'demo' },
    update: {},
    create: {
      name: 'Demo Showroom',
      slug: 'demo',
      domain: 'demo.autolumiku.com',
      status: 'active',
      createdBy: 'system',
    },
  });
  console.log('✓ Tenant created:', tenant.name);

  // Create Platform Admin (uses the demo tenant for now)
  const adminPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@autolumiku.com' },
    update: {},
    create: {
      email: 'admin@autolumiku.com',
      passwordHash: adminPassword,
      firstName: 'Platform',
      lastName: 'Admin',
      role: 'admin',
      tenantId: tenant.id,
      emailVerified: true,
    },
  });
  console.log('✓ Platform Admin created:', admin.email);

  // Create Showroom Owner
  const ownerPassword = await bcrypt.hash('owner123', 10);
  const owner = await prisma.user.upsert({
    where: { email: 'owner@demo.autolumiku.com' },
    update: {},
    create: {
      email: 'owner@demo.autolumiku.com',
      passwordHash: ownerPassword,
      firstName: 'John',
      lastName: 'Doe',
      role: 'owner',
      tenantId: tenant.id,
      emailVerified: true,
    },
  });
  console.log('✓ Showroom Owner created:', owner.email);

  // Create Sales Staff
  const staffPassword = await bcrypt.hash('staff123', 10);
  const staff = await prisma.user.upsert({
    where: { email: 'staff@demo.autolumiku.com' },
    update: {},
    create: {
      email: 'staff@demo.autolumiku.com',
      passwordHash: staffPassword,
      firstName: 'Jane',
      lastName: 'Smith',
      role: 'staff',
      tenantId: tenant.id,
      emailVerified: true,
    },
  });
  console.log('✓ Sales Staff created:', staff.email);

  // Create Sample Vehicles
  const vehicles = [
    {
      make: 'Toyota',
      model: 'Avanza',
      year: 2023,
      variant: '1.5 G CVT',
      transmissionType: 'CVT',
      fuelType: 'BENSIN',
      color: 'Putih',
      mileage: 15000,
      price: 220000000, // Rp 220 juta
      condition: 'excellent',
      status: 'AVAILABLE',
      descriptionId: 'Toyota Avanza 2023 dalam kondisi prima, kilometer rendah, perawatan rutin di dealer resmi.',
      descriptionEn: '2023 Toyota Avanza in excellent condition, low mileage, regularly serviced at official dealer.',
      features: {
        id: ['AC Double Blower', 'Power Steering', 'Central Lock', 'Electric Mirror', 'Fog Lamp'],
        en: ['Dual AC', 'Power Steering', 'Central Lock', 'Electric Mirror', 'Fog Lamp'],
      },
    },
    {
      make: 'Honda',
      model: 'Brio',
      year: 2022,
      variant: 'RS CVT',
      transmissionType: 'CVT',
      fuelType: 'BENSIN',
      color: 'Merah',
      mileage: 25000,
      price: 185000000, // Rp 185 juta
      condition: 'good',
      status: 'AVAILABLE',
      descriptionId: 'Honda Brio RS 2022, mobil city car yang cocok untuk perkotaan, irit BBM.',
      descriptionEn: '2022 Honda Brio RS, perfect city car for urban driving, fuel efficient.',
      features: {
        id: ['Keyless Entry', 'Push Start Button', 'Touchscreen Audio', 'Rear Camera'],
        en: ['Keyless Entry', 'Push Start Button', 'Touchscreen Audio', 'Rear Camera'],
      },
    },
    {
      make: 'Suzuki',
      model: 'Ertiga',
      year: 2023,
      variant: 'GX AT',
      transmissionType: 'AUTOMATIC',
      fuelType: 'BENSIN',
      color: 'Silver',
      mileage: 10000,
      price: 240000000, // Rp 240 juta
      condition: 'excellent',
      status: 'AVAILABLE',
      descriptionId: 'Suzuki Ertiga 2023 kondisi istimewa, cocok untuk keluarga, interior luas dan nyaman.',
      descriptionEn: '2023 Suzuki Ertiga in excellent condition, perfect for families, spacious and comfortable interior.',
      features: {
        id: ['7 Seater', 'Dual SRS Airbag', 'ABS', 'EBD', 'Alloy Wheels'],
        en: ['7 Seater', 'Dual SRS Airbag', 'ABS', 'EBD', 'Alloy Wheels'],
      },
    },
  ];

  for (const vehicleData of vehicles) {
    const vehicle = await prisma.vehicle.create({
      data: {
        ...vehicleData,
        tenantId: tenant.id,
        createdBy: staff.id,
      },
    });
    console.log(`✓ Vehicle created: ${vehicle.make} ${vehicle.model} ${vehicle.year}`);
  }

  console.log('\n✅ Database seeded successfully!');
  console.log('\n📝 Test Accounts:');
  console.log('   Platform Admin: admin@autolumiku.com / admin123');
  console.log('   Showroom Owner: owner@demo.autolumiku.com / owner123');
  console.log('   Sales Staff: staff@demo.autolumiku.com / staff123');
  console.log('\n🌐 Access: http://localhost:3002');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
