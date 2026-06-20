import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authGate = await requireAuth(request);
  if (authGate instanceof NextResponse) return authGate;

  const isSuperAdmin = authGate.user.role?.toLowerCase() === 'super_admin';

  try {
    const { id } = await params;

    // Query tenant from database
    const tenant = await prisma.tenant.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        slug: true,
        logoUrl: true,
        address: true,
        phoneNumber: true,
        whatsappNumber: true, // Epic 8: For dual contact modal
        email: true,
      },
    });

    if (!tenant) {
      return NextResponse.json(
        { error: 'Tenant not found' },
        { status: 404 }
      );
    }

    // Cross-tenant IDOR protection: users may only read their own tenant
    if (!isSuperAdmin && tenant.id !== authGate.user.tenantId) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      data: tenant,
    });
  } catch (error) {
    console.error('Get tenant error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
