#!/usr/bin/env tsx
/**
 * Create Platform Tenant (auto.lumiku.com)
 *
 * Creates or updates the main platform tenant that cannot be deleted.
 * This tenant represents the main AutoLumiku platform.
 *
 * Usage:
 *   npm run create-platform-tenant
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const PLATFORM_TENANT = {
  slug: 'autolumiku-platform',
  name: 'AutoLumiku Platform',
  domain: 'auto.lumiku.com',
  status: 'active' as const,
  primaryColor: '#1a56db',
  secondaryColor: '#7c3aed',
  theme: 'light',
  isPlatform: true, // Special flag to identify platform tenant
};

async function main() {
  try {
    console.log('🔍 Checking for platform tenant...');

    // Check if platform tenant exists
    let platformTenant = await prisma.tenant.findUnique({
      where: { slug: PLATFORM_TENANT.slug },
    });

    if (platformTenant) {
      console.log('✅ Platform tenant already exists');
      console.log(`   - ID: ${platformTenant.id}`);
      console.log(`   - Name: ${platformTenant.name}`);
      console.log(`   - Domain: ${platformTenant.domain}`);

      // Update to ensure domain is correct
      if (platformTenant.domain !== PLATFORM_TENANT.domain) {
        console.log('🔄 Updating platform tenant domain...');
        platformTenant = await prisma.tenant.update({
          where: { id: platformTenant.id },
          data: { domain: PLATFORM_TENANT.domain },
        });
        console.log('✅ Platform tenant domain updated');
      }
    } else {
      console.log('📝 Creating platform tenant...');

      // Create platform tenant first (use placeholder for createdBy)
      // We'll create the system user after, since User requires a tenantId
      platformTenant = await prisma.tenant.create({
        data: {
          ...PLATFORM_TENANT,
          createdBy: 'SYSTEM', // Placeholder, will be updated after system user is created
        },
      });

      console.log('📝 Creating system user...');

      // Now create system user with the platform tenant ID
      const systemUser = await prisma.user.create({
        data: {
          email: 'system@autolumiku.com',
          firstName: 'System',
          lastName: 'Administrator',
          passwordHash: 'SYSTEM_USER_NO_PASSWORD', // This account cannot be used to login
          tenantId: platformTenant.id,
          role: 'SUPER_ADMIN',
        },
      });

      // Update platform tenant to reference system user
      platformTenant = await prisma.tenant.update({
        where: { id: platformTenant.id },
        data: { createdBy: systemUser.id },
      });

      console.log('✅ Platform tenant created successfully!');
      console.log(`   - ID: ${platformTenant.id}`);
      console.log(`   - Slug: ${platformTenant.slug}`);
      console.log(`   - Domain: ${platformTenant.domain}`);
    }

    console.log('\n💡 Next steps:');
    console.log('   1. Run: npm run traefik:sync');
    console.log('   2. Platform will be available at: https://auto.lumiku.com');
    console.log('   3. This tenant CANNOT be deleted via the API');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
