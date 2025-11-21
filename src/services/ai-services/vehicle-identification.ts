/**
 * AI Vehicle Identification Service
 * Uses GLM-4.5V (via z.ai) with vision to identify vehicle make, model, year, and variant from photos
 *
 * Epic 2: AI-Powered Vehicle Upload
 * Story 2.3: AI Vehicle Identification
 */

import OpenAI from 'openai';
import { createLogger, format, transports } from 'winston';

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
    new transports.File({ filename: 'logs/ai-vehicle-identification.log' })
  ]
});

export interface VehicleIdentification {
  make: string;
  model: string;
  year: number;
  variant?: string;

  // Identification confidence
  confidence: number; // 0-100
  reasoning: string;

  // Additional details identified from photos
  transmissionType?: 'manual' | 'automatic' | 'cvt';
  fuelType?: 'bensin' | 'diesel' | 'hybrid' | 'electric';
  color?: string;
  condition?: 'excellent' | 'good' | 'fair' | 'poor';

  // Visible features
  visibleFeatures: string[];
  bodyType?: string; // sedan, suv, mpv, hatchback, etc.
}

export class VehicleIdentificationService {
  private readonly openai: OpenAI;
  private readonly model: string;

  constructor() {
    // Using OpenAI SDK in compatibility mode with z.ai
    this.openai = new OpenAI({
      apiKey: process.env.ZAI_API_KEY || '',
      baseURL: process.env.ZAI_BASE_URL || 'https://api.z.ai/api/paas/v4/',
      timeout: parseInt(process.env.API_TIMEOUT_MS || '300000')
    });

    // GLM-4.5V for vision tasks
    this.model = process.env.ZAI_VISION_MODEL || 'glm-4.5v';

    if (!process.env.ZAI_API_KEY) {
      logger.warn('Z.AI API key not configured');
    }

    logger.info('Vehicle Identification Service initialized', {
      model: this.model,
      baseURL: process.env.ZAI_BASE_URL || 'https://api.z.ai/api/paas/v4/'
    });
  }

  /**
   * Identify vehicle from photo URLs
   */
  async identifyFromPhotos(photoUrls: string[]): Promise<VehicleIdentification> {
    try {
      logger.info('Starting vehicle identification', {
        photoCount: photoUrls.length
      });

      if (photoUrls.length === 0) {
        throw new Error('At least one photo is required for vehicle identification');
      }

      // Prepare system prompt with Indonesian automotive context
      const systemPrompt = this.buildSystemPrompt();

      // Prepare user message with photos (OpenAI format)
      const userContent = this.buildUserMessage(photoUrls);

      // Call z.ai GLM-4.5V via OpenAI SDK compatibility
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: userContent
          }
        ],
        max_tokens: 4096,
        temperature: 0.3 // Lower temperature for more consistent identification
      });

      const rawResponse = response.choices[0]?.message?.content || '{}';
      logger.info('Received AI response', {
        tokensUsed: response.usage?.total_tokens
      });

      // Parse JSON response
      const identification = this.parseResponse(rawResponse);

      logger.info('Vehicle identified successfully', {
        make: identification.make,
        model: identification.model,
        year: identification.year,
        confidence: identification.confidence
      });

      return identification;
    } catch (error) {
      logger.error('Vehicle identification error:', error);
      throw new Error(`AI vehicle identification failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Build system prompt with Indonesian automotive expertise
   */
  private buildSystemPrompt(): string {
    return `You are an expert automotive identifier specializing in the Indonesian vehicle market.

Your expertise includes:
- Popular brands in Indonesia: Toyota (Avanza, Innova, Fortuner, etc.), Honda (Brio, Mobilio, CR-V, etc.), Mitsubishi (Xpander, Pajero Sport), Suzuki (Ertiga, XL7), Daihatsu (Terios, Xenia), Nissan, Mazda
- Indonesian vehicle variants and trim levels
- Local automotive terminology in Bahasa Indonesia

Analyze the provided vehicle photos and identify:
1. **Make (Manufacturer)** - e.g., Toyota, Honda, Mitsubishi
2. **Model** - e.g., Avanza, CR-V, Xpander
3. **Year** - Estimate based on design, features, and styling cues
4. **Variant/Trim** - e.g., "G 1.5 MT", "E CVT", "Prestige"
5. **Transmission Type** - manual, automatic, or CVT (if visible)
6. **Fuel Type** - bensin (gasoline), diesel, hybrid, electric
7. **Color** - Primary exterior color
8. **Condition** - excellent, good, fair, poor (based on visible condition)
9. **Visible Features** - List notable features visible in photos
10. **Body Type** - sedan, suv, mpv, hatchback, pickup, etc.
11. **Confidence Score** - How confident are you in this identification (0-100)
12. **Reasoning** - Explain key visual cues that led to your identification

IMPORTANT:
- Use specific Indonesian automotive terminology when applicable
- If you're unsure about certain details, indicate lower confidence
- Focus on visual cues: grille design, headlight shape, body style, badges, wheels
- Indonesian vehicles often have market-specific badges and variants

Return your response as a JSON object with this exact structure:
{
  "make": "string",
  "model": "string",
  "year": number,
  "variant": "string or null",
  "transmissionType": "manual | automatic | cvt | null",
  "fuelType": "bensin | diesel | hybrid | electric | null",
  "color": "string or null",
  "condition": "excellent | good | fair | poor | null",
  "visibleFeatures": ["feature1", "feature2"],
  "bodyType": "sedan | suv | mpv | hatchback | pickup | null",
  "confidence": number (0-100),
  "reasoning": "string explaining your identification based on visual cues"
}`;
  }

  /**
   * Build user message with photos (OpenAI format compatible with z.ai)
   */
  private buildUserMessage(photoUrls: string[]): any[] {
    const content: any[] = [
      {
        type: 'text',
        text: 'Please identify this vehicle from the photos. Analyze all available photos to determine make, model, year, variant, and other details. Provide your response in JSON format as specified.'
      }
    ];

    // Add all photo URLs (OpenAI format)
    photoUrls.forEach((url) => {
      content.push({
        type: 'image_url',
        image_url: {
          url: url,
          detail: 'high'
        }
      });
    });

    return content;
  }

  /**
   * Parse AI response into structured identification
   */
  private parseResponse(rawResponse: string): VehicleIdentification {
    try {
      // Extract JSON from response (handle cases where AI adds extra text)
      const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No valid JSON found in AI response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Validate and normalize
      return {
        make: parsed.make || 'Unknown',
        model: parsed.model || 'Unknown',
        year: parsed.year || new Date().getFullYear(),
        variant: parsed.variant || undefined,
        transmissionType: parsed.transmissionType || undefined,
        fuelType: parsed.fuelType || undefined,
        color: parsed.color || undefined,
        condition: parsed.condition || undefined,
        visibleFeatures: Array.isArray(parsed.visibleFeatures) ? parsed.visibleFeatures : [],
        bodyType: parsed.bodyType || undefined,
        confidence: typeof parsed.confidence === 'number' ? Math.min(100, Math.max(0, parsed.confidence)) : 50,
        reasoning: parsed.reasoning || 'Identified based on visual analysis'
      };
    } catch (error) {
      logger.error('Failed to parse AI response:', error);
      logger.error('Raw response:', rawResponse);

      // Return fallback identification with low confidence
      return {
        make: 'Unknown',
        model: 'Unknown',
        year: new Date().getFullYear(),
        visibleFeatures: [],
        confidence: 0,
        reasoning: 'Failed to parse AI response'
      };
    }
  }

  /**
   * Identify vehicle with retry logic
   */
  async identifyWithRetry(
    photoUrls: string[],
    maxRetries: number = 2
  ): Promise<VehicleIdentification> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          logger.info(`Retry attempt ${attempt} for vehicle identification`);
        }

        const result = await this.identifyFromPhotos(photoUrls);

        // If confidence is very low, consider retry
        if (result.confidence < 30 && attempt < maxRetries) {
          logger.warn(`Low confidence result (${result.confidence}%), retrying...`);
          continue;
        }

        return result;
      } catch (error) {
        lastError = error as Error;
        logger.warn(`Identification attempt ${attempt + 1} failed:`, error);

        if (attempt < maxRetries) {
          // Wait before retry (exponential backoff)
          await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      }
    }

    throw lastError || new Error('Vehicle identification failed after retries');
  }

  /**
   * Check if service is configured and ready
   */
  isConfigured(): boolean {
    return !!process.env.ZAI_API_KEY;
  }
}

// Singleton instance
export const vehicleIdentificationService = new VehicleIdentificationService();
