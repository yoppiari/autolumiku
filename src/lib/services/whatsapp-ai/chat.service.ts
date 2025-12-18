/**
 * WhatsApp AI Chat Service
 * Handles customer conversations dengan Z.ai GLM-4 model
 * Context-aware dengan vehicle inventory dan showroom info
 */

import { createZAIClient } from "@/lib/ai/zai-client";
import { prisma } from "@/lib/prisma";
import { MessageIntent } from "./intent-classifier.service";

// ==================== TYPES ====================

export interface ChatContext {
  tenantId: string;
  conversationId: string;
  customerPhone: string;
  customerName?: string;
  intent: MessageIntent;
  messageHistory: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
}

export interface ChatResponse {
  message: string;
  shouldEscalate: boolean;
  confidence: number;
  processingTime: number;
  images?: Array<{ imageUrl: string; caption?: string }>; // Optional vehicle images
  uploadRequest?: {
    make: string;
    model: string;
    year: number;
    price: number;
    mileage?: number;
    color?: string;
    transmission?: string;
  }; // Optional vehicle upload request from AI
}

// ==================== WHATSAPP AI CHAT SERVICE ====================

export class WhatsAppAIChatService {
  /**
   * Generate AI response untuk customer message
   */
  static async generateResponse(
    context: ChatContext,
    userMessage: string
  ): Promise<ChatResponse> {
    const startTime = Date.now();

    console.log(`[WhatsApp AI Chat] Generating response for tenant: ${context.tenantId}, message: ${userMessage.substring(0, 50)}`);

    try {
      // Get AI config
      let account = await prisma.aimeowAccount.findUnique({
        where: { tenantId: context.tenantId },
        include: {
          aiConfig: true,
          tenant: true,
        },
      });

      if (!account) {
        console.error(`[WhatsApp AI Chat] Aimeow account not found for tenant: ${context.tenantId}`);
        throw new Error("Aimeow account not found");
      }
      console.log(`[WhatsApp AI Chat] Account found: ${account.id}`);

      // Auto-generate AI config if it doesn't exist
      if (!account.aiConfig) {
        console.log(`[WhatsApp AI Chat] Auto-generating AI config for tenant: ${context.tenantId}`);

        const defaultConfig = await prisma.whatsAppAIConfig.create({
          data: {
            accountId: account.id,
            tenantId: context.tenantId,
            aiName: "AI Assistant",
            aiPersonality: "friendly",
            welcomeMessage: `Halo! Saya adalah asisten virtual ${account.tenant.name}. Ada yang bisa saya bantu?`,
            customerChatEnabled: true,
            autoReply: true,
            staffCommandsEnabled: true,
            temperature: 0.7,
            enableVehicleInfo: true,
            enableTestDriveBooking: true,
          },
        });

        // Reload account with the new config
        account = await prisma.aimeowAccount.findUnique({
          where: { tenantId: context.tenantId },
          include: {
            aiConfig: true,
            tenant: true,
          },
        });

        if (!account) {
          throw new Error("Failed to reload account after creating AI config");
        }

        console.log(`[WhatsApp AI Chat] Created default AI config: ${defaultConfig.id}`);
      }

      const config = account.aiConfig!;
      console.log(`[WhatsApp AI Chat] AI Config loaded. customerChatEnabled: ${config.customerChatEnabled}`);

      // Check if customer chat is enabled
      if (!config.customerChatEnabled) {
        console.log(`[WhatsApp AI Chat] Customer chat is DISABLED. No auto-reply will be sent.`);
        return {
          message: "", // Return empty message - no auto-reply will be sent
          shouldEscalate: true,
          confidence: 1.0,
          processingTime: Date.now() - startTime,
        };
      }
      console.log(`[WhatsApp AI Chat] Customer chat is ENABLED. Proceeding with AI response.`);

      // Check business hours (optional)
      const shouldCheckHours = config.businessHours && config.afterHoursMessage;
      if (shouldCheckHours && !this.isWithinBusinessHours(config.businessHours, config.timezone)) {
        console.log(`[WhatsApp AI Chat] Outside business hours, returning after-hours message`);
        return {
          message: config.afterHoursMessage || "Kami sedang tutup. Silakan hubungi lagi pada jam operasional.",
          shouldEscalate: false,
          confidence: 1.0,
          processingTime: Date.now() - startTime,
        };
      }

      // Build system prompt
      console.log(`[WhatsApp AI Chat] Building system prompt for tenant: ${account.tenant.name}`);
      const systemPrompt = await this.buildSystemPrompt(
        account.tenant,
        config,
        context.intent
      );
      console.log(`[WhatsApp AI Chat] System prompt built (${systemPrompt.length} chars)`);

      // Build context dengan conversation history
      console.log(`[WhatsApp AI Chat] Building conversation context with ${context.messageHistory.length} history messages`);
      const conversationContext = this.buildConversationContext(
        context.messageHistory,
        userMessage
      );
      console.log(`[WhatsApp AI Chat] Conversation context built (${conversationContext.length} chars)`);

      // Generate response dengan Z.ai
      console.log(`[WhatsApp AI Chat] Creating ZAI client...`);
      const zaiClient = createZAIClient();
      if (!zaiClient) {
        console.error(`[WhatsApp AI Chat] ZAI client is null - missing API key or base URL`);
        throw new Error('ZAI client not configured. Please set ZAI_API_KEY and ZAI_BASE_URL environment variables.');
      }
      console.log(`[WhatsApp AI Chat] ZAI client created successfully. Calling API with params:`, {
        systemPromptLength: systemPrompt.length,
        userPromptLength: conversationContext.length,
      });

      let aiResponse;
      try {
        // Add a race condition with manual timeout (45s for tool calls)
        const apiCallPromise = zaiClient.generateText({
          systemPrompt,
          userPrompt: conversationContext,
        });

        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(new Error('ZAI API call timed out after 45 seconds'));
          }, 45000); // 45 second timeout for tool calls
        });

        aiResponse = await Promise.race([apiCallPromise, timeoutPromise]);

        // Trim leading/trailing whitespace from AI response
        if (aiResponse.content) {
          aiResponse.content = aiResponse.content.trim();
        }

        console.log(`[WhatsApp AI Chat] ✅ AI response received successfully`);
        console.log(`[WhatsApp AI Chat] Content length:`, aiResponse.content.length);
        console.log(`[WhatsApp AI Chat] Reasoning content length (should be 0 with glm-4-flash):`, aiResponse.reasoning?.length || 0);

        // If content is empty but reasoning exists, extract answer from reasoning
        if (!aiResponse.content && aiResponse.reasoning) {
          console.log(`[WhatsApp AI Chat] ⚠️ Content empty, extracting from reasoning...`);
          // The reasoning contains the thought process, but we need the final response
          // For now, use a fallback message
          aiResponse = {
            ...aiResponse,
            content: "Halo! Selamat datang di Showroom Jakarta Premium. Ada yang bisa saya bantu hari ini?"
          };
        }

        console.log(`[WhatsApp AI Chat] Response content (first 100 chars): ${aiResponse.content.substring(0, 100)}...`);
        console.log(`[WhatsApp AI Chat] Response usage:`, aiResponse.usage);
      } catch (apiError: any) {
        console.error(`[WhatsApp AI Chat] ❌ ZAI API call failed:`);
        console.error(`[WhatsApp AI Chat] API Error name:`, apiError.name);
        console.error(`[WhatsApp AI Chat] API Error message:`, apiError.message);
        console.error(`[WhatsApp AI Chat] API Error code:`, apiError.code);
        console.error(`[WhatsApp AI Chat] API Error status:`, apiError.status);
        console.error(`[WhatsApp AI Chat] API Error stack:`, apiError.stack);
        throw apiError;
      }

      // Analyze response untuk escalation
      const shouldEscalate = this.shouldEscalateToHuman(
        aiResponse.content,
        context.intent
      );

      const processingTime = Date.now() - startTime;

      // Handle tool calls (function calling)
      let images: Array<{ imageUrl: string; caption?: string }> | null = null;
      let uploadRequest: any = null;

      if (aiResponse.toolCalls && aiResponse.toolCalls.length > 0) {
        console.log('[WhatsApp AI Chat] 🔧 Processing tool calls:', aiResponse.toolCalls.length);

        for (const toolCall of aiResponse.toolCalls) {
          // Type guard: check if this is a function tool call (not custom)
          if (toolCall.type === 'function' && 'function' in toolCall) {
            console.log('[WhatsApp AI Chat] Tool call:', toolCall.function.name);

            if (toolCall.function.name === 'send_vehicle_images') {
              const args = JSON.parse(toolCall.function.arguments);
              const searchQuery = args.search_query;

              console.log('[WhatsApp AI Chat] 📸 AI requested vehicle images for:', searchQuery);

              images = await this.fetchVehicleImagesByQuery(searchQuery, context.tenantId);

              if (images && images.length > 0) {
                console.log(`[WhatsApp AI Chat] ✅ Found ${images.length} images to send`);
              } else {
                console.log('[WhatsApp AI Chat] ⚠️ No images found for query:', searchQuery);
              }
            } else if (toolCall.function.name === 'search_vehicles') {
              const args = JSON.parse(toolCall.function.arguments);
              console.log('[WhatsApp AI Chat] 🔍 AI searching vehicles with criteria:', args);

              const searchResults = await this.searchVehiclesByCriteria(context.tenantId, args);
              console.log(`[WhatsApp AI Chat] Found ${searchResults.length} vehicles matching criteria`);

              // Store search results in context for follow-up (like sending photos)
              if (searchResults.length > 0) {
                // Build vehicle names for potential photo sending
                const vehicleNames = searchResults.map(v => `${v.make} ${v.model}`).join(' ');
                console.log('[WhatsApp AI Chat] Vehicles found:', vehicleNames);
              }
            } else if (toolCall.function.name === 'upload_vehicle') {
              const args = JSON.parse(toolCall.function.arguments);

              console.log('[WhatsApp AI Chat] 🚗 AI detected vehicle upload request:', args);

              uploadRequest = {
                make: args.make,
                model: args.model,
                year: args.year,
                price: args.price,
                mileage: args.mileage || 0,
                color: args.color || 'Unknown',
                transmission: args.transmission || 'Manual',
              };
            }
          }
        }
      }

      // Build response message
      let responseMessage = aiResponse.content || '';

      // If AI sent images but no text, add default message
      if (images && images.length > 0 && !responseMessage) {
        responseMessage = `Ini foto ${images.length > 1 ? 'mobil-mobil' : 'mobil'} yang tersedia 👇`;
        console.log('[WhatsApp AI Chat] Added default image message:', responseMessage);
      }

      // If images requested but none found, add helpful message
      if (aiResponse.toolCalls?.some(tc =>
        tc.type === 'function' && 'function' in tc && tc.function.name === 'send_vehicle_images'
      ) && (!images || images.length === 0)) {
        responseMessage = responseMessage || 'Maaf, saat ini belum ada foto untuk mobil tersebut. Ada yang lain yang bisa saya bantu?';
      }

      return {
        message: responseMessage,
        shouldEscalate,
        confidence: 0.85,
        processingTime,
        ...(images && images.length > 0 && { images }),
        ...(uploadRequest && { uploadRequest }),
      };
    } catch (error: any) {
      console.error("[WhatsApp AI Chat] ❌ ERROR generating response:");
      console.error("[WhatsApp AI Chat] Error name:", error.name);
      console.error("[WhatsApp AI Chat] Error message:", error.message);
      console.error("[WhatsApp AI Chat] Error stack:", error.stack);

      // Get tenant info for helpful fallback
      let tenantName = "Showroom Kami";
      let whatsappNumber = "";
      try {
        const tenant = await prisma.tenant.findUnique({
          where: { id: context.tenantId },
          select: { name: true, whatsappNumber: true, phoneNumber: true }
        });
        if (tenant) {
          tenantName = tenant.name;
          whatsappNumber = tenant.whatsappNumber || tenant.phoneNumber || "";
        }
      } catch (e) {
        // Ignore errors fetching tenant
      }

      // Helpful fallback response instead of generic error
      const fallbackMessage = `Halo! Terima kasih sudah menghubungi ${tenantName}. 😊\n\n` +
        `Untuk informasi lebih lanjut tentang mobil yang tersedia, silakan:\n` +
        `• Ketik "mobil" untuk melihat daftar mobil\n` +
        `• Ketik "harga" untuk info harga\n` +
        (whatsappNumber ? `• Hubungi langsung: ${whatsappNumber}\n` : '') +
        `\nAda yang bisa kami bantu?`;

      return {
        message: fallbackMessage,
        shouldEscalate: false,
        confidence: 0.5,
        processingTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Build system prompt untuk AI
   */
  private static async buildSystemPrompt(
    tenant: any,
    config: any,
    intent: MessageIntent
  ): Promise<string> {
    // Optimized system prompt for fast, responsive customer service
    let systemPrompt = `Anda adalah ${config.aiName}, asisten virtual ${tenant.name} (showroom mobil bekas di ${tenant.city || "Indonesia"}).

PRINSIP UTAMA:
- Respons CEPAT & SINGKAT (2-3 kalimat)
- Bahasa Indonesia ramah, gunakan emoji
- Format WhatsApp (tanpa markdown)

ALUR RESPONS:

1. PERTANYAAN MOBIL (merk/budget/tahun/transmisi/km/bbm):
   → Jawab langsung dari inventory
   → Sebutkan: Nama, Tahun, Harga, KM, Transmisi
   → TAWARKAN: "Mau saya kirimkan fotonya via WA? 📸"

2. KONFIRMASI FOTO (iya/ya/mau/boleh/ok/oke/yup/sip/kirim/gas/lanjut):
   → LANGSUNG panggil tool "send_vehicle_images"
   → Gunakan nama mobil dari chat sebelumnya

3. MINTA FOTO LANGSUNG (ada foto/lihat gambar/foto dong/kirimin):
   → LANGSUNG panggil tool "send_vehicle_images"

4. TIDAK MAU FOTO / TANYA LAIN:
   → Jawab pertanyaan dengan cepat
   → Bantu cari mobil lain sesuai kebutuhan

CONTOH:
C: "ada Avanza matic?"
A: "Ada kak! Avanza 2021 Matic - Rp 180jt, KM 35rb, Silver 😊 Mau saya kirimkan fotonya? 📸"

C: "boleh"
A: [panggil send_vehicle_images: "Avanza"] "Ini fotonya kak 👇"

C: "budget 100-150jt ada apa?"
A: "Di budget itu ada:\n• Brio 2019 - 125jt\n• Agya 2020 - 110jt\nMau lihat fotonya? 📸"

C: "ga usah, km nya berapa?"
A: "Brio KM 45rb, Agya KM 30rb kak 😊 Ada yang mau ditanyakan lagi?"
`;

    // Add vehicle inventory context
    const vehicles = await this.getAvailableVehiclesDetailed(tenant.id);
    if (vehicles.length > 0) {
      systemPrompt += `\n📋 INVENTORY TERSEDIA (${vehicles.length} unit):\n`;
      systemPrompt += vehicles
        .slice(0, 10)
        .map(
          (v) =>
            `• ${v.make} ${v.model} ${v.year} - Rp ${this.formatPrice(Number(v.price))} | ${v.transmissionType || 'Manual'} | ${v.mileage?.toLocaleString('id-ID') || 0}km | ${v.fuelType || 'Bensin'} | ${v.color || '-'}`
        )
        .join("\n");

      if (vehicles.length > 10) {
        systemPrompt += `\n... dan ${vehicles.length - 10} unit lainnya`;
      }
    }

    return systemPrompt;
  }

  /**
   * Get available vehicles with more details
   */
  private static async getAvailableVehiclesDetailed(tenantId: string) {
    return await prisma.vehicle.findMany({
      where: {
        tenantId,
        status: "AVAILABLE",
      },
      select: {
        id: true,
        make: true,
        model: true,
        year: true,
        price: true,
        mileage: true,
        transmissionType: true,
        fuelType: true,
        color: true,
      },
      orderBy: { createdAt: "desc" },
      take: 15,
    });
  }

  /**
   * Build conversation context - include enough history for AI to remember vehicle context
   */
  private static buildConversationContext(
    messageHistory: Array<{ role: "user" | "assistant"; content: string }>,
    currentMessage: string
  ): string {
    let context = "";

    // Include last 5 messages for better context (important for photo confirmations)
    const recentHistory = messageHistory.slice(-5);
    if (recentHistory.length > 0) {
      context += "Chat sebelumnya:\n";
      recentHistory.forEach((msg) => {
        const label = msg.role === "user" ? "C" : "A";
        // Keep 150 chars to preserve vehicle names for context
        const truncated = msg.content.length > 150 ? msg.content.substring(0, 150) + "..." : msg.content;
        context += `${label}: ${truncated}\n`;
      });
    }

    context += `\nPesan sekarang: ${currentMessage}\n\nBalas (singkat, responsif):`;

    return context;
  }

  /**
   * Get available vehicles untuk context
   */
  private static async getAvailableVehicles(tenantId: string) {
    return await prisma.vehicle.findMany({
      where: {
        tenantId,
        status: "AVAILABLE",
      },
      select: {
        id: true,
        make: true,
        model: true,
        year: true,
        price: true,
      },
      orderBy: { createdAt: "desc" },
      take: 5, // Limit to 5 most recent for faster response
    });
  }

  /**
   * Format price to Indonesian format
   */
  private static formatPrice(price: number): string {
    return new Intl.NumberFormat("id-ID").format(price);
  }

  /**
   * Check if within business hours
   */
  private static isWithinBusinessHours(
    businessHours: any,
    timezone: string
  ): boolean {
    // Simplified check - dalam production perlu timezone handling proper
    const now = new Date();
    const day = now
      .toLocaleDateString("en-US", { weekday: "long", timeZone: timezone })
      .toLowerCase();
    const currentHour = now.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: timezone,
    });

    const todayHours = businessHours[day];
    if (!todayHours || todayHours.open === "closed") {
      return false;
    }

    return currentHour >= todayHours.open && currentHour <= todayHours.close;
  }

  /**
   * Determine if conversation should be escalated to human
   */
  private static shouldEscalateToHuman(
    aiResponse: string,
    intent: MessageIntent
  ): boolean {
    // Escalate if AI mentions uncertainty
    const uncertaintyKeywords = [
      "tidak yakin",
      "tidak tahu",
      "maaf saya tidak",
      "hubungi staff",
      "berbicara dengan staff",
      "tidak dapat membantu",
    ];

    const hasUncertainty = uncertaintyKeywords.some((keyword) =>
      aiResponse.toLowerCase().includes(keyword)
    );

    // Escalate for price negotiation (if not enabled in config)
    const isPriceNegotiation =
      intent === "customer_price_inquiry" &&
      (aiResponse.toLowerCase().includes("nego") ||
        aiResponse.toLowerCase().includes("diskon"));

    return hasUncertainty || isPriceNegotiation;
  }

  /**
   * Fetch vehicle images based on search query
   */
  private static async fetchVehicleImagesByQuery(
    searchQuery: string,
    tenantId: string
  ): Promise<Array<{ imageUrl: string; caption?: string }> | null> {
    console.log('[WhatsApp AI Chat] 📸 Fetching vehicles for query:', searchQuery);

    // Parse search query into individual terms
    const searchTerms = searchQuery.toLowerCase().split(/\s+/).filter(term => term.length > 0);
    console.log('[WhatsApp AI Chat] Search terms:', searchTerms);

    // Query vehicles with photos - more flexible search
    const vehicles = await prisma.vehicle.findMany({
      where: {
        tenantId,
        status: 'AVAILABLE',
        ...(searchTerms.length > 0 && {
          OR: searchTerms.flatMap(term => [
            { make: { contains: term, mode: 'insensitive' as const } },
            { model: { contains: term, mode: 'insensitive' as const } },
            { variant: { contains: term, mode: 'insensitive' as const } },
          ])
        }),
      },
      include: {
        photos: {
          orderBy: { isMainPhoto: 'desc' },
          take: 2, // Get main photo + 1 backup
        },
      },
      take: 3, // Max 3 vehicles to avoid spamming
    });

    console.log(`[WhatsApp AI Chat] Found ${vehicles.length} vehicles matching query`);

    if (vehicles.length === 0) {
      console.log('[WhatsApp AI Chat] ❌ No vehicles found for query:', searchQuery);
      return null;
    }

    // Build image array with fallback URLs
    // Convert relative URLs to full URLs for Aimeow
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://primamobil.id';

    const images = vehicles
      .filter(v => v.photos.length > 0)
      .map(v => {
        const photo = v.photos[0];
        // Fallback: mediumUrl → largeUrl → originalUrl
        let imageUrl = photo.mediumUrl || photo.largeUrl || photo.originalUrl;

        // Convert relative URL to full URL
        if (imageUrl && imageUrl.startsWith('/')) {
          imageUrl = `${baseUrl}${imageUrl}`;
          console.log(`[WhatsApp AI Chat] Converted relative URL to: ${imageUrl}`);
        }

        console.log(`[WhatsApp AI Chat] Vehicle ${v.make} ${v.model} - imageUrl: ${imageUrl}`);
        return {
          imageUrl,
          caption: `${v.make} ${v.model} ${v.year} - Rp ${this.formatPrice(Number(v.price))}\n${v.mileage?.toLocaleString('id-ID') || 0}km • ${v.transmissionType || 'Manual'} • ${v.color || '-'}`,
        };
      })
      .filter(img => img.imageUrl); // Filter out any without valid URL

    console.log(`[WhatsApp AI Chat] ✅ Prepared ${images.length} vehicle images to send`);

    if (images.length === 0) {
      console.log('[WhatsApp AI Chat] ⚠️ Vehicles found but no photos available');
      return null;
    }

    return images;
  }

  /**
   * Search vehicles by criteria (budget, make, transmission, year, fuel type, etc.)
   */
  private static async searchVehiclesByCriteria(
    tenantId: string,
    criteria: {
      min_price?: number;
      max_price?: number;
      make?: string;
      transmission?: string;
      min_year?: number;
      max_year?: number;
      fuel_type?: string;
      sort_by?: string;
      limit?: number;
    }
  ) {
    console.log('[WhatsApp AI Chat] 🔍 Searching vehicles with criteria:', criteria);

    // Build where clause
    const where: any = {
      tenantId,
      status: 'AVAILABLE',
    };

    // Price filter
    if (criteria.min_price || criteria.max_price) {
      where.price = {};
      if (criteria.min_price) {
        // Price in database is stored in cents, criteria is in IDR
        where.price.gte = BigInt(criteria.min_price * 100);
      }
      if (criteria.max_price) {
        where.price.lte = BigInt(criteria.max_price * 100);
      }
    }

    // Make filter
    if (criteria.make) {
      where.make = { contains: criteria.make, mode: 'insensitive' };
    }

    // Transmission filter
    if (criteria.transmission) {
      const trans = criteria.transmission.toLowerCase();
      if (trans === 'manual' || trans === 'mt') {
        where.transmissionType = { contains: 'manual', mode: 'insensitive' };
      } else if (trans === 'automatic' || trans === 'matic' || trans === 'at') {
        where.OR = [
          { transmissionType: { contains: 'automatic', mode: 'insensitive' } },
          { transmissionType: { contains: 'matic', mode: 'insensitive' } },
          { transmissionType: { contains: 'at', mode: 'insensitive' } },
          { transmissionType: { contains: 'cvt', mode: 'insensitive' } },
        ];
      }
    }

    // Year filter
    if (criteria.min_year || criteria.max_year) {
      where.year = {};
      if (criteria.min_year) {
        where.year.gte = criteria.min_year;
      }
      if (criteria.max_year) {
        where.year.lte = criteria.max_year;
      }
    }

    // Fuel type filter
    if (criteria.fuel_type) {
      where.fuelType = { contains: criteria.fuel_type, mode: 'insensitive' };
    }

    // Build order by
    let orderBy: any = { createdAt: 'desc' }; // default: newest
    if (criteria.sort_by) {
      switch (criteria.sort_by) {
        case 'newest':
          orderBy = { createdAt: 'desc' };
          break;
        case 'oldest':
          orderBy = { createdAt: 'asc' };
          break;
        case 'price_low':
          orderBy = { price: 'asc' };
          break;
        case 'price_high':
          orderBy = { price: 'desc' };
          break;
        case 'mileage_low':
          orderBy = { mileage: 'asc' };
          break;
      }
    }

    const vehicles = await prisma.vehicle.findMany({
      where,
      orderBy,
      take: criteria.limit || 5,
      select: {
        id: true,
        make: true,
        model: true,
        year: true,
        price: true,
        mileage: true,
        transmissionType: true,
        fuelType: true,
        color: true,
      },
    });

    console.log(`[WhatsApp AI Chat] Found ${vehicles.length} vehicles matching criteria`);
    return vehicles;
  }

  /**
   * Get conversation history untuk context building
   */
  static async getConversationHistory(
    conversationId: string,
    limit: number = 5
  ): Promise<Array<{ role: "user" | "assistant"; content: string }>> {
    const messages = await prisma.whatsAppMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        direction: true,
        content: true,
      },
    });

    // Reverse untuk chronological order
    return messages.reverse().map((msg) => ({
      role: msg.direction === "inbound" ? ("user" as const) : ("assistant" as const),
      content: msg.content,
    }));
  }
}

export default WhatsAppAIChatService;
