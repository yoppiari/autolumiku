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

    // Helper to check for invalid/LID numbers (same as in conversations API)
    const isLIDNumber = (num: string): boolean => {
      if (!num) return false;
      const digits = num.replace(/\D/g, "");
      // LID patterns: very long numbers, or numbers starting with 100/101/102
      if (digits.length >= 16) return true;
      if (digits.length >= 14 && (digits.startsWith("100") || digits.startsWith("101") || digits.startsWith("102"))) return true;
      // Numbers that are too long for valid country codes
      if (digits.startsWith("62") && digits.length > 14) return true;
      if (digits.startsWith("1") && digits.length > 11 && !digits.startsWith("1800")) return true;
      return false;
    };

    // Parallel queries with filtering for consistency with UI
    const [
      totalVehicles,
      vehiclesThisMonth,
      activeConversationsCount,
      conversationsTodayCount,
      teamMembers,
      salesThisMonth,
      salesLastMonth,
      totalBlogPosts,
      blogPostsThisMonth,
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

      // Active conversations - FETCH & FILTER (Consistency Fix)
      prisma.whatsAppConversation.findMany({
        where: {
          tenantId,
          status: 'active',
        },
        select: { customerPhone: true }
      }).then(list => list.filter(c => !isLIDNumber(c.customerPhone)).length),

      // Chats/Conversations started today - FETCH & FILTER (Consistency Fix)
      prisma.whatsAppConversation.findMany({
        where: {
          tenantId,
          startedAt: {
            gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
          },
          status: { not: 'deleted' },
        },
        select: { customerPhone: true }
      }).then(list => list.filter(c => !isLIDNumber(c.customerPhone)).length),

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
      // Total published blog posts
      prisma.blogPost.count({
        where: {
          tenantId,
          status: 'PUBLISHED',
        },
      }),
      // Blog posts added this month
      prisma.blogPost.count({
        where: {
          tenantId,
          createdAt: {
            gte: firstDayOfMonth,
            lte: lastDayOfMonth,
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
          active: activeConversationsCount,
          today: conversationsTodayCount,
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
        blog: {
          total: totalBlogPosts,
          thisMonth: blogPostsThisMonth,
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
