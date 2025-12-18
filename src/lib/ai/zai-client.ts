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
   * Generate text completion using GLM-4.6 with reasoning disabled
   */
  async generateText(params: {
    systemPrompt: string;
    userPrompt: string;
    temperature?: number;
    maxTokens?: number;
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
        // Add tools for vehicle operations
        tools: [
          {
            type: "function",
            function: {
              name: "send_vehicle_images",
              description: "Kirim foto mobil ke customer via WhatsApp. PANGGIL LANGSUNG ketika: 1) Customer bilang 'iya/ya/mau/boleh/ok/oke/yup/sip/kirim/gas/lanjut' setelah ditawari foto, 2) Customer minta foto (ada foto/lihat gambar/kirimin foto), 3) Customer tertarik dan konfirmasi. JANGAN panggil jika customer menolak atau tanya hal lain.",
              parameters: {
                type: "object",
                properties: {
                  search_query: {
                    type: "string",
                    description: "Nama mobil dari percakapan sebelumnya. Contoh: 'Brio', 'Avanza', 'Jazz', 'Brio Agya'. Ambil dari konteks chat."
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
              description: "Cari mobil berdasarkan kriteria customer (budget, merk, transmisi, tahun, dll). Panggil ini untuk menjawab pertanyaan tentang ketersediaan mobil.",
              parameters: {
                type: "object",
                properties: {
                  min_price: {
                    type: "number",
                    description: "Harga minimum dalam Rupiah. Contoh: budget 100jt → min_price: 100000000"
                  },
                  max_price: {
                    type: "number",
                    description: "Harga maksimum dalam Rupiah. Contoh: budget 150jt → max_price: 150000000"
                  },
                  make: {
                    type: "string",
                    description: "Merk mobil: Toyota, Honda, Daihatsu, Suzuki, Mitsubishi, Nissan, dll"
                  },
                  transmission: {
                    type: "string",
                    enum: ["manual", "automatic", "matic", "at", "mt"],
                    description: "Jenis transmisi: manual/mt atau automatic/matic/at"
                  },
                  min_year: {
                    type: "integer",
                    description: "Tahun minimal. Contoh: 'tahun 2020 ke atas' → min_year: 2020"
                  },
                  max_year: {
                    type: "integer",
                    description: "Tahun maksimal"
                  },
                  fuel_type: {
                    type: "string",
                    enum: ["bensin", "diesel", "hybrid", "electric"],
                    description: "Jenis bahan bakar"
                  },
                  sort_by: {
                    type: "string",
                    enum: ["newest", "oldest", "price_low", "price_high", "mileage_low"],
                    description: "Urutan: newest (terbaru), oldest (terlama), price_low (termurah), price_high (termahal), mileage_low (km terendah)"
                  },
                  limit: {
                    type: "integer",
                    description: "Jumlah hasil maksimal (default 5)"
                  }
                }
              }
            }
          },
          {
            type: "function",
            function: {
              name: "upload_vehicle",
              description: "Upload a new vehicle to inventory. Call this when staff provides vehicle information to add to the showroom catalog. Staff may say 'upload', 'tambah mobil', 'input mobil', etc.",
              parameters: {
                type: "object",
                properties: {
                  make: {
                    type: "string",
                    description: "Vehicle manufacturer/brand (e.g., 'Toyota', 'Honda', 'Daihatsu', 'Suzuki', 'Mitsubishi')"
                  },
                  model: {
                    type: "string",
                    description: "Vehicle model name (e.g., 'Avanza', 'Brio', 'Xenia', 'Ertiga', 'Xpander')"
                  },
                  year: {
                    type: "integer",
                    description: "Manufacturing year (e.g., 2020, 2021, 2024)"
                  },
                  price: {
                    type: "number",
                    description: "Vehicle price in Indonesian Rupiah (IDR). Convert shorthand to full number: '120jt' = 120000000, '95juta' = 95000000, '250rb' = 250000"
                  },
                  mileage: {
                    type: "number",
                    description: "Mileage in kilometers. Convert shorthand: '30rb' = 30000, '50ribu' = 50000, '100000km' = 100000. If not mentioned, use 0."
                  },
                  color: {
                    type: "string",
                    description: "Vehicle color in Indonesian (e.g., 'Hitam', 'Putih', 'Silver', 'Merah', 'Abu-abu'). If not mentioned, use 'Unknown'."
                  },
                  transmission: {
                    type: "string",
                    enum: ["Manual", "Automatic", "CVT"],
                    description: "Transmission type. Convert: 'MT/manual/Manual' → 'Manual', 'AT/matic/Matic/automatic' → 'Automatic', 'CVT/cvt' → 'CVT'. If not mentioned, use 'Manual'."
                  }
                },
                required: ["make", "model", "year", "price"]
              }
            }
          }
        ],
        tool_choice: "auto"
      };

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
