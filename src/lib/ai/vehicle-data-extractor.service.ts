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
    fuelType?: string;     // Bensin, Diesel, Hybrid, Electric
    engineCapacity?: string; // 1500cc, 1300cc, 2000cc, etc.
    variant?: string;      // E, G, S, RS, Satya, Veloz, etc.
  };
  confidence: number;      // 0-1 confidence score
  reasoning?: string;      // AI reasoning for extraction
  error?: string;
}

// ==================== SYSTEM PROMPT ====================

const VEHICLE_EXTRACTION_SYSTEM_PROMPT = `Kamu adalah AI expert otomotif yang bertugas mengekstrak data spesifikasi mobil dari pesan teks.
Kamu memiliki pengetahuan mendalam tentang spesifikasi mobil di Indonesia (seperti data dari oto.com).

TUGAS UTAMA:
1. Ekstrak data eksplisit yang ditulis user.
2. LENGKAPI data yang hilang ("hallucinate based on facts") menggunakan pengetahuan otomotifmu jika user tidak menyebutkannya.

DATA YANG HARUS DIEKSTRAK (Return JSON):
{
  "make": "Toyota",              // Merk (Toyota, Honda, dll)
  "model": "Avanza",             // Model (Avanza, Brio, dll)
  "year": 2020,                  // Tahun (integer)
  "price": 150000000,            // Harga dalam Rupiah (integer)
  "mileage": 50000,              // Kilometer (integer, null jika tidak ada)
  "color": "Hitam",              // Warna (Title Case)
  "transmission": "Manual",      // Manual/Automatic/CVT
  "fuelType": "Bensin",          // Bensin/Diesel/Hybrid/Electric
  "engineCapacity": "1500cc",    // Kapasitas mesin (string)
  "variant": "G"                 // Varian (G, E, RS, Veloz, dll)
}

ATURAN INFERENSI (HUBUNGKAN TITIK-TITIK):
- Jika user hanya sebut "Pajero Sport", INFERENSI bahwa fuelType="Diesel" dan engineCapacity="2400cc" (umumnya).
- Jika user sebut "Fortuner VRZ", INFERENSI fuelType="Diesel" dan transmission="Automatic".
- Jika user sebut "Brio Satya", INFERENSI fuelType="Bensin", engineCapacity="1200cc".
- Jika user sebut harga "150", asumsikan "150 juta" -> 150000000.
- Jika user sebut "km 50", asumsikan "50 ribu" -> 50000 (jika tahun muda).
- Jika data varian sangat spesifik (misal "Civic Turbo"), lengkapi data teknisnya.

FORMAT ANGKA INDONESIA:
- Harga: "150jt", "150 juta", "150.000.000", "150" -> 150000000
- KM: "30rb", "30 ribu", "30.000", "30k" -> 30000

CONTOH INPUT & OUTPUT SMART:
Input: "fortuner vrz 2019 hitam 450jt"
Output: {
  "make": "Toyota", 
  "model": "Fortuner", 
  "variant": "VRZ", 
  "year": 2019, 
  "price": 450000000, 
  "color": "Hitam",
  "transmission": "Automatic",  // Inferensi: VRZ pasti matic
  "fuelType": "Diesel",         // Inferensi: VRZ umumnya diesel
  "engineCapacity": "2400cc"    // Inferensi
}

Input: "brio 2021 satya e"
Output: {
  "make": "Honda",
  "model": "Brio",
  "variant": "Satya E",
  "year": 2021,
  "transmission": "Manual",   // Default guess jika tidak disebut
  "fuelType": "Bensin",
  "engineCapacity": "1200cc"
}

JANGAN return error jika bisa ditebak/inferensi. Prioritaskan kelengkapan data.`;

// ==================== SERVICE ====================


const VEHICLE_SCRAPER_SYSTEM_PROMPT = `Kamu adalah Data Extractor robot yang kaku dan presisi.
Tugasmu adalah mengekstrak data kendaraan dari teks HTML/iklan mentah.

ATURAN KRUSIAL (ANTI-HALUSINASI & ANTI-SAMPAH):
1. HANYA ekstrak data yang TERTULIS EKSPLISIT di teks.
2. JANGAN MENEBAK, JANGAN MENGARANG, JANGAN ASUMSI.
3. FAIL FAST (Return error) jika ini BUKAN iklan mobil utuh (misal: "Jual Velg", "Over Kredit Rumah", "Sewa Mobil", "Jasa Inspeksi").
4. Validasi Harga: Jika harga < 20.000.000 atau format aneh (12345), tandai sebagai mencurigakan atau return 0.
5. Jika data "Transmission" tak tertulis -> return null.

OUTPUT JSON FORMAT:
{
  "make": "string",
  "model": "string",
  "year": number,
  "price": number,
  "mileage": number | null,
  "color": "string" | null,
  "transmission": "string" | null,
  "fuelType": "string" | null,
  "engineCapacity": "string" | null,
  "variant": "string" | null,
  "error": "string" // Optional: Isi alasan jika ini DATA SAMPAH / BUKAN MOBIL
}
`;

export class VehicleDataExtractorService {
  /**
   * Extract vehicle data dari natural language text
   */
  static async extractFromNaturalLanguage(
    text: string,
    systemPromptOverride?: string
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
        systemPrompt: systemPromptOverride || VEHICLE_EXTRACTION_SYSTEM_PROMPT,
        userPrompt: text,  // Send text directly - system prompt already has instructions
        temperature: 0.1, // Low temperature untuk consistency
        maxTokens: 2000,  // High limit to ensure complete responses
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
        const missing: string[] = [];
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
          mileage: extractedData.mileage || undefined,
          color: extractedData.color || 'Unknown',
          transmission: extractedData.transmission || 'Manual',
          fuelType: extractedData.fuelType || 'Bensin',
          engineCapacity: extractedData.engineCapacity || null,
          variant: extractedData.variant || null,
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
      mileage: undefined, // Keep undefined if not provided, don't default to 0
      color: 'Unknown',
      transmission: 'Manual',
      fuelType: 'Bensin',
      engineCapacity: null,
      variant: null,
    };

    // Extract year (4 digits)
    const yearMatch = text.match(/\b(19\d{2}|20[0-2]\d)\b/);
    if (yearMatch) {
      extractedData.year = parseInt(yearMatch[1]);
    }

    // Extract price (support: harga 150juta, 150 juta, 150jt, Rp 120jt, Rp.120jt, 150000000, 120)
    // First try "Rp" prefix format (common in WhatsApp messages)
    let priceMatch = text.match(/(?:Rp\.?\s*)(\d+(?:[.,]\d+)?)\s*(juta|jt|m|M)?/i);
    if (!priceMatch) {
      // Fallback to "harga" prefix
      priceMatch = text.match(/(?:harga|price)\s*:?\s*(\d+(?:[.,]\d+)?)\s*(juta|jt|m|M)?/i);
    }
    if (!priceMatch) {
      // Try standalone number with jt/juta suffix
      priceMatch = text.match(/(\d+(?:[.,]\d+)?)\s*(juta|jt|m|M)\b/i);
    }

    // Fallback: Check for numbers that look like price (e.g. "120" followed by nothing specific, or "120 2020")
    // Context heuristic: If > 50 and < 2000, likely price in millions if year matches separately
    if (!priceMatch) {
      const possiblePrice = text.match(/\b(\d{2,4})\b/g);
      if (possiblePrice) {
        for (const numStr of possiblePrice) {
          const val = parseInt(numStr);
          // If not a year (1990-2030) and roughly in price range (50-2000 millions)
          if ((val < 1980 || val > 2030) && val >= 50 && val <= 5000) {
            // Assume this is price in millions (e.g. 120 -> 120jt)
            priceMatch = [numStr, numStr, 'jt'];
            break;
          }
        }
      }
    }

    if (priceMatch) {
      // Remove thousands separator (.) and parse
      const numStr = priceMatch[1].replace(/\./g, '').replace(',', '.');
      const num = parseFloat(numStr);
      const unit = priceMatch[2]?.toLowerCase();

      if (unit === 'juta' || unit === 'jt' || unit === 'm' || unit === 'M') {
        extractedData.price = Math.round(num * 1000000);
      } else if (num > 10000000) {
        // Large number, assume raw rupiah
        extractedData.price = Math.round(num);
      } else if (!unit && num >= 50 && num <= 5000) {
        // Inferred millions from context heuristic above
        extractedData.price = Math.round(num * 1000000);
      }
    } else {
      // Fallback: look for large numbers (likely price in full rupiah)
      const largeNumberMatch = text.match(/\b(\d{8,})\b/);
      if (largeNumberMatch) {
        extractedData.price = parseInt(largeNumberMatch[1]);
      }
    }

    // Extract mileage (support: km 50rb, 50 ribu km, 50k, KM 30.000, 50000)
    // Handle thousands separator (.) in km values like "KM 30.000"
    const mileageMatch = text.match(/(?:km|kilometer|odometer|jarak)\s*:?\s*(\d+(?:[.,]\d+)?)\s*(rb|ribu|k)?/i);
    if (mileageMatch) {
      // Remove thousands separator (.) and parse
      const numStr = mileageMatch[1].replace(/\./g, '').replace(',', '.');
      const num = parseFloat(numStr);
      const unit = mileageMatch[2]?.toLowerCase();

      if (unit === 'rb' || unit === 'ribu' || unit === 'k') {
        extractedData.mileage = Math.round(num * 1000);
      } else if (num < 1000000) {
        // Reasonable mileage range
        extractedData.mileage = Math.round(num);
      }
    }

    // Extract transmission (MT = Manual Transmission, AT = Automatic Transmission)
    if (/\b(matic|automatic|AT|A\/T)\b/i.test(text)) {
      extractedData.transmission = 'Automatic';
    } else if (/\b(manual|MT|M\/T)\b/i.test(text)) {
      extractedData.transmission = 'Manual';
    } else if (/\bCVT\b/i.test(text)) {
      extractedData.transmission = 'CVT';
    }

    // Extract color (common Indonesian colors)
    const colors = [
      'hitam', 'putih', 'silver', 'abu-abu', 'abu abu', 'merah', 'biru', 'hijau',
      'kuning', 'coklat', 'gold', 'emas', 'orange', 'oranye', 'ungu', 'pink',
      'cream', 'krem', 'bronze', 'grey', 'gray', 'white', 'black', 'red', 'blue',
      'metalik', 'metallic', 'maroon', 'burgundy', 'champagne', 'titanium',
      'dark grey', 'dark gray', 'light grey', 'light gray'
    ];
    for (const color of colors) {
      if (new RegExp(`\\b${color}\\b`, 'i').test(text)) {
        extractedData.color = color.charAt(0).toUpperCase() + color.slice(1);
        break;
      }
    }

    // Extract fuel type (bahan bakar)
    if (/\b(diesel|solar)\b/i.test(text)) {
      extractedData.fuelType = 'Diesel';
    } else if (/\b(hybrid)\b/i.test(text)) {
      extractedData.fuelType = 'Hybrid';
    } else if (/\b(listrik|electric|ev)\b/i.test(text)) {
      extractedData.fuelType = 'Electric';
    } else if (/\b(bensin|pertamax|pertalite)\b/i.test(text)) {
      extractedData.fuelType = 'Bensin';
    }

    // Extract engine capacity (CC mesin) - supports formats: 1500cc, 1.5L, 1500 cc, 1.5 L
    const ccMatch = text.match(/(\d+(?:\.\d+)?)\s*(cc|CC|L)\b/i);
    if (ccMatch) {
      let capacity = parseFloat(ccMatch[1]);
      const unit = ccMatch[2].toLowerCase();
      // Convert L to cc if needed (1.5L = 1500cc)
      if (unit === 'l' && capacity < 10) {
        capacity = capacity * 1000;
      }
      extractedData.engineCapacity = `${Math.round(capacity)}cc`;
    }

    // Model to make mapping (common Indonesian market vehicles)
    const modelToMake: Record<string, string> = {
      // Honda
      'brio': 'Honda', 'jazz': 'Honda', 'civic': 'Honda', 'city': 'Honda',
      'cr-v': 'Honda', 'crv': 'Honda', 'hr-v': 'Honda', 'hrv': 'Honda',
      'accord': 'Honda', 'mobilio': 'Honda', 'br-v': 'Honda', 'brv': 'Honda',
      'wr-v': 'Honda', 'wrv': 'Honda',
      // Toyota
      'avanza': 'Toyota', 'innova': 'Toyota', 'fortuner': 'Toyota', 'rush': 'Toyota',
      'yaris': 'Toyota', 'vios': 'Toyota', 'camry': 'Toyota', 'corolla': 'Toyota',
      'alphard': 'Toyota', 'vellfire': 'Toyota', 'hilux': 'Toyota', 'kijang': 'Toyota',
      'agya': 'Toyota', 'calya': 'Toyota', 'sienta': 'Toyota', 'raize': 'Toyota',
      'veloz': 'Toyota',
      // Suzuki
      'ertiga': 'Suzuki', 'ignis': 'Suzuki', 'baleno': 'Suzuki', 'xl7': 'Suzuki',
      'sx4': 'Suzuki', 'swift': 'Suzuki', 'karimun': 'Suzuki', 'apv': 'Suzuki',
      's-cross': 'Suzuki', 'scross': 'Suzuki', 'jimny': 'Suzuki',
      // Daihatsu
      'xenia': 'Daihatsu', 'terios': 'Daihatsu', 'sigra': 'Daihatsu', 'ayla': 'Daihatsu',
      'rocky': 'Daihatsu', 'sirion': 'Daihatsu', 'granmax': 'Daihatsu', 'luxio': 'Daihatsu',
      // Mitsubishi
      'pajero': 'Mitsubishi', 'xpander': 'Mitsubishi', 'outlander': 'Mitsubishi',
      'triton': 'Mitsubishi', 'l300': 'Mitsubishi', 'colt': 'Mitsubishi',
      'eclipse': 'Mitsubishi',
      // Nissan
      'livina': 'Nissan', 'serena': 'Nissan', 'terra': 'Nissan', 'navara': 'Nissan',
      'juke': 'Nissan', 'x-trail': 'Nissan', 'xtrail': 'Nissan', 'march': 'Nissan',
      'kicks': 'Nissan', 'magnite': 'Nissan',
      // Mazda
      'mazda2': 'Mazda', 'mazda3': 'Mazda', 'cx-3': 'Mazda', 'cx-5': 'Mazda',
      'cx-8': 'Mazda', 'cx-9': 'Mazda', 'biante': 'Mazda',
      // Wuling
      'confero': 'Wuling', 'almaz': 'Wuling', 'cortez': 'Wuling', 'formo': 'Wuling',
      'air': 'Wuling',
      // Hyundai
      'creta': 'Hyundai', 'stargazer': 'Hyundai', 'palisade': 'Hyundai',
      'santa': 'Hyundai', 'ioniq': 'Hyundai', 'kona': 'Hyundai',
      // Kia
      'seltos': 'Kia', 'sonet': 'Kia', 'sportage': 'Kia', 'carnival': 'Kia',
    };

    // Extract make and model (simple word matching)
    const parts = text.split(/\s+/).filter((p) => p && !/^\d+$/.test(p));

    // Common brands
    const brands = ['Toyota', 'Honda', 'Suzuki', 'Daihatsu', 'Mitsubishi', 'Nissan', 'Mazda', 'Wuling', 'Hyundai', 'Kia', 'BMW', 'Mercedes', 'Audi', 'Volkswagen'];
    for (const brand of brands) {
      if (new RegExp(`\\b${brand}\\b`, 'i').test(text)) {
        extractedData.make = brand;
        break;
      }
    }

    // Common models with variant support
    const models = Object.keys(modelToMake);
    for (const model of models) {
      if (new RegExp(`\\b${model}\\b`, 'i').test(text)) {
        extractedData.model = model.charAt(0).toUpperCase() + model.slice(1);
        // Auto-detect make if not already set
        if (!extractedData.make) {
          extractedData.make = modelToMake[model.toLowerCase()];
        }
        break;
      }
    }

    // Try to extract variant (e.g., "Brio Satya", "Avanza Veloz", "Jazz RS")
    // Common variants in Indonesian market
    const knownVariants = [
      'satya', 'veloz', 'rs', 'type r', 'type-r', 'sport', 'luxury', 'ultimate',
      'base', 'standar', 'standard', 'premium', 'prestige', 'limited', 'special',
      'g', 'e', 's', 'v', 'vx', 'srz', 'q', 'gx', 'lx', 'ex', 'sx', 'cvt',
      'cross', 'exceed', 'glx', 'gls', 'sport'
    ];

    if (extractedData.model) {
      const modelPattern = new RegExp(`\\b${extractedData.model}\\s+(\\w+)`, 'i');
      const variantMatch = text.match(modelPattern);
      if (variantMatch && variantMatch[1]) {
        const potentialVariant = variantMatch[1];
        // Check if it's a known variant or not a common keyword
        const excludedWords = ['mt', 'at', 'km', 'tahun', 'warna', 'harga', 'rp', 'manual', 'matic', 'automatic', 'cc', 'bensin', 'diesel', 'hitam', 'putih', 'silver', 'merah', 'biru'];
        if (!excludedWords.includes(potentialVariant.toLowerCase()) && !/^\d+$/.test(potentialVariant)) {
          // Store as separate variant field instead of appending to model
          extractedData.variant = potentialVariant.toUpperCase();
        }
      }
    }

    // Also check for standalone known variants
    if (!extractedData.variant) {
      for (const variant of knownVariants) {
        if (new RegExp(`\\b${variant}\\b`, 'i').test(text)) {
          extractedData.variant = variant.toUpperCase();
          break;
        }
      }
    }

    // If make/model not found by keyword, use first two words as fallback
    if (!extractedData.make && parts.length >= 1) {
      // Filter out keywords before using as make
      const filtered = parts.filter(p => !['km', 'rp', 'warna', 'tahun', 'harga', 'mt', 'at', 'cvt'].includes(p.toLowerCase()));
      if (filtered.length >= 1) {
        extractedData.make = filtered[0].charAt(0).toUpperCase() + filtered[0].slice(1);
      }
    }
    if (!extractedData.model && parts.length >= 2) {
      const filtered = parts.filter(p => !['km', 'rp', 'warna', 'tahun', 'harga', 'mt', 'at', 'cvt'].includes(p.toLowerCase()));
      if (filtered.length >= 2 && filtered[1] !== extractedData.make) {
        extractedData.model = filtered[1].charAt(0).toUpperCase() + filtered[1].slice(1);
      }
    }

    // Validate required fields
    if (!extractedData.make || !extractedData.model || !extractedData.year || !extractedData.price) {
      const missing: string[] = [];
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

  /**
   * Extract partial vehicle data without requiring all fields
   * Used when staff is completing missing fields during upload flow
   *
   * Example inputs (completion messages):
   * - "hitam matic km 30rb" → extracts color, transmission, mileage
   * - "silver manual" → extracts color, transmission
   * - "km 50000" → extracts mileage only
   */
  static extractPartialData(text: string): VehicleDataExtractionResult {
    console.log('[Vehicle Data Extractor] Extracting partial data for completion:', text);

    const extractedData: any = {};
    let fieldsFound = 0;

    // Extract year (4 digits) - optional
    const yearMatch = text.match(/\b(19\d{2}|20[0-2]\d)\b/);
    if (yearMatch) {
      extractedData.year = parseInt(yearMatch[1]);
      fieldsFound++;
    }

    // Extract price - optional
    let priceMatch = text.match(/(?:Rp\.?\s*)(\d+(?:[.,]\d+)?)\s*(juta|jt|m)?/i);
    if (!priceMatch) {
      priceMatch = text.match(/(?:harga|price)\s*:?\s*(\d+(?:[.,]\d+)?)\s*(juta|jt|m)?/i);
    }
    if (!priceMatch) {
      priceMatch = text.match(/(\d+(?:[.,]\d+)?)\s*(juta|jt)\b/i);
    }
    if (priceMatch) {
      const numStr = priceMatch[1].replace(/\./g, '').replace(',', '.');
      const num = parseFloat(numStr);
      const unit = priceMatch[2]?.toLowerCase();

      if (unit === 'juta' || unit === 'jt' || unit === 'm') {
        extractedData.price = Math.round(num * 1000000);
        fieldsFound++;
      } else if (num > 10000000) {
        extractedData.price = Math.round(num);
        fieldsFound++;
      }
    }

    // Extract mileage
    const mileageMatch = text.match(/(?:km|kilometer|odometer|jarak)\s*:?\s*(\d+(?:[.,]\d+)?)\s*(rb|ribu|k)?/i);
    if (mileageMatch) {
      const numStr = mileageMatch[1].replace(/\./g, '').replace(',', '.');
      const num = parseFloat(numStr);
      const unit = mileageMatch[2]?.toLowerCase();

      if (unit === 'rb' || unit === 'ribu' || unit === 'k') {
        extractedData.mileage = Math.round(num * 1000);
      } else if (num < 1000000) {
        extractedData.mileage = Math.round(num);
      }
      fieldsFound++;
    }

    // Extract transmission
    if (/\b(matic|automatic|AT|A\/T)\b/i.test(text)) {
      extractedData.transmission = 'Automatic';
      fieldsFound++;
    } else if (/\b(manual|MT|M\/T)\b/i.test(text)) {
      extractedData.transmission = 'Manual';
      fieldsFound++;
    } else if (/\bCVT\b/i.test(text)) {
      extractedData.transmission = 'CVT';
      fieldsFound++;
    }

    // Extract color
    const colors = [
      'hitam', 'putih', 'silver', 'abu-abu', 'abu abu', 'merah', 'biru', 'hijau',
      'kuning', 'coklat', 'gold', 'emas', 'orange', 'oranye', 'ungu', 'pink',
      'cream', 'krem', 'bronze', 'grey', 'gray', 'white', 'black', 'red', 'blue',
      'metalik', 'metallic', 'maroon', 'burgundy', 'champagne', 'titanium',
      'dark grey', 'dark gray', 'light grey', 'light gray'
    ];
    for (const color of colors) {
      if (new RegExp(`\\b${color}\\b`, 'i').test(text)) {
        extractedData.color = color.charAt(0).toUpperCase() + color.slice(1);
        fieldsFound++;
        break;
      }
    }

    // Extract fuel type (bahan bakar)
    if (/\b(diesel|solar)\b/i.test(text)) {
      extractedData.fuelType = 'Diesel';
      fieldsFound++;
    } else if (/\b(hybrid)\b/i.test(text)) {
      extractedData.fuelType = 'Hybrid';
      fieldsFound++;
    } else if (/\b(listrik|electric|ev)\b/i.test(text)) {
      extractedData.fuelType = 'Electric';
      fieldsFound++;
    } else if (/\b(bensin|pertamax|pertalite)\b/i.test(text)) {
      extractedData.fuelType = 'Bensin';
      fieldsFound++;
    }

    // Extract engine capacity (CC mesin)
    const ccMatch = text.match(/(\d+(?:\.\d+)?)\s*(cc|CC|L)\b/i);
    if (ccMatch) {
      let capacity = parseFloat(ccMatch[1]);
      const unit = ccMatch[2].toLowerCase();
      if (unit === 'l' && capacity < 10) {
        capacity = capacity * 1000;
      }
      extractedData.engineCapacity = `${Math.round(capacity)}cc`;
      fieldsFound++;
    }

    // Extract variant
    const knownVariants = [
      'satya', 'veloz', 'rs', 'type r', 'type-r', 'sport', 'luxury', 'ultimate',
      'base', 'standar', 'standard', 'premium', 'prestige', 'limited', 'special',
      'g', 'e', 's', 'v', 'vx', 'srz', 'q', 'gx', 'lx', 'ex', 'sx',
      'cross', 'exceed', 'glx', 'gls'
    ];
    for (const variant of knownVariants) {
      if (new RegExp(`\\b${variant}\\b`, 'i').test(text)) {
        extractedData.variant = variant.toUpperCase();
        fieldsFound++;
        break;
      }
    }

    // Model to make mapping
    const modelToMake: Record<string, string> = {
      'brio': 'Honda', 'jazz': 'Honda', 'civic': 'Honda', 'city': 'Honda',
      'cr-v': 'Honda', 'crv': 'Honda', 'hr-v': 'Honda', 'hrv': 'Honda',
      'accord': 'Honda', 'mobilio': 'Honda', 'br-v': 'Honda', 'brv': 'Honda',
      'avanza': 'Toyota', 'innova': 'Toyota', 'fortuner': 'Toyota', 'rush': 'Toyota',
      'yaris': 'Toyota', 'vios': 'Toyota', 'camry': 'Toyota', 'corolla': 'Toyota',
      'agya': 'Toyota', 'calya': 'Toyota', 'raize': 'Toyota', 'veloz': 'Toyota',
      'ertiga': 'Suzuki', 'ignis': 'Suzuki', 'baleno': 'Suzuki', 'xl7': 'Suzuki',
      'swift': 'Suzuki', 'karimun': 'Suzuki', 'jimny': 'Suzuki',
      'xenia': 'Daihatsu', 'terios': 'Daihatsu', 'sigra': 'Daihatsu', 'ayla': 'Daihatsu',
      'rocky': 'Daihatsu', 'sirion': 'Daihatsu',
      'pajero': 'Mitsubishi', 'xpander': 'Mitsubishi', 'outlander': 'Mitsubishi',
      'triton': 'Mitsubishi', 'eclipse': 'Mitsubishi',
      'livina': 'Nissan', 'serena': 'Nissan', 'terra': 'Nissan', 'navara': 'Nissan',
      'kicks': 'Nissan', 'magnite': 'Nissan',
    };

    // Extract make and model if present
    const brands = ['Toyota', 'Honda', 'Suzuki', 'Daihatsu', 'Mitsubishi', 'Nissan', 'Mazda', 'Wuling', 'Hyundai', 'Kia'];
    for (const brand of brands) {
      if (new RegExp(`\\b${brand}\\b`, 'i').test(text)) {
        extractedData.make = brand;
        fieldsFound++;
        break;
      }
    }

    const models = Object.keys(modelToMake);
    for (const model of models) {
      if (new RegExp(`\\b${model}\\b`, 'i').test(text)) {
        extractedData.model = model.charAt(0).toUpperCase() + model.slice(1);
        if (!extractedData.make) {
          extractedData.make = modelToMake[model.toLowerCase()];
        }
        fieldsFound++;
        break;
      }
    }

    // Return success if we found at least one field
    if (fieldsFound > 0) {
      console.log('[Vehicle Data Extractor] ✅ Partial extraction found', fieldsFound, 'fields:', extractedData);
      return {
        success: true,
        data: extractedData,
        confidence: 0.6,
      };
    }

    console.log('[Vehicle Data Extractor] ⚠️ No fields extracted from:', text);
    return {
      success: false,
      confidence: 0,
      error: 'Tidak dapat mengenali data. Coba ketik dengan format: "hitam matic km 30rb"',
    };
  }
  /**
   * Extract data from HTML content (Scraper support)
   * Cleans HTML tags to save tokens and uses AI to extract vehicle specs
   * USES STRICT PROMPT to avoid hallucination.
   */
  static async extractFromHTML(html: string): Promise<VehicleDataExtractionResult> {
    console.log('[Vehicle Data Extractor] Extracting from HTML content (Strict Mode)...');

    // 1. Clean HTML to reduce tokens (remove scripts, styles, comments)
    // Keep only text content structure
    const cleanText = html
      .replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gim, "")
      .replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gim, "")
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/<[^>]+>/g, " ") // Replace tags with space
      .replace(/\s+/g, " ")     // Collapse whitespace
      .trim()
      .substring(0, 15000);     // Limit length to ~3-4k tokens

    console.log('[Vehicle Data Extractor] Cleaned text length:', cleanText.length);

    // 2. Use the natural language extractor with the cleaned text AND STRICT prompt
    try {
      // We pass the STRICT prompt to override the default "Chatbot" prompt
      return await this.extractFromNaturalLanguage(cleanText, VEHICLE_SCRAPER_SYSTEM_PROMPT);
    } catch (error) {
      console.error('[Vehicle Data Extractor] HTML extraction failed:', error);
      return {
        success: false,
        confidence: 0,
        error: 'HTML extraction failed'
      };
    }
  }
}

export default VehicleDataExtractorService;
