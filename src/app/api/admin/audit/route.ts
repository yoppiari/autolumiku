/**
 * Admin Audit Logs API
 * GET: List all audit logs with user and tenant information
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/admin/audit - List all audit logs
export async function GET(request: NextRequest) {
  try {
    // TODO: Add admin authentication check
    // const session = await getServerSession(authOptions);
    // if (!session || session.user.role !== 'super_admin') {
    //   return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    // }

    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const action = searchParams.get('action');
    const resourceType = searchParams.get('resourceType');
    const tenantId = searchParams.get('tenantId');

    // Build where clause
    const where: any = {};
    if (action) where.action = action;
    if (resourceType) where.resourceType = resourceType;
    if (tenantId) where.tenantId = tenantId;

    // Fetch audit logs
    const auditLogs = await prisma.auditLog.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
      skip: offset,
    });

    // Get total count
    const total = await prisma.auditLog.count({ where });

    return NextResponse.json({
      success: true,
      data: auditLogs,
      total,
      limit,
      offset,
    });

  } catch (error) {
    console.error('Audit logs API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch audit logs',
      },
      { status: 500 }
    );
  }
}
