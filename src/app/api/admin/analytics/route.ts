/**
 * Analytics API Endpoint
 * Provides comprehensive analytics data for tenant vehicles
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
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

    // Get tenant summaries with real data
    const tenants = await prisma.tenant.findMany({
      include: {
        _count: {
          select: {
            vehicles: true,
            users: true,
          },
        },
      },
    });

    const tenantSummary = await Promise.all(
      tenants.map(async (tenant) => {
        const soldVehicles = await prisma.vehicle.count({
          where: {
            tenantId: tenant.id,
            status: 'sold',
          },
        });

        const totalLeads = await prisma.lead.count({
          where: {
            tenantId: tenant.id,
          },
        });

        const conversionRate = tenant._count.vehicles > 0
          ? ((soldVehicles / tenant._count.vehicles) * 100).toFixed(1)
          : '0.0';

        return {
          tenantId: tenant.id,
          tenantName: tenant.name,
          totalVehicles: tenant._count.vehicles,
          soldVehicles,
          totalViews: Math.floor(Math.random() * 5000) + 1000, // Mock: view tracking not implemented
          totalInquiries: totalLeads,
          conversionRate: parseFloat(conversionRate),
        };
      })
    );

    // Get most sold vehicles
    const soldVehicles = await prisma.vehicle.findMany({
      where: {
        status: 'sold',
      },
      include: {
        tenant: {
          select: {
            name: true,
          },
        },
      },
      take: 10,
      orderBy: {
        updatedAt: 'desc',
      },
    });

    // Group by make/model for most sold
    const soldByModel = soldVehicles.reduce((acc: any, vehicle) => {
      const key = `${vehicle.make}-${vehicle.model}`;
      if (!acc[key]) {
        acc[key] = {
          vehicleId: vehicle.id,
          make: vehicle.make,
          model: vehicle.model,
          year: vehicle.year,
          count: 0,
          tenantName: vehicle.tenant.name,
        };
      }
      acc[key].count++;
      return acc;
    }, {});

    const mostSold = Object.values(soldByModel)
      .sort((a: any, b: any) => b.count - a.count)
      .slice(0, 5);

    // Get most collected (available vehicles)
    const availableVehicles = await prisma.vehicle.findMany({
      where: {
        status: 'available',
      },
      include: {
        tenant: {
          select: {
            name: true,
          },
        },
      },
      take: 20,
    });

    const collectedByModel = availableVehicles.reduce((acc: any, vehicle) => {
      const key = `${vehicle.make}-${vehicle.model}`;
      if (!acc[key]) {
        acc[key] = {
          vehicleId: vehicle.id,
          make: vehicle.make,
          model: vehicle.model,
          year: vehicle.year,
          count: 0,
          tenantName: vehicle.tenant.name,
        };
      }
      acc[key].count++;
      return acc;
    }, {});

    const mostCollected = Object.values(collectedByModel)
      .sort((a: any, b: any) => b.count - a.count)
      .slice(0, 5);

    // Get leads for most asked (inquiries)
    const leads = await prisma.lead.findMany({
      where: {
        interestedIn: {
          not: null,
        },
      },
      include: {
        tenant: {
          select: {
            name: true,
          },
        },
      },
      take: 50,
    });

    const askedByVehicle = leads.reduce((acc: any, lead) => {
      if (lead.interestedIn) {
        const key = lead.interestedIn;
        if (!acc[key]) {
          acc[key] = {
            vehicleId: lead.id,
            make: lead.interestedIn.split(' ')[0] || 'Unknown',
            model: lead.interestedIn.split(' ').slice(1).join(' ') || 'Unknown',
            year: new Date().getFullYear(),
            count: 0,
            tenantName: lead.tenant.name,
          };
        }
        acc[key].count++;
      }
      return acc;
    }, {});

    const mostAsked = Object.values(askedByVehicle)
      .sort((a: any, b: any) => b.count - a.count)
      .slice(0, 5);

    // Time series data - mock for now (requires historical tracking)
    const timeSeriesData = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      timeSeriesData.push({
        date: date.toISOString().split('T')[0],
        views: Math.floor(Math.random() * 2000) + 2000,
        inquiries: Math.floor(Math.random() * 40) + 40,
        sales: Math.floor(Math.random() * 15) + 10,
        newVehicles: Math.floor(Math.random() * 10) + 5,
      });
    }

    const analyticsData = {
      mostCollected,
      mostViewed: mostCollected, // Mock: view tracking not implemented
      mostAsked: mostAsked.length > 0 ? mostAsked : mostCollected,
      mostSold: mostSold.length > 0 ? mostSold : mostCollected,
      tenantSummary,
      timeSeriesData,
      generated: new Date().toISOString(),
      timeRange,
    };

    return NextResponse.json(analyticsData);

  } catch (error) {
    console.error('Analytics API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}