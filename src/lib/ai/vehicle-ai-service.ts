/**
 * Vehicle AI Service
 *
 * Handles AI-powered vehicle identification, description generation,
 * and pricing analysis using z.ai GLM models
 */

import { createZAIClient, ZAIClient } from './zai-client';
import { popularVehicleService } from '../services/popular-vehicle-service';
import { prisma } from '../prisma';

export interface VehicleInput {
  userDescription: string; // e.g., "Avanza 2020 AT, KM 20.000, Hitam, Rp 130jt"
  photos?: string[]; // Base64 encoded photos (optional)
}

export interface VehicleAIResult {
  // Basic Information
  make: string;
  model: string;
  year: number;
  variant?: string;
  transmissionType?: string; // manual, automatic, cvt
  fuelType?: string; // bensin, diesel, hybrid, electric
  color?: string;
  mileage?: number;

  // Pricing
  price: number; // User input price in IDR cents
  aiSuggestedPrice: number; // AI suggested price in IDR cents
  priceConfidence: number; // 0-100
  priceAnalysis: {
    marketRange: {
      min: number; // IDR cents
      max: number; // IDR cents
    };
    factors: string[];
    recommendation: string;
  };

  // AI-Generated Content
  descriptionId: string;
  features: string[];
  specifications: {
    engineCapacity?: string;
    seatingCapacity?: number;
    driveType?: string;
  };

  // AI Metadata
  aiConfidence: number; // 0-100
  aiReasoning: string;
}

const VEHICLE_IDENTIFICATION_PROMPT = `JSON API for Indonesian used car.

Parse vehicle, SEO description (Bahasa Indonesia, 80-120 words, 3 paragraphs).
Keywords: "mobil bekas", "dijual", make, model, year

Price in IDR cents (130jt=13000000000). Estimate if missing.
Transmission: manual/automatic/cvt

JSON:
{"make":"Toyota","model":"Avanza","year":2020,"variant":"G AT","transmissionType":"automatic","fuelType":"bensin","color":"Hitam","mileage":20000,"price":13000000000,"descriptionId":"Toyota Avanza 2020 Bekas\\n\\nDijual mobil bekas Toyota Avanza G AT 2020, KM 20rb, automatic, hitam. Terawat, siap pakai.\\n\\nInterior bersih, AC dingin, mesin halus. Cat original mengkilap.\\n\\nHubungi untuk test drive!","features":["AC","Power Steering"],"specifications":{"engineCapacity":"1329cc"},"aiConfidence":85,"aiReasoning":"OK","aiSuggestedPrice":13500000000,"priceConfidence":90,"priceAnalysis":{"marketRange":{"min":13000000000,"max":14000000000},"factors":["2020"],"recommendation":"Fair"}}`;

export class VehicleAIService {
  private client: ZAIClient | null;

  constructor(client?: ZAIClient | null) {
    if (client) {
      this.client = client;
    } else {
      this.client = createZAIClient();
      if (!this.client) {
        throw new Error('ZAI client not configured. Please set ZAI_API_KEY and ZAI_BASE_URL environment variables.');
      }
    }
  }

  private getClient(): ZAIClient {
    if (!this.client) {
      throw new Error('ZAI client not initialized');
    }
    return this.client;
  }

  /**
   * Query scraped vehicle data for reference
   * Searches ScraperResult table for similar vehicles
   */
  private async queryScrapedData(userDescription: string): Promise<any[]> {
    try {
      // Extract make/model/year from description (simple keyword matching)
      const descLower = userDescription.toLowerCase();

      // Common makes to search for
      const makes = ['toyota', 'honda', 'daihatsu', 'mitsubishi', 'suzuki', 'nissan', 'mazda', 'isuzu', 'bmw', 'mercedes'];
      const foundMake = makes.find(make => descLower.includes(make));

      if (!foundMake) return [];

      // Query approved scraped results
      const scrapedVehicles = await prisma.scraperResult.findMany({
        where: {
          make: {
            contains: foundMake,
            mode: 'insensitive',
          },
          status: 'approved', // Only use approved data
        },
        select: {
          make: true,
          model: true,
          year: true,
          variant: true,
          price: true,
          priceDisplay: true,
          transmission: true,
          fuelType: true,
          bodyType: true,
          features: true,
          description: true,
          source: true,
        },
        orderBy: {
          createdAt: 'desc', // ScraperResult uses createdAt not scrapedAt
        },
        take: 2, // Limit for speed - only need reference data
      });

      return scrapedVehicles;
    } catch (error) {
      console.error('Error querying scraped data:', error);
      return [];
    }
  }

  /**
   * Identify vehicle from user description
   * Uses GLM-4.6 for text-only identification
   * Enhanced with Popular Vehicle Database lookup AND Scraped Data
   */
  async identifyFromText(input: VehicleInput): Promise<VehicleAIResult> {
    try {
      // Step 1: Run database queries in parallel for speed
      const [searchResults, scrapedData] = await Promise.all([
        popularVehicleService.searchVehicles(input.userDescription, 3),
        this.queryScrapedData(input.userDescription),
      ]);

      let prompt = `Parse kendaraan ini dan generate data lengkap: ${input.userDescription}`;
      let temperature = 0.7;

      // Step 3: Build enhanced prompt with reference data
      let referenceData = '';

      // Add popular vehicle database reference (compact format)
      if (searchResults.length > 0) {
        const topMatch = searchResults[0];
        const priceRange = topMatch.usedCarPrices?.[0];
        referenceData += `\nDB: ${topMatch.make} ${topMatch.model}, variants: ${topMatch.variants?.slice(0, 2).join(', ')}`;
        if (priceRange) {
          referenceData += `, price: Rp ${priceRange.minPrice}-${priceRange.maxPrice}jt`;
        }
      }

      // Add scraped data reference (compact format - only top 2 examples)
      if (scrapedData.length > 0) {
        referenceData += `\nMarket:`;
        scrapedData.slice(0, 2).forEach((v, i) => {
          referenceData += ` ${i + 1}) ${v.make} ${v.model} ${v.year} ${v.priceDisplay || ''}`;
        });
      }

      // If we have reference data, enhance the prompt
      if (referenceData) {
        prompt = `${input.userDescription}${referenceData}\n\nUse reference for price validation.`;
        temperature = 0.5; // Lower temperature for more consistent results with reference data
      }

      const response = await this.getClient().generateText({
        systemPrompt: VEHICLE_IDENTIFICATION_PROMPT,
        userPrompt: prompt,
        temperature,
      });

      // Check if response was truncated
      if (response.finishReason === 'length') {
        console.error('AI response truncated:', {
          finishReason: response.finishReason,
          contentLength: response.content?.length || 0,
          contentPreview: response.content?.substring(0, 200),
        });
        throw new Error('AI response truncated - response was cut off before completion. Please try again.');
      }

      // Parse JSON response with better error handling
      let result: VehicleAIResult;
      try {
        result = this.getClient().parseJSON<VehicleAIResult>(response.content);
      } catch (parseError) {
        console.error('JSON parse error:', {
          error: parseError instanceof Error ? parseError.message : parseError,
          contentLength: response.content?.length || 0,
          contentPreview: response.content?.substring(0, 500),
          finishReason: response.finishReason,
        });
        throw new Error(`Failed to parse AI response: ${parseError instanceof Error ? parseError.message : 'Invalid JSON'}. Please try again.`);
      }

      // Validate required fields
      this.validateResult(result);

      // Step 3: Enhance with price validation if we have reference data
      if (searchResults.length > 0 && result.year) {
        const priceValidation = await popularVehicleService.validatePrice(
          result.make,
          result.model,
          result.year,
          result.price
        );

        // Update price analysis with validation data
        result.priceAnalysis = {
          ...result.priceAnalysis,
          marketRange: {
            min: priceValidation.marketMin,
            max: priceValidation.marketMax,
          },
          factors: [
            ...result.priceAnalysis.factors,
            priceValidation.message,
          ],
          recommendation: priceValidation.recommendation,
        };
      }

      return result;
    } catch (error) {
      console.error('Vehicle AI identification error:', error);
      throw new Error(
        `Failed to identify vehicle: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  // Vision-based identification removed - text-only identification is used

  /**
   * Validate AI result has required fields
   */
  private validateResult(result: VehicleAIResult): void {
    const requiredFields: (keyof VehicleAIResult)[] = [
      'make',
      'model',
      'year',
      'price',
      'descriptionId',
    ];

    for (const field of requiredFields) {
      if (!result[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    // Validate price format (should be in cents, > 1000000)
    if (result.price < 1000000) {
      throw new Error('Price seems to be in wrong format (should be in IDR cents)');
    }

    // Validate year is reasonable
    const currentYear = new Date().getFullYear();
    if (result.year < 1980 || result.year > currentYear + 1) {
      throw new Error(`Invalid year: ${result.year}`);
    }
  }

  /**
   * Re-generate description with custom tone/style
   */
  async regenerateDescription(
    vehicle: VehicleAIResult,
    tone: 'professional' | 'casual' | 'luxury'
  ): Promise<{ descriptionId: string }> {
    const tonePrompts = {
      professional: 'profesional dan formal',
      casual: 'santai dan friendly',
      luxury: 'mewah dan eksklusif',
    };

    const prompt = `Generate ulang deskripsi untuk kendaraan ini dengan tone ${tonePrompts[tone]}:

Make: ${vehicle.make}
Model: ${vehicle.model}
Year: ${vehicle.year}
Variant: ${vehicle.variant}
Mileage: ${vehicle.mileage} KM
Color: ${vehicle.color}
Features: ${vehicle.features.join(', ')}

PENTING: Gunakan kaidah SEO untuk mobil bekas di Indonesia seperti yang sudah dijelaskan sebelumnya.

Response format (JSON):
{
  "descriptionId": "Deskripsi dalam Bahasa Indonesia dengan kaidah SEO..."
}`;

    const response = await this.getClient().generateText({
      systemPrompt: 'Anda adalah copywriter profesional untuk showroom mobil bekas.',
      userPrompt: prompt,
      temperature: 0.8,
      maxTokens: 1500,
    });

    return this.getClient().parseJSON<{ descriptionId: string }>(
      response.content
    );
  }

  /**
   * Get price recommendation only
   */
  async analyzePricing(params: {
    make: string;
    model: string;
    year: number;
    mileage?: number;
    condition?: string;
    userPrice: number; // IDR cents
  }): Promise<VehicleAIResult['priceAnalysis'] & { aiSuggestedPrice: number; priceConfidence: number }> {
    const prompt = `Analisis harga untuk kendaraan berikut berdasarkan market Indonesia:

Make: ${params.make}
Model: ${params.model}
Year: ${params.year}
Mileage: ${params.mileage || 'Unknown'} KM
Condition: ${params.condition || 'Unknown'}
User Price: Rp ${(params.userPrice / 100000000).toFixed(0)} juta

Berikan analisis market price dan recommendation.

Response format (JSON):
{
  "aiSuggestedPrice": 23500000000,
  "priceConfidence": 95,
  "priceAnalysis": {
    "marketRange": { "min": 23000000000, "max": 24500000000 },
    "factors": ["Factor 1", "Factor 2"],
    "recommendation": "Detailed recommendation..."
  }
}`;

    const response = await this.getClient().generateText({
      systemPrompt: 'Anda adalah pricing analyst untuk used car market di Indonesia.',
      userPrompt: prompt,
      temperature: 0.5,
      maxTokens: 1500,
    });

    return this.getClient().parseJSON(response.content);
  }
}

// Export lazy-initialized singleton instance
let _vehicleAIService: VehicleAIService | null = null;
export function getVehicleAIService(): VehicleAIService {
  if (!_vehicleAIService) {
    _vehicleAIService = new VehicleAIService();
  }
  return _vehicleAIService;
}

// For backward compatibility
export const vehicleAIService = {
  get _instance() {
    return getVehicleAIService();
  },
  identifyFromText: (...args: Parameters<VehicleAIService['identifyFromText']>) =>
    getVehicleAIService().identifyFromText(...args),
  regenerateDescription: (...args: Parameters<VehicleAIService['regenerateDescription']>) =>
    getVehicleAIService().regenerateDescription(...args),
  analyzePricing: (...args: Parameters<VehicleAIService['analyzePricing']>) =>
    getVehicleAIService().analyzePricing(...args),
};
