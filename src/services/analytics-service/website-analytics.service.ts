/**
 * Website Analytics Service
 * Epic 7: Story 7.2 - Website Traffic and Customer Engagement Analytics
 *
 * Track website traffic, engagement, and conversion metrics
 */

import { prisma } from '@/lib/prisma';
import { PageView } from '@prisma/client';

export interface TrackPageViewData {
  path: string;
  vehicleId?: string;
  referrer?: string;
  userAgent?: string;
  sessionId: string;
  visitorId?: string;
  duration?: number;
}

export interface WebsiteAnalytics {
  traffic: {
    totalViews: number;
    uniqueVisitors: number;
    avgSessionDuration: number;
    bounceRate: number;
  };
  topPages: { path: string; views: number }[];
  topVehicles: { vehicleId: string; views: number }[];
  conversions: {
    leadsGenerated: number;
    inquiriesSubmitted: number;
    conversionRate: number;
  };
  referrers: { source: string; count: number }[];
}

export class WebsiteAnalyticsService {
  /**
   * Track page view
   */
  async trackPageView(tenantId: string, data: TrackPageViewData): Promise<PageView> {
    return prisma.pageView.create({
      data: {
        tenantId,
        ...data,
      },
    });
  }

  /**
   * Get website analytics
   */
  async getWebsiteAnalytics(
    tenantId: string,
    dateFrom: Date,
    dateTo: Date
  ): Promise<WebsiteAnalytics> {
    const [views, topPages, topVehicles, conversions, referrers] = await Promise.all([
      this.getTrafficMetrics(tenantId, dateFrom, dateTo),
      this.getTopPages(tenantId, dateFrom, dateTo),
      this.getTopVehicles(tenantId, dateFrom, dateTo),
      this.getConversionMetrics(tenantId, dateFrom, dateTo),
      this.getTopReferrers(tenantId, dateFrom, dateTo),
    ]);

    return {
      traffic: views,
      topPages,
      topVehicles,
      conversions,
      referrers,
    };
  }

  /**
   * Get traffic metrics
   */
  private async getTrafficMetrics(
    tenantId: string,
    dateFrom: Date,
    dateTo: Date
  ): Promise<{
    totalViews: number;
    uniqueVisitors: number;
    avgSessionDuration: number;
    bounceRate: number;
  }> {
    const views = await prisma.pageView.findMany({
      where: {
        tenantId,
        createdAt: { gte: dateFrom, lte: dateTo },
      },
    });

    const totalViews = views.length;
    const uniqueVisitors = new Set(views.map((v) => v.visitorId || v.sessionId)).size;

    const totalDuration = views.reduce((sum, v) => sum + (v.duration || 0), 0);
    const avgSessionDuration = totalViews > 0 ? totalDuration / totalViews : 0;

    const bounced = views.filter((v) => v.bounced).length;
    const bounceRate = totalViews > 0 ? (bounced / totalViews) * 100 : 0;

    return {
      totalViews,
      uniqueVisitors,
      avgSessionDuration: Math.round(avgSessionDuration),
      bounceRate: Math.round(bounceRate * 10) / 10,
    };
  }

  /**
   * Get top pages
   */
  private async getTopPages(
    tenantId: string,
    dateFrom: Date,
    dateTo: Date,
    limit: number = 10
  ): Promise<{ path: string; views: number }[]> {
    const result = await prisma.pageView.groupBy({
      by: ['path'],
      where: {
        tenantId,
        createdAt: { gte: dateFrom, lte: dateTo },
      },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: limit,
    });

    return result.map((r) => ({
      path: r.path,
      views: r._count.id,
    }));
  }

  /**
   * Get top vehicles
   */
  private async getTopVehicles(
    tenantId: string,
    dateFrom: Date,
    dateTo: Date,
    limit: number = 10
  ): Promise<{ vehicleId: string; views: number }[]> {
    const result = await prisma.pageView.groupBy({
      by: ['vehicleId'],
      where: {
        tenantId,
        vehicleId: { not: null },
        createdAt: { gte: dateFrom, lte: dateTo },
      },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: limit,
    });

    return result
      .filter((r) => r.vehicleId)
      .map((r) => ({
        vehicleId: r.vehicleId!,
        views: r._count.id,
      }));
  }

  /**
   * Get conversion metrics
   */
  private async getConversionMetrics(
    tenantId: string,
    dateFrom: Date,
    dateTo: Date
  ): Promise<{
    leadsGenerated: number;
    inquiriesSubmitted: number;
    conversionRate: number;
  }> {
    const views = await prisma.pageView.findMany({
      where: {
        tenantId,
        createdAt: { gte: dateFrom, lte: dateTo },
      },
      select: {
        leadGenerated: true,
        inquirySubmitted: true,
      },
    });

    const leadsGenerated = views.filter((v) => v.leadGenerated).length;
    const inquiriesSubmitted = views.filter((v) => v.inquirySubmitted).length;

    const totalViews = views.length;
    const conversionRate =
      totalViews > 0 ? ((leadsGenerated + inquiriesSubmitted) / totalViews) * 100 : 0;

    return {
      leadsGenerated,
      inquiriesSubmitted,
      conversionRate: Math.round(conversionRate * 10) / 10,
    };
  }

  /**
   * Get top referrers
   */
  private async getTopReferrers(
    tenantId: string,
    dateFrom: Date,
    dateTo: Date,
    limit: number = 10
  ): Promise<{ source: string; count: number }[]> {
    const result = await prisma.pageView.groupBy({
      by: ['referrer'],
      where: {
        tenantId,
        referrer: { not: null },
        createdAt: { gte: dateFrom, lte: dateTo },
      },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: limit,
    });

    return result
      .filter((r) => r.referrer)
      .map((r) => ({
        source: r.referrer!,
        count: r._count.id,
      }));
  }

  /**
   * Get vehicle engagement
   */
  async getVehicleEngagement(
    tenantId: string,
    vehicleId: string,
    dateFrom: Date,
    dateTo: Date
  ): Promise<{
    totalViews: number;
    uniqueVisitors: number;
    avgDuration: number;
    inquiries: number;
  }> {
    const views = await prisma.pageView.findMany({
      where: {
        tenantId,
        vehicleId,
        createdAt: { gte: dateFrom, lte: dateTo },
      },
    });

    const totalViews = views.length;
    const uniqueVisitors = new Set(views.map((v) => v.visitorId || v.sessionId)).size;

    const totalDuration = views.reduce((sum, v) => sum + (v.duration || 0), 0);
    const avgDuration = totalViews > 0 ? totalDuration / totalViews : 0;

    const inquiries = views.filter((v) => v.inquirySubmitted).length;

    return {
      totalViews,
      uniqueVisitors,
      avgDuration: Math.round(avgDuration),
      inquiries,
    };
  }
}

export const websiteAnalyticsService = new WebsiteAnalyticsService();
