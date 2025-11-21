/**
 * Test Script for z.ai GLM AI Services
 * Tests vehicle identification, description generation, and pricing intelligence
 */

require('dotenv').config();

console.log('='.repeat(80));
console.log('🧪 Testing AutoLumiKu AI Services (z.ai GLM Models)');
console.log('='.repeat(80));
console.log();

// Test 1: Environment Variables
console.log('📋 Test 1: Environment Variables Configuration');
console.log('-'.repeat(80));

const requiredEnvVars = [
  'ZAI_API_KEY',
  'ZAI_BASE_URL',
  'ZAI_VISION_MODEL',
  'ZAI_TEXT_MODEL'
];

let envTestPassed = true;

requiredEnvVars.forEach(varName => {
  const value = process.env[varName];
  const status = value ? '✅' : '❌';
  console.log(`${status} ${varName}: ${value ? '(configured)' : '(MISSING)'}`);

  if (!value) {
    envTestPassed = false;
  }
});

console.log();

if (!envTestPassed) {
  console.log('❌ Environment variables test FAILED!');
  console.log('Please check your .env file and ensure all required variables are set.');
  console.log();
  console.log('Required variables:');
  console.log('  ZAI_API_KEY="93ac6b4e9c1c49b4b64fed617669e569.5nfnaoMbbNaKZ26I"');
  console.log('  ZAI_BASE_URL="https://api.z.ai/api/paas/v4/"');
  console.log('  ZAI_VISION_MODEL="glm-4.5v"');
  console.log('  ZAI_TEXT_MODEL="glm-4.6"');
  process.exit(1);
}

console.log('✅ Environment variables test PASSED!');
console.log();

// Test 2: AI Service Modules
console.log('📦 Test 2: AI Service Modules Import');
console.log('-'.repeat(80));

let modulesTestPassed = true;

try {
  console.log('Loading vehicle-identification service...');
  const { vehicleIdentificationService } = require('../src/services/ai-services/vehicle-identification.ts');
  console.log('✅ vehicle-identification service loaded');
  console.log(`   Configured: ${vehicleIdentificationService.isConfigured()}`);
} catch (error) {
  console.log('❌ Failed to load vehicle-identification service');
  console.log(`   Error: ${error.message}`);
  modulesTestPassed = false;
}

try {
  console.log('Loading description-generator service...');
  const { descriptionGeneratorService } = require('../src/services/ai-services/description-generator.ts');
  console.log('✅ description-generator service loaded');
  console.log(`   Configured: ${descriptionGeneratorService.isConfigured()}`);
} catch (error) {
  console.log('❌ Failed to load description-generator service');
  console.log(`   Error: ${error.message}`);
  modulesTestPassed = false;
}

try {
  console.log('Loading pricing-intelligence service...');
  const { pricingIntelligenceService } = require('../src/services/ai-services/pricing-intelligence.ts');
  console.log('✅ pricing-intelligence service loaded');
  console.log(`   Configured: ${pricingIntelligenceService.isConfigured()}`);
} catch (error) {
  console.log('❌ Failed to load pricing-intelligence service');
  console.log(`   Error: ${error.message}`);
  modulesTestPassed = false;
}

console.log();

if (!modulesTestPassed) {
  console.log('❌ AI service modules test FAILED!');
  console.log('Some services could not be loaded. Check the error messages above.');
  process.exit(1);
}

console.log('✅ AI service modules test PASSED!');
console.log();

// Test 3: OpenAI SDK Connection
console.log('🔌 Test 3: z.ai API Connection Test');
console.log('-'.repeat(80));

const OpenAI = require('openai').default;

const client = new OpenAI({
  apiKey: process.env.ZAI_API_KEY,
  baseURL: process.env.ZAI_BASE_URL,
  timeout: 30000 // 30 seconds for test
});

console.log('Testing connection to z.ai API...');
console.log(`Base URL: ${process.env.ZAI_BASE_URL}`);
console.log(`Model: ${process.env.ZAI_TEXT_MODEL}`);
console.log();

async function testConnection() {
  try {
    console.log('Sending test request to GLM-4.6...');

    const response = await client.chat.completions.create({
      model: process.env.ZAI_TEXT_MODEL || 'glm-4.6',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant.'
        },
        {
          role: 'user',
          content: 'Say "Hello from GLM-4.6!" in Indonesian.'
        }
      ],
      max_tokens: 100,
      temperature: 0.3
    });

    console.log('✅ API connection test PASSED!');
    console.log();
    console.log('Response from GLM-4.6:');
    console.log('-'.repeat(80));
    console.log(response.choices[0].message.content);
    console.log('-'.repeat(80));
    console.log();
    console.log('Token usage:');
    console.log(`  Total tokens: ${response.usage?.total_tokens || 'N/A'}`);
    console.log();

    return true;
  } catch (error) {
    console.log('❌ API connection test FAILED!');
    console.log();
    console.log('Error details:');
    console.log(`  Type: ${error.constructor.name}`);
    console.log(`  Message: ${error.message}`);

    if (error.status) {
      console.log(`  Status: ${error.status}`);
    }

    if (error.code) {
      console.log(`  Code: ${error.code}`);
    }

    console.log();
    console.log('Troubleshooting tips:');
    console.log('  1. Check if ZAI_API_KEY is correct');
    console.log('  2. Verify ZAI_BASE_URL: https://api.z.ai/api/paas/v4/');
    console.log('  3. Ensure you have active z.ai subscription');
    console.log('  4. Check internet connection');
    console.log('  5. Visit https://z.ai/manage-apikey/apikey-list to verify API key');

    return false;
  }
}

// Run async test
testConnection().then(success => {
  console.log();
  console.log('='.repeat(80));

  if (success) {
    console.log('🎉 ALL TESTS PASSED!');
    console.log();
    console.log('Your z.ai GLM AI services are configured correctly and ready to use!');
    console.log();
    console.log('Next steps:');
    console.log('  1. Start development server: npm run dev');
    console.log('  2. Navigate to: http://localhost:3000/vehicles/upload');
    console.log('  3. Test vehicle upload workflow with real photos');
  } else {
    console.log('❌ TESTS FAILED!');
    console.log();
    console.log('Please fix the issues above and run the test again.');
    process.exit(1);
  }

  console.log('='.repeat(80));
}).catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
