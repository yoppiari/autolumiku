```/**
``` * Z.AI API Client - OPTIMIZED for faster WhatsApp responses
``` *
``` * Provides wrapper for z.ai GLM models (GLM-4.6 and GLM-4.5V)
``` * using OpenAI SDK compatibility
``` */
```
```import OpenAI from 'openai';
```
```export interface ZAIClientConfig {
```  apiKey: string;
```  baseURL: string;
```  timeout?: number;
```  textModel?: string;
```  visionModel?: string;
```}
```
```export class ZAIClient {
```  private client: OpenAI;
```  private textModel: string;
```  private visionModel: string;
```
```  constructor(config: ZAIClientConfig) {
```    this.client = new OpenAI({
```      apiKey: config.apiKey,
```      baseURL: config.baseURL,
```      timeout: config.timeout || 15000, // OPTIMIZED: 15 seconds for faster fail
```    });
```
```    this.textModel = config.textModel || 'glm-4.6';
```    this.visionModel = config.visionModel || 'glm-4.5v';
```  }
```
```  /**
```   * Generate text completion using GLM-4.6
```   * OPTIMIZED: Reduced logging, shorter max_tokens for faster response
```   */
```  async generateText(params: {
```    systemPrompt: string;
```    userPrompt: string;
```    temperature?: number;
```    maxTokens?: number;
```  }) {
```    // OPTIMIZED: max_tokens reduced from 100000 to 400 for faster response
```    const maxTokens = params.maxTokens ?? 400;
```
```    try {
```      const response = await this.client.chat.completions.create({
```        model: this.textModel,
```        messages: [
```          { role: 'system', content: params.systemPrompt },
```          { role: 'user', content: params.userPrompt },
```        ],
```        temperature: params.temperature ?? 0.7,
```        max_tokens: maxTokens,
```      });
```
```      const content = response.choices[0]?.message?.content || '';
```
```      return {
```        content,
```        reasoning: (response.choices[0]?.message as any)?.reasoning_content || null,
```        finishReason: response.choices[0]?.finish_reason,
```        usage: response.usage,
```      };
```    } catch (error: any) {
```      console.error('[ZAI Client] API call failed:', error.message);
```      throw error;
```    }
```  }
```
```  /**
```   * Generate vision completion using GLM-4.5V
```   */
```  async generateVision(params: {
```    systemPrompt: string;
```    userPrompt: string;
```    images: string[]; // Base64 encoded images
```    temperature?: number;
```    maxTokens?: number;
```  }) {
```    const imageMessages = params.images.map((img) => ({
```      type: 'image_url' as const,
```      image_url: { url: img },
```    }));
```
```    const response = await this.client.chat.completions.create({
```      model: this.visionModel,
```      messages: [
```        { role: 'system', content: params.systemPrompt },
```        {
```          role: 'user',
```          content: [
```            { type: 'text' as const, text: params.userPrompt },
```            ...imageMessages,
```          ],
```        },
```      ],
```      temperature: params.temperature ?? 0.7,
```      max_tokens: params.maxTokens ?? 500, // OPTIMIZED: reduced from 100000
```    });
```
```    return {
```      content: response.choices[0]?.message?.content || '',
```      reasoning: (response.choices[0]?.message as any)?.reasoning_content || null,
```      finishReason: response.choices[0]?.finish_reason,
```      usage: response.usage,
```    };
```  }
```
```  /**
```   * Parse JSON from AI response (handles markdown code blocks)
```   */
```  parseJSON<T>(content: string): T {
```    let jsonContent = content.trim();
```
```    // Remove markdown code block syntax
```    if (jsonContent.startsWith('\`\`\`')) {
```      jsonContent = jsonContent.replace(/^\`\`\`(?:json)?\s*\n?/m, '');
```      jsonContent = jsonContent.replace(/\n?\`\`\`\s*$/m, '');
```    }
```
```    jsonContent = jsonContent.trim();
```
```    return JSON.parse(jsonContent);
```  }
```}
```
```/**
``` * Create ZAI client from environment variables
``` * Returns null if environment variables are not configured (e.g., during build time)
``` */
```export function createZAIClient(): ZAIClient | null {
```  const apiKey = process.env.ZAI_API_KEY;
```  const baseURL = process.env.ZAI_BASE_URL;
```
```  // Return null during build time or when not configured
```  if (!apiKey || apiKey === 'your-zai-api-key-here' || !baseURL) {
```    if (process.env.NODE_ENV === 'production' && typeof window === 'undefined') {
```      return null;
```    }
```    throw new Error('ZAI_API_KEY and ZAI_BASE_URL not configured in environment variables');
```  }
```
```  return new ZAIClient({
```    apiKey,
```    baseURL,
```    timeout: parseInt(process.env.API_TIMEOUT_MS || '15000', 10), // OPTIMIZED: 15s timeout
```    textModel: process.env.ZAI_TEXT_MODEL || 'glm-4.6',
```    visionModel: process.env.ZAI_VISION_MODEL || 'glm-4.5v',
```  });
```}
