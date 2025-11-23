/**
 * Competitor Analysis Service
 * Epic 7: Story 7.7 - Competitor Analysis and Market Position Tracking
 *
 * Provides competitor pricing analysis, market positioning, and competitive intelligence
 * for automotive showrooms in Indonesia.
 */

import { prisma } from '@/lib/prisma';
import { AnalyticsFilter } from './types';

// ============================================================================
// Types
// ============================================================================

export interface CompetitorData {
  id: string;
  tenantId: string;
  competitorName: string;
  location: string;
  vehicleMake: string;
  vehicleModel: string;
  year: number;
  price: number;
  mileage?: number;
  condition?: string;
  inventoryCount?: number;
  sourceUrl?: string;
  lastUpdated: Date;
  createdAt: Date;
}

export interface CompetitorPricing {
  vehicleKey: string; // make-model-year
  make: string;
  model: string;
  year: number;
  ourPrice: number;
  avgCompetitorPrice: number;
  minCompetitorPrice: number;
  maxCompetitorPrice: number;
  pricePosition: 'below' | 'competitive' | 'above';
  priceDifference: number;
  priceDifferencePercent: number;
  competitorCount: number;
  recommendation: string;
}

export interface MarketGap {
  category: string;
  make?: string;
  model?: string;
  priceRange: { min: number; max: number };
  competitorCount: number;
  ourInventoryCount: number;
  opportunity: 'high' | 'medium' | 'low';
  description: string;
}

export interface CompetitorAnalyticsResult {
  pricingComparison: CompetitorPricing[];
  marketGaps: MarketGap[];
  competitorOverview: {
    totalCompetitors: number;
    totalVehiclesTracked: number;
    avgPriceDifference: number;
    marketPosition: 'leader' | 'competitive' | 'follower';
  };
  recentChanges: {
    competitorName: string;
    vehicleDescription: string;
    oldPrice: number;
    newPrice: number;
    changePercent: number;
    changedAt: Date;
  }[];
}

// ============================================================================
// Competitor Analysis Service
// ============================================================================

export class CompetitorAnalysisService {
  /**
   * Get comprehensive competitor analysis
   */
  async getCompetitorAnalysis(filter: AnalyticsFilter): Promise<CompetitorAnalyticsResult> {
    const { tenantId } = filter;

    const [pricingComparison, marketGaps, competitorOverview, recentChanges] = await Promise.all([
      this.getPricingComparison(tenantId),
      this.identifyMarketGaps(tenantId),
      this.getCompetitorOverview(tenantId),
      this.getRecentPriceChanges(tenantId),
    ]);

    return {
      pricingComparison,
      marketGaps,
      competitorOverview,
      recentChanges,
    };
  }

  /**
   * Compare pricing with competitors
   */
  async getPricingComparison(tenantId: string): Promise<CompetitorPricing[]> {
    // Get our inventory
    const ourVehicles = await prisma.vehicle.findMany({
      where: {
        tenantId,
        status: 'AVAILABLE',
        deletedAt: null,
      },
      select: {
        make: true,
        model: true,
        year: true,
        price: true,
      },
    });

    // Get competitor data
    const competitorVehicles = await prisma.competitorVehicle.findMany({
      where: {
        tenantId,
      },
    });

    // Group by make-model-year
    const comparisonMap = new Map<string, CompetitorPricing>();

    // Process our vehicles
    ourVehicles.forEach((vehicle) => {
      const key = `${vehicle.make}-${vehicle.model}-${vehicle.year}`;
      if (!comparisonMap.has(key)) {
        comparisonMap.set(key, {
          vehicleKey: key,
          make: vehicle.make,
          model: vehicle.model,
          year: vehicle.year,
          ourPrice: vehicle.price,
          avgCompetitorPrice: 0,
          minCompetitorPrice: 0,
          maxCompetitorPrice: 0,
          pricePosition: 'competitive',
          priceDifference: 0,
          priceDifferencePercent: 0,
          competitorCount: 0,
          recommendation: '',
        });
      }
    });

    // Process competitor vehicles
    competitorVehicles.forEach((compVehicle) => {
      const key = `${compVehicle.vehicleMake}-${compVehicle.vehicleModel}-${compVehicle.year}`;
      const comparison = comparisonMap.get(key);

      if (comparison) {
        if (comparison.competitorCount === 0) {
          comparison.minCompetitorPrice = compVehicle.price;
          comparison.maxCompetitorPrice = compVehicle.price;
          comparison.avgCompetitorPrice = compVehicle.price;
        } else {
          comparison.minCompetitorPrice = Math.min(comparison.minCompetitorPrice, compVehicle.price);
          comparison.maxCompetitorPrice = Math.max(comparison.maxCompetitorPrice, compVehicle.price);
          comparison.avgCompetitorPrice =
            (comparison.avgCompetitorPrice * comparison.competitorCount + compVehicle.price) /
            (comparison.competitorCount + 1);
        }
        comparison.competitorCount++;
      }
    });

    // Calculate positions and recommendations
    const results: CompetitorPricing[] = [];
    comparisonMap.forEach((comparison) => {
      if (comparison.competitorCount > 0) {
        comparison.priceDifference = comparison.ourPrice - comparison.avgCompetitorPrice;
        comparison.priceDifferencePercent = (comparison.priceDifference / comparison.avgCompetitorPrice) * 100;

        // Determine price position
        if (comparison.ourPrice < comparison.avgCompetitorPrice * 0.95) {
          comparison.pricePosition = 'below';
          comparison.recommendation = 'Harga Anda lebih rendah dari pasar. Pertimbangkan untuk menaikkan harga.';
        } else if (comparison.ourPrice > comparison.avgCompetitorPrice * 1.05) {
          comparison.pricePosition = 'above';
          comparison.recommendation = 'Harga Anda lebih tinggi dari pasar. Pertimbangkan penyesuaian harga.';
        } else {
          comparison.pricePosition = 'competitive';
          comparison.recommendation = 'Harga Anda kompetitif dengan pasar.';
        }

        results.push(comparison);
      }
    });

    return results.sort((a, b) => Math.abs(b.priceDifferencePercent) - Math.abs(a.priceDifferencePercent));
  }

  /**
   * Identify market gaps and opportunities
   */
  async identifyMarketGaps(tenantId: string): Promise<MarketGap[]> {
    const gaps: MarketGap[] = [];

    // Get competitor inventory categories
    const competitorCategories = await prisma.competitorVehicle.groupBy({
      by: ['vehicleMake', 'vehicleModel'],
      where: { tenantId },
      _count: { id: true },
    });

    // Get our inventory categories
    const ourCategories = await prisma.vehicle.groupBy({
      by: ['make', 'model'],
      where: {
        tenantId,
        status: 'AVAILABLE',
        deletedAt: null,
      },
      _count: { id: true },
    });

    // Find categories where competitors have inventory but we don't
    for (const compCat of competitorCategories) {
      const weHave = ourCategories.find(
        (ourCat) => ourCat.make === compCat.vehicleMake && ourCat.model === compCat.vehicleModel
      );

      if (!weHave || weHave._count.id === 0) {
        // Get price range for this category
        const priceData = await prisma.competitorVehicle.aggregate({
          where: {
            tenantId,
            vehicleMake: compCat.vehicleMake,
            vehicleModel: compCat.vehicleModel,
          },
          _min: { price: true },
          _max: { price: true },
        });

        gaps.push({
          category: `${compCat.vehicleMake} ${compCat.vehicleModel}`,
          make: compCat.vehicleMake,
          model: compCat.vehicleModel,
          priceRange: {
            min: priceData._min.price || 0,
            max: priceData._max.price || 0,
          },
          competitorCount: compCat._count.id,
          ourInventoryCount: 0,
          opportunity: compCat._count.id > 5 ? 'high' : compCat._count.id > 2 ? 'medium' : 'low',
          description: `${compCat._count.id} competitor(s) menjual ${compCat.vehicleMake} ${compCat.vehicleModel}, tapi Anda belum punya di inventory.`,
        });
      }
    }

    return gaps.sort((a, b) => b.competitorCount - a.competitorCount);
  }

  /**
   * Get competitor overview statistics
   */
  async getCompetitorOverview(tenantId: string) {
    const [competitorCount, totalTracked, avgDiff] = await Promise.all([
      prisma.competitorVehicle
        .findMany({
          where: { tenantId },
          distinct: ['competitorName'],
        })
        .then((res) => res.length),

      prisma.competitorVehicle.count({
        where: { tenantId },
      }),

      this.calculateAvgPriceDifference(tenantId),
    ]);

    // Determine market position
    let marketPosition: 'leader' | 'competitive' | 'follower' = 'competitive';
    if (avgDiff < -5) {
      marketPosition = 'leader'; // Our prices are lower
    } else if (avgDiff > 5) {
      marketPosition = 'follower'; // Our prices are higher
    }

    return {
      totalCompetitors: competitorCount,
      totalVehiclesTracked: totalTracked,
      avgPriceDifference: avgDiff,
      marketPosition,
    };
  }

  /**
   * Calculate average price difference across all vehicles
   */
  private async calculateAvgPriceDifference(tenantId: string): Promise<number> {
    const comparisons = await this.getPricingComparison(tenantId);

    if (comparisons.length === 0) return 0;

    const totalDiff = comparisons.reduce((sum, comp) => sum + comp.priceDifferencePercent, 0);
    return totalDiff / comparisons.length;
  }

  /**
   * Get recent competitor price changes
   */
  async getRecentPriceChanges(tenantId: string, limit: number = 10) {
    const priceHistory = await prisma.competitorPriceHistory.findMany({
      where: { tenantId },
      orderBy: { changedAt: 'desc' },
      take: limit,
      include: {
        competitorVehicle: true,
      },
    });

    return priceHistory.map((history) => ({
      competitorName: history.competitorVehicle.competitorName,
      vehicleDescription: `${history.competitorVehicle.vehicleMake} ${history.competitorVehicle.vehicleModel} ${history.competitorVehicle.year}`,
      oldPrice: history.oldPrice,
      newPrice: history.newPrice,
      changePercent: ((history.newPrice - history.oldPrice) / history.oldPrice) * 100,
      changedAt: history.changedAt,
    }));
  }

  /**
   * Add competitor vehicle data (manual entry)
   */
  async addCompetitorVehicle(data: {
    tenantId: string;
    competitorName: string;
    location: string;
    vehicleMake: string;
    vehicleModel: string;
    year: number;
    price: number;
    mileage?: number;
    condition?: string;
    sourceUrl?: string;
  }) {
    return prisma.competitorVehicle.create({
      data: {
        ...data,
        lastUpdated: new Date(),
      },
    });
  }

  /**
   * Update competitor vehicle price (track price changes)
   */
  async updateCompetitorPrice(vehicleId: string, newPrice: number) {
    const vehicle = await prisma.competitorVehicle.findUnique({
      where: { id: vehicleId },
    });

    if (!vehicle) {
      throw new Error('Competitor vehicle not found');
    }

    // Record price change history
    if (vehicle.price !== newPrice) {
      await prisma.competitorPriceHistory.create({
        data: {
          tenantId: vehicle.tenantId,
          competitorVehicleId: vehicleId,
          oldPrice: vehicle.price,
          newPrice,
          changedAt: new Date(),
        },
      });
    }

    // Update vehicle price
    return prisma.competitorVehicle.update({
      where: { id: vehicleId },
      data: {
        price: newPrice,
        lastUpdated: new Date(),
      },
    });
  }

  /**
   * Delete competitor vehicle data
   */
  async deleteCompetitorVehicle(vehicleId: string) {
    return prisma.competitorVehicle.delete({
      where: { id: vehicleId },
    });
  }

  /**
   * Get competitor list
   */
  async getCompetitorList(tenantId: string) {
    const competitors = await prisma.competitorVehicle.findMany({
      where: { tenantId },
      distinct: ['competitorName'],
      select: {
        competitorName: true,
        location: true,
      },
    });

    // Get vehicle count per competitor
    const result = await Promise.all(
      competitors.map(async (comp) => {
        const count = await prisma.competitorVehicle.count({
          where: {
            tenantId,
            competitorName: comp.competitorName,
          },
        });

        return {
          name: comp.competitorName,
          location: comp.location,
          vehicleCount: count,
        };
      })
    );

    return result;
  }
}

export const competitorAnalysisService = new CompetitorAnalysisService();
