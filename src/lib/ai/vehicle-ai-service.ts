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

const VEHICLE_IDENTIFICATION_PROMPT = `Anda adalah AI assistant untuk sistem inventory showroom mobil bekas di Indonesia.

Tugas Anda:
1. Parse informasi kendaraan dari input user yang minimal
2. Generate data lengkap untuk listing kendaraan
3. Buat deskripsi SEO-friendly dalam Bahasa Indonesia untuk mobil bekas
4. Extract fitur-fitur kendaraan berdasarkan pengetahuan umum tentang model tersebut
5. Validasi harga berdasarkan market price Indonesia dan berikan analisis

KAIDAH SEO MOBIL BEKAS INDONESIA:
- Gunakan kata kunci: "mobil bekas", "second", "dijual", nama merek & model, tahun, kota
- Format: [Merek] [Model] [Tahun] Bekas - [Kondisi/Variant]
- Paragraf 1: Pengenalan singkat (kondisi umum, tahun, KM, transmisi, warna)
- Paragraf 2: Keunggulan & fitur utama (3-5 poin)
- Paragraf 3: Kondisi mesin & eksterior/interior
- Paragraf 4: Call-to-action (hubungi, test drive, harga nego)
- Panjang: 150-250 kata
- Tone: Profesional tapi ramah, meyakinkan pembeli
- Hindari: Superlatif berlebihan, klaim tidak terverifikasi

IMPORTANT:
- Gunakan pengetahuan umum tentang model kendaraan untuk melengkapi data
- Harga harus dalam format IDR cents (Rp 130jt = 13000000000 cents)
- JIKA USER TIDAK MENTION HARGA: estimate harga market yang wajar dan set aiSuggestedPrice = price
- Transmission type: "manual", "automatic", atau "cvt"
- Confidence score: 0-100
- PRICE ANALYSIS sangat penting: bandingkan harga user dengan market price, berikan recommendation
- ALWAYS provide price field (required) - estimate if not provided by user
- Description HANYA dalam Bahasa Indonesia (SEO-optimized)

Response format (JSON):
{
  "make": "Toyota",
  "model": "Avanza",
  "year": 2020,
  "variant": "1.3 G AT",
  "transmissionType": "automatic",
  "fuelType": "bensin",
  "color": "Hitam",
  "mileage": 20000,
  "price": 13000000000,
  "descriptionId": "Toyota Avanza 2020 Bekas - Kondisi Prima Siap Pakai\\n\\nDijual mobil bekas Toyota Avanza 1.3 G AT tahun 2020 dengan kilometer 20.000, transmisi automatic, dan warna hitam yang elegan. Mobil ini sangat terawat dan siap digunakan untuk kebutuhan keluarga Anda.\\n\\nKeunggulan unit ini meliputi: interior bersih dan rapi, AC dingin, audio touchscreen, dan semua fitur berfungsi dengan baik. Mesin kering dan halus, tidak ada rembesan oli. Kaki-kaki nyaman, ban tebal, dan velg mulus tanpa cacat.\\n\\nEksterior cat masih original dan mengkilap, bebas dari baret atau penyok. Interior bersih, jok masih kencang, dan tidak ada bau tidak sedap.\\n\\nHubungi kami sekarang untuk test drive atau nego harga. Unit terbatas, siapa cepat dia dapat!",
  "features": ["Fitur 1", "Fitur 2", ...],
  "specifications": {
    "engineCapacity": "1329cc",
    "seatingCapacity": 7,
    "driveType": "FWD"
  },
  "aiConfidence": 85,
  "aiReasoning": "Reasoning tentang identifikasi dan pricing...",
  "aiSuggestedPrice": 23500000000,
  "priceConfidence": 95,
  "priceAnalysis": {
    "marketRange": { "min": 23000000000, "max": 24500000000 },
    "factors": ["Tahun 2020", "KM rendah", "Kondisi baik"],
    "recommendation": "Harga sesuai market / Harga terlalu rendah / Harga terlalu tinggi dengan penjelasan detail"
  }
}`;

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
        take: 5, // Get top 5 most recent
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
      // Step 1: Search popular vehicle database for quick match
      const searchResults = await popularVehicleService.searchVehicles(input.userDescription, 3);

      // Step 2: Query scraped data for real market examples
      const scrapedData = await this.queryScrapedData(input.userDescription);

      let prompt = `Parse kendaraan ini dan generate data lengkap: ${input.userDescription}`;
      let temperature = 0.7;

      // Step 3: Build enhanced prompt with reference data
      let referenceData = '';

      // Add popular vehicle database reference
      if (searchResults.length > 0) {
        const topMatch = searchResults[0];
        referenceData += `\n\nPOPULAR VEHICLE DATABASE:
Make: ${topMatch.make}
Model: ${topMatch.model}
Category: ${topMatch.category}
Available variants: ${JSON.stringify(topMatch.variants)}
Market price range: ${JSON.stringify(topMatch.usedCarPrices)}`;
      }

      // Add scraped data reference (REAL market data from OLX and CARSOME)
      if (scrapedData.length > 0) {
        referenceData += `\n\nREAL MARKET DATA (from OLX and CARSOME):`;

        scrapedData.slice(0, 3).forEach((vehicle, idx) => {
          referenceData += `\n\nExample ${idx + 1} (Source: ${vehicle.source}):
- ${vehicle.make} ${vehicle.model} ${vehicle.year}${vehicle.variant ? ` ${vehicle.variant}` : ''}
- Price: ${vehicle.priceDisplay || 'N/A'}
- Transmission: ${vehicle.transmission || 'N/A'}
- Fuel Type: ${vehicle.fuelType || 'N/A'}
- Body Type: ${vehicle.bodyType || 'N/A'}
- Mileage: ${vehicle.mileage ? `${vehicle.mileage.toLocaleString()} km` : 'N/A'}
- Features: ${vehicle.features || 'N/A'}
${vehicle.description ? `- Description: ${vehicle.description.substring(0, 200)}...` : ''}`;
        });
      }

      // If we have reference data, enhance the prompt
      if (referenceData) {
        prompt = `Parse kendaraan ini dan generate data lengkap: ${input.userDescription}
${referenceData}

IMPORTANT - Use this reference data to:
1. Confirm make/model identification
2. Validate variant against available options
3. Compare user's price with REAL market data above
4. Extract features similar to market examples
5. Generate descriptions inspired by market descriptions
6. Provide accurate pricing analysis based on actual listings`;

        temperature = 0.5; // Lower temperature for more consistent results with reference data
      }

      const response = await this.getClient().generateText({
        systemPrompt: VEHICLE_IDENTIFICATION_PROMPT,
        userPrompt: prompt,
        temperature,
        maxTokens: 4000,
      });

      // Parse JSON response
      const result = this.getClient().parseJSON<VehicleAIResult>(response.content);

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

// Export singleton instance
export const vehicleAIService = new VehicleAIService();
