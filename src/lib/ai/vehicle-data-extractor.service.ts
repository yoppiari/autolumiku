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

const VEHICLE_EXTRACTION_SYSTEM_PROMPT = `Anda adalah AI assistant yang expert dalam mengekstrak data kendaraan dari text Bahasa Indonesia.

TUGAS ANDA:
Extract informasi kendaraan berikut dari text yang diberikan dan return dalam format JSON:

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

OUTPUT FORMAT:
Return ONLY valid JSON object (no markdown, no explanation):

{
  "make": "Toyota",
  "model": "Avanza",
  "year": 2020,
  "price": 150000000,
  "mileage": 50000,
  "color": "Hitam",
  "transmission": "Manual"
}

JIKA DATA TIDAK LENGKAP:
- Required fields (make, model, year, price) HARUS ada
- Optional fields boleh null
- Jika required field tidak ditemukan, return null untuk field tersebut

CONTOH EXTRACTION:

Input: "Toyota Avanza tahun 2020 harga 150 juta km 50 ribu warna hitam transmisi manual"
Output: {"make":"Toyota","model":"Avanza","year":2020,"price":150000000,"mileage":50000,"color":"Hitam","transmission":"Manual"}

Input: "Avanza 2020 hitam matic 150jt km 50rb"
Output: {"make":"Toyota","model":"Avanza","year":2020,"price":150000000,"mileage":50000,"color":"Hitam","transmission":"Automatic"}

Input: "Honda Brio 2021, 140 juta, kilometer 30000, silver, automatic"
Output: {"make":"Honda","model":"Brio","year":2021,"price":140000000,"mileage":30000,"color":"Silver","transmission":"Automatic"}

PENTING:
- Return ONLY JSON object
- NO markdown code blocks
- NO explanations
- NO additional text
- Jika tidak bisa extract, return: {"error": "Cannot extract vehicle data"}`;

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

      console.log('[Vehicle Data Extractor] AI Response:', aiResponse.content);
      console.log('[Vehicle Data Extractor] AI Reasoning:', aiResponse.reasoning);

      // Parse JSON response
      let extractedData;
      try {
        extractedData = zaiClient.parseJSON(aiResponse.content);
      } catch (parseError: any) {
        console.error('[Vehicle Data Extractor] Failed to parse AI response as JSON:', parseError.message);
        console.error('[Vehicle Data Extractor] Raw content:', aiResponse.content);

        return {
          success: false,
          confidence: 0,
          error: 'Failed to parse AI response. Invalid JSON format.',
        };
      }

      // Check for AI error response
      if (extractedData.error) {
        console.warn('[Vehicle Data Extractor] AI could not extract data:', extractedData.error);
        return {
          success: false,
          confidence: 0,
          error: extractedData.error,
        };
      }

      // Validate required fields
      const { make, model, year, price } = extractedData;

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
