/**
 * Comprehensive Epic 2 AI Services Test
 * Tests all three AI services with actual API calls
 */

import OpenAI from 'openai';

// Load environment variables
import * as dotenv from 'dotenv';
dotenv.config();

console.log('='.repeat(80));
console.log('🧪 Epic 2 AI Services Comprehensive Test');
console.log('='.repeat(80));
console.log();

// Test sample vehicle photo URLs (public accessible for testing)
const TEST_PHOTO_URLS = [
  'https://images.unsplash.com/photo-1583121274602-3e2820c69888?w=800', // Toyota
  'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=800'  // Honda
];

// Initialize OpenAI client for z.ai
const client = new OpenAI({
  apiKey: process.env.ZAI_API_KEY || '',
  baseURL: process.env.ZAI_BASE_URL || 'https://api.z.ai/api/paas/v4/',
  timeout: 300000 // 5 minutes
});

// Test results storage
const results = {
  identification: { success: false, duration: 0, data: null as any, error: null as any },
  description: { success: false, duration: 0, data: null as any, error: null as any },
  pricing: { success: false, duration: 0, data: null as any, error: null as any }
};

/**
 * Test 1: Vehicle Identification (GLM-4.5V)
 */
async function testVehicleIdentification() {
  console.log('📸 Test 1: Vehicle Identification (GLM-4.5V)');
  console.log('-'.repeat(80));

  const systemPrompt = `You are an expert automotive identifier specializing in the Indonesian vehicle market.

Analyze the provided vehicle photos and identify:
1. Make (Manufacturer) - e.g., Toyota, Honda
2. Model - e.g., Avanza, CR-V
3. Year - Estimate based on design
4. Variant/Trim
5. Transmission Type
6. Fuel Type
7. Color
8. Condition
9. Visible Features
10. Confidence Score (0-100)

Return ONLY a valid JSON object with this structure:
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
  "bodyType": "sedan | suv | mpv | hatchback | null",
  "confidence": number,
  "reasoning": "string"
}`;

  const userContent = [
    {
      type: 'text' as const,
      text: 'Please identify this vehicle from the photos. Provide response in JSON format.'
    },
    ...TEST_PHOTO_URLS.map(url => ({
      type: 'image_url' as const,
      image_url: { url, detail: 'high' as const }
    }))
  ];

  try {
    console.log(`Testing with ${TEST_PHOTO_URLS.length} photos...`);
    const startTime = Date.now();

    const response = await client.chat.completions.create({
      model: process.env.ZAI_VISION_MODEL || 'glm-4.5v',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent }
      ],
      max_tokens: 4096,
      temperature: 0.3
    });

    const duration = Date.now() - startTime;
    const rawResponse = response.choices[0]?.message?.content || '{}';

    console.log(`✅ Request completed in ${(duration / 1000).toFixed(2)}s`);
    console.log();

    // Parse JSON response
    const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No valid JSON found in response');
    }

    const identification = JSON.parse(jsonMatch[0]);

    console.log('Identification Results:');
    console.log(`  Make: ${identification.make}`);
    console.log(`  Model: ${identification.model}`);
    console.log(`  Year: ${identification.year}`);
    console.log(`  Variant: ${identification.variant || 'N/A'}`);
    console.log(`  Transmission: ${identification.transmissionType || 'N/A'}`);
    console.log(`  Fuel: ${identification.fuelType || 'N/A'}`);
    console.log(`  Color: ${identification.color || 'N/A'}`);
    console.log(`  Condition: ${identification.condition || 'N/A'}`);
    console.log(`  Confidence: ${identification.confidence}%`);
    console.log(`  Features: ${identification.visibleFeatures?.join(', ') || 'None'}`);
    console.log();
    console.log(`  Reasoning: ${identification.reasoning}`);

    results.identification = {
      success: true,
      duration,
      data: identification,
      error: null
    };

    return identification;
  } catch (error: any) {
    const duration = Date.now() - Date.now();
    console.log('❌ Test failed!');
    console.log(`  Error: ${error.message}`);

    results.identification = {
      success: false,
      duration,
      data: null,
      error: error.message
    };

    throw error;
  }
}

/**
 * Test 2: Description Generation (GLM-4.6)
 */
async function testDescriptionGeneration(vehicleData: any) {
  console.log();
  console.log('📝 Test 2: Description Generation (GLM-4.6)');
  console.log('-'.repeat(80));

  const systemPrompt = `Kamu adalah seorang penulis konten otomotif profesional yang ahli dalam menulis deskripsi kendaraan untuk showroom di Indonesia.

Buatlah deskripsi kendaraan yang menarik dan informatif dalam format JSON:
{
  "description": "Deskripsi lengkap 3-4 paragraf dalam Bahasa Indonesia",
  "features": ["Fitur 1", "Fitur 2", ...],
  "highlights": ["Poin menarik 1", "Poin menarik 2", ...]
}`;

  const userPrompt = `Buatlah deskripsi untuk kendaraan berikut:

**Merek:** ${vehicleData.make}
**Model:** ${vehicleData.model}
**Tahun:** ${vehicleData.year}
${vehicleData.variant ? `**Varian:** ${vehicleData.variant}` : ''}
${vehicleData.transmissionType ? `**Transmisi:** ${vehicleData.transmissionType}` : ''}
${vehicleData.fuelType ? `**Bahan Bakar:** ${vehicleData.fuelType}` : ''}
${vehicleData.color ? `**Warna:** ${vehicleData.color}` : ''}
${vehicleData.condition ? `**Kondisi:** ${vehicleData.condition}` : ''}

Buat deskripsi yang menarik dan informatif.`;

  try {
    console.log('Generating Indonesian description...');
    const startTime = Date.now();

    const response = await client.chat.completions.create({
      model: process.env.ZAI_TEXT_MODEL || 'glm-4.6',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 4096
    });

    const duration = Date.now() - startTime;
    const rawResponse = response.choices[0]?.message?.content || '{}';

    console.log(`✅ Request completed in ${(duration / 1000).toFixed(2)}s`);
    console.log();

    // Parse JSON response
    const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No valid JSON found in response');
    }

    const description = JSON.parse(jsonMatch[0]);

    console.log('Description Generated:');
    console.log('-'.repeat(80));
    console.log(description.description);
    console.log('-'.repeat(80));
    console.log();
    console.log(`Features (${description.features?.length || 0}):`);
    description.features?.forEach((feat: string, idx: number) => {
      console.log(`  ${idx + 1}. ${feat}`);
    });
    console.log();
    console.log(`Highlights (${description.highlights?.length || 0}):`);
    description.highlights?.forEach((hl: string, idx: number) => {
      console.log(`  ${idx + 1}. ${hl}`);
    });

    results.description = {
      success: true,
      duration,
      data: description,
      error: null
    };

    return description;
  } catch (error: any) {
    console.log('❌ Test failed!');
    console.log(`  Error: ${error.message}`);

    results.description = {
      success: false,
      duration: 0,
      data: null,
      error: error.message
    };

    throw error;
  }
}

/**
 * Test 3: Pricing Intelligence (GLM-4.6)
 */
async function testPricingIntelligence(vehicleData: any) {
  console.log();
  console.log('💰 Test 3: Pricing Intelligence (GLM-4.6)');
  console.log('-'.repeat(80));

  const systemPrompt = `Kamu adalah seorang analis pasar otomotif Indonesia yang ahli dalam pricing kendaraan.

Berikan analisis pricing dalam format JSON:
{
  "marketAverage": number (dalam rupiah),
  "suggestedMin": number (dalam rupiah),
  "suggestedMax": number (dalam rupiah),
  "confidence": number (0-100),
  "reasoning": "string menjelaskan harga",
  "demandLevel": "low | medium | high",
  "marketTrend": "declining | stable | rising"
}`;

  const userPrompt = `Berikan analisis pricing untuk:

**Merek:** ${vehicleData.make}
**Model:** ${vehicleData.model}
**Tahun:** ${vehicleData.year}
${vehicleData.variant ? `**Varian:** ${vehicleData.variant}` : ''}
${vehicleData.transmissionType ? `**Transmisi:** ${vehicleData.transmissionType}` : ''}

Berikan rekomendasi harga untuk pasar Indonesia.`;

  try {
    console.log('Analyzing pricing...');
    const startTime = Date.now();

    const response = await client.chat.completions.create({
      model: process.env.ZAI_TEXT_MODEL || 'glm-4.6',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.4,
      max_tokens: 4096
    });

    const duration = Date.now() - startTime;
    const rawResponse = response.choices[0]?.message?.content || '{}';

    console.log(`✅ Request completed in ${(duration / 1000).toFixed(2)}s`);
    console.log();

    // Parse JSON response
    const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No valid JSON found in response');
    }

    const pricing = JSON.parse(jsonMatch[0]);

    const formatIDR = (amount: number) => {
      return `Rp ${amount.toLocaleString('id-ID')}`;
    };

    console.log('Pricing Analysis:');
    console.log(`  Market Average: ${formatIDR(pricing.marketAverage)}`);
    console.log(`  Suggested Range: ${formatIDR(pricing.suggestedMin)} - ${formatIDR(pricing.suggestedMax)}`);
    console.log(`  Confidence: ${pricing.confidence}%`);
    console.log(`  Demand Level: ${pricing.demandLevel}`);
    console.log(`  Market Trend: ${pricing.marketTrend}`);
    console.log();
    console.log(`  Reasoning: ${pricing.reasoning}`);

    results.pricing = {
      success: true,
      duration,
      data: pricing,
      error: null
    };

    return pricing;
  } catch (error: any) {
    console.log('❌ Test failed!');
    console.log(`  Error: ${error.message}`);

    results.pricing = {
      success: false,
      duration: 0,
      data: null,
      error: error.message
    };

    throw error;
  }
}

/**
 * Main test runner
 */
async function runTests() {
  const totalStartTime = Date.now();

  try {
    // Test 1: Vehicle Identification
    const vehicleData = await testVehicleIdentification();

    // Test 2: Description Generation
    await testDescriptionGeneration(vehicleData);

    // Test 3: Pricing Intelligence
    await testPricingIntelligence(vehicleData);

    const totalDuration = Date.now() - totalStartTime;

    // Summary
    console.log();
    console.log('='.repeat(80));
    console.log('📊 Test Summary');
    console.log('='.repeat(80));
    console.log();

    console.log('Results:');
    console.log(`  ✅ Vehicle Identification: ${results.identification.success ? 'PASSED' : 'FAILED'} (${(results.identification.duration / 1000).toFixed(2)}s)`);
    console.log(`  ✅ Description Generation: ${results.description.success ? 'PASSED' : 'FAILED'} (${(results.description.duration / 1000).toFixed(2)}s)`);
    console.log(`  ✅ Pricing Intelligence: ${results.pricing.success ? 'PASSED' : 'FAILED'} (${(results.pricing.duration / 1000).toFixed(2)}s)`);
    console.log();

    console.log(`Total Duration: ${(totalDuration / 1000).toFixed(2)}s`);
    console.log(`Target: < 90s`);
    console.log(`Status: ${totalDuration < 90000 ? '✅ WITHIN TARGET' : '⚠️ EXCEEDS TARGET'}`);
    console.log();

    const allPassed = results.identification.success && results.description.success && results.pricing.success;

    if (allPassed) {
      console.log('🎉 ALL TESTS PASSED!');
      console.log();
      console.log('Your Epic 2 AI services are working correctly!');
      console.log();
      console.log('Next steps:');
      console.log('  1. Test with real vehicle photos');
      console.log('  2. Test complete upload workflow');
      console.log('  3. Setup Cloudflare R2 for storage');
      console.log('  4. Run end-to-end integration tests');
    } else {
      console.log('❌ SOME TESTS FAILED');
      console.log();
      console.log('Please review the errors above and fix the issues.');
    }

    console.log();
    console.log('='.repeat(80));

    process.exit(allPassed ? 0 : 1);
  } catch (error: any) {
    const totalDuration = Date.now() - totalStartTime;

    console.log();
    console.log('='.repeat(80));
    console.log('❌ TEST SUITE FAILED');
    console.log('='.repeat(80));
    console.log();
    console.log(`Error: ${error.message}`);
    console.log(`Duration: ${(totalDuration / 1000).toFixed(2)}s`);
    console.log();
    console.log('Please check:');
    console.log('  1. ZAI_API_KEY is correct and has sufficient quota');
    console.log('  2. Internet connection is stable');
    console.log('  3. z.ai service is operational');
    console.log('  4. All environment variables are set correctly');
    console.log();
    console.log('='.repeat(80));

    process.exit(1);
  }
}

// Run tests
runTests();
