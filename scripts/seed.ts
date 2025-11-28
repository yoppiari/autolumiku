import { PrismaClient, VehicleStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...\n');

  // ============================================================================
  // 1. Create Demo Tenant: "showroomjakarta"
  // ============================================================================
  console.log('📦 Creating demo tenant...');

  const tenant = await prisma.tenant.upsert({
    where: { slug: 'showroomjakarta' },
    update: {},
    create: {
      name: 'Showroom Jakarta Premium',
      slug: 'showroomjakarta',
      domain: 'showroomjakarta.autolumiku.com',
      status: 'active',
      logoUrl: 'https://via.placeholder.com/200x60/1e40af/ffffff?text=ShowroomJKT',
      primaryColor: '#1e40af',
      secondaryColor: '#3b82f6',
      theme: 'light',
      createdBy: 'system',
      whatsappNumber: '6281234567890',
      phoneNumber: '6281234567890',
      address: 'Jl. Jend. Sudirman No. 1, Jakarta Pusat',
      city: 'Jakarta Pusat',
      province: 'DKI Jakarta',
    },
  });
  console.log(`✅ Tenant created: ${tenant.name} (ID: ${tenant.id})`);

  // ============================================================================
  // 2. Create Demo Users
  // ============================================================================
  console.log('\n👤 Creating demo users...');

  // Admin User
  const adminPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@showroomjakarta.com' },
    update: {},
    create: {
      email: 'admin@showroomjakarta.com',
      passwordHash: adminPassword,
      firstName: 'Admin',
      lastName: 'Showroom',
      phone: '+62-812-3456-7890',
      role: 'admin',
      tenantId: tenant.id,
      emailVerified: true,
    },
  });
  console.log(`✅ Admin user: ${admin.email} / admin123`);

  // Manager User
  const managerPassword = await bcrypt.hash('manager123', 10);
  const manager = await prisma.user.upsert({
    where: { email: 'manager@showroomjakarta.com' },
    update: {},
    create: {
      email: 'manager@showroomjakarta.com',
      passwordHash: managerPassword,
      firstName: 'Budi',
      lastName: 'Santoso',
      phone: '+62-813-4567-8901',
      role: 'manager',
      tenantId: tenant.id,
      emailVerified: true,
    },
  });
  console.log(`✅ Manager user: ${manager.email} / manager123`);

  // Sales User
  const salesPassword = await bcrypt.hash('sales123', 10);
  const sales = await prisma.user.upsert({
    where: { email: 'sales@showroomjakarta.com' },
    update: {},
    create: {
      email: 'sales@showroomjakarta.com',
      passwordHash: salesPassword,
      firstName: 'Siti',
      lastName: 'Rahayu',
      phone: '+62-814-5678-9012',
      role: 'staff',
      tenantId: tenant.id,
      emailVerified: true,
    },
  });
  console.log(`✅ Sales user: ${sales.email} / sales123`);

  // ============================================================================
  // 3. Create Demo Vehicles
  // ============================================================================
  console.log('\n🚗 Creating demo vehicles...');

  const vehicles = [
    {
      make: 'Toyota',
      model: 'Avanza',
      year: 2023,
      variant: '1.5 G CVT',
      transmissionType: 'CVT',
      fuelType: 'BENSIN',
      color: 'Putih Mutiara',
      mileage: 15000,
      price: 220000000, // Rp 220 juta
      condition: 'excellent',
      status: VehicleStatus.AVAILABLE,
      isFeatured: true,
      descriptionId: 'Toyota Avanza 2023 dalam kondisi prima, kilometer rendah, perawatan rutin di dealer resmi. Cocok untuk keluarga.',
      descriptionEn: '2023 Toyota Avanza in excellent condition, low mileage, regularly serviced at official dealer. Perfect for families.',
      features: {
        id: ['AC Double Blower', 'Power Steering', 'Central Lock', 'Electric Mirror', 'Fog Lamp'],
        en: ['Dual AC', 'Power Steering', 'Central Lock', 'Electric Mirror', 'Fog Lamp'],
      },
      tags: ['Best Seller', 'Family Car'],
      categories: ['MPV', 'Mobil Keluarga'],
    },
    {
      make: 'Honda',
      model: 'CR-V',
      year: 2022,
      variant: '1.5 Turbo Prestige',
      transmissionType: 'AUTOMATIC',
      fuelType: 'BENSIN',
      color: 'Putih',
      mileage: 28000,
      price: 485000000, // Rp 485 juta
      condition: 'excellent',
      status: VehicleStatus.AVAILABLE,
      isFeatured: true,
      descriptionId: 'Honda CR-V Turbo 2022, SUV premium dengan fitur lengkap. Sunroof, leather seat, parking sensor. Seperti baru!',
      descriptionEn: '2022 Honda CR-V Turbo, premium SUV with complete features. Sunroof, leather seats, parking sensors. Like new!',
      features: {
        id: ['Sunroof', 'Leather Seats', 'Parking Sensor', 'Reverse Camera', 'Cruise Control', 'Keyless Entry'],
        en: ['Sunroof', 'Leather Seats', 'Parking Sensor', 'Reverse Camera', 'Cruise Control', 'Keyless Entry'],
      },
      tags: ['Premium', 'SUV'],
      categories: ['SUV', 'Premium'],
    },
    {
      make: 'Mitsubishi',
      model: 'Xpander',
      year: 2023,
      variant: 'Sport MT',
      transmissionType: 'MANUAL',
      fuelType: 'BENSIN',
      color: 'Merah Solid',
      mileage: 12000,
      price: 235000000, // Rp 235 juta
      condition: 'excellent',
      status: VehicleStatus.AVAILABLE,
      isFeatured: true,
      descriptionId: 'Mitsubishi Xpander Sport 2023, masih garansi pabrik. KM sangat rendah, kondisi perfect seperti baru.',
      descriptionEn: '2023 Mitsubishi Xpander Sport, still under factory warranty. Very low mileage, perfect condition like new.',
      features: {
        id: ['Reverse Camera', 'Touchscreen', 'Keyless Entry', 'ABS', 'Airbag'],
        en: ['Reverse Camera', 'Touchscreen', 'Keyless Entry', 'ABS', 'Airbag'],
      },
      tags: ['New Arrival'],
      categories: ['MPV', 'Mobil Keluarga'],
    },
    {
      make: 'Suzuki',
      model: 'Ertiga',
      year: 2022,
      variant: 'GX AT',
      transmissionType: 'AUTOMATIC',
      fuelType: 'BENSIN',
      color: 'Silver Metalik',
      mileage: 20000,
      price: 215000000, // Rp 215 juta
      condition: 'excellent',
      status: VehicleStatus.AVAILABLE,
      isFeatured: false,
      descriptionId: 'Suzuki Ertiga GX AT 2022, mobil keluarga irit dan nyaman. Service record lengkap, pajak hidup.',
      descriptionEn: '2022 Suzuki Ertiga GX AT, economical and comfortable family car. Complete service records, active tax.',
      features: {
        id: ['7 Seater', 'Dual SRS Airbag', 'ABS', 'EBD', 'Alloy Wheels'],
        en: ['7 Seater', 'Dual SRS Airbag', 'ABS', 'EBD', 'Alloy Wheels'],
      },
      tags: ['Family Car'],
      categories: ['MPV', 'Mobil Keluarga'],
    },
    {
      make: 'Toyota',
      model: 'Fortuner',
      year: 2021,
      variant: '2.4 VRZ AT Diesel',
      transmissionType: 'AUTOMATIC',
      fuelType: 'DIESEL',
      color: 'Hitam',
      mileage: 35000,
      price: 525000000, // Rp 525 juta
      condition: 'excellent',
      status: VehicleStatus.AVAILABLE,
      isFeatured: true,
      descriptionId: 'Toyota Fortuner VRZ Diesel 2021, SUV tangguh dan mewah. Full spec, pajak baru, siap touring.',
      descriptionEn: '2021 Toyota Fortuner VRZ Diesel, rugged and luxurious SUV. Full spec, fresh tax, ready for adventure.',
      features: {
        id: ['Leather Seats', 'Cruise Control', 'Parking Sensor', 'Reverse Camera', 'Touchscreen', '4x4'],
        en: ['Leather Seats', 'Cruise Control', 'Parking Sensor', 'Reverse Camera', 'Touchscreen', '4x4'],
      },
      tags: ['Premium', 'SUV', '4WD'],
      categories: ['SUV', 'Premium', '4x4'],
    },
  ];

  for (const vehicleData of vehicles) {
    const vehicle = await prisma.vehicle.create({
      data: {
        ...vehicleData,
        tenantId: tenant.id,
        createdBy: admin.id,
        updatedBy: admin.id,
      },
    });
    console.log(`✅ Vehicle: ${vehicle.year} ${vehicle.make} ${vehicle.model} - Rp ${vehicle.price.toLocaleString('id-ID')}`);
  }

  // ============================================================================
  // 4. Create Tenant-1 (Requested by User)
  // ============================================================================
  console.log('\n📦 Creating tenant-1...');

  const tenant1 = await prisma.tenant.upsert({
    where: { slug: 'tenant-1' },
    update: {},
    create: {
      name: 'Tenant 1 Demo',
      slug: 'tenant-1',
      domain: 'tenant-1.autolumiku.com',
      status: 'active',
      primaryColor: '#000000',
      secondaryColor: '#ffffff',
      theme: 'dark',
      createdBy: 'system',
    },
  });
  console.log(`✅ Tenant-1 created: ${tenant1.name}`);

  // Tenant-1 Admin
  const tenant1Admin = await prisma.user.upsert({
    where: { email: 'admin@tenant-1.com' },
    update: {},
    create: {
      email: 'admin@tenant-1.com',
      passwordHash: adminPassword, // Reuse same hash
      firstName: 'Admin',
      lastName: 'Tenant1',
      role: 'admin',
      tenantId: tenant1.id,
      emailVerified: true,
    },
  });
  console.log(`✅ Tenant-1 Admin: admin@tenant-1.com / admin123`);

  // ============================================================================
  // 5. Create Blog Posts for Tenant-1
  // ============================================================================
  console.log('\n📝 Creating blog posts for tenant-1...');

  const blogPosts = [
    {
      title: 'Tips Memilih Mobil Bekas Berkualitas',
      slug: 'tips-memilih-mobil-bekas',
      category: 'BUYING_GUIDE',
      content: '<p>Ini adalah artikel panduan lengkap memilih mobil bekas...</p>',
      excerpt: 'Panduan lengkap cara inspeksi mobil bekas agar tidak tertipu.',
      status: 'PUBLISHED',
      authorId: tenant1Admin.id,
      authorName: 'Admin Tenant1',
      publishedAt: new Date(),
    },
    {
      title: '5 Mobil Keluarga Terbaik 2024',
      slug: '5-mobil-keluarga-terbaik-2024',
      category: 'COMPARISON',
      content: '<p>Daftar mobil keluarga paling nyaman dan irit...</p>',
      excerpt: 'Rekomendasi mobil MPV terbaik untuk keluarga Indonesia.',
      status: 'DRAFT',
      authorId: tenant1Admin.id,
      authorName: 'Admin Tenant1',
    }
  ];

  // Note: Using any because BlogCategory enum might need import, but string works for Prisma if matches
  for (const post of blogPosts) {
    await prisma.blogPost.upsert({
      where: {
        tenantId_slug: {
          tenantId: tenant1.id,
          slug: post.slug
        }
      },
      update: {},
      create: {
        ...post,
        tenantId: tenant1.id,
        metaDescription: post.excerpt,
        focusKeyword: post.title.split(' ')[0].toLowerCase(), // Use first word as focus keyword
        tone: 'CASUAL',
        category: post.category as any,
        status: post.status as any,
      },
    });
  }
  console.log(`✅ Created ${blogPosts.length} blog posts for tenant-1`);

  // ============================================================================
  // Done!
  // ============================================================================
  console.log('\n✅ Database seeded successfully!\n');
  console.log('================================================================');
  console.log('📝 DEMO CREDENTIALS');
  console.log('================================================================\n');
  console.log('👤 Demo Users:');
  console.log('   Admin:     admin@showroomjakarta.com / admin123');
  console.log('   Manager:   manager@showroomjakarta.com / manager123');
  console.log('   Sales:     sales@showroomjakarta.com / sales123');
  console.log('   Tenant-1:  admin@tenant-1.com / admin123\n');
  console.log('🏢 Tenant Information:');
  console.log('   Name:      Showroom Jakarta Premium');
  console.log('   Slug:      showroomjakarta');
  console.log('   Domain:    showroomjakarta.autolumiku.com');
  console.log('   Tenant-1:  tenant-1\n');
  console.log('🌐 Access URLs:');
  console.log('   Admin Panel:       http://localhost:3000/admin');
  console.log('   Public Catalog:    http://localhost:3000/catalog/showroomjakarta');
  console.log('   Login:             http://localhost:3000/login\n');
  console.log('🚗 Demo Data:');
  console.log('   Vehicles:  5 vehicles created');
  console.log('   Users:     4 users created');
  console.log('   Blogs:     2 posts created for tenant-1');
  console.log('================================================================\n');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
