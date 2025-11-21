/**
 * Pricing Intelligence Service
 * Uses GLM-4.6 (via z.ai) and market analysis to suggest competitive pricing for vehicles
 *
 * Epic 2: AI-Powered Vehicle Upload
 * Story 2.5: Intelligent Pricing Suggestions
 */

import OpenAI from 'openai';
import { createLogger, format, transports } from 'winston';
import { VehicleIdentification } from './vehicle-identification';

const logger = createLogger({
  format: format.combine(
    format.timestamp(),
    format.errors({ stack: true }),
    format.json()
  ),
  transports: [
    new transports.Console({
      format: format.combine(format.colorize(), format.simple())
    }),
    new transports.File({ filename: 'logs/ai-pricing-intelligence.log' })
  ]
});

export interface PriceRange {
  min: number; // IDR cents
  max: number; // IDR cents
  recommended: number; // IDR cents
}

export interface ComparableVehicle {
  make: string;
  model: string;
  year: number;
  variant?: string;
  price: number; // IDR cents
  mileage?: number;
  condition?: string;
  source: string; // 'internal' | 'market_data' | 'estimated'
}

export interface PricingAnalysis {
  // Suggested pricing
  priceRange: PriceRange;
  confidence: number; // 0-100

  // Market analysis
  marketAverage: number; // IDR cents
  comparableVehicles: ComparableVehicle[];

  // Pricing factors
  factors: {
    yearDepreciation: number; // Percentage
    conditionAdjustment: number; // Percentage
    demandLevel: 'low' | 'medium' | 'high';
    marketTrend: 'declining' | 'stable' | 'rising';
  };

  // Recommendations
  recommendations: string[];
  reasoning: string;

  // Competitive positioning
  positioning: 'budget' | 'competitive' | 'premium';
}

export interface PricingOptions {
  vehicle: VehicleIdentification;
  mileage?: number; // Kilometers
  condition?: 'excellent' | 'good' | 'fair' | 'poor';
  desiredPositioning?: 'budget' | 'competitive' | 'premium';
}

export class PricingIntelligenceService {
  private readonly openai: OpenAI;
  private readonly model: string;

  constructor() {
    // Using OpenAI SDK in compatibility mode with z.ai
    this.openai = new OpenAI({
      apiKey: process.env.ZAI_API_KEY || '',
      baseURL: process.env.ZAI_BASE_URL || 'https://api.z.ai/api/paas/v4/',
      timeout: parseInt(process.env.API_TIMEOUT_MS || '300000')
    });

    // GLM-4.6 for text generation tasks
    this.model = process.env.ZAI_TEXT_MODEL || 'glm-4.6';

    logger.info('Pricing Intelligence Service initialized', {
      model: this.model,
      baseURL: process.env.ZAI_BASE_URL || 'https://api.z.ai/api/paas/v4/'
    });
  }

  /**
   * Generate pricing suggestions
   */
  async analyzePricing(options: PricingOptions): Promise<PricingAnalysis> {
    try {
      logger.info('Starting pricing analysis', {
        vehicle: `${options.vehicle.make} ${options.vehicle.model} ${options.vehicle.year}`
      });

      // Get AI-powered market analysis
      const aiAnalysis = await this.getAIMarketAnalysis(options);

      // Calculate depreciation-based pricing
      const depreciationPrice = this.calculateDepreciationPrice(options);

      // Combine AI and depreciation for final recommendation
      const priceRange = this.calculatePriceRange(aiAnalysis, depreciationPrice, options);

      // Generate comparable vehicles (mix of AI suggestions and database)
      const comparables = await this.findComparableVehicles(options);

      // Determine market factors
      const factors = this.analyzeMarketFactors(options, aiAnalysis);

      // Generate recommendations
      const recommendations = this.generateRecommendations(priceRange, factors, options);

      const analysis: PricingAnalysis = {
        priceRange,
        confidence: aiAnalysis.confidence,
        marketAverage: aiAnalysis.marketAverage,
        comparableVehicles: comparables,
        factors,
        recommendations,
        reasoning: aiAnalysis.reasoning,
        positioning: options.desiredPositioning || 'competitive'
      };

      logger.info('Pricing analysis complete', {
        recommended: this.formatIDR(analysis.priceRange.recommended),
        confidence: analysis.confidence
      });

      return analysis;
    } catch (error) {
      logger.error('Pricing analysis error:', error);
      throw new Error(`Pricing intelligence failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get AI-powered market analysis
   */
  private async getAIMarketAnalysis(options: PricingOptions): Promise<{
    marketAverage: number;
    confidence: number;
    reasoning: string;
    suggestedMin: number;
    suggestedMax: number;
  }> {
    const { vehicle, mileage, condition } = options;

    const systemPrompt = `Kamu adalah seorang analis pasar otomotif Indonesia yang ahli dalam pricing kendaraan bekas dan baru.

Keahlian kamu:
- Memahami pasar otomotif Indonesia (harga, demand, trend)
- Mengetahui brand populer dan model terlaris di Indonesia
- Memahami faktor-faktor yang mempengaruhi harga: tahun, kilometer, kondisi, varian
- Mengetahui tren harga kendaraan di Indonesia

Berikan analisis pricing untuk kendaraan yang diminta dalam format JSON:
{
  "marketAverage": number (dalam rupiah),
  "suggestedMin": number (dalam rupiah),
  "suggestedMax": number (dalam rupiah),
  "confidence": number (0-100),
  "reasoning": "string menjelaskan bagaimana kamu menentukan harga ini",
  "demandLevel": "low | medium | high",
  "marketTrend": "declining | stable | rising"
}

PENTING:
- Berikan harga dalam RUPIAH (bukan cents)
- Pertimbangkan kondisi pasar Indonesia
- Pertimbangkan depresiasi tahunan (sekitar 10-15% per tahun)
- Brand populer seperti Toyota, Honda cenderung lebih stabil harganya
- Pertimbangkan kilometer (semakin tinggi, semakin murah)
- Pertimbangkan kondisi kendaraan`;

    const userPrompt = `Berikan analisis pricing untuk kendaraan berikut:

**Merek:** ${vehicle.make}
**Model:** ${vehicle.model}
**Tahun:** ${vehicle.year}
${vehicle.variant ? `**Varian:** ${vehicle.variant}` : ''}
${mileage ? `**Kilometer:** ${mileage.toLocaleString()} km` : ''}
${condition ? `**Kondisi:** ${condition}` : ''}
${vehicle.transmissionType ? `**Transmisi:** ${vehicle.transmissionType}` : ''}

Berikan rekomendasi harga yang kompetitif untuk pasar Indonesia.`;

    const response = await this.openai.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.4, // Lower temperature for more consistent pricing
      max_tokens: 4096
    });

    const rawResponse = response.choices[0]?.message?.content || '{}';
    const parsed = this.parsePricingResponse(rawResponse);

    return {
      marketAverage: parsed.marketAverage * 100, // Convert to cents
      confidence: parsed.confidence,
      reasoning: parsed.reasoning,
      suggestedMin: parsed.suggestedMin * 100, // Convert to cents
      suggestedMax: parsed.suggestedMax * 100 // Convert to cents
    };
  }

  /**
   * Calculate price based on depreciation model
   */
  private calculateDepreciationPrice(options: PricingOptions): number {
    const { vehicle, mileage, condition } = options;

    // Base prices for common Indonesian vehicles (in IDR cents)
    // This is a simplified model - in production, use database of historical prices
    const basePrices: Record<string, number> = {
      'Toyota Avanza': 25000000000, // Rp 250 juta
      'Toyota Innova': 35000000000, // Rp 350 juta
      'Honda Brio': 15000000000, // Rp 150 juta
      'Honda CR-V': 45000000000, // Rp 450 juta
      'Mitsubishi Xpander': 24000000000, // Rp 240 juta
      'Suzuki Ertiga': 20000000000 // Rp 200 juta
    };

    const vehicleKey = `${vehicle.make} ${vehicle.model}`;
    let basePrice = basePrices[vehicleKey] || 20000000000; // Default Rp 200 juta

    // Apply year depreciation (10% per year)
    const currentYear = new Date().getFullYear();
    const yearsOld = currentYear - vehicle.year;
    const depreciationRate = 0.10;
    const yearlyDepreciation = Math.pow(1 - depreciationRate, yearsOld);
    let price = basePrice * yearlyDepreciation;

    // Apply mileage adjustment
    if (mileage) {
      if (mileage > 150000) {
        // > 150k km
        price *= 0.85;
      } else if (mileage > 100000) {
        // > 100k km
        price *= 0.90;
      } else if (mileage > 50000) {
        // > 50k km
        price *= 0.95;
      }
    }

    // Apply condition adjustment
    if (condition) {
      const conditionMultipliers = {
        excellent: 1.1,
        good: 1.0,
        fair: 0.9,
        poor: 0.75
      };
      price *= conditionMultipliers[condition];
    }

    return Math.round(price);
  }

  /**
   * Calculate final price range
   */
  private calculatePriceRange(
    aiAnalysis: { suggestedMin: number; suggestedMax: number; marketAverage: number },
    depreciationPrice: number,
    options: PricingOptions
  ): PriceRange {
    // Use AI suggestions as primary guidance
    let min = aiAnalysis.suggestedMin;
    let max = aiAnalysis.suggestedMax;
    let recommended = aiAnalysis.marketAverage;

    // Blend with depreciation model (70% AI, 30% depreciation)
    recommended = Math.round(recommended * 0.7 + depreciationPrice * 0.3);

    // Adjust based on desired positioning
    if (options.desiredPositioning === 'premium') {
      recommended = Math.round(recommended * 1.1);
      min = recommended;
      max = Math.round(recommended * 1.15);
    } else if (options.desiredPositioning === 'budget') {
      recommended = Math.round(recommended * 0.9);
      min = Math.round(recommended * 0.85);
      max = recommended;
    } else {
      // competitive
      min = Math.round(recommended * 0.95);
      max = Math.round(recommended * 1.05);
    }

    return { min, max, recommended };
  }

  /**
   * Find comparable vehicles
   */
  private async findComparableVehicles(options: PricingOptions): Promise<ComparableVehicle[]> {
    // In production, query database for similar vehicles
    // For now, return AI-estimated comparables
    const { vehicle } = options;

    return [
      {
        make: vehicle.make,
        model: vehicle.model,
        year: vehicle.year,
        variant: vehicle.variant,
        price: 0, // Would be populated from database
        source: 'estimated'
      }
    ];
  }

  /**
   * Analyze market factors
   */
  private analyzeMarketFactors(
    options: PricingOptions,
    aiAnalysis: any
  ): PricingAnalysis['factors'] {
    const { vehicle, mileage, condition } = options;

    const currentYear = new Date().getFullYear();
    const yearsOld = currentYear - vehicle.year;
    const yearDepreciation = Math.round(yearsOld * 10); // 10% per year

    const conditionAdjustments = {
      excellent: 10,
      good: 0,
      fair: -10,
      poor: -25
    };
    const conditionAdjustment = condition ? conditionAdjustments[condition] : 0;

    return {
      yearDepreciation,
      conditionAdjustment,
      demandLevel: aiAnalysis.demandLevel || 'medium',
      marketTrend: aiAnalysis.marketTrend || 'stable'
    };
  }

  /**
   * Generate pricing recommendations
   */
  private generateRecommendations(
    priceRange: PriceRange,
    factors: PricingAnalysis['factors'],
    options: PricingOptions
  ): string[] {
    const recommendations: string[] = [];

    // Price positioning recommendation
    recommendations.push(
      `Harga rekomendasi: ${this.formatIDR(priceRange.recommended)} (range: ${this.formatIDR(priceRange.min)} - ${this.formatIDR(priceRange.max)})`
    );

    // Market trend recommendation
    if (factors.marketTrend === 'rising') {
      recommendations.push('Tren pasar sedang naik - pertimbangkan harga di range atas');
    } else if (factors.marketTrend === 'declining') {
      recommendations.push('Tren pasar sedang turun - harga kompetitif akan lebih cepat terjual');
    }

    // Demand recommendation
    if (factors.demandLevel === 'high') {
      recommendations.push('Demand tinggi untuk model ini - Anda bisa set harga lebih tinggi');
    } else if (factors.demandLevel === 'low') {
      recommendations.push('Demand rendah - pertimbangkan harga lebih kompetitif');
    }

    // Condition recommendation
    if (options.condition === 'excellent') {
      recommendations.push('Kondisi excellent - tonjolkan ini untuk justify harga premium');
    } else if (options.condition === 'poor') {
      recommendations.push('Kondisi perlu perbaikan - harga lebih rendah akan menarik pembeli');
    }

    return recommendations;
  }

  /**
   * Parse AI pricing response
   */
  private parsePricingResponse(rawResponse: string): {
    marketAverage: number;
    suggestedMin: number;
    suggestedMax: number;
    confidence: number;
    reasoning: string;
    demandLevel?: string;
    marketTrend?: string;
  } {
    try {
      const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No valid JSON in pricing response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      return {
        marketAverage: parsed.marketAverage || 200000000, // Rp 200 juta default
        suggestedMin: parsed.suggestedMin || 180000000,
        suggestedMax: parsed.suggestedMax || 220000000,
        confidence: parsed.confidence || 50,
        reasoning: parsed.reasoning || 'Estimasi berdasarkan pasar umum',
        demandLevel: parsed.demandLevel,
        marketTrend: parsed.marketTrend
      };
    } catch (error) {
      logger.error('Failed to parse pricing response:', error);

      // Fallback
      return {
        marketAverage: 200000000,
        suggestedMin: 180000000,
        suggestedMax: 220000000,
        confidence: 30,
        reasoning: 'Estimasi fallback - data pasar tidak tersedia'
      };
    }
  }

  /**
   * Format IDR currency
   */
  private formatIDR(cents: number): string {
    const rupiah = Math.round(cents / 100);
    return `Rp ${rupiah.toLocaleString('id-ID')}`;
  }

  /**
   * Check if service is configured
   */
  isConfigured(): boolean {
    return !!process.env.ZAI_API_KEY;
  }
}

// Singleton instance
export const pricingIntelligenceService = new PricingIntelligenceService();
