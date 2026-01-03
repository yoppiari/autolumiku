/**
 * Admin Tenant Detail API
 * GET: Get tenant by ID with full details
 * PUT: Update tenant information
 * DELETE: Delete tenant
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { exec } from 'child_process';
import { promisify } from 'util';
import { withPlatformAuth } from '@/lib/auth/middleware';

const execAsync = promisify(exec);

// GET /api/admin/tenants/[id] - Get tenant details
export async function GET(
  request: NextRequest,
  { params }: { params: any }
) {
  return withPlatformAuth(request, async (request, auth) => {
    try {
      const { id } = await params;

      const tenant = await prisma.tenant.findUnique({
        where: { id },
        include: {
          subscription: true,
          _count: {
            select: {
              users: true,
              vehicles: true,
            },
          },
        },
      });

      if (!tenant) {
        return NextResponse.json(
          {
            success: false,
            error: 'Tenant not found',
          },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        data: tenant,
      });
    } catch (error) {
      console.error('Error fetching tenant:', error);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to fetch tenant',
        },
        { status: 500 }
      );
    }
  });
}

// PUT /api/admin/tenants/[id] - Update tenant
export async function PUT(
  request: NextRequest,
  { params }: { params: any }
) {
  return withPlatformAuth(request, async (request, auth) => {
    try {
      const { id } = await params;
      const body = await request.json();

      const {
        name,
        slug,
        domain,
        logoUrl,
        faviconUrl,
        primaryColor,
        secondaryColor,
        theme,
        status,
      } = body;

      // Check if tenant exists
      const existingTenant = await prisma.tenant.findUnique({
        where: { id },
      });

      if (!existingTenant) {
        return NextResponse.json(
          {
            success: false,
            error: 'Tenant not found',
          },
          { status: 404 }
        );
      }

      // If slug is being changed, check if new slug is available
      if (slug && slug !== existingTenant.slug) {
        const slugExists = await prisma.tenant.findUnique({
          where: { slug },
        });

        if (slugExists) {
          return NextResponse.json(
            {
              success: false,
              error: 'Subdomain already exists',
            },
            { status: 400 }
          );
        }
      }

      // Check if domain is being changed
      const domainChanged = domain !== undefined && domain !== existingTenant.domain;

      // Update tenant
      const updatedTenant = await prisma.tenant.update({
        where: { id },
        data: {
          ...(name && { name }),
          ...(slug && { slug }),
          ...(domain !== undefined && { domain: domain || null }),
          ...(logoUrl !== undefined && { logoUrl: logoUrl || null }),
          ...(faviconUrl !== undefined && { faviconUrl: faviconUrl || null }),
          ...(primaryColor && { primaryColor }),
          ...(secondaryColor && { secondaryColor }),
          ...(theme && { theme }),
          ...(status && { status }),
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
      });

      // Auto-sync Traefik if domain was changed
      let traefikSyncStatus = null;
      let traefikErrorDetail = null;

      if (domainChanged) {
        try {
          console.log('🔄 Domain changed, syncing Traefik configuration...');
          const { stdout, stderr } = await execAsync('npm run traefik:sync -- --no-confirm', {
            cwd: process.cwd(),
            timeout: 30000, // 30 seconds
          });
          console.log('✅ Traefik sync completed:', stdout);
          traefikSyncStatus = 'success';
        } catch (error: any) {
          console.error('❌ Traefik sync failed:', error);
          traefikSyncStatus = 'failed';
          traefikErrorDetail = error.message;
        }
      }

      return NextResponse.json({
        success: true,
        data: updatedTenant,
        message: 'Tenant updated successfully',
        traefikSynced: traefikSyncStatus,
        traefikError: traefikErrorDetail,
      });
    } catch (error) {
      console.error('Error updating tenant:', error);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to update tenant',
        },
        { status: 500 }
      );
    }
  });
}

// DELETE /api/admin/tenants/[id] - Delete tenant
export async function DELETE(
  request: NextRequest,
  { params }: { params: any }
) {
  return withPlatformAuth(request, async (request, auth) => {
    try {
      const { id } = await params;

      // Check if tenant exists
      const tenant = await prisma.tenant.findUnique({
        where: { id },
        include: {
          _count: {
            select: {
              users: true,
              vehicles: true,
            },
          },
        },
      });

      if (!tenant) {
        return NextResponse.json(
          {
            success: false,
            error: 'Tenant not found',
          },
          { status: 404 }
        );
      }

      // Prevent deletion of platform tenant (auto.lumiku.com)
      if (tenant.slug === 'autolumiku-platform' || tenant.domain === 'auto.lumiku.com') {
        return NextResponse.json(
          {
            success: false,
            error: 'Cannot delete platform tenant',
          },
          { status: 403 }
        );
      }

      // Check if tenant has users or vehicles
      if (tenant._count.users > 0 || tenant._count.vehicles > 0) {
        return NextResponse.json(
          {
            success: false,
            error: 'Cannot delete tenant with existing users or vehicles',
          },
          { status: 400 }
        );
      }

      // Delete tenant
      await prisma.tenant.delete({
        where: { id },
      });

      return NextResponse.json({
        success: true,
        message: 'Tenant deleted successfully',
      });
    } catch (error) {
      console.error('Error deleting tenant:', error);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to delete tenant',
        },
        { status: 500 }
      );
    }
  });
}
