/**
 * GET /api/v1/dashboard/activities
 * Get recent activities for dashboard
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');
    const limit = parseInt(searchParams.get('limit') || '10');

    if (!tenantId) {
      return NextResponse.json(
        { error: 'Tenant ID is required' },
        { status: 400 }
      );
    }

    // Get recent activities from different sources
    const [recentLeads, recentVehicles, recentUsers] = await Promise.all([
      // Recent leads
      prisma.lead.findMany({
        where: { tenantId },
        select: {
          id: true,
          name: true,
          interestedIn: true,
          createdAt: true,
          source: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),

      // Recent vehicles
      prisma.vehicle.findMany({
        where: { tenantId },
        select: {
          id: true,
          displayId: true,
          make: true,
          model: true,
          year: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),

      // Recent users (team members)
      prisma.user.findMany({
        where: { tenantId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          role: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 3,
      }),
    ]);

    // Combine and format activities
    const activities: any[] = [];

    // Add lead activities
    recentLeads.forEach((lead) => {
      activities.push({
        type: 'LEAD',
        icon: 'blue',
        message: `Lead baru dari ${lead.name}${lead.interestedIn ? ` - ${lead.interestedIn}` : ''}`,
        timestamp: lead.createdAt,
        details: {
          source: lead.source,
        },
      });
    });

    // Add vehicle activities
    recentVehicles.forEach((vehicle) => {
      activities.push({
        type: 'VEHICLE',
        icon: 'green',
        message: `Kendaraan baru ditambahkan: ${vehicle.make} ${vehicle.model} ${vehicle.year}`,
        timestamp: vehicle.createdAt,
        details: {
          displayId: vehicle.displayId,
        },
      });
    });

    // Add user activities
    recentUsers.forEach((user) => {
      activities.push({
        type: 'USER',
        icon: 'purple',
        message: `Staff baru bergabung: ${user.firstName} ${user.lastName || ''}`,
        timestamp: user.createdAt,
        details: {
          role: user.role,
        },
      });
    });

    // Sort all activities by timestamp (most recent first)
    activities.sort((a, b) => {
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });

    // Limit to requested number
    const limitedActivities = activities.slice(0, limit);

    return NextResponse.json({
      success: true,
      data: {
        activities: limitedActivities,
        total: activities.length,
      },
    });
  } catch (error) {
    console.error('Dashboard activities error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard activities' },
      { status: 500 }
    );
  }
}
