/**
 * Z.AI API Client
 *
 * Provides wrapper for z.ai GLM models (GLM-4.6 and GLM-4.5V)
 * using OpenAI SDK compatibility
 */

import OpenAI from 'openai';

export interface ZAIClientConfig {
  apiKey: string;
  baseURL: string;
  timeout?: number;
  textModel?: string;
  visionModel?: string;
}

export class ZAIClient {
  private client: OpenAI;
  private textModel: string;
  private visionModel: string;

  constructor(config: ZAIClientConfig) {
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
      timeout: config.timeout || 300000, // 5 minutes default
    });

    this.textModel = config.textModel || 'glm-4.6';
    this.visionModel = config.visionModel || 'glm-4.5v';
  }

  /**
   * Generate text completion using GLM-4.6
   */
  async generateText(params: {
    systemPrompt: string;
    userPrompt: string;
    temperature?: number;
    maxTokens?: number;
  }) {
    console.log('[ZAI Client] 🚀 Starting generateText call...');
    console.log('[ZAI Client] Model:', this.textModel);
    console.log('[ZAI Client] Temperature:', params.temperature ?? 0.7);
    console.log('[ZAI Client] Max Tokens:', params.maxTokens ?? 4000);
    console.log('[ZAI Client] System Prompt Length:', params.systemPrompt.length);
    console.log('[ZAI Client] User Prompt Length:', params.userPrompt.length);

    try {
      console.log('[ZAI Client] 📡 Calling OpenAI API (ZAI endpoint)...');
      const response = await this.client.chat.completions.create({
        model: this.textModel,
        messages: [
          { role: 'system', content: params.systemPrompt },
          { role: 'user', content: params.userPrompt },
        ],
        temperature: params.temperature ?? 0.7,
        max_tokens: params.maxTokens ?? 4000,
      });

      console.log('[ZAI Client] ✅ API call successful!');
      console.log('[ZAI Client] Response ID:', response.id);
      console.log('[ZAI Client] Model used:', response.model);
      console.log('[ZAI Client] Finish reason:', response.choices[0]?.finish_reason);
      console.log('[ZAI Client] Usage:', response.usage);
      console.log('[ZAI Client] 🔍 Full response.choices[0]:', JSON.stringify(response.choices[0], null, 2));
      console.log('[ZAI Client] 🔍 Message object:', response.choices[0]?.message);
      console.log('[ZAI Client] 🔍 Content value:', response.choices[0]?.message?.content);
      console.log('[ZAI Client] 🔍 Content type:', typeof response.choices[0]?.message?.content);

      const content = response.choices[0]?.message?.content || '';
      console.log('[ZAI Client] Response length:', content.length, 'characters');

      return {
        content,
        reasoning: (response.choices[0]?.message as any)?.reasoning_content || null,
        finishReason: response.choices[0]?.finish_reason,
        usage: response.usage,
      };
    } catch (error: any) {
      console.error('[ZAI Client] ❌ API call failed!');
      console.error('[ZAI Client] Error type:', error.constructor.name);
      console.error('[ZAI Client] Error message:', error.message);
      console.error('[ZAI Client] Error status:', error.status);
      console.error('[ZAI Client] Error code:', error.code);
      console.error('[ZAI Client] Error response:', error.response?.data);
      console.error('[ZAI Client] Error stack:', error.stack);
      throw error;
    }
  }

  /**
   * Generate vision completion using GLM-4.5V
   */
  async generateVision(params: {
    systemPrompt: string;
    userPrompt: string;
    images: string[]; // Base64 encoded images
    temperature?: number;
    maxTokens?: number;
  }) {
    const imageMessages = params.images.map((img) => ({
      type: 'image_url' as const,
      image_url: { url: img },
    }));

    const response = await this.client.chat.completions.create({
      model: this.visionModel,
      messages: [
        { role: 'system', content: params.systemPrompt },
        {
          role: 'user',
          content: [
            { type: 'text' as const, text: params.userPrompt },
            ...imageMessages,
          ],
        },
      ],
      temperature: params.temperature ?? 0.7,
      max_tokens: params.maxTokens ?? 4000,
    });

    return {
      content: response.choices[0]?.message?.content || '',
      reasoning: (response.choices[0]?.message as any)?.reasoning_content || null,
      finishReason: response.choices[0]?.finish_reason,
      usage: response.usage,
    };
  }

  /**
   * Parse JSON from AI response (handles markdown code blocks)
   */
  parseJSON<T>(content: string): T {
    let jsonContent = content.trim();

    // Remove markdown code block syntax
    if (jsonContent.startsWith('```')) {
      jsonContent = jsonContent.replace(/^```(?:json)?\s*\n?/m, '');
      jsonContent = jsonContent.replace(/\n?```\s*$/m, '');
    }

    jsonContent = jsonContent.trim();

    return JSON.parse(jsonContent);
  }
}

/**
 * Create ZAI client from environment variables
 * Returns null if environment variables are not configured (e.g., during build time)
 */
export function createZAIClient(): ZAIClient | null {
  const apiKey = process.env.ZAI_API_KEY;
  const baseURL = process.env.ZAI_BASE_URL;

  console.log('[ZAI Client Factory] 🔧 Creating ZAI client...');
  console.log('[ZAI Client Factory] API Key exists:', !!apiKey);
  console.log('[ZAI Client Factory] API Key (first 10 chars):', apiKey?.substring(0, 10) + '...');
  console.log('[ZAI Client Factory] Base URL:', baseURL);
  console.log('[ZAI Client Factory] Text Model:', process.env.ZAI_TEXT_MODEL || 'glm-4.6');
  console.log('[ZAI Client Factory] Vision Model:', process.env.ZAI_VISION_MODEL || 'glm-4.5v');
  console.log('[ZAI Client Factory] Timeout:', process.env.API_TIMEOUT_MS || '300000', 'ms');

  // Return null during build time or when not configured
  if (!apiKey || apiKey === 'your-zai-api-key-here' || !baseURL) {
    console.warn('[ZAI Client Factory] ⚠️ ZAI client not configured properly');
    console.warn('[ZAI Client Factory] API Key missing or placeholder:', !apiKey || apiKey === 'your-zai-api-key-here');
    console.warn('[ZAI Client Factory] Base URL missing:', !baseURL);

    if (process.env.NODE_ENV === 'production' && typeof window === 'undefined') {
      // During build time, return null instead of throwing
      console.log('[ZAI Client Factory] Returning null for build time');
      return null;
    }
    throw new Error('ZAI_API_KEY and ZAI_BASE_URL not configured in environment variables');
  }

  console.log('[ZAI Client Factory] ✅ ZAI client created successfully');
  return new ZAIClient({
    apiKey,
    baseURL,
    timeout: parseInt(process.env.API_TIMEOUT_MS || '60000', 10),  // Reduced timeout from 300s to 60s
    textModel: process.env.ZAI_TEXT_MODEL || 'glm-4.6',
    visionModel: process.env.ZAI_VISION_MODEL || 'glm-4.5v',
  });
}
