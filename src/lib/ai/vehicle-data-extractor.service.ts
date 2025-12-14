/**
 * AI Vehicle Data Extractor Service
 *
 * Menggunakan Z.AI GLM-4.6 untuk extract vehicle data dari natural language
 * Mendukung berbagai format Bahasa Indonesia untuk automotive terms
 *
 * Example inputs:
 * - "Toyota Avanza tahun 2020 harga 150 juta km 50 ribu warna hitam transmisi manual"
 * - "Avanza 2020 hitam matic 150jt km 50rb"
 * - "Honda Brio 2021, 140 juta, kilometer 30000, silver, automatic"
 */

import { createZAIClient } from './zai-client';

// ==================== TYPES ====================

export interface VehicleDataExtractionResult {
  success: boolean;
  data?: {
    make: string;          // Toyota, Honda, Suzuki, etc.
    model: string;         // Avanza, Brio, Ertiga, etc.
    year: number;          // 2020, 2021, etc.
    price: number;         // In IDR (150000000 for 150 juta)
    mileage?: number;      // In kilometers
    color?: string;        // Hitam, Putih, Silver, etc.
    transmission?: string; // Manual, Automatic, CVT
  };
  confidence: number;      // 0-1 confidence score
  reasoning?: string;      // AI reasoning for extraction
  error?: string;
}

// ==================== SYSTEM PROMPT ====================

const VEHICLE_EXTRACTION_SYSTEM_PROMPT = `You are a JSON extraction API. You MUST respond with ONLY valid JSON, no other text.

TASK:
Extract vehicle data from Indonesian text and return ONLY a JSON object:

FIELDS YANG HARUS DI-EXTRACT:
1. make (required): Brand/merk mobil (Toyota, Honda, Suzuki, Daihatsu, Mitsubishi, Nissan, Mazda, dll)
2. model (required): Model mobil (Avanza, Xenia, Brio, Jazz, Ertiga, Terios, Rush, Innova, Fortuner, dll)
3. year (required): Tahun produksi (1980-2026)
4. price (required): Harga dalam IDR (angka penuh, bukan juta)
5. mileage (optional): Kilometer (angka dalam satuan km)
6. color (optional): Warna (Hitam, Putih, Silver, Merah, Biru, Abu-abu, dll)
7. transmission (optional): Transmisi (Manual, Automatic, CVT)

RULES UNTUK NORMALISASI DATA:

1. PRICE NORMALIZATION:
   - "150 juta" → 150000000
   - "150jt" → 150000000
   - "1.5M" → 1500000
   - "250rb" → 250000
   - Selalu return angka penuh dalam IDR

2. MILEAGE NORMALIZATION:
   - "50 ribu" → 50000
   - "50rb" → 50000
   - "50k" → 50000
   - "100 ribu km" → 100000
   - Selalu return angka dalam satuan km

3. TRANSMISSION NORMALIZATION:
   - "matic" → "Automatic"
   - "AT" → "Automatic"
   - "automatic" → "Automatic"
   - "manual" → "Manual"
   - "MT" → "Manual"
   - "CVT" → "CVT"

4. BRAND/MAKE CAPITALIZATION:
   - "toyota" → "Toyota"
   - "honda" → "Honda"
   - Selalu kapitalisasi proper (title case)

5. COLOR CAPITALIZATION:
   - "hitam" → "Hitam"
   - "putih" → "Putih"
   - Selalu kapitalisasi proper (title case)

6. YEAR VALIDATION:
   - Harus antara 1980-2026
   - Jika di luar range, return null

CRITICAL RULES - MUST FOLLOW:
1. Response must be ONLY valid JSON
2. NO markdown (no ```)
3. NO explanations
4. NO additional text before or after JSON
5. Start response with { and end with }

RESPONSE FORMAT (copy exactly):
{"make":"Toyota","model":"Avanza","year":2020,"price":150000000,"mileage":50000,"color":"Hitam","transmission":"Manual"}

EXAMPLES - YOUR RESPONSE MUST LOOK EXACTLY LIKE THIS:

Input: "Toyota Avanza tahun 2020 harga 150 juta km 50 ribu warna hitam transmisi manual"
Your response: {"make":"Toyota","model":"Avanza","year":2020,"price":150000000,"mileage":50000,"color":"Hitam","transmission":"Manual"}

Input: "Avanza 2020 hitam matic 150jt km 50rb"
Your response: {"make":"Toyota","model":"Avanza","year":2020,"price":150000000,"mileage":50000,"color":"Hitam","transmission":"Automatic"}

Input: "Honda Brio 2021, 140 juta, kilometer 30000, silver, automatic"
Your response: {"make":"Honda","model":"Brio","year":2021,"price":140000000,"mileage":30000,"color":"Silver","transmission":"Automatic"}

If data incomplete:
- Required missing: {"error":"Cannot extract vehicle data"}
- Optional missing: Use null for mileage/color/transmission

REMEMBER: Your response must START with { and END with } - absolutely nothing else!`;

// ==================== SERVICE ====================

export class VehicleDataExtractorService {
  /**
   * Extract vehicle data dari natural language text
   */
  static async extractFromNaturalLanguage(
    text: string
  ): Promise<VehicleDataExtractionResult> {
    console.log(`[Vehicle Data Extractor] Extracting from text: "${text}"`);

    try {
      // Create ZAI client
      const zaiClient = createZAIClient();

      if (!zaiClient) {
        console.error('[Vehicle Data Extractor] ZAI client not configured');
        return {
          success: false,
          confidence: 0,
          error: 'AI service not configured. Please set ZAI_API_KEY and ZAI_BASE_URL.',
        };
      }

      // Call AI untuk extraction
      console.log('[Vehicle Data Extractor] Calling AI for data extraction...');
      const aiResponse = await zaiClient.generateText({
        systemPrompt: VEHICLE_EXTRACTION_SYSTEM_PROMPT,
        userPrompt: `Extract vehicle data dari text berikut:\n\n${text}`,
        temperature: 0.1, // Low temperature untuk consistency
        maxTokens: 500,   // Short response expected
      });

      console.log('[Vehicle Data Extractor] ===== AI RESPONSE DEBUG =====');
      console.log('[Vehicle Data Extractor] Content length:', aiResponse.content.length);
      console.log('[Vehicle Data Extractor] Content type:', typeof aiResponse.content);
      console.log('[Vehicle Data Extractor] Content (first 200 chars):', aiResponse.content.substring(0, 200));
      console.log('[Vehicle Data Extractor] Full content:', aiResponse.content);
      console.log('[Vehicle Data Extractor] Reasoning:', aiResponse.reasoning);
      console.log('[Vehicle Data Extractor] ================================');

      // Parse JSON response
      let extractedData: any;
      try {
        extractedData = zaiClient.parseJSON(aiResponse.content);
        console.log('[Vehicle Data Extractor] ✅ JSON parsed successfully:', extractedData);
      } catch (parseError: any) {
        console.error('[Vehicle Data Extractor] ❌ Failed to parse AI response as JSON');
        console.error('[Vehicle Data Extractor] Parse error name:', parseError.name);
        console.error('[Vehicle Data Extractor] Parse error message:', parseError.message);
        console.error('[Vehicle Data Extractor] Parse error stack:', parseError.stack);
        console.error('[Vehicle Data Extractor] Raw content length:', aiResponse.content.length);
        console.error('[Vehicle Data Extractor] Raw content (full):', JSON.stringify(aiResponse.content));

        // Try to extract JSON from text if AI added extra explanation
        const jsonMatch = aiResponse.content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          console.log('[Vehicle Data Extractor] Found JSON pattern in response, trying to extract...');
          try {
            extractedData = JSON.parse(jsonMatch[0]);
            console.log('[Vehicle Data Extractor] ✅ Successfully extracted JSON from text:', extractedData);
          } catch (extractError) {
            console.error('[Vehicle Data Extractor] ❌ Failed to extract JSON pattern:', extractError);
            return {
              success: false,
              confidence: 0,
              error: 'AI returned invalid JSON format. Please try again with different wording.',
            };
          }
        } else {
          console.error('[Vehicle Data Extractor] ❌ No JSON pattern found in response');
          return {
            success: false,
            confidence: 0,
            error: 'AI did not return valid JSON. Response: ' + aiResponse.content.substring(0, 100),
          };
        }
      }

      // Check for AI error response
      if (extractedData?.error) {
        console.warn('[Vehicle Data Extractor] AI could not extract data:', extractedData.error);
        return {
          success: false,
          confidence: 0,
          error: extractedData.error,
        };
      }

      // Validate required fields
      const { make, model, year, price } = extractedData as any;

      if (!make || !model || !year || !price) {
        const missing = [];
        if (!make) missing.push('make/merk');
        if (!model) missing.push('model');
        if (!year) missing.push('year/tahun');
        if (!price) missing.push('price/harga');

        console.warn('[Vehicle Data Extractor] Missing required fields:', missing);
        return {
          success: false,
          confidence: 0,
          error: `Data tidak lengkap. Field yang hilang: ${missing.join(', ')}`,
        };
      }

      // Additional validation
      const currentYear = new Date().getFullYear();
      if (year < 1980 || year > currentYear + 1) {
        return {
          success: false,
          confidence: 0,
          error: `Tahun tidak valid: ${year}. Harus antara 1980-${currentYear + 1}`,
        };
      }

      if (price <= 0 || price > 100000000000) {
        return {
          success: false,
          confidence: 0,
          error: 'Harga tidak valid. Harus antara 0-100 miliar',
        };
      }

      // Successful extraction
      console.log('[Vehicle Data Extractor] ✅ Successfully extracted vehicle data');
      return {
        success: true,
        data: {
          make,
          model,
          year,
          price,
          mileage: extractedData.mileage || 0,
          color: extractedData.color || 'Unknown',
          transmission: extractedData.transmission || 'Manual',
        },
        confidence: 0.95, // High confidence for successful extraction
        reasoning: aiResponse.reasoning || undefined,
      };

    } catch (error: any) {
      console.error('[Vehicle Data Extractor] ❌ Extraction failed:', error);
      return {
        success: false,
        confidence: 0,
        error: `AI extraction failed: ${error.message}`,
      };
    }
  }

  /**
   * Fallback: Extract using regex patterns (legacy support)
   * Digunakan jika AI extraction gagal atau untuk backward compatibility
   */
  static extractUsingRegex(text: string): VehicleDataExtractionResult {
    console.log('[Vehicle Data Extractor] Using regex fallback for:', text);

    const parts = text.split(/\s+/).filter((p) => p);

    // Need at least 4 parts: make, model, year, price
    if (parts.length < 4) {
      return {
        success: false,
        confidence: 0,
        error: 'Format tidak lengkap. Minimal: [merk] [model] [tahun] [harga]',
      };
    }

    const [make, model, yearStr, priceStr, mileageStr, color, ...transmissionParts] = parts;

    // Parse year
    const year = parseInt(yearStr);
    if (isNaN(year)) {
      return {
        success: false,
        confidence: 0,
        error: 'Tahun tidak valid',
      };
    }

    // Parse price
    const price = parseInt(priceStr);
    if (isNaN(price)) {
      return {
        success: false,
        confidence: 0,
        error: 'Harga tidak valid',
      };
    }

    // Parse optional mileage
    const mileage = mileageStr ? parseInt(mileageStr) : 0;

    // Parse transmission
    const transmission = transmissionParts.join(' ') || 'Manual';

    return {
      success: true,
      data: {
        make,
        model,
        year,
        price,
        mileage: isNaN(mileage) ? 0 : mileage,
        color: color || 'Unknown',
        transmission,
      },
      confidence: 0.7, // Lower confidence for regex extraction
    };
  }
}

export default VehicleDataExtractorService;
