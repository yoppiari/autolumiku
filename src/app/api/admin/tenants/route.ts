/**
 * Admin Tenants API
 * GET: List all tenants with subscription and stats
 * POST: Create new tenant
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { withSuperAdminAuth } from '@/lib/auth/middleware';

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
        slug,
        domain,
        adminEmail,
        adminFirstName,
        adminLastName,
        adminPassword,
      } = body;

      // Validate required fields
      if (!name || !slug || !adminEmail || !adminFirstName || !adminPassword) {
        return NextResponse.json(
          {
            success: false,
            error: 'Missing required fields',
          },
          { status: 400 }
        );
      }

      // Check if slug already exists
      const existingTenant = await prisma.tenant.findUnique({
        where: { slug },
      });

      if (existingTenant) {
        return NextResponse.json(
          {
            success: false,
            error: 'Subdomain already exists',
          },
          { status: 400 }
        );
      }

      // Create tenant with admin user in a transaction
      const result = await prisma.$transaction(async (tx) => {
        // Create tenant
        const tenant = await tx.tenant.create({
          data: {
            name,
            slug,
            domain: domain || null,
            status: 'active',
            primaryColor: '#2563eb',
            secondaryColor: '#7c3aed',
            theme: 'light',
          },
        });

        // Create admin user for the tenant
        const adminUser = await tx.user.create({
          data: {
            email: adminEmail,
            firstName: adminFirstName,
            lastName: adminLastName || '',
            passwordHash: await bcrypt.hash(adminPassword, 10),
            role: 'admin',
            tenantId: tenant.id,
            emailVerified: true,
          },
        });

        return { tenant, adminUser };
      });

      return NextResponse.json({
        success: true,
        data: result.tenant,
        message: 'Tenant created successfully',
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
