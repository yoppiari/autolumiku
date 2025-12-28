/**
 * GET /api/v1/analytics/sales - Sales Department Analytics
 *
 * Protected: Requires ADMIN+ role (roleLevel >= 90)
 * Returns sales performance, top performers, vehicle categories, revenue trends
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
    const period = searchParams.get('period') || 'monthly';

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

    // Get sold vehicles in period
    const soldVehicles = await prisma.vehicle.findMany({
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
        createdBy: true,
      },
    });

    // Calculate total sales
    const totalSalesValue = soldVehicles.reduce((sum, v) => sum + Number(v.price), 0);
    const totalSalesCount = soldVehicles.length;

    // Get top sales performers
    const salesByUser = await prisma.user.findMany({
      where: {
        tenantId,
        role: { in: ['SALES', 'sales', 'STAFF', 'staff'] },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
      },
    });

    // Count sales per user (using createdBy or a sales assignment if available)
    const userSalesCount: Record<string, { name: string; count: number; value: number }> = {};

    salesByUser.forEach((user) => {
      userSalesCount[user.id] = {
        name: `${user.firstName} ${user.lastName}`,
        count: 0,
        value: 0,
      };
    });

    soldVehicles.forEach((vehicle) => {
      if (vehicle.createdBy && userSalesCount[vehicle.createdBy]) {
        userSalesCount[vehicle.createdBy].count++;
        userSalesCount[vehicle.createdBy].value += Number(vehicle.price);
      }
    });

    const topPerformers = Object.entries(userSalesCount)
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Vehicles by category (make)
    const vehiclesByMake = soldVehicles.reduce((acc: Record<string, { count: number; value: number }>, v) => {
      const make = v.make || 'Other';
      if (!acc[make]) {
        acc[make] = { count: 0, value: 0 };
      }
      acc[make].count++;
      acc[make].value += Number(v.price);
      return acc;
    }, {});

    const categoryBreakdown = Object.entries(vehiclesByMake)
      .map(([make, data]) => ({
        category: make,
        count: data.count,
        value: data.value,
        percentage: totalSalesCount > 0 ? ((data.count / totalSalesCount) * 100).toFixed(1) : '0.0',
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Revenue trend (group by day/week/month based on period)
    const revenueTrend: { date: string; count: number; value: number }[] = [];
    const dateMap: Record<string, { count: number; value: number }> = {};

    soldVehicles.forEach((v) => {
      let dateKey: string;
      const date = new Date(v.updatedAt);

      if (period === 'daily' || timeRange === '7d') {
        dateKey = date.toISOString().split('T')[0];
      } else if (period === 'weekly') {
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        dateKey = weekStart.toISOString().split('T')[0];
      } else {
        dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      }

      if (!dateMap[dateKey]) {
        dateMap[dateKey] = { count: 0, value: 0 };
      }
      dateMap[dateKey].count++;
      dateMap[dateKey].value += Number(v.price);
    });

    Object.entries(dateMap)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .forEach(([date, data]) => {
        revenueTrend.push({ date, ...data });
      });

    // Get leads/inquiries data
    let leadsData = null;
    try {
      const leads = await prisma.lead.findMany({
        where: {
          tenantId,
          createdAt: { gte: startDate },
        },
        select: {
          id: true,
          status: true,
          interestedIn: true,
          createdAt: true,
        },
      });

      const leadsByStatus = leads.reduce((acc: Record<string, number>, lead) => {
        const status = lead.status || 'NEW';
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      }, {});

      leadsData = {
        total: leads.length,
        byStatus: leadsByStatus,
        conversionRate: leads.length > 0
          ? ((soldVehicles.length / leads.length) * 100).toFixed(1)
          : '0.0',
      };
    } catch {
      // Leads table might not exist
    }

    // Average sale value
    const averageSaleValue = totalSalesCount > 0 ? totalSalesValue / totalSalesCount : 0;

    // Compare with previous period
    const previousPeriodStart = new Date(startDate);
    const periodDays = Math.ceil((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    previousPeriodStart.setDate(previousPeriodStart.getDate() - periodDays);

    const previousSoldVehicles = await prisma.vehicle.findMany({
      where: {
        tenantId,
        status: 'SOLD',
        updatedAt: {
          gte: previousPeriodStart,
          lt: startDate,
        },
      },
      select: { price: true },
    });

    const previousTotalValue = previousSoldVehicles.reduce((sum, v) => sum + Number(v.price), 0);
    const previousCount = previousSoldVehicles.length;

    const growthRate = previousTotalValue > 0
      ? (((totalSalesValue - previousTotalValue) / previousTotalValue) * 100).toFixed(1)
      : totalSalesValue > 0 ? '100.0' : '0.0';

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          totalSalesCount,
          totalSalesValue,
          averageSaleValue,
          growthRate: parseFloat(growthRate),
          previousPeriod: {
            count: previousCount,
            value: previousTotalValue,
          },
        },
        topPerformers,
        categoryBreakdown,
        revenueTrend,
        leads: leadsData,
        timeRange,
        period,
        startDate: startDate.toISOString(),
        endDate: now.toISOString(),
        generated: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Sales analytics error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch sales analytics',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
