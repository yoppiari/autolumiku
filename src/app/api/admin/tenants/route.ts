/**
 * Admin Tenants API
 * GET: List all tenants with subscription and stats
 * POST: Create new tenant
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { withSuperAdminAuth } from '@/lib/auth/middleware';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// GET /api/admin/tenants - List all tenants
export async function GET(request: NextRequest) {
  return withSuperAdminAuth(request, async (request, auth) => {
    try {
      // TODO: Add admin authentication check
      // const session = await getServerSession(authOptions);
      // if (!session || session.user.role !== 'super_admin') {
      //   return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
      // }

      const tenants = await prisma.tenant.findMany({
        where: {
          name: {
            notIn: [
              "Tenant 1 Demo",
              "Showroom Jakarta Premium",
              "Showroom Jakarta",
              "Dealer Mobil",
              "AutoMobil",
              "AutoLumiku Platform"
            ]
          }
        },
        include: {
          subscription: true,
          _count: {
            select: {
              users: true,
              vehicles: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      return NextResponse.json({
        success: true,
        data: tenants,
      });
    } catch (error) {
      console.error('Error fetching tenants:', error);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to fetch tenants',
        },
        { status: 500 }
      );
    }
  });
}

// POST /api/admin/tenants - Create new tenant
export async function POST(request: NextRequest) {
  return withSuperAdminAuth(request, async (request, auth) => {
    try {
      // TODO: Add admin authentication check

      const body = await request.json();
      const {
        name,
        domain,
        adminUser,
        adminEmail,
        adminFirstName,
        adminLastName,
        adminPassword,
      } = body;

      // Support both old format (direct fields) and new format (adminUser object)
      const email = adminUser?.email || adminEmail;
      const firstName = adminUser?.firstName || adminFirstName;
      const lastName = adminUser?.lastName || adminLastName;
      const password = adminPassword || Math.random().toString(36).slice(-12); // Auto-generate if not provided

      // Validate required fields
      if (!name || !domain || !email || !firstName) {
        return NextResponse.json(
          {
            success: false,
            error: 'Missing required fields: name, domain, admin email, and admin first name are required',
          },
          { status: 400 }
        );
      }

      // Generate slug from domain (remove www. and dots)
      const slug = domain.replace(/^www\./, '').replace(/\./g, '-');

      // Check if domain already exists
      const existingTenant = await prisma.tenant.findUnique({
        where: { domain },
      });

      if (existingTenant) {
        return NextResponse.json(
          {
            success: false,
            error: 'Domain already exists',
          },
          { status: 400 }
        );
      }

      // Create tenant with admin user and default subscription in a transaction
      const result = await prisma.$transaction(async (tx) => {
        // Create tenant
        const tenant = await tx.tenant.create({
          data: {
            name,
            slug,
            domain,
            status: 'active',
            primaryColor: '#2563eb',
            secondaryColor: '#7c3aed',
            theme: 'light',
          },
        });

        // Create default subscription (1-year trial/enterprise)
        const now = new Date();
        const oneYearLater = new Date(now);
        oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);

        const subscription = await tx.subscription.create({
          data: {
            tenantId: tenant.id,
            plan: 'enterprise',
            status: 'active',
            currentPeriodStart: now,
            currentPeriodEnd: oneYearLater,
            pricePerMonth: 299000, // Rp 299.000/month
            currency: 'IDR',
          },
        });

        // Link subscription to tenant
        await tx.tenant.update({
          where: { id: tenant.id },
          data: { subscriptionId: subscription.id },
        });

        // Create admin user for the tenant
        const createdAdminUser = await tx.user.create({
          data: {
            email,
            firstName,
            lastName: lastName || '',
            passwordHash: await bcrypt.hash(password, 10),
            role: 'admin',
            tenantId: tenant.id,
            emailVerified: true,
          },
        });

        return { tenant, adminUser: createdAdminUser, subscription };
      });

      // Auto-sync Traefik configuration for new domain
      let traefikSyncStatus = null;
      if (domain) {
        try {
          console.log('🔄 New tenant created with domain, syncing Traefik configuration...');
          const { stdout, stderr } = await execAsync('npm run traefik:sync -- --no-confirm', {
            cwd: process.cwd(),
            timeout: 30000, // 30 seconds
          });
          console.log('✅ Traefik sync completed:', stdout);
          traefikSyncStatus = 'success';
        } catch (error) {
          console.error('❌ Traefik sync failed:', error);
          traefikSyncStatus = 'failed';
        }
      }

      return NextResponse.json({
        success: true,
        data: result.tenant,
        message: 'Tenant created successfully',
        traefikSynced: traefikSyncStatus,
      });
    } catch (error) {
      console.error('Error creating tenant:', error);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to create tenant',
        },
        { status: 500 }
      );
    }
  });
}
