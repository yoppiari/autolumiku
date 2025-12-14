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

const VEHICLE_EXTRACTION_SYSTEM_PROMPT = `JSON API. Extract vehicle data.

Required: make, model, year, price (full IDR)
Optional: mileage (km), color, transmission

Normalize:
- 150jt/150 juta → 150000000
- 50rb/50k → 50000
- matic → Automatic
- Capitalize names

Return ONLY JSON:
{"make":"Toyota","model":"Avanza","year":2020,"price":150000000,"mileage":50000,"color":"Hitam","transmission":"Manual"}

If incomplete: {"error":"Missing data"}`;

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
      console.log('[Vehicle Data Extractor] System prompt length:', VEHICLE_EXTRACTION_SYSTEM_PROMPT.length, 'chars');
      console.log('[Vehicle Data Extractor] User prompt length:', text.length, 'chars');

      const aiResponse = await zaiClient.generateText({
        systemPrompt: VEHICLE_EXTRACTION_SYSTEM_PROMPT,
        userPrompt: text,  // Send text directly - system prompt already has instructions
        temperature: 0.1, // Low temperature untuk consistency
        maxTokens: 256,  // Aggressively reduced - GLM-4.6 has strict limits
      });

      console.log('[Vehicle Data Extractor] ===== AI RESPONSE DEBUG =====');
      console.log('[Vehicle Data Extractor] Content length:', aiResponse.content?.length || 0);
      console.log('[Vehicle Data Extractor] Content type:', typeof aiResponse.content);
      console.log('[Vehicle Data Extractor] Content is empty?:', !aiResponse.content || aiResponse.content.trim() === '');
      console.log('[Vehicle Data Extractor] Content (first 200 chars):', aiResponse.content?.substring(0, 200) || 'EMPTY');
      console.log('[Vehicle Data Extractor] Full content:', aiResponse.content || 'EMPTY');
      console.log('[Vehicle Data Extractor] Reasoning:', aiResponse.reasoning || 'NONE');
      console.log('[Vehicle Data Extractor] Finish reason:', aiResponse.finishReason);
      console.log('[Vehicle Data Extractor] Usage:', aiResponse.usage);
      console.log('[Vehicle Data Extractor] ================================');

      // Check if AI response is empty
      if (!aiResponse.content || aiResponse.content.trim() === '') {
        console.error('[Vehicle Data Extractor] ❌ AI returned empty response!');
        console.error('[Vehicle Data Extractor] Finish reason:', aiResponse.finishReason);
        console.error('[Vehicle Data Extractor] This might indicate:');
        console.error('[Vehicle Data Extractor] - API key issue');
        console.error('[Vehicle Data Extractor] - Model configuration issue');
        console.error('[Vehicle Data Extractor] - Content filtering/safety issue');
        console.error('[Vehicle Data Extractor] - Token limit reached');

        return {
          success: false,
          confidence: 0,
          error: `AI returned empty response. Finish reason: ${aiResponse.finishReason || 'unknown'}. Please try again or use strict format.`,
        };
      }

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

    // Try to extract structured data with Indonesian number formats
    const extractedData: any = {
      make: null,
      model: null,
      year: null,
      price: null,
      mileage: 0,
      color: 'Unknown',
      transmission: 'Manual',
    };

    // Extract year (4 digits)
    const yearMatch = text.match(/\b(19\d{2}|20[0-2]\d)\b/);
    if (yearMatch) {
      extractedData.year = parseInt(yearMatch[1]);
    }

    // Extract price (support: harga 150juta, 150 juta, 150jt, 150000000)
    const priceMatch = text.match(/(?:harga|price)\s*:?\s*(\d+(?:\.\d+)?)\s*(juta|jt|m)?/i);
    if (priceMatch) {
      const num = parseFloat(priceMatch[1]);
      const unit = priceMatch[2]?.toLowerCase();

      if (unit === 'juta' || unit === 'jt' || unit === 'm') {
        extractedData.price = Math.round(num * 1000000);
      } else if (num > 10000000) {
        // Large number, assume raw rupiah
        extractedData.price = Math.round(num);
      }
    } else {
      // Fallback: look for large numbers (likely price in full rupiah)
      const largeNumberMatch = text.match(/\b(\d{8,})\b/);
      if (largeNumberMatch) {
        extractedData.price = parseInt(largeNumberMatch[1]);
      }
    }

    // Extract mileage (support: km 50rb, 50 ribu km, 50k, 50000)
    const mileageMatch = text.match(/(?:km|kilometer|odometer|jarak)\s*:?\s*(\d+(?:\.\d+)?)\s*(rb|ribu|k)?/i);
    if (mileageMatch) {
      const num = parseFloat(mileageMatch[1]);
      const unit = mileageMatch[2]?.toLowerCase();

      if (unit === 'rb' || unit === 'ribu' || unit === 'k') {
        extractedData.mileage = Math.round(num * 1000);
      } else if (num < 1000000) {
        // Reasonable mileage range
        extractedData.mileage = Math.round(num);
      }
    }

    // Extract transmission
    if (/\b(matic|automatic|AT)\b/i.test(text)) {
      extractedData.transmission = 'Automatic';
    } else if (/\b(manual|MT)\b/i.test(text)) {
      extractedData.transmission = 'Manual';
    } else if (/\bCVT\b/i.test(text)) {
      extractedData.transmission = 'CVT';
    }

    // Extract color (common Indonesian colors)
    const colors = ['hitam', 'putih', 'silver', 'abu-abu', 'merah', 'biru', 'hijau', 'kuning', 'coklat'];
    for (const color of colors) {
      if (new RegExp(`\\b${color}\\b`, 'i').test(text)) {
        extractedData.color = color.charAt(0).toUpperCase() + color.slice(1);
        break;
      }
    }

    // Extract make and model (simple word matching)
    const parts = text.split(/\s+/).filter((p) => p && !/^\d+$/.test(p));

    // Common brands
    const brands = ['Toyota', 'Honda', 'Suzuki', 'Daihatsu', 'Mitsubishi', 'Nissan', 'Mazda'];
    for (const brand of brands) {
      if (new RegExp(`\\b${brand}\\b`, 'i').test(text)) {
        extractedData.make = brand;
        break;
      }
    }

    // Common models
    const models = ['Avanza', 'Xenia', 'Brio', 'Jazz', 'Ertiga', 'Terios', 'Rush', 'Innova', 'Fortuner', 'Pajero', 'Civic', 'CR-V', 'HR-V'];
    for (const model of models) {
      if (new RegExp(`\\b${model}\\b`, 'i').test(text)) {
        extractedData.model = model;
        break;
      }
    }

    // If make/model not found by keyword, use first two words as fallback
    if (!extractedData.make && parts.length >= 1) {
      extractedData.make = parts[0];
    }
    if (!extractedData.model && parts.length >= 2) {
      extractedData.model = parts[1];
    }

    // Validate required fields
    if (!extractedData.make || !extractedData.model || !extractedData.year || !extractedData.price) {
      const missing = [];
      if (!extractedData.make) missing.push('merk');
      if (!extractedData.model) missing.push('model');
      if (!extractedData.year) missing.push('tahun');
      if (!extractedData.price) missing.push('harga');

      console.warn('[Vehicle Data Extractor] Regex extraction missing fields:', missing);
      return {
        success: false,
        confidence: 0,
        error: `Format tidak lengkap. Field yang hilang: ${missing.join(', ')}. Contoh: Toyota Avanza 2020 150 juta`,
      };
    }

    console.log('[Vehicle Data Extractor] ✅ Regex extraction successful:', extractedData);

    return {
      success: true,
      data: extractedData,
      confidence: 0.7, // Lower confidence for regex extraction
    };
  }
}

export default VehicleDataExtractorService;
