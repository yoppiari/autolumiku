/**
 * Analytics API Endpoint
 * Provides comprehensive analytics data for tenant vehicles
 */

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // TODO: Add proper authentication in production
    // For development, allow all requests

    const searchParams = request.nextUrl.searchParams;
    const timeRange = searchParams.get('timeRange') || '7d';

    // Mock analytics data for development
    const analyticsData = {
      mostCollected: [
        { vehicleId: '1', make: 'Toyota', model: 'Avanza', year: 2023, count: 45, tenantName: 'AutoMobil', percentage: 15.2 },
        { vehicleId: '2', make: 'Honda', model: 'CR-V', year: 2023, count: 38, tenantName: 'HondaCenter', percentage: 12.8 },
        { vehicleId: '3', make: 'Suzuki', model: 'Ertiga', year: 2023, count: 32, tenantName: 'SuzukiDealer', percentage: 10.8 },
        { vehicleId: '4', make: 'Mitsubishi', model: 'Xpander', year: 2023, count: 28, tenantName: 'MitsubishiMotors', percentage: 9.5 },
        { vehicleId: '5', make: 'Daihatsu', model: 'Xenia', year: 2023, count: 25, tenantName: 'AutoMobil', percentage: 8.4 }
      ],
      mostViewed: [
        { vehicleId: '6', make: 'Toyota', model: 'Alphard', year: 2024, count: 1250, tenantName: 'LuxuryCars', percentage: 18.5 },
        { vehicleId: '7', make: 'Mercedes', model: 'C-Class', year: 2024, count: 980, tenantName: 'EuroAuto', percentage: 14.5 },
        { vehicleId: '8', make: 'Honda', model: 'Civic', year: 2024, count: 850, tenantName: 'HondaCenter', percentage: 12.6 },
        { vehicleId: '9', make: 'Mazda', model: 'CX-5', year: 2024, count: 720, tenantName: 'MazdaDealer', percentage: 10.7 },
        { vehicleId: '10', make: 'BMW', model: '3-Series', year: 2024, count: 650, tenantName: 'EuroAuto', percentage: 9.6 }
      ],
      mostAsked: [
        { vehicleId: '11', make: 'Toyota', model: 'Kijang Innova', year: 2024, count: 156, tenantName: 'ToyotaDealer', percentage: 22.3 },
        { vehicleId: '12', make: 'Honda', model: 'HR-V', year: 2024, count: 134, tenantName: 'HondaCenter', percentage: 19.2 },
        { vehicleId: '13', make: 'Suzuki', model: 'Jimny', year: 2024, count: 98, tenantName: 'SuzukiDealer', percentage: 14.0 },
        { vehicleId: '14', make: 'Mitsubishi', model: 'Pajero Sport', year: 2024, count: 87, tenantName: 'MitsubishiMotors', percentage: 12.4 },
        { vehicleId: '15', make: 'Daihatsu', model: 'Terios', year: 2024, count: 76, tenantName: 'AutoMobil', percentage: 10.9 }
      ],
      mostSold: [
        { vehicleId: '16', make: 'Toyota', model: 'Avanza', year: 2023, count: 28, tenantName: 'AutoMobil', percentage: 20.1 },
        { vehicleId: '17', make: 'Honda', model: 'Brio', year: 2023, count: 22, tenantName: 'HondaCenter', percentage: 15.8 },
        { vehicleId: '18', make: 'Suzuki', model: 'Carry Pick-up', year: 2023, count: 18, tenantName: 'SuzukiDealer', percentage: 12.9 },
        { vehicleId: '19', make: 'Daihatsu', model: 'Ayla', year: 2023, count: 15, tenantName: 'AutoMobil', percentage: 10.8 },
        { vehicleId: '20', make: 'Mitsubishi', model: 'L300', year: 2023, count: 12, tenantName: 'MitsubishiMotors', percentage: 8.6 }
      ],
      tenantSummary: [
        { tenantId: '1', tenantName: 'AutoMobil', totalVehicles: 85, soldVehicles: 43, totalViews: 12500, totalInquiries: 234, conversionRate: 18.4 },
        { tenantId: '2', tenantName: 'HondaCenter', totalVehicles: 72, soldVehicles: 37, totalViews: 10800, totalInquiries: 198, conversionRate: 18.7 },
        { tenantId: '3', tenantName: 'SuzukiDealer', totalVehicles: 68, soldVehicles: 31, totalViews: 9200, totalInquiries: 167, conversionRate: 18.6 },
        { tenantId: '4', tenantName: 'MitsubishiMotors', totalVehicles: 54, soldVehicles: 25, totalViews: 7800, totalInquiries: 143, conversionRate: 17.5 },
        { tenantId: '5', tenantName: 'LuxuryCars', totalVehicles: 28, soldVehicles: 12, totalViews: 15600, totalInquiries: 89, conversionRate: 13.5 }
      ],
      timeSeriesData: [
        { date: '2025-11-17', views: 2400, inquiries: 45, sales: 12, newVehicles: 8 },
        { date: '2025-11-18', views: 2800, inquiries: 52, sales: 15, newVehicles: 12 },
        { date: '2025-11-19', views: 3200, inquiries: 61, sales: 18, newVehicles: 6 },
        { date: '2025-11-20', views: 2900, inquiries: 48, sales: 14, newVehicles: 9 },
        { date: '2025-11-21', views: 3500, inquiries: 67, sales: 22, newVehicles: 15 },
        { date: '2025-11-22', views: 3800, inquiries: 72, sales: 25, newVehicles: 11 },
        { date: '2025-11-23', views: 4200, inquiries: 85, sales: 28, newVehicles: 18 }
      ],
      generated: new Date().toISOString(),
      timeRange
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