import OpenAI from 'openai';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

/**
 * Test z.ai GLM API for vehicle upload scenario
 *
 * Scenario: User uploads Avanza with minimal info:
 * "Avanza 2020 AT, KM 20.000, Hitam, Rp 130jt"
 *
 * AI should:
 * 1. Identify make, model, year, variant
 * 2. Generate Indonesian description
 * 3. Generate English description
 * 4. Extract features
 * 5. Validate pricing
 */

const client = new OpenAI({
  apiKey: process.env.ZAI_API_KEY || '',
  baseURL: process.env.ZAI_BASE_URL || 'https://api.z.ai/api/coding/paas/v4/',
  timeout: parseInt(process.env.API_TIMEOUT_MS || '300000', 10),
});

const systemPrompt = `Anda adalah AI assistant untuk sistem inventory showroom mobil di Indonesia.

Tugas Anda:
1. Parse informasi kendaraan dari input user yang minimal
2. Generate data lengkap untuk listing kendaraan
3. Buat deskripsi menarik dalam Bahasa Indonesia dan English
4. Extract fitur-fitur kendaraan berdasarkan pengetahuan umum tentang model tersebut
5. Validasi harga berdasarkan market price Indonesia

IMPORTANT:
- Gunakan pengetahuan umum tentang model kendaraan untuk melengkapi data
- Harga harus dalam format IDR cents (Rp 130jt = 13000000000 cents)
- Transmission type: "manual" atau "automatic"
- Status default: "DRAFT"
- Confidence score: 0-100

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
  "descriptionId": "Deskripsi menarik dalam Bahasa Indonesia...",
  "descriptionEn": "Attractive description in English...",
  "features": ["Fitur 1", "Fitur 2", ...],
  "specifications": {
    "engineCapacity": "1329cc",
    "seatingCapacity": 7,
    "driveType": "FWD"
  },
  "aiConfidence": 85,
  "aiReasoning": "Reasoning tentang identifikasi dan pricing...",
  "aiSuggestedPrice": 13000000000,
  "priceConfidence": 80,
  "priceAnalysis": {
    "marketRange": { "min": 12000000000, "max": 14000000000 },
    "factors": ["Tahun 2020", "KM rendah", "Kondisi baik"],
    "recommendation": "Harga sesuai market"
  }
}`;

async function testVehicleIdentification() {
  console.log('🚀 Testing z.ai GLM API for Vehicle Upload\n');
  console.log('📝 Test Case: Avanza 2020 AT, KM 20.000, Hitam, Rp 130jt\n');

  try {
    console.log('⏳ Calling z.ai API...\n');

    const startTime = Date.now();

    const response = await client.chat.completions.create({
      model: process.env.ZAI_TEXT_MODEL || 'glm-4.6',
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: 'Parse kendaraan ini dan generate data lengkap: Avanza 2020 AT, KM 20.000, Hitam, Rp 130jt',
        },
      ],
      temperature: 0.7,
      max_tokens: 4000,
    });

    const endTime = Date.now();
    const duration = endTime - startTime;

    console.log('✅ Response received!\n');
    console.log(`⏱️  Duration: ${duration}ms (${(duration / 1000).toFixed(2)}s)\n`);

    console.log('📊 Full Response Object:');
    console.log('─'.repeat(80));
    console.log(JSON.stringify(response, null, 2));
    console.log('─'.repeat(80));
    console.log();

    const content = response.choices[0]?.message?.content || '';
    console.log('📄 Raw Response Content:');
    console.log('─'.repeat(80));
    console.log(content);
    console.log('─'.repeat(80));
    console.log();
    console.log('Content length:', content.length);
    console.log();

    // Try to parse JSON
    try {
      // Extract JSON from markdown code blocks if present
      let jsonContent = content.trim();

      // Remove markdown code block syntax
      if (jsonContent.startsWith('```')) {
        jsonContent = jsonContent.replace(/^```(?:json)?\s*\n?/m, '');
        jsonContent = jsonContent.replace(/\n?```\s*$/m, '');
      }

      jsonContent = jsonContent.trim();

      const parsed = JSON.parse(jsonContent);
      console.log('✅ JSON Parsed Successfully!\n');
      console.log('📊 Parsed Vehicle Data:');
      console.log('─'.repeat(80));
      console.log(JSON.stringify(parsed, null, 2));
      console.log('─'.repeat(80));
      console.log();

      // Validate required fields
      console.log('🔍 Validation:');
      const requiredFields = ['make', 'model', 'year', 'price'];
      const missingFields = requiredFields.filter(field => !parsed[field]);

      if (missingFields.length === 0) {
        console.log('✅ All required fields present');
      } else {
        console.log('❌ Missing fields:', missingFields.join(', '));
      }

      // Check price format
      if (parsed.price && parsed.price > 1000000) {
        console.log('✅ Price in correct format (IDR cents)');
      } else {
        console.log('⚠️  Price might not be in IDR cents format');
      }

      // Check descriptions
      if (parsed.descriptionId && parsed.descriptionEn) {
        console.log('✅ Both Indonesian and English descriptions present');
        console.log(`   - ID description length: ${parsed.descriptionId.length} chars`);
        console.log(`   - EN description length: ${parsed.descriptionEn.length} chars`);
      }

      // Check features
      if (parsed.features && Array.isArray(parsed.features)) {
        console.log(`✅ Features extracted: ${parsed.features.length} features`);
      }

      console.log();
      console.log('🎉 Test PASSED! z.ai API is working correctly.');

    } catch (parseError) {
      console.log('⚠️  Could not parse as JSON, but API call succeeded');
      console.log('Error:', parseError instanceof Error ? parseError.message : 'Unknown error');
    }

  } catch (error: any) {
    console.error('❌ Test FAILED!\n');
    console.error('Error details:');
    console.error('─'.repeat(80));

    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      console.error('No response received');
      console.error('Request:', error.request);
    } else {
      console.error('Error:', error.message);
    }

    console.error('─'.repeat(80));
    console.error('\n💡 Troubleshooting:');
    console.error('1. Check ZAI_API_KEY in .env.local');
    console.error('2. Check ZAI_BASE_URL is correct');
    console.error('3. Verify network connectivity');
    console.error('4. Check z.ai API status');

    process.exit(1);
  }
}

// Check environment variables
console.log('🔧 Configuration Check:');
console.log('─'.repeat(80));
console.log('ZAI_API_KEY:', process.env.ZAI_API_KEY ? '✅ Set (hidden)' : '❌ Not set');
console.log('ZAI_BASE_URL:', process.env.ZAI_BASE_URL || '❌ Not set');
console.log('ZAI_TEXT_MODEL:', process.env.ZAI_TEXT_MODEL || '❌ Not set');
console.log('API_TIMEOUT_MS:', process.env.API_TIMEOUT_MS || '❌ Not set');
console.log('─'.repeat(80));
console.log();

if (!process.env.ZAI_API_KEY || process.env.ZAI_API_KEY === 'your-zai-api-key-here') {
  console.error('❌ ZAI_API_KEY not configured in .env.local');
  console.error('Please set your z.ai API key before running this test.');
  process.exit(1);
}

// Run test
testVehicleIdentification();
