/**
 * Admin Tenant Detail API
 * GET: Get tenant by ID with full details
 * PUT: Update tenant information
 * DELETE: Delete tenant
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/admin/tenants/[id] - Get tenant details
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

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
}

// PUT /api/admin/tenants/[id] - Update tenant
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
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

    return NextResponse.json({
      success: true,
      data: updatedTenant,
      message: 'Tenant updated successfully',
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
}

// DELETE /api/admin/tenants/[id] - Delete tenant
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

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
}
