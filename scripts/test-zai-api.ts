/**
 * Test Z.AI API Connection
 *
 * This script tests different model configurations to find the correct one
 * for your Z.AI subscription.
 */

import OpenAI from 'openai';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env file
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// Get configuration from environment
const API_KEY = process.env.ZAI_API_KEY || '';
const BASE_URL = process.env.ZAI_BASE_URL || 'https://api.z.ai/api/paas/v4/';

// Models to test
const MODELS_TO_TEST = [
  'glm-4-plus',      // Latest text model
  'glm-4',           // Standard text model
  'glm-4-flash',     // Fast model
  'glm-4-air',       // Lightweight model
  'glm-4-airx',      // Extended lightweight
  'glm-4-long',      // Long context model
];

// Different base URLs to try
const BASE_URLS_TO_TEST = [
  'https://api.z.ai/api/paas/v4/',           // Regular plan
  'https://api.z.ai/api/coding/paas/v4/',    // Coding plan
  'https://open.bigmodel.cn/api/paas/v4/',   // Official endpoint
];

async function testModel(baseUrl: string, modelName: string): Promise<{
  success: boolean;
  error?: string;
  responseTime?: number;
}> {
  try {
    console.log(`\n[Testing] ${baseUrl} with model: ${modelName}`);

    const client = new OpenAI({
      apiKey: API_KEY,
      baseURL: baseUrl,
      timeout: 30000, // 30 seconds
    });

    const startTime = Date.now();

    const response = await client.chat.completions.create({
      model: modelName,
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Respond with just "OK" if you receive this message.' },
      ],
      max_tokens: 10,
      temperature: 0.1,
    });

    const responseTime = Date.now() - startTime;
    const content = response.choices[0]?.message?.content || '';

    console.log(`✅ SUCCESS! Response: "${content}" (${responseTime}ms)`);
    console.log(`   Model: ${modelName}`);
    console.log(`   Endpoint: ${baseUrl}`);

    return {
      success: true,
      responseTime,
    };
  } catch (error: any) {
    const errorMsg = error.message || String(error);
    console.log(`❌ FAILED: ${errorMsg}`);

    // Check for specific error codes
    if (error.status === 429) {
      console.log(`   → 429 Error: Quota exceeded or model not available in subscription`);
    } else if (error.status === 404) {
      console.log(`   → 404 Error: Model not found or incorrect endpoint`);
    } else if (error.status === 401) {
      console.log(`   → 401 Error: Invalid API key`);
    }

    return {
      success: false,
      error: errorMsg,
    };
  }
}

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Z.AI API Configuration Test');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`API Key: ${API_KEY ? API_KEY.substring(0, 20) + '...' : 'NOT SET'}`);
  console.log(`Current Base URL: ${BASE_URL}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  if (!API_KEY || API_KEY === 'your-zai-api-key-here') {
    console.error('❌ ZAI_API_KEY not configured in .env file');
    process.exit(1);
  }

  const results: Array<{
    baseUrl: string;
    model: string;
    success: boolean;
    responseTime?: number;
  }> = [];

  // Test each combination
  for (const baseUrl of BASE_URLS_TO_TEST) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Testing endpoint: ${baseUrl}`);
    console.log('='.repeat(60));

    for (const model of MODELS_TO_TEST) {
      const result = await testModel(baseUrl, model);
      results.push({
        baseUrl,
        model,
        success: result.success,
        responseTime: result.responseTime,
      });

      // Add small delay between requests
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  // Print summary
  console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('SUMMARY - Working Configurations');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const successful = results.filter((r) => r.success);

  if (successful.length === 0) {
    console.log('❌ No working configurations found!');
    console.log('\nPossible issues:');
    console.log('1. API key is invalid or expired');
    console.log('2. Subscription does not include these models');
    console.log('3. Rate limit exceeded');
    console.log('\nPlease check your Z.AI dashboard at: https://z.ai/manage-apikey/subscription');
  } else {
    console.log('✅ Found working configurations:\n');

    // Sort by response time
    successful.sort((a, b) => (a.responseTime || 0) - (b.responseTime || 0));

    successful.forEach((result, index) => {
      console.log(`${index + 1}. Model: ${result.model}`);
      console.log(`   Endpoint: ${result.baseUrl}`);
      console.log(`   Response Time: ${result.responseTime}ms`);
      console.log('');
    });

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('RECOMMENDED CONFIGURATION FOR .env');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const recommended = successful[0];
    console.log(`ZAI_BASE_URL="${recommended.baseUrl}"`);
    console.log(`ZAI_TEXT_MODEL="${recommended.model}"`);
    console.log('\nCopy the above lines to your .env file and restart the application.');
  }

  console.log('\n');
}

main().catch(console.error);
