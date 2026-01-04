/**
 * GET /api/v1/analytics - Dashboard Analytics Overview
 *
 * Protected: Requires ADMIN+ role (roleLevel >= 90)
 * Returns analytics overview for the authenticated user's tenant
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateRequest } from '@/lib/auth/middleware';
import { ROLE_LEVELS } from '@/lib/rbac';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // Authenticate request
  const auth = await authenticateRequest(request);
  if (!auth.success || !auth.user) {
    return NextResponse.json(
      { error: auth.error || 'Unauthorized' },
      { status: 401 }
    );
  }

  // RBAC: Require ADMIN+ role (roleLevel >= 90)
  if (auth.user.roleLevel < ROLE_LEVELS.ADMIN) {
    return NextResponse.json(
      { error: 'Forbidden - Admin role or higher required for analytics' },
      { status: 403 }
    );
  }

  try {
    const tenantId = auth.user.tenantId;
    if (!tenantId) {
      return NextResponse.json(
        { error: 'No tenant associated with this user' },
        { status: 400 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const timeRange = searchParams.get('timeRange') || '30d';
    const period = searchParams.get('period') || 'monthly'; // monthly, quarterly, yearly

    // Calculate date range
    const now = new Date();
    let startDate = new Date();

    switch (timeRange) {
      case '7d':
        startDate.setDate(now.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(now.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(now.getDate() - 90);
        break;
      case '1y':
        startDate.setFullYear(now.getFullYear() - 1);
        break;
      default:
        startDate.setDate(now.getDate() - 30);
    }

    // Get vehicle statistics
    const [totalVehicles, availableVehicles, soldVehicles, bookedVehicles] = await Promise.all([
      prisma.vehicle.count({ where: { tenantId, status: { not: 'DELETED' } } }),
      prisma.vehicle.count({ where: { tenantId, status: 'AVAILABLE' } }),
      prisma.vehicle.count({ where: { tenantId, status: 'SOLD' } }),
      prisma.vehicle.count({ where: { tenantId, status: 'BOOKED' } }),
    ]);

    // Revenue calculation from sold vehicles (actual valid data)
    const recentSoldVehicles = await prisma.vehicle.findMany({
      where: {
        tenantId,
        status: 'SOLD',
        updatedAt: { gte: startDate },
      },
      select: { price: true },
    });

    const totalSoldRevenue = recentSoldVehicles.reduce((sum, v) => sum + Number(v.price), 0);
    const paidRevenue = totalSoldRevenue; // Assume sold = paid for simplified showroom flow

    const summaryData = {
      totalSoldRevenue,
      paidRevenue,
      soldCount: recentSoldVehicles.length,
    };

    // Get team statistics
    const teamStats = await prisma.user.groupBy({
      by: ['role'],
      where: { tenantId },
      _count: { id: true },
    });

    const teamSummary = {
      total: 0,
      sales: 0,
      finance: 0,
      manager: 0,
      admin: 0,
    };

    teamStats.forEach((stat) => {
      const count = stat._count.id;
      teamSummary.total += count;

      const role = stat.role.toUpperCase();
      if (role === 'SALES' || role === 'STAFF') teamSummary.sales += count;
      else if (role === 'ADMIN' || role === 'OWNER') teamSummary.admin += count;
    });

    // Get recent sales activity (last 30 days sold vehicles)
    const recentSales = await prisma.vehicle.findMany({
      where: {
        tenantId,
        status: 'SOLD',
        updatedAt: { gte: startDate },
      },
      select: {
        id: true,
        displayId: true,
        make: true,
        model: true,
        year: true,
        price: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: 'desc' },
      take: 10,
    });

    // Get WhatsApp AI statistics if available
    let whatsappStats = null;
    try {
      const [totalConversations, activeConversations] = await Promise.all([
        prisma.whatsAppConversation.count({
          where: { tenantId },
        }),
        prisma.whatsAppConversation.count({
          where: {
            tenantId,
            lastMessageAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
          },
        }),
      ]);

      whatsappStats = {
        totalConversations,
        activeConversations,
      };
    } catch {
      // WhatsApp tables might not exist
    }

    return NextResponse.json({
      success: true,
      data: {
        vehicles: {
          total: totalVehicles,
          available: availableVehicles,
          sold: soldVehicles,
          booked: bookedVehicles,
          conversionRate: totalVehicles > 0
            ? ((soldVehicles / totalVehicles) * 100).toFixed(1)
            : '0.0',
        },
        summary: summaryData,
        team: teamSummary,
        recentSales: recentSales.map((v) => ({
          ...v,
          price: Number(v.price),
        })),
        whatsapp: whatsappStats,
        generated: new Date().toISOString(),
        timeRange,
        period,
      },
    });
  } catch (error) {
    console.error('Analytics overview error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch analytics',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
