/**
 * Marketing Analytics Service
 * Epic 7: Story 7.5 - Marketing Campaign Performance Tracking
 *
 * Track and analyze marketing campaign performance and ROI
 */

import { prisma } from '@/lib/prisma';
import { MarketingCampaign, CampaignStatus, MarketingChannel } from '@prisma/client';

export interface CreateCampaignData {
  name: string;
  channel: MarketingChannel;
  type: string;
  budget: number;
  startDate: Date;
  endDate?: Date;
  description?: string;
  targetAudience?: string;
}

export interface UpdateCampaignData {
  name?: string;
  budget?: number;
  endDate?: Date;
  status?: CampaignStatus;
  description?: string;
}

export interface CampaignPerformance {
  campaign: MarketingCampaign;
  metrics: {
    ctr: number; // Click-through rate
    cpl: number; // Cost per lead
    cpc: number; // Cost per click
    roi: number; // Return on investment
    conversionRate: number;
  };
}

export class MarketingAnalyticsService {
  /**
   * Create campaign
   */
  async createCampaign(
    tenantId: string,
    data: CreateCampaignData
  ): Promise<MarketingCampaign> {
    return prisma.marketingCampaign.create({
      data: {
        tenantId,
        ...data,
      },
    });
  }

  /**
   * Get campaign
   */
  async getCampaign(
    campaignId: string,
    tenantId: string
  ): Promise<MarketingCampaign | null> {
    return prisma.marketingCampaign.findFirst({
      where: { id: campaignId, tenantId },
    });
  }

  /**
   * Get all campaigns
   */
  async getCampaigns(
    tenantId: string,
    filters: { status?: CampaignStatus; channel?: MarketingChannel } = {}
  ): Promise<MarketingCampaign[]> {
    const where: any = { tenantId };

    if (filters.status) where.status = filters.status;
    if (filters.channel) where.channel = filters.channel;

    return prisma.marketingCampaign.findMany({
      where,
      orderBy: { startDate: 'desc' },
    });
  }

  /**
   * Update campaign
   */
  async updateCampaign(
    campaignId: string,
    tenantId: string,
    data: UpdateCampaignData
  ): Promise<MarketingCampaign> {
    return prisma.marketingCampaign.update({
      where: { id: campaignId, tenantId },
      data,
    });
  }

  /**
   * Update campaign metrics
   */
  async updateCampaignMetrics(
    campaignId: string,
    tenantId: string,
    metrics: {
      impressions?: number;
      clicks?: number;
      leads?: number;
      conversions?: number;
      revenue?: number;
      spent?: number;
    }
  ): Promise<MarketingCampaign> {
    return prisma.marketingCampaign.update({
      where: { id: campaignId, tenantId },
      data: metrics,
    });
  }

  /**
   * Get campaign performance
   */
  async getCampaignPerformance(
    campaignId: string,
    tenantId: string
  ): Promise<CampaignPerformance | null> {
    const campaign = await this.getCampaign(campaignId, tenantId);

    if (!campaign) return null;

    // Calculate metrics
    const ctr = campaign.impressions > 0
      ? (campaign.clicks / campaign.impressions) * 100
      : 0;

    const cpl = campaign.leads > 0 ? campaign.spent / campaign.leads : 0;

    const cpc = campaign.clicks > 0 ? campaign.spent / campaign.clicks : 0;

    const roi = campaign.spent > 0
      ? ((campaign.revenue - campaign.spent) / campaign.spent) * 100
      : 0;

    const conversionRate = campaign.leads > 0
      ? (campaign.conversions / campaign.leads) * 100
      : 0;

    return {
      campaign,
      metrics: {
        ctr: Math.round(ctr * 100) / 100,
        cpl: Math.round(cpl),
        cpc: Math.round(cpc),
        roi: Math.round(roi * 100) / 100,
        conversionRate: Math.round(conversionRate * 100) / 100,
      },
    };
  }

  /**
   * Get campaign performance comparison
   */
  async compareCampaigns(
    tenantId: string,
    dateFrom: Date,
    dateTo: Date
  ): Promise<CampaignPerformance[]> {
    const campaigns = await prisma.marketingCampaign.findMany({
      where: {
        tenantId,
        startDate: { gte: dateFrom },
        OR: [
          { endDate: null },
          { endDate: { lte: dateTo } },
        ],
      },
      orderBy: { startDate: 'desc' },
    });

    const performances: CampaignPerformance[] = [];

    for (const campaign of campaigns) {
      const ctr = campaign.impressions > 0
        ? (campaign.clicks / campaign.impressions) * 100
        : 0;

      const cpl = campaign.leads > 0 ? campaign.spent / campaign.leads : 0;

      const cpc = campaign.clicks > 0 ? campaign.spent / campaign.clicks : 0;

      const roi = campaign.spent > 0
        ? ((campaign.revenue - campaign.spent) / campaign.spent) * 100
        : 0;

      const conversionRate = campaign.leads > 0
        ? (campaign.conversions / campaign.leads) * 100
        : 0;

      performances.push({
        campaign,
        metrics: {
          ctr: Math.round(ctr * 100) / 100,
          cpl: Math.round(cpl),
          cpc: Math.round(cpc),
          roi: Math.round(roi * 100) / 100,
          conversionRate: Math.round(conversionRate * 100) / 100,
        },
      });
    }

    return performances;
  }

  /**
   * Get channel performance
   */
  async getChannelPerformance(
    tenantId: string,
    dateFrom: Date,
    dateTo: Date
  ): Promise<Record<string, {
    campaigns: number;
    spent: number;
    revenue: number;
    leads: number;
    conversions: number;
    roi: number;
  }>> {
    const campaigns = await prisma.marketingCampaign.findMany({
      where: {
        tenantId,
        startDate: { gte: dateFrom },
        OR: [
          { endDate: null },
          { endDate: { lte: dateTo } },
        ],
      },
    });

    const channelStats: Record<string, any> = {};

    campaigns.forEach((campaign) => {
      const channel = campaign.channel;

      if (!channelStats[channel]) {
        channelStats[channel] = {
          campaigns: 0,
          spent: 0,
          revenue: 0,
          leads: 0,
          conversions: 0,
        };
      }

      channelStats[channel].campaigns += 1;
      channelStats[channel].spent += campaign.spent;
      channelStats[channel].revenue += campaign.revenue;
      channelStats[channel].leads += campaign.leads;
      channelStats[channel].conversions += campaign.conversions;
    });

    // Calculate ROI for each channel
    Object.keys(channelStats).forEach((channel) => {
      const stats = channelStats[channel];
      stats.roi = stats.spent > 0
        ? ((stats.revenue - stats.spent) / stats.spent) * 100
        : 0;
      stats.roi = Math.round(stats.roi * 100) / 100;
    });

    return channelStats;
  }

  /**
   * Get active campaigns
   */
  async getActiveCampaigns(tenantId: string): Promise<MarketingCampaign[]> {
    const now = new Date();

    return prisma.marketingCampaign.findMany({
      where: {
        tenantId,
        status: 'ACTIVE',
        startDate: { lte: now },
        OR: [
          { endDate: null },
          { endDate: { gte: now } },
        ],
      },
      orderBy: { startDate: 'desc' },
    });
  }

  /**
   * Get campaign recommendations
   */
  async getCampaignRecommendations(
    tenantId: string
  ): Promise<{
    topPerformingChannels: string[];
    recommendations: string[];
  }> {
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);

    const channelPerf = await this.getChannelPerformance(
      tenantId,
      lastMonth,
      new Date()
    );

    // Sort channels by ROI
    const sortedChannels = Object.entries(channelPerf)
      .sort(([, a], [, b]) => b.roi - a.roi)
      .map(([channel]) => channel);

    const topPerformingChannels = sortedChannels.slice(0, 3);

    const recommendations: string[] = [];

    if (sortedChannels.length > 0) {
      const topChannel = sortedChannels[0];
      recommendations.push(
        `Focus budget on ${topChannel} - highest ROI of ${channelPerf[topChannel].roi.toFixed(2)}%`
      );
    }

    // Find underperforming campaigns
    const activeCampaigns = await this.getActiveCampaigns(tenantId);
    const lowROI = activeCampaigns.filter((c) => {
      const roi = c.spent > 0 ? ((c.revenue - c.spent) / c.spent) * 100 : 0;
      return roi < 0;
    });

    if (lowROI.length > 0) {
      recommendations.push(
        `Review ${lowROI.length} campaigns with negative ROI`
      );
    }

    return {
      topPerformingChannels,
      recommendations,
    };
  }
}

export const marketingAnalyticsService = new MarketingAnalyticsService();
