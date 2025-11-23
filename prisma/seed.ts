/**
 * Prisma Database Seeder
 * Creates demo data for AutoLumiku platform
 *
 * Run: npx prisma db seed
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...\n');

  // ============================================================================
  // 1. Create Demo Tenant: "ShowroomJakarta"
  // ============================================================================
  console.log('📦 Creating demo tenant...');

  const tenant = await prisma.tenant.upsert({
    where: { subdomain: 'showroomjakarta' },
    update: {},
    create: {
      name: 'Showroom Jakarta Premium',
      subdomain: 'showroomjakarta',
      email: 'admin@showroomjakarta.com',
      phone: '+62-21-5550-1234',
      address: 'Jl. Sudirman No. 123, Jakarta Selatan',
      city: 'Jakarta',
      province: 'DKI Jakarta',
      postalCode: '12190',
      country: 'Indonesia',
      status: 'ACTIVE',
      subscriptionTier: 'PREMIUM',
      subscriptionStartDate: new Date('2025-01-01'),
      subscriptionEndDate: new Date('2025-12-31'),
      maxUsers: 20,
      maxVehicles: 500,
      storageQuotaMB: 10240, // 10GB
      branding: {
        primaryColor: '#1e40af', // Blue
        secondaryColor: '#3b82f6',
        logoUrl: 'https://via.placeholder.com/200x60/1e40af/ffffff?text=ShowroomJKT',
        customDomain: null,
      },
      seoSettings: {
        metaTitle: 'Showroom Jakarta Premium - Mobil Bekas Berkualitas',
        metaDescription: 'Jual beli mobil bekas berkualitas di Jakarta dengan harga terbaik. Garansi mesin, proses cepat, dan layanan profesional.',
        keywords: ['mobil bekas jakarta', 'showroom mobil', 'jual mobil bekas'],
      },
    },
  });

  console.log(`✅ Tenant created: ${tenant.name} (ID: ${tenant.id})`);

  // ============================================================================
  // 2. Create Demo Users
  // ============================================================================
  console.log('\n👤 Creating demo users...');

  // Admin User
  const adminPassword = await bcrypt.hash('admin123', 10);
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@showroomjakarta.com' },
    update: {},
    create: {
      email: 'admin@showroomjakarta.com',
      passwordHash: adminPassword,
      firstName: 'Admin',
      lastName: 'Showroom',
      phone: '+62-812-3456-7890',
      role: 'ADMIN',
      tenantId: tenant.id,
      isActive: true,
      emailVerified: true,
    },
  });

  console.log(`✅ Admin user: ${adminUser.email} / admin123`);

  // Sales Manager
  const managerPassword = await bcrypt.hash('manager123', 10);
  const managerUser = await prisma.user.upsert({
    where: { email: 'manager@showroomjakarta.com' },
    update: {},
    create: {
      email: 'manager@showroomjakarta.com',
      passwordHash: managerPassword,
      firstName: 'Budi',
      lastName: 'Santoso',
      phone: '+62-813-4567-8901',
      role: 'MANAGER',
      tenantId: tenant.id,
      isActive: true,
      emailVerified: true,
    },
  });

  console.log(`✅ Manager user: ${managerUser.email} / manager123`);

  // Sales User
  const salesPassword = await bcrypt.hash('sales123', 10);
  const salesUser = await prisma.user.upsert({
    where: { email: 'sales@showroomjakarta.com' },
    update: {},
    create: {
      email: 'sales@showroomjakarta.com',
      passwordHash: salesPassword,
      firstName: 'Siti',
      lastName: 'Rahayu',
      phone: '+62-814-5678-9012',
      role: 'SALES',
      tenantId: tenant.id,
      isActive: true,
      emailVerified: true,
    },
  });

  console.log(`✅ Sales user: ${salesUser.email} / sales123`);

  // ============================================================================
  // 3. Create Demo Vehicles
  // ============================================================================
  console.log('\n🚗 Creating demo vehicles...');

  const vehicles = [
    {
      make: 'Toyota',
      model: 'Avanza',
      variant: '1.3 G MT',
      year: 2022,
      price: 185000000,
      mileage: 25000,
      condition: 'EXCELLENT',
      transmission: 'MANUAL',
      fuelType: 'PETROL',
      color: 'Silver Metallic',
      licensePlate: 'B 1234 XYZ',
      vin: 'MHFCB16507K000001',
      description: 'Toyota Avanza 2022 kondisi istimewa, service rutin di Auto2000, interior bersih, eksterior mulus tanpa lecet.',
      features: ['ABS', 'Airbag', 'Power Steering', 'AC', 'Audio System', 'Central Lock'],
      status: 'AVAILABLE',
      isFeatured: true,
      photos: [
        'https://images.unsplash.com/photo-1619767886558-efdc259cde1a?w=800',
        'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=800',
      ],
    },
    {
      make: 'Honda',
      model: 'CR-V',
      variant: '1.5 Turbo Prestige',
      year: 2021,
      price: 485000000,
      mileage: 35000,
      condition: 'EXCELLENT',
      transmission: 'AUTOMATIC',
      fuelType: 'PETROL',
      color: 'White Pearl',
      licensePlate: 'B 5678 ABC',
      vin: 'MHFCB16507K000002',
      description: 'Honda CR-V Turbo Prestige 2021, full option, sunroof, leather seat, KM rendah, kondisi seperti baru.',
      features: ['ABS', 'Airbag', 'Cruise Control', 'Sunroof', 'Leather Seats', 'Parking Sensor', 'Reverse Camera', 'Keyless Entry'],
      status: 'AVAILABLE',
      isFeatured: true,
      photos: [
        'https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?w=800',
        'https://images.unsplash.com/photo-1606664515568-5c1cf6aba3c6?w=800',
      ],
    },
    {
      make: 'Mitsubishi',
      model: 'Xpander',
      variant: 'Sport MT',
      year: 2023,
      price: 235000000,
      mileage: 12000,
      condition: 'EXCELLENT',
      transmission: 'MANUAL',
      fuelType: 'PETROL',
      color: 'Red Solid',
      licensePlate: 'B 9012 DEF',
      vin: 'MHFCB16507K000003',
      description: 'Mitsubishi Xpander Sport 2023, masih garansi, KM sangat rendah, kondisi perfect seperti baru.',
      features: ['ABS', 'Airbag', 'Touchscreen', 'Reverse Camera', 'Parking Sensor', 'Keyless Entry'],
      status: 'AVAILABLE',
      isFeatured: true,
      photos: [
        'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=800',
      ],
    },
    {
      make: 'Daihatsu',
      model: 'Terios',
      variant: 'R MT',
      year: 2020,
      price: 175000000,
      mileage: 45000,
      condition: 'GOOD',
      transmission: 'MANUAL',
      fuelType: 'PETROL',
      color: 'Black Metallic',
      licensePlate: 'B 3456 GHI',
      vin: 'MHFCB16507K000004',
      description: 'Daihatsu Terios 2020, mobil tangguh untuk adventure, kondisi baik, siap pakai.',
      features: ['ABS', 'Airbag', 'Power Steering', 'AC', 'Audio System'],
      status: 'AVAILABLE',
      isFeatured: false,
      photos: [
        'https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?w=800',
      ],
    },
    {
      make: 'Suzuki',
      model: 'Ertiga',
      variant: 'GX AT',
      year: 2021,
      price: 215000000,
      mileage: 30000,
      condition: 'EXCELLENT',
      transmission: 'AUTOMATIC',
      fuelType: 'PETROL',
      color: 'Silver Metallic',
      licensePlate: 'B 7890 JKL',
      vin: 'MHFCB16507K000005',
      description: 'Suzuki Ertiga GX AT 2021, mobil keluarga irit dan nyaman, service record lengkap.',
      features: ['ABS', 'Airbag', 'Power Steering', 'AC', 'Audio System', 'Central Lock'],
      status: 'AVAILABLE',
      isFeatured: false,
      photos: [
        'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=800',
      ],
    },
    {
      make: 'Toyota',
      model: 'Fortuner',
      variant: '2.4 VRZ AT',
      year: 2020,
      price: 485000000,
      mileage: 40000,
      condition: 'EXCELLENT',
      transmission: 'AUTOMATIC',
      fuelType: 'DIESEL',
      color: 'White Pearl',
      licensePlate: 'B 2468 MNO',
      vin: 'MHFCB16507K000006',
      description: 'Toyota Fortuner VRZ Diesel 2020, mobil SUV tangguh dan mewah, pajak baru, siap touring.',
      features: ['ABS', 'Airbag', 'Cruise Control', 'Leather Seats', 'Parking Sensor', 'Reverse Camera', 'Keyless Entry', 'Touchscreen'],
      status: 'RESERVED',
      isFeatured: false,
      photos: [
        'https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?w=800',
      ],
    },
    {
      make: 'Honda',
      model: 'Civic',
      variant: 'Turbo RS',
      year: 2022,
      price: 535000000,
      mileage: 18000,
      condition: 'EXCELLENT',
      transmission: 'AUTOMATIC',
      fuelType: 'PETROL',
      color: 'Rallye Red',
      licensePlate: 'B 1357 PQR',
      vin: 'MHFCB16507K000007',
      description: 'Honda Civic Turbo RS 2022, sedan sport elegan, performa tinggi, kondisi showroom.',
      features: ['ABS', 'Airbag', 'Cruise Control', 'Sunroof', 'Leather Seats', 'Parking Sensor', 'Reverse Camera', 'Keyless Entry', 'Paddle Shift'],
      status: 'AVAILABLE',
      isFeatured: true,
      photos: [
        'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=800',
      ],
    },
    {
      make: 'Mazda',
      model: 'CX-5',
      variant: 'Elite',
      year: 2021,
      price: 465000000,
      mileage: 28000,
      condition: 'EXCELLENT',
      transmission: 'AUTOMATIC',
      fuelType: 'PETROL',
      color: 'Soul Red Crystal',
      licensePlate: 'B 2468 STU',
      vin: 'MHFCB16507K000008',
      description: 'Mazda CX-5 Elite 2021, SUV premium dengan desain elegan, fitur lengkap, kondisi istimewa.',
      features: ['ABS', 'Airbag', 'Cruise Control', 'Leather Seats', 'Parking Sensor', 'Reverse Camera', 'Keyless Entry', 'Bose Audio', 'Sunroof'],
      status: 'AVAILABLE',
      isFeatured: true,
      photos: [
        'https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?w=800',
      ],
    },
  ];

  for (const vehicleData of vehicles) {
    const vehicle = await prisma.vehicle.create({
      data: {
        ...vehicleData,
        tenantId: tenant.id,
        ownerId: adminUser.id,
      },
    });
    console.log(`✅ Vehicle created: ${vehicle.year} ${vehicle.make} ${vehicle.model} - Rp ${vehicle.price.toLocaleString('id-ID')}`);
  }

  // ============================================================================
  // 4. Create Demo Leads
  // ============================================================================
  console.log('\n📞 Creating demo leads...');

  const leads = [
    {
      firstName: 'Ahmad',
      lastName: 'Wijaya',
      email: 'ahmad.wijaya@email.com',
      phone: '+62-821-1111-2222',
      source: 'WEBSITE',
      status: 'NEW',
      score: 85,
      notes: 'Tertarik dengan Honda CR-V, ingin test drive minggu depan',
    },
    {
      firstName: 'Rina',
      lastName: 'Kusuma',
      email: 'rina.kusuma@email.com',
      phone: '+62-822-3333-4444',
      source: 'WHATSAPP',
      status: 'CONTACTED',
      score: 70,
      notes: 'Menanyakan harga Avanza, budget sekitar 180 juta',
    },
    {
      firstName: 'Doni',
      lastName: 'Pratama',
      email: 'doni.pratama@email.com',
      phone: '+62-823-5555-6666',
      source: 'REFERRAL',
      status: 'QUALIFIED',
      score: 90,
      notes: 'Cash buyer, siap beli Fortuner minggu ini',
    },
  ];

  const firstVehicle = await prisma.vehicle.findFirst({
    where: { tenantId: tenant.id },
  });

  for (const leadData of leads) {
    const lead = await prisma.lead.create({
      data: {
        ...leadData,
        tenantId: tenant.id,
        assignedToId: salesUser.id,
        vehicleId: firstVehicle?.id,
      },
    });
    console.log(`✅ Lead created: ${lead.firstName} ${lead.lastName} - ${lead.status}`);
  }

  // ============================================================================
  // 5. Create Demo API Key
  // ============================================================================
  console.log('\n🔑 Creating demo API key...');

  const apiKeyPlain = 'sk_demo_showroomjakarta_test_key_12345';
  const apiKeyHash = await bcrypt.hash(apiKeyPlain, 10);

  const apiKey = await prisma.apiKey.create({
    data: {
      tenantId: tenant.id,
      name: 'Demo API Key',
      keyPrefix: 'sk_demo_showro',
      keyHash: apiKeyHash,
      permissions: ['vehicles:read', 'catalog:read', 'leads:write'],
      rateLimit: 100,
      isActive: true,
    },
  });

  console.log(`✅ API Key created: ${apiKey.name}`);
  console.log(`   Plain key (save this!): ${apiKeyPlain}`);

  // ============================================================================
  // Done!
  // ============================================================================
  console.log('\n✅ Database seeding completed successfully!\n');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
