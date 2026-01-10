/**
 * GET /api/v1/dashboard/stats
 * Get real-time dashboard statistics for showroom admin
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');

    if (!tenantId) {
      return NextResponse.json(
        { error: 'Tenant ID is required' },
        { status: 400 }
      );
    }

    // Get current month start/end dates
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    // Previous month for comparison
    const firstDayOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastDayOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    // Parallel queries for better performance
    const [
      totalVehicles,
      vehiclesThisMonth,
      activeLeads,
      leadsToday,
      teamMembers,
      salesThisMonth,
      salesLastMonth,
    ] = await Promise.all([
      // Total vehicles
      prisma.vehicle.count({
        where: {
          tenantId,
          status: { in: ['AVAILABLE', 'BOOKED'] },
        },
      }),

      // Vehicles added this month (exclude DELETED)
      prisma.vehicle.count({
        where: {
          tenantId,
          status: { not: 'DELETED' },
          createdAt: {
            gte: firstDayOfMonth,
            lte: lastDayOfMonth,
          },
        },
      }),

      // Active conversations (Replaces Active Leads for "Analytics" card)
      prisma.whatsAppConversation.count({
        where: {
          tenantId,
          status: 'active',
        },
      }),

      // Chats/Conversations started today (Replaces Leads created today)
      prisma.whatsAppConversation.count({
        where: {
          tenantId,
          startedAt: {
            gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
          },
          status: { not: 'deleted' }, // EXPLICITLY EXCLUDE DELETED CHATS
        },
      }),

      // Team members (all users)
      prisma.user.count({
        where: {
          tenantId,
        },
      }),

      // Sales this month (vehicles sold)
      prisma.vehicle.count({
        where: {
          tenantId,
          status: 'SOLD',
          updatedAt: {
            gte: firstDayOfMonth,
            lte: lastDayOfMonth,
          },
        },
      }),

      // Sales last month for comparison
      prisma.vehicle.count({
        where: {
          tenantId,
          status: 'SOLD',
          updatedAt: {
            gte: firstDayOfLastMonth,
            lte: lastDayOfLastMonth,
          },
        },
      }),
    ]);

    // Calculate sales percentage change
    const salesChange = salesLastMonth > 0
      ? Math.round(((salesThisMonth - salesLastMonth) / salesLastMonth) * 100)
      : salesThisMonth > 0 ? 100 : 0;

    return NextResponse.json({
      success: true,
      data: {
        vehicles: {
          total: totalVehicles,
          thisMonth: vehiclesThisMonth,
        },
        leads: {
          active: activeLeads,
          today: leadsToday,
        },
        team: {
          total: teamMembers,
          active: teamMembers, // All counted users are active
        },
        sales: {
          thisMonth: salesThisMonth,
          lastMonth: salesLastMonth,
          changePercent: salesChange,
        },
      },
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard statistics' },
      { status: 500 }
    );
  }
}
