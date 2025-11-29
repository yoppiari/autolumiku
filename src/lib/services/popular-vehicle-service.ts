/**
 * Popular Vehicle Service
 *
 * Service layer for Popular Vehicle Reference Database
 * Provides search, suggestions, and data retrieval for AI integration
 */

import { PrismaClient, PopularVehicle } from '@prisma/client';

const prisma = new PrismaClient();

export interface VehicleSearchResult {
  id: string;
  make: string;
  model: string;
  category: string;
  variants: string[];
  popularityScore: number;
  newCarPrice?: any;
  usedCarPrices: any;
}

export interface PriceValidation {
  isValid: boolean;
  message: string;
  difference: number; // percentage
  marketMin: number;
  marketMax: number;
  userPrice: number;
  recommendation: string;
}

export class PopularVehicleService {
  /**
   * Search vehicles by query (make, model, keywords)
   */
  async searchVehicles(query: string, limit: number = 10): Promise<VehicleSearchResult[]> {
    const searchTerm = query.toLowerCase().trim();

    const vehicles = await prisma.popularVehicle.findMany({
      where: {
        AND: [
          { isActive: true },
          {
            OR: [
              { make: { contains: searchTerm, mode: 'insensitive' } },
              { model: { contains: searchTerm, mode: 'insensitive' } },
              { commonKeywords: { has: searchTerm } },
              { searchAliases: { has: searchTerm } },
              // Fuzzy match for misspellings
              { commonMisspellings: { hasSome: [searchTerm] } },
            ],
          },
        ],
      },
      orderBy: [
        { popularityScore: 'desc' },
        { make: 'asc' },
      ],
      take: limit,
      select: {
        id: true,
        make: true,
        model: true,
        category: true,
        variants: true,
        popularityScore: true,
        newCarPrice: true,
        usedCarPrices: true,
      },
    });

    return vehicles as VehicleSearchResult[];
  }

  /**
   * Find vehicle by exact make and model
   */
  async findVehicle(make: string, model: string): Promise<PopularVehicle | null> {
    return await prisma.popularVehicle.findUnique({
      where: {
        make_model: {
          make: make,
          model: model,
        },
      },
    });
  }

  /**
   * Get vehicle by ID
   */
  async getVehicleById(id: string): Promise<PopularVehicle | null> {
    return await prisma.popularVehicle.findUnique({
      where: { id },
    });
  }

  /**
   * Get auto-complete suggestions
   */
  async getSuggestions(query: string): Promise<Array<{
    make: string;
    model: string;
    category: string;
  }>> {
    const results = await this.searchVehicles(query, 5);
    return results.map(v => ({
      make: v.make,
      model: v.model,
      category: v.category,
    }));
  }

  /**
   * Get variants for a vehicle
   */
  async getVariants(make: string, model: string): Promise<string[]> {
    const vehicle = await this.findVehicle(make, model);
    if (!vehicle) return [];
    return vehicle.variants as string[];
  }

  /**
   * Get price range for a specific year
   */
  async getPriceRange(
    make: string,
    model: string,
    year: number
  ): Promise<{ min: number; max: number } | null> {
    const vehicle = await this.findVehicle(make, model);
    if (!vehicle) return null;

    const usedCarPrices = vehicle.usedCarPrices as any;
    const yearStr = year.toString();

    if (usedCarPrices && usedCarPrices[yearStr]) {
      return usedCarPrices[yearStr];
    }

    // Try new car price if current year
    const currentYear = new Date().getFullYear();
    if (year === currentYear && vehicle.newCarPrice) {
      const newPrices = vehicle.newCarPrice as any;
      if (newPrices[yearStr]) {
        return newPrices[yearStr];
      }
    }

    return null;
  }

  /**
   * Validate price against market data
   */
  async validatePrice(
    make: string,
    model: string,
    year: number,
    userPrice: number
  ): Promise<PriceValidation> {
    const priceRange = await this.getPriceRange(make, model, year);

    if (!priceRange) {
      return {
        isValid: true, // Can't validate, assume valid
        message: 'No market data available for this year',
        difference: 0,
        marketMin: 0,
        marketMax: 0,
        userPrice,
        recommendation: 'Unable to compare with market price',
      };
    }

    const { min: marketMin, max: marketMax } = priceRange;
    const marketAvg = (marketMin + marketMax) / 2;
    const difference = ((userPrice - marketAvg) / marketAvg) * 100;

    let isValid = true;
    let message = '';
    let recommendation = '';

    if (userPrice < marketMin * 0.7) {
      isValid = false;
      message = `Harga terlalu rendah (${Math.abs(difference).toFixed(0)}% di bawah market)`;
      recommendation = `Harga market: Rp ${(marketMin / 100000000).toFixed(0)}-${(marketMax / 100000000).toFixed(0)} juta. Harga Anda mungkin terlalu murah.`;
    } else if (userPrice < marketMin) {
      message = `Harga di bawah market (${Math.abs(difference).toFixed(0)}%)`;
      recommendation = `Harga market rata-rata: Rp ${(marketAvg / 100000000).toFixed(0)} juta. Ini bisa jadi penawaran bagus!`;
    } else if (userPrice >= marketMin && userPrice <= marketMax) {
      message = `Harga sesuai market`;
      recommendation = `Harga Anda berada di range market yang wajar (Rp ${(marketMin / 100000000).toFixed(0)}-${(marketMax / 100000000).toFixed(0)} juta)`;
    } else if (userPrice <= marketMax * 1.15) {
      message = `Harga sedikit di atas market (+${difference.toFixed(0)}%)`;
      recommendation = `Market max: Rp ${(marketMax / 100000000).toFixed(0)} juta. Harga Anda masih reasonable jika kondisi/spec premium.`;
    } else {
      isValid = false;
      message = `Harga terlalu tinggi (+${difference.toFixed(0)}% di atas market)`;
      recommendation = `Harga market: Rp ${(marketMin / 100000000).toFixed(0)}-${(marketMax / 100000000).toFixed(0)} juta. Pertimbangkan menurunkan harga.`;
    }

    return {
      isValid,
      message,
      difference,
      marketMin,
      marketMax,
      userPrice,
      recommendation,
    };
  }

  /**
   * Get similar/competitor vehicles
   */
  async getSimilarVehicles(make: string, model: string, limit: number = 5): Promise<PopularVehicle[]> {
    const vehicle = await this.findVehicle(make, model);
    if (!vehicle) return [];

    const competitors = vehicle.directCompetitors as string[];

    // Find competitors by make/model in the list
    const similarVehicles = await prisma.popularVehicle.findMany({
      where: {
        AND: [
          { isActive: true },
          {
            NOT: {
              AND: [
                { make: make },
                { model: model },
              ],
            },
          },
          {
            OR: [
              // Same category
              { category: vehicle.category },
              // Mentioned in competitors
              ...competitors.map(comp => {
                const [compMake, compModel] = comp.split(' ');
                return {
                  AND: [
                    { make: { contains: compMake, mode: 'insensitive' as const } },
                    { model: { contains: compModel || '', mode: 'insensitive' as const } },
                  ],
                };
              }),
            ],
          },
        ],
      },
      orderBy: [
        { popularityScore: 'desc' },
      ],
      take: limit,
    });

    return similarVehicles;
  }

  /**
   * Get popular vehicles by category
   */
  async getPopularByCategory(category: string, limit: number = 10): Promise<PopularVehicle[]> {
    return await prisma.popularVehicle.findMany({
      where: {
        AND: [
          { isActive: true },
          { category: category },
        ],
      },
      orderBy: [
        { popularityScore: 'desc' },
      ],
      take: limit,
    });
  }

  /**
   * Get top popular vehicles overall
   */
  async getTopPopular(limit: number = 10): Promise<PopularVehicle[]> {
    return await prisma.popularVehicle.findMany({
      where: { isActive: true },
      orderBy: [
        { popularityScore: 'desc' },
      ],
      take: limit,
    });
  }

  /**
   * Get vehicles for comparison (for blog content)
   */
  async getForComparison(vehicleIds: string[]): Promise<PopularVehicle[]> {
    return await prisma.popularVehicle.findMany({
      where: {
        id: { in: vehicleIds },
      },
    });
  }
}

// Export singleton instance
export const popularVehicleService = new PopularVehicleService();
