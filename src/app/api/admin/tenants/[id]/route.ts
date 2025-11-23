import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/admin/tenants/[id] - Get tenant by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    // Get tenant with related data
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
        { success: false, error: 'Tenant not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: tenant,
    });
  } catch (error) {
    console.error('Failed to fetch tenant:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch tenant',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/tenants/[id] - Update tenant
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();

    // Update tenant
    const tenant = await prisma.tenant.update({
      where: { id },
      data: {
        name: body.name,
        slug: body.slug,
        domain: body.domain,
        logoUrl: body.logoUrl,
        primaryColor: body.primaryColor,
        secondaryColor: body.secondaryColor,
        theme: body.theme,
        status: body.status,
      },
    });

    return NextResponse.json({
      success: true,
      data: tenant,
      message: 'Tenant updated successfully',
    });
  } catch (error) {
    console.error('Failed to update tenant:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update tenant',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/tenants/[id] - Delete tenant
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    // Delete tenant (cascade delete will handle related records)
    await prisma.tenant.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: 'Tenant deleted successfully',
    });
  } catch (error) {
    console.error('Failed to delete tenant:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete tenant',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
