/**
 * Analytics API Endpoint
 * Provides comprehensive analytics data for tenant vehicles
 * 
 * Access Control:
 * - Super Admin (roleLevel >= 100): Can view all tenants or filter by specific tenantId
 * - Tenant Admin (roleLevel >= 90): Can only view their own tenant's data
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateRequest } from '@/lib/auth/middleware';
import { ROLE_LEVELS } from '@/lib/rbac';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Authenticate the request
    const authResult = await authenticateRequest(request);

    if (!authResult.success || !authResult.user) {
      return NextResponse.json({
        success: false,
        error: 'Unauthorized - Please login to access analytics'
      }, { status: 401 });
    }

    const user = authResult.user;

    // Require at least ADMIN level (roleLevel >= 90)
    if (user.roleLevel < ROLE_LEVELS.ADMIN) {
      return NextResponse.json({
        success: false,
        error: 'Forbidden - Admin access required'
      }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const timeRange = searchParams.get('timeRange') || '7d';
    const requestedTenantId = searchParams.get('tenantId'); // Optional filter for specific tenant

    // Determine which tenant(s) to show based on user role
    let filterTenantIds: string[] = [];

    if (user.roleLevel >= ROLE_LEVELS.SUPER_ADMIN || !user.tenantId) {
      // Super Admin: Can view all tenants OR filter by specific tenantId
      if (requestedTenantId) {
        filterTenantIds = [requestedTenantId];
      }
      // If no tenantId specified, filterTenantIds stays empty = show all
    } else {
      // Tenant Admin: Can ONLY view their own tenant
      if (!user.tenantId) {
        return NextResponse.json({
          success: false,
          error: 'No tenant associated with your account'
        }, { status: 400 });
      }

      // Force tenant admin to only see their own data
      filterTenantIds = [user.tenantId];

      // If they try to access another tenant's data, deny
      if (requestedTenantId && requestedTenantId !== user.tenantId) {
        return NextResponse.json({
          success: false,
          error: 'Forbidden - You can only view your own tenant data'
        }, { status: 403 });
      }
    }

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
    // Apply tenant filtering based on user role
    const tenantWhereClause: any = {
      status: 'active',
      name: {
        notIn: [
          "Tenant 1 Demo",
          "Showroom Jakarta Premium",
          "Showroom Jakarta",
          "Dealer Mobil",
          "AutoMobil",
          "AutoLumiku Platform"
        ]
      }
    };

    // If filterTenantIds is not empty, restrict to those tenants only
    if (filterTenantIds.length > 0) {
      tenantWhereClause.id = { in: filterTenantIds };
    }

    const tenants = await prisma.tenant.findMany({
      where: tenantWhereClause,
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
        // CLEAN DATA POLICY:
        // Fetch IDs of 'DELETED' (Fake/Test) vehicles to exclude their stats
        const deletedVehicles = await prisma.vehicle.findMany({
          where: { tenantId: tenant.id, status: 'DELETED' },
          select: { id: true }
        });
        const deletedIds = deletedVehicles.map(v => v.id);

        const [soldVehicles, totalLeads, totalViews, totalVehiclesClean] = await Promise.all([
          prisma.vehicle.count({
            where: {
              tenantId: tenant.id,
              status: 'SOLD',
            },
          }),
          // Exclude leads linked to deleted vehicles
          prisma.lead.count({
            where: {
              tenantId: tenant.id,
              createdAt: { gte: startDate },
              NOT: { vehicleId: { in: deletedIds.length > 0 ? deletedIds : ['dummy-id'] } }
            },
          }),
          // Exclude views of deleted vehicles
          prisma.pageView.count({
            where: {
              tenantId: tenant.id,
              createdAt: { gte: startDate },
              NOT: { vehicleId: { in: deletedIds.length > 0 ? deletedIds : ['dummy-id'] } }
            },
          }),
          prisma.vehicle.count({
            where: {
              tenantId: tenant.id,
              status: { not: 'DELETED' },
            },
          }),
        ]);

        const totalVehicles = totalVehiclesClean;
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
          include: { tenant: { select: { id: true, name: true } } },
        });
        if (!vehicle || vehicle.status === 'DELETED') return null;
        return {
          vehicleId: view.vehicleId,
          make: vehicle?.make || 'Unknown',
          model: vehicle?.model || 'Unknown',
          year: vehicle?.year || 0,
          count: view._count.id,
          tenantId: vehicle?.tenantId,
          tenantName: vehicle?.tenant.name || 'Unknown',
        };
      })
    ).then(results => results.filter((v): v is NonNullable<typeof v> => v !== null));

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
          select: { id: true, name: true },
        });
        return {
          vehicleId: `${item.make}-${item.model}`, // Composite ID for aggregation
          make: item.make,
          model: item.model,
          year: item.year,
          count: item._count.id,
          tenantId: item.tenantId,
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
          select: { id: true, name: true },
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
          tenantId: item.tenantId,
          tenantName: tenant?.name || 'Unknown',
        };
      })
    );

    // 6. Get Most Stocked (Inventory Count by Model)
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

    const mostStocked = await Promise.all(
      availableByModel.map(async (item) => {
        const tenant = await prisma.tenant.findUnique({
          where: { id: item.tenantId },
          select: { id: true, name: true },
        });
        return {
          vehicleId: `${item.make}-${item.model}`,
          make: item.make,
          model: item.model,
          year: item.year,
          count: item._count.id,
          tenantId: item.tenantId,
          tenantName: tenant?.name || 'Unknown',
        };
      })
    );

    // 7. Time Series Activity (Real - Dynamic based on timeRange)
    let daysToLookBack = 7;
    if (timeRange === '30d') daysToLookBack = 30;
    if (timeRange === '90d') daysToLookBack = 90;

    // For 24h we might want to show hourly, but for now let's keep it as last 1 day or default to 7 if not supported by UI
    if (timeRange === '24h') daysToLookBack = 1;

    // CLEAN DATA POLICY: Get all deleted vehicle IDs to exclude from time series
    const allDeletedVehicles = await prisma.vehicle.findMany({
      where: {
        tenantId: { in: activeTenantIds },
        status: 'DELETED'
      },
      select: { id: true }
    });
    const allDeletedIds = allDeletedVehicles.map(v => v.id);

    const timeSeriesData = [];
    for (let i = daysToLookBack - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);

      const nextD = new Date(d);
      nextD.setDate(nextD.getDate() + 1);

      const [views, inquiries, sales, newVehicles] = await Promise.all([
        // Exclude views of deleted vehicles
        prisma.pageView.count({
          where: {
            createdAt: { gte: d, lt: nextD },
            tenantId: { in: activeTenantIds },
            NOT: { vehicleId: { in: allDeletedIds.length > 0 ? allDeletedIds : ['dummy-id'] } }
          }
        }),
        // Exclude inquiries/leads linked to deleted vehicles
        prisma.lead.count({
          where: {
            createdAt: { gte: d, lt: nextD },
            tenantId: { in: activeTenantIds },
            NOT: { vehicleId: { in: allDeletedIds.length > 0 ? allDeletedIds : ['dummy-id'] } }
          }
        }),
        prisma.vehicle.count({
          where: { status: 'SOLD', updatedAt: { gte: d, lt: nextD }, tenantId: { in: activeTenantIds } }
        }),
        prisma.vehicle.count({
          where: { createdAt: { gte: d, lt: nextD }, tenantId: { in: activeTenantIds }, status: { not: 'DELETED' } }
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
      mostStocked,
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
}
