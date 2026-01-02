/**
 * Analytics API Endpoint
 * Provides comprehensive analytics data for tenant vehicles
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withSuperAdminAuth } from '@/lib/auth/middleware';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return withSuperAdminAuth(request, async (request, auth) => {
    try {
      // TODO: Add proper authentication in production
      // const session = await getServerSession(authOptions);
      // if (!session || session.user.role !== 'super_admin') {
      //   return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
      // }

      const searchParams = request.nextUrl.searchParams;
      const timeRange = searchParams.get('timeRange') || '7d';

      // Calculate date range
      const now = new Date();
      let startDate = new Date();

      switch (timeRange) {
        case '24h':
          startDate.setHours(now.getHours() - 24);
          break;
        case '7d':
          startDate.setDate(now.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(now.getDate() - 30);
          break;
        case '90d':
          startDate.setDate(now.getDate() - 90);
          break;
        default:
          startDate.setDate(now.getDate() - 7);
      }

      // 1. Get Active Tenants only (No dummy/deleted tenants)
      const tenants = await prisma.tenant.findMany({
        where: {
          status: 'active',
          // Exclude internal/placeholder tenants if needed (can add slug filter if there's a convention)
        },
        include: {
          _count: {
            select: {
              vehicles: true,
              searchAnalytics: true,
            },
          },
        },
      });

      const activeTenantIds = tenants.map(t => t.id);

      // 2. Fetch all required counts in parallel for performance
      const tenantSummary = await Promise.all(
        tenants.map(async (tenant) => {
          const [soldVehicles, totalLeads, totalViews] = await Promise.all([
            prisma.vehicle.count({
              where: {
                tenantId: tenant.id,
                status: 'SOLD',
              },
            }),
            prisma.lead.count({
              where: {
                tenantId: tenant.id,
                createdAt: { gte: startDate },
              },
            }),
            prisma.pageView.count({
              where: {
                tenantId: tenant.id,
                createdAt: { gte: startDate },
              },
            }),
          ]);

          const totalVehicles = tenant._count.vehicles;
          const conversionRate = totalVehicles > 0
            ? ((soldVehicles / totalVehicles) * 100).toFixed(1)
            : '0.0';

          return {
            tenantId: tenant.id,
            tenantName: tenant.name,
            totalVehicles,
            soldVehicles,
            totalViews,
            totalInquiries: totalLeads,
            conversionRate: parseFloat(conversionRate),
          };
        })
      );

      // 3. Get Most Viewed Vehicles (Real data from PageView)
      const pageViewsByVehicle = await prisma.pageView.groupBy({
        by: ['vehicleId'],
        where: {
          vehicleId: { not: null },
          createdAt: { gte: startDate },
          tenantId: { in: activeTenantIds }, // Ensure we only count active tenant views
        },
        _count: {
          id: true,
        },
        orderBy: {
          _count: {
            id: 'desc',
          },
        },
        take: 5,
      });

      const mostViewed = await Promise.all(
        pageViewsByVehicle.map(async (view) => {
          const vehicle = await prisma.vehicle.findUnique({
            where: { id: view.vehicleId as string },
            include: { tenant: { select: { name: true } } },
          });
          return {
            vehicleId: view.vehicleId,
            make: vehicle?.make || 'Unknown',
            model: vehicle?.model || 'Unknown',
            year: vehicle?.year || 0,
            count: view._count.id,
            tenantName: vehicle?.tenant.name || 'Unknown',
          };
        })
      );

      // 4. Get Most Sold Vehicles (Real data)
      const soldVehiclesByModel = await prisma.vehicle.groupBy({
        by: ['make', 'model', 'year', 'tenantId'],
        where: {
          status: 'SOLD',
          updatedAt: { gte: startDate },
          tenantId: { in: activeTenantIds },
        },
        _count: {
          id: true,
        },
        orderBy: {
          _count: {
            id: 'desc',
          },
        },
        take: 5,
      });

      const mostSold = await Promise.all(
        soldVehiclesByModel.map(async (item) => {
          const tenant = await prisma.tenant.findUnique({
            where: { id: item.tenantId },
            select: { name: true },
          });
          return {
            vehicleId: `${item.make}-${item.model}`, // Composite ID for aggregation
            make: item.make,
            model: item.model,
            year: item.year,
            count: item._count.id,
            tenantName: tenant?.name || 'Unknown',
          };
        })
      );

      // 5. Get Most Asked Vehicles (Leads - Real data)
      const leadsByModel = await prisma.lead.groupBy({
        by: ['interestedIn', 'tenantId'],
        where: {
          interestedIn: { not: null },
          createdAt: { gte: startDate },
          tenantId: { in: activeTenantIds },
        },
        _count: {
          id: true,
        },
        orderBy: {
          _count: {
            id: 'desc',
          },
        },
        take: 5,
      });

      const mostAsked = await Promise.all(
        leadsByModel.map(async (item) => {
          const tenant = await prisma.tenant.findUnique({
            where: { id: item.tenantId },
            select: { name: true },
          });

          // Split interestedIn which usually stores "Make Model"
          const parts = (item.interestedIn || '').split(' ');
          const make = parts[0] || 'Unknown';
          const model = parts.slice(1).join(' ') || 'Unknown';

          return {
            vehicleId: item.interestedIn,
            make,
            model,
            year: now.getFullYear(),
            count: item._count.id,
            tenantName: tenant?.name || 'Unknown',
          };
        })
      );

      // 6. Get Most Collected (Inventory Count by Model)
      const availableByModel = await prisma.vehicle.groupBy({
        by: ['make', 'model', 'year', 'tenantId'],
        where: {
          status: 'AVAILABLE',
          tenantId: { in: activeTenantIds },
        },
        _count: {
          id: true,
        },
        orderBy: {
          _count: {
            id: 'desc',
          },
        },
        take: 5,
      });

      const mostCollected = await Promise.all(
        availableByModel.map(async (item) => {
          const tenant = await prisma.tenant.findUnique({
            where: { id: item.tenantId },
            select: { name: true },
          });
          return {
            vehicleId: `${item.make}-${item.model}`,
            make: item.make,
            model: item.model,
            year: item.year,
            count: item._count.id,
            tenantName: tenant?.name || 'Unknown',
          };
        })
      );

      // 7. Time Series Activity (Real - Last 7 Days)
      const timeSeriesData = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        d.setHours(0, 0, 0, 0);

        const nextD = new Date(d);
        nextD.setDate(nextD.getDate() + 1);

        const [views, inquiries, sales, newVehicles] = await Promise.all([
          prisma.pageView.count({
            where: { createdAt: { gte: d, lt: nextD }, tenantId: { in: activeTenantIds } }
          }),
          prisma.lead.count({
            where: { createdAt: { gte: d, lt: nextD }, tenantId: { in: activeTenantIds } }
          }),
          prisma.vehicle.count({
            where: { status: 'SOLD', updatedAt: { gte: d, lt: nextD }, tenantId: { in: activeTenantIds } }
          }),
          prisma.vehicle.count({
            where: { createdAt: { gte: d, lt: nextD }, tenantId: { in: activeTenantIds } }
          })
        ]);

        timeSeriesData.push({
          date: d.toISOString().split('T')[0],
          views,
          inquiries,
          sales,
          newVehicles,
        });
      }

      const analyticsData = {
        mostCollected,
        mostViewed,
        mostAsked,
        mostSold,
        tenantSummary,
        timeSeriesData,
        generated: new Date().toISOString(),
        timeRange,
      };

      return NextResponse.json(analyticsData);

    } catch (error) {
      console.error('Analytics API error:', error);
      if (error instanceof Error) {
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
      }
      return NextResponse.json(
        {
          error: 'Internal server error',
          message: error instanceof Error ? error.message : 'Unknown error'
        },
        { status: 500 }
      );
    }
  });
}