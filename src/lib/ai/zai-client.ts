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
    console.log('[ZAI Client Constructor] Creating OpenAI client with baseURL:', config.baseURL);
    console.log('[ZAI Client Constructor] OpenAI SDK will call:', config.baseURL + 'chat/completions');

    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
      timeout: config.timeout || 300000, // 5 minutes default
    });

    this.textModel = config.textModel || 'glm-4.6';
    this.visionModel = config.visionModel || 'glm-4.5v';
  }

  /**
   * Alias for generateText for backward compatibility
   */
  async generateChatResponse(params: any) {
    // Map parameters from the old generateChatResponse format to the new generateText format
    return this.generateText({
      systemPrompt: params.systemPrompt,
      userPrompt: params.userPrompt || `${params.conversationContext}\n\nUser Message: ${params.userMessage}`,
      temperature: params.temperature,
      maxTokens: params.maxTokens,
      includeTools: params.includeTools
    });
  }

  /**
   * Generate text completion using GLM-4.6 with reasoning disabled
   * @param includeTools - Whether to include function calling tools (default: true for chat, false for JSON generation)
   */
  async generateText(params: {
    systemPrompt: string;
    userPrompt: string;
    temperature?: number;
    maxTokens?: number;
    includeTools?: boolean; // Set to false for JSON generation tasks
  }) {
    console.log('[ZAI Client] 🚀 Starting generateText call...');
    console.log('[ZAI Client] Model:', this.textModel);
    console.log('[ZAI Client] System Prompt Length:', params.systemPrompt.length);
    console.log('[ZAI Client] User Prompt Length:', params.userPrompt.length);

    try {
      console.log('[ZAI Client] 📡 Calling OpenAI API (ZAI endpoint)...');
      console.log('[ZAI Client] Request details:', JSON.stringify({
        model: this.textModel,
        thinking: { type: "disabled" },
        messages: [
          { role: 'system', contentLength: params.systemPrompt.length },
          { role: 'user', contentLength: params.userPrompt.length }
        ]
      }, null, 2));

      const requestParams: any = {
        model: this.textModel,
        messages: [
          { role: 'system', content: params.systemPrompt },
          { role: 'user', content: params.userPrompt },
        ],
        // Disable thinking/reasoning mode for faster chat responses
        thinking: {
          type: "disabled"
        },
      };

      // Only add tools for chat interactions (WhatsApp AI), not for JSON generation tasks
      if (params.includeTools !== false) {
        requestParams.tools = [
          {
            type: "function",
            function: {
              name: "send_vehicle_images",
              description: "Kirim foto kendaraan. Panggil saat customer confirm mau lihat foto (iya/boleh/mau/kirim) atau minta foto eksplisit. Jangan panggil jika menolak.",
              parameters: {
                type: "object",
                properties: {
                  search_query: {
                    type: "string",
                    description: "Nama mobil dari konteks chat. Contoh: 'Brio', 'Avanza', 'PM-PST-001'."
                  }
                },
                required: ["search_query"]
              }
            }
          },
          {
            type: "function",
            function: {
              name: "search_vehicles",
              description: "Cari mobil berdasarkan kriteria (budget, merk, transmisi, dll). Gunakan untuk menjawab pertanyaan ketersediaan stok.",
              parameters: {
                type: "object",
                properties: {
                  min_price: {
                    type: "number",
                    description: "Harga min (Rupiah). Contoh: 100jt → 100000000"
                  },
                  max_price: {
                    type: "number",
                    description: "Harga max (Rupiah). Contoh: 150jt → 150000000"
                  },
                  make: {
                    type: "string",
                    description: "Merk/Model/ID. Contoh: 'Toyota', 'Avanza', 'PM-PST-001'"
                  },
                  transmission: {
                    type: "string",
                    enum: ["manual", "automatic", "matic", "at", "mt"],
                    description: "Transmisi: manual/mt atau automatic/matic/at"
                  },
                  min_year: {
                    type: "integer",
                    description: "Tahun min"
                  },
                  max_year: {
                    type: "integer",
                    description: "Tahun max"
                  },
                  fuel_type: {
                    type: "string",
                    enum: ["bensin", "diesel", "hybrid", "electric"],
                    description: "Jenis bahan bakar"
                  },
                  sort_by: {
                    type: "string",
                    enum: ["newest", "oldest", "price_low", "price_high", "mileage_low"],
                    description: "Urutan sort"
                  },
                  limit: {
                    type: "integer",
                    description: "Max hasil (default 5)"
                  }
                }
              }
            }
          },
          {
            type: "function",
            function: {
              name: "upload_vehicle",
              description: "Upload vehicle baru. Panggil saat staff memberi info mobil baru untuk ditambahkan ke katalog.",
              parameters: {
                type: "object",
                properties: {
                  make: {
                    type: "string",
                    description: "Merk (e.g. Toyota)"
                  },
                  model: {
                    type: "string",
                    description: "Model (e.g. Avanza)"
                  },
                  year: {
                    type: "integer",
                    description: "Tahun (e.g. 2021)"
                  },
                  price: {
                    type: "number",
                    description: "Harga (Rupiah full number)"
                  },
                  mileage: {
                    type: "number",
                    description: "KM (number)"
                  },
                  color: {
                    type: "string",
                    description: "Warna"
                  },
                  transmission: {
                    type: "string",
                    enum: ["Manual", "Automatic", "CVT"],
                    description: "Transmisi"
                  }
                },
                required: ["make", "model", "year", "price"]
              }
            }
          },
          {
            type: "function",
            function: {
              name: "edit_vehicle",
              description: "Edit data kendaraan. Panggil saat staff ingin ubah info (misal: 'ganti harga', 'rubah km', 'koreksi tahun').",
              parameters: {
                type: "object",
                properties: {
                  vehicle_id: {
                    type: "string",
                    description: "DisplayId (PM-PST-XXX) atau UUID"
                  },
                  field: {
                    type: "string",
                    enum: ["year", "price", "mileage", "color", "transmission", "fuelType", "make", "model", "variant", "engineCapacity", "condition"],
                    description: "Field target (e.g. price, mileage, color)"
                  },
                  old_value: {
                    type: "string",
                    description: "Nilai lama (opsional)"
                  },
                  new_value: {
                    type: "string",
                    description: "Nilai baru"
                  }
                },
                required: ["field", "new_value"]
              }
            }
          },
          {
            type: "function",
            function: {
              name: "calculate_kkb_simulation",
              description: "Menghitung simulasi kredit mobil (KKB) dengan estimasi angsuran. Panggil saat user tanya 'cicilan', 'kredit', 'angsuran', 'dp', atau simulasi.",
              parameters: {
                type: "object",
                properties: {
                  vehicle_price: {
                    type: "number",
                    description: "Harga kendaraan (Rupiah). Contoh: 150000000"
                  },
                  dp_amount: {
                    type: "number",
                    description: "Jumlah DP (Rupiah). Opsional."
                  },
                  dp_percentage: {
                    type: "number",
                    description: "Persen DP (e.g. 20 atau 30). Default 30. Opsional."
                  },
                  tenor_years: {
                    type: "integer",
                    description: "Tenor dalam tahun (1-5). Opsional."
                  }
                },
                required: ["vehicle_price"]
              }
            }
          }
        ];
        requestParams.tool_choice = "auto";
      }

      // Only add temperature and max_tokens if explicitly provided
      if (params.temperature !== undefined) {
        requestParams.temperature = params.temperature;
      }
      if (params.maxTokens !== undefined) {
        requestParams.max_tokens = params.maxTokens;
      }

      const response = await this.client.chat.completions.create(requestParams);

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
      const toolCalls = response.choices[0]?.message?.tool_calls || [];

      console.log('[ZAI Client] Response length:', content.length, 'characters');
      console.log('[ZAI Client] Tool calls:', toolCalls.length);

      return {
        content,
        reasoning: (response.choices[0]?.message as any)?.reasoning_content || null,
        finishReason: response.choices[0]?.finish_reason,
        usage: response.usage,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
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
      max_tokens: params.maxTokens ?? 100000,
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
    timeout: parseInt(process.env.API_TIMEOUT_MS || '30000', 10),
    textModel: process.env.ZAI_TEXT_MODEL || 'glm-4.6',
    visionModel: process.env.ZAI_VISION_MODEL || 'glm-4.5v',
  });
}
