/**
 * AI Description Generator Service
 * Uses GLM-4.6 (via z.ai) to generate comprehensive vehicle descriptions
 * Bilingual support: Indonesian (primary) and English
 *
 * Epic 2: AI-Powered Vehicle Upload
 * Story 2.4: Comprehensive AI Description Generation
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
    new transports.File({ filename: 'logs/ai-description-generator.log' })
  ]
});

export interface VehicleDescription {
  // Indonesian content (primary)
  descriptionId: string; // Full multi-paragraph description in Indonesian
  featuresId: string[]; // List of features in Indonesian

  // English content (for international buyers)
  descriptionEn: string; // Full multi-paragraph description in English
  featuresEn: string[]; // List of features in English

  // Structured data
  highlights: string[]; // Key selling points (Indonesian)
  specifications: {
    engine?: string;
    transmission?: string;
    fuelType?: string;
    seats?: number;
    drivetrain?: string;
    fuelConsumption?: string;
  };

  // Description metadata
  tone: 'professional' | 'casual' | 'promotional';
  wordCount: number;
}

export interface DescriptionOptions {
  vehicle: VehicleIdentification;
  photoUrls: string[];
  tone?: 'professional' | 'casual' | 'promotional';
  emphasis?: 'features' | 'performance' | 'family' | 'luxury' | 'value';
  includeEnglish?: boolean;
}

export class DescriptionGeneratorService {
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

    logger.info('Description Generator Service initialized', {
      model: this.model,
      baseURL: process.env.ZAI_BASE_URL || 'https://api.z.ai/api/paas/v4/'
    });
  }

  /**
   * Generate comprehensive vehicle description
   */
  async generateDescription(options: DescriptionOptions): Promise<VehicleDescription> {
    try {
      logger.info('Starting description generation', {
        vehicle: `${options.vehicle.make} ${options.vehicle.model}`,
        tone: options.tone || 'professional'
      });

      // Generate Indonesian description (primary)
      const indonesianContent = await this.generateIndonesianDescription(options);

      // Generate English description if requested
      let englishContent: { description: string; features: string[] } | null = null;
      if (options.includeEnglish !== false) {
        englishContent = await this.generateEnglishDescription(options);
      }

      // Extract structured specifications
      const specifications = this.extractSpecifications(options.vehicle);

      const description: VehicleDescription = {
        descriptionId: indonesianContent.description,
        featuresId: indonesianContent.features,
        descriptionEn: englishContent?.description || '',
        featuresEn: englishContent?.features || [],
        highlights: indonesianContent.highlights,
        specifications,
        tone: options.tone || 'professional',
        wordCount: indonesianContent.description.split(/\s+/).length
      };

      logger.info('Description generated successfully', {
        wordCount: description.wordCount,
        featuresCount: description.featuresId.length
      });

      return description;
    } catch (error) {
      logger.error('Description generation error:', error);
      throw new Error(`AI description generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate Indonesian description
   */
  private async generateIndonesianDescription(
    options: DescriptionOptions
  ): Promise<{ description: string; features: string[]; highlights: string[] }> {
    const { vehicle, tone = 'professional', emphasis = 'features' } = options;

    const systemPrompt = `Kamu adalah seorang penulis konten otomotif profesional yang ahli dalam menulis deskripsi kendaraan untuk showroom di Indonesia.

Gaya penulisan kamu:
- ${tone === 'professional' ? 'Profesional dan informatif' : tone === 'casual' ? 'Ramah dan conversational' : 'Persuasif dan menarik'}
- Fokus pada ${emphasis === 'features' ? 'fitur dan teknologi' : emphasis === 'performance' ? 'performa dan handling' : emphasis === 'family' ? 'kenyamanan keluarga' : emphasis === 'luxury' ? 'kemewahan dan prestise' : 'value for money'}
- Menggunakan bahasa Indonesia yang baik dan menarik
- Menyoroti keunggulan kendaraan untuk pasar Indonesia

Buatlah deskripsi kendaraan yang:
1. Menarik perhatian calon pembeli
2. Menjelaskan fitur-fitur utama
3. Cocok untuk target pasar Indonesia
4. Menonjolkan keunggulan kompetitif

Format respons dalam JSON:
{
  "description": "Deskripsi lengkap 3-4 paragraf",
  "features": ["Fitur 1", "Fitur 2", ...],
  "highlights": ["Poin menarik 1", "Poin menarik 2", ...]
}`;

    const userPrompt = `Buatlah deskripsi untuk kendaraan berikut:

**Merek:** ${vehicle.make}
**Model:** ${vehicle.model}
**Tahun:** ${vehicle.year}
${vehicle.variant ? `**Varian:** ${vehicle.variant}` : ''}
${vehicle.transmissionType ? `**Transmisi:** ${vehicle.transmissionType}` : ''}
${vehicle.fuelType ? `**Bahan Bakar:** ${vehicle.fuelType}` : ''}
${vehicle.color ? `**Warna:** ${vehicle.color}` : ''}
${vehicle.condition ? `**Kondisi:** ${vehicle.condition}` : ''}
${vehicle.visibleFeatures.length > 0 ? `**Fitur Terlihat:** ${vehicle.visibleFeatures.join(', ')}` : ''}

Buat deskripsi yang menarik dan informatif untuk mobil ini.`;

    const response = await this.openai.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 4096
    });

    const rawResponse = response.choices[0]?.message?.content || '{}';
    const parsed = this.parseDescriptionResponse(rawResponse);

    return parsed;
  }

  /**
   * Generate English description
   */
  private async generateEnglishDescription(
    options: DescriptionOptions
  ): Promise<{ description: string; features: string[] }> {
    const { vehicle, tone = 'professional' } = options;

    const systemPrompt = `You are a professional automotive content writer specializing in vehicle descriptions for international buyers.

Your writing style:
- ${tone === 'professional' ? 'Professional and informative' : tone === 'casual' ? 'Friendly and conversational' : 'Persuasive and engaging'}
- Clear and concise English
- Highlights key features and benefits
- Appeals to international car buyers

Create a vehicle description in English with:
1. Engaging introduction
2. Key features and specifications
3. Selling points and benefits

Format response as JSON:
{
  "description": "Full 2-3 paragraph description",
  "features": ["Feature 1", "Feature 2", ...]
}`;

    const userPrompt = `Create an English description for this vehicle:

**Make:** ${vehicle.make}
**Model:** ${vehicle.model}
**Year:** ${vehicle.year}
${vehicle.variant ? `**Variant:** ${vehicle.variant}` : ''}
${vehicle.transmissionType ? `**Transmission:** ${vehicle.transmissionType}` : ''}
${vehicle.fuelType ? `**Fuel Type:** ${vehicle.fuelType}` : ''}
${vehicle.color ? `**Color:** ${vehicle.color}` : ''}
${vehicle.condition ? `**Condition:** ${vehicle.condition}` : ''}

Create an appealing and informative description.`;

    const response = await this.openai.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 4096
    });

    const rawResponse = response.choices[0]?.message?.content || '{}';
    const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No valid JSON in English description response');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return {
      description: parsed.description || '',
      features: Array.isArray(parsed.features) ? parsed.features : []
    };
  }

  /**
   * Parse description response
   */
  private parseDescriptionResponse(rawResponse: string): {
    description: string;
    features: string[];
    highlights: string[];
  } {
    try {
      const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No valid JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      return {
        description: parsed.description || 'Deskripsi tidak tersedia.',
        features: Array.isArray(parsed.features) ? parsed.features : [],
        highlights: Array.isArray(parsed.highlights) ? parsed.highlights : []
      };
    } catch (error) {
      logger.error('Failed to parse description response:', error);

      // Fallback
      return {
        description: 'Kendaraan berkualitas dengan berbagai fitur menarik.',
        features: [],
        highlights: []
      };
    }
  }

  /**
   * Extract structured specifications
   */
  private extractSpecifications(vehicle: VehicleIdentification): VehicleDescription['specifications'] {
    return {
      engine: vehicle.variant || undefined,
      transmission: vehicle.transmissionType || undefined,
      fuelType: vehicle.fuelType || undefined,
      seats: undefined, // Would need to be identified or provided
      drivetrain: undefined,
      fuelConsumption: undefined
    };
  }

  /**
   * Regenerate description with different tone
   */
  async regenerateWithTone(
    originalOptions: DescriptionOptions,
    newTone: 'professional' | 'casual' | 'promotional'
  ): Promise<VehicleDescription> {
    logger.info('Regenerating description with new tone', { newTone });

    return this.generateDescription({
      ...originalOptions,
      tone: newTone
    });
  }

  /**
   * Enhance description with additional details
   */
  async enhanceDescription(
    vehicle: VehicleIdentification,
    currentDescription: string,
    additionalDetails: string
  ): Promise<string> {
    logger.info('Enhancing description with additional details');

    const response = await this.openai.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content: 'Kamu adalah editor konten otomotif. Tingkatkan deskripsi kendaraan dengan menambahkan detail tambahan secara natural.'
        },
        {
          role: 'user',
          content: `Deskripsi saat ini:\n${currentDescription}\n\nDetail tambahan yang perlu ditambahkan:\n${additionalDetails}\n\nBuatlah deskripsi yang lebih lengkap dengan menggabungkan informasi tambahan tersebut.`
        }
      ],
      temperature: 0.7,
      max_tokens: 4096
    });

    return response.choices[0]?.message?.content || currentDescription;
  }

  /**
   * Check if service is configured
   */
  isConfigured(): boolean {
    return !!process.env.ZAI_API_KEY;
  }
}

// Singleton instance
export const descriptionGeneratorService = new DescriptionGeneratorService();
