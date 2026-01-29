/**
 * Vehicle AI Service
 *
 * Handles AI-powered vehicle identification, description generation,
 * and pricing analysis using z.ai GLM models
 */

import { createZAIClient, ZAIClient } from './zai-client';
import { popularVehicleService } from '../services/inventory/popular-vehicle-service';
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

const VEHICLE_IDENTIFICATION_PROMPT = `JSON API for Indonesian second-hand car showroom.

Parse vehicle data and generate PROFESSIONAL SEO description in Bahasa Indonesia (80-120 words, 3 paragraphs).
Style: Professional, formal, informative. NO slang. Use "second" or "pre-owned" instead of "bekas".
Keywords: "mobil second", "dijual", make, model, year, city

CRITICAL - You MUST infer these fields based on your vehicle knowledge even if NOT in user input:
- variant: Infer common variant (e.g. "G AT", "E MT", "RS CVT") based on make/model/year/transmission
- fuelType: ALWAYS infer from vehicle type (bensin/diesel/hybrid/electric). Most cars use "bensin", trucks/pickups often "diesel"
- engineCapacity: ALWAYS infer from make/model (e.g. Avanza="1329cc" or "1496cc", Brio="1199cc", Jazz="1497cc")

Price in IDR cents (130jt=13000000000). Estimate if missing.
Transmission: manual/automatic/cvt

JSON:
{"make":"Toyota","model":"Avanza","year":2020,"variant":"G AT","transmissionType":"automatic","fuelType":"bensin","color":"Hitam","mileage":20000,"price":13000000000,"descriptionId":"Toyota Avanza G AT 2020 Second\\n\\nDijual Toyota Avanza G AT tahun 2020 dengan kondisi terawat dan siap pakai. Kendaraan ini memiliki kilometer 20.000 km, transmisi automatic, dan warna hitam metalik yang elegan.\\n\\nEksterior masih terawat dengan cat Abu-Abu Metalik yang masih mengkilap. Interior bersih dan nyaman, fitur-fitur lengkap sesuai standar Toyota Avanza.\\n\\nHarga 130 Juta, unit siap pakai untuk harian maupun keluarga. Hubungi segera untuk informasi lebih lanjut!","features":["AC","Power Steering","Electric Mirror","Airbag"],"specifications":{"engineCapacity":"1329cc","seatingCapacity":7},"aiConfidence":85,"aiReasoning":"OK","aiSuggestedPrice":13500000000,"priceConfidence":90,"priceAnalysis":{"marketRange":{"min":13000000000,"max":14000000000},"factors":["2020"],"recommendation":"Fair"}}`;

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
        includeTools: false, // Disable function calling for JSON generation
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

      // Step 4: Enrich with PopularVehicle data for any missing fields
      const enrichedResult = await this.enrichWithPopularVehicleData(result, searchResults);

      return enrichedResult;
    } catch (error) {
      console.error('Vehicle AI identification error:', error);
      throw new Error(
        `Failed to identify vehicle: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Enrich AI result with PopularVehicle reference data
   * Fills in missing fuelType, engineCapacity, and variant from database
   */
  private async enrichWithPopularVehicleData(
    result: VehicleAIResult,
    searchResults: any[]
  ): Promise<VehicleAIResult> {
    // If we have search results, use the top match for enrichment
    if (searchResults.length === 0) {
      // Fallback defaults if no PopularVehicle data
      return this.applyDefaultEnrichment(result);
    }

    const topMatch = searchResults[0];
    console.log('[VehicleAI] Enriching with PopularVehicle data:', topMatch.make, topMatch.model);

    // Get full PopularVehicle data
    const popularVehicle = await prisma.popularVehicle.findUnique({
      where: { id: topMatch.id },
      select: {
        variants: true,
        engineCapacity: true,
        fuelTypes: true,
        transmissionTypes: true,
        category: true,
      },
    });

    if (!popularVehicle) {
      return this.applyDefaultEnrichment(result);
    }

    // Enrich missing fields
    const enriched = { ...result };

    // 1. Enrich variant if missing
    if (!enriched.variant && popularVehicle.variants) {
      const variants = popularVehicle.variants as string[];
      if (variants.length > 0) {
        // Try to match variant based on transmission
        const transmission = enriched.transmissionType?.toLowerCase() || '';
        const matchingVariant = variants.find(v => {
          const vLower = v.toLowerCase();
          if (transmission.includes('automatic') || transmission.includes('cvt') || transmission.includes('at')) {
            return vLower.includes('at') || vLower.includes('cvt') || vLower.includes('matic');
          }
          return vLower.includes('mt') || vLower.includes('manual');
        });
        enriched.variant = matchingVariant || variants[0];
        console.log('[VehicleAI] Enriched variant:', enriched.variant);
      }
    }

    // 2. Enrich fuelType if missing or default "bensin"
    if (!enriched.fuelType && popularVehicle.fuelTypes) {
      const fuelTypes = popularVehicle.fuelTypes as string[];
      if (fuelTypes.length > 0) {
        enriched.fuelType = fuelTypes[0].toLowerCase();
        console.log('[VehicleAI] Enriched fuelType:', enriched.fuelType);
      }
    }

    // 3. Enrich engineCapacity if missing
    if (!enriched.specifications?.engineCapacity && popularVehicle.engineCapacity) {
      const engineData = popularVehicle.engineCapacity as Record<string, string>;
      const engineKeys = Object.keys(engineData);
      if (engineKeys.length > 0) {
        // Get the first (most common) engine capacity
        const firstKey = engineKeys[0];
        const capacity = engineData[firstKey] || firstKey;
        enriched.specifications = {
          ...enriched.specifications,
          engineCapacity: capacity,
        };
        console.log('[VehicleAI] Enriched engineCapacity:', capacity);
      }
    }

    return this.applyDefaultEnrichment(enriched);
  }

  /**
   * Apply fallback defaults for any still-missing fields
   */
  private applyDefaultEnrichment(result: VehicleAIResult): VehicleAIResult {
    const enriched = { ...result };

    // Ensure fuelType is never empty
    if (!enriched.fuelType) {
      enriched.fuelType = 'bensin';
    }

    // Ensure specifications exists
    if (!enriched.specifications) {
      enriched.specifications = {};
    }

    // Infer engineCapacity from common knowledge if still missing
    if (!enriched.specifications.engineCapacity) {
      const knownEngineCapacity = this.inferEngineCapacity(enriched.make, enriched.model);
      if (knownEngineCapacity) {
        enriched.specifications.engineCapacity = knownEngineCapacity;
        console.log('[VehicleAI] Inferred engineCapacity:', knownEngineCapacity);
      }
    }

    return enriched;
  }

  /**
   * Infer engine capacity from common Indonesian vehicle knowledge
   */
  private inferEngineCapacity(make: string, model: string): string | null {
    const makeLower = make.toLowerCase();
    const modelLower = model.toLowerCase();

    // Common Indonesian vehicles with known engine capacities
    const knownCapacities: Record<string, Record<string, string>> = {
      toyota: {
        avanza: '1329cc',
        calya: '1197cc',
        rush: '1496cc',
        innova: '1998cc',
        fortuner: '2393cc',
        yaris: '1496cc',
        vios: '1496cc',
        agya: '998cc',
        raize: '1197cc',
        veloz: '1496cc',
      },
      daihatsu: {
        xenia: '1329cc',
        sigra: '1197cc',
        terios: '1496cc',
        ayla: '998cc',
        rocky: '1197cc',
        gran: '1329cc', // Gran Max
      },
      honda: {
        brio: '1199cc',
        jazz: '1497cc',
        city: '1497cc',
        civic: '1498cc',
        'hr-v': '1497cc',
        hrv: '1497cc',
        'cr-v': '1498cc',
        crv: '1498cc',
        mobilio: '1497cc',
        'br-v': '1497cc',
        brv: '1497cc',
      },
      suzuki: {
        ertiga: '1462cc',
        xl7: '1462cc',
        baleno: '1462cc',
        ignis: '1197cc',
        karimun: '998cc',
        apv: '1493cc',
        swift: '1197cc',
        jimny: '1462cc',
      },
      mitsubishi: {
        xpander: '1499cc',
        pajero: '2442cc',
        outlander: '1998cc',
        triton: '2442cc',
        colt: '1298cc', // Colt series
      },
      nissan: {
        livina: '1498cc',
        march: '1198cc',
        serena: '1997cc',
        navara: '2298cc',
        'x-trail': '1997cc',
        xtrail: '1997cc',
        juke: '1498cc',
      },
      mazda: {
        '2': '1496cc',
        '3': '1998cc',
        cx3: '1998cc',
        'cx-3': '1998cc',
        cx5: '2488cc',
        'cx-5': '2488cc',
      },
      hyundai: {
        creta: '1497cc',
        stargazer: '1497cc',
        ioniq: '1580cc',
        'santa fe': '2199cc',
        palisade: '2199cc',
      },
      wuling: {
        confero: '1499cc',
        cortez: '1499cc',
        almaz: '1499cc',
        'air ev': 'Electric',
      },
    };

    const makeData = knownCapacities[makeLower];
    if (makeData) {
      // Try exact match first
      if (makeData[modelLower]) {
        return makeData[modelLower];
      }
      // Try partial match
      for (const [key, value] of Object.entries(makeData)) {
        if (modelLower.includes(key) || key.includes(modelLower)) {
          return value;
        }
      }
    }

    return null;
  }

  /**
   * Identify vehicle from photos using AI Vision (GLM-4.5V)
   */
  async identifyFromVision(input: VehicleInput): Promise<VehicleAIResult> {
    try {
      if (!input.photos || input.photos.length === 0) {
        throw new Error('No photos provided for vision identification');
      }

      console.log(`[VehicleAI] Identifying from ${input.photos.length} photos...`);

      const response = await this.getClient().generateVision({
        systemPrompt: VEHICLE_IDENTIFICATION_PROMPT,
        userPrompt: input.userDescription || 'Identify this vehicle and extract all specifications.',
        images: input.photos,
        temperature: 0.1,
      });

      // Check if response was truncated
      if (response.finishReason === 'length') {
        throw new Error('AI Vision response truncated');
      }

      // Parse JSON
      let result = this.getClient().parseJSON<VehicleAIResult>(response.content);

      // Validate
      this.validateResult(result);

      // Simple enrichment
      return this.applyDefaultEnrichment(result);
    } catch (error) {
      console.error('Vehicle AI Vision error:', error);
      throw new Error(
        `Failed to identify vehicle from photos: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

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
      includeTools: false, // Disable function calling for JSON generation
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
      includeTools: false, // Disable function calling for JSON generation
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
  identifyFromVision: (...args: Parameters<VehicleAIService['identifyFromVision']>) =>
    getVehicleAIService().identifyFromVision(...args),
  regenerateDescription: (...args: Parameters<VehicleAIService['regenerateDescription']>) =>
    getVehicleAIService().regenerateDescription(...args),
  analyzePricing: (...args: Parameters<VehicleAIService['analyzePricing']>) =>
    getVehicleAIService().analyzePricing(...args),
};
