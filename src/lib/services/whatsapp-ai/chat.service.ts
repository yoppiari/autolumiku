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
  isStaff?: boolean;
  staffInfo?: {
    name: string;
    role: string;
    phone: string;
  };
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
  editRequest?: {
    vehicleId?: string;
    field: string;
    oldValue?: string;
    newValue: string;
  }; // Optional vehicle edit request from AI
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

      // Build system prompt with sender info
      console.log(`[WhatsApp AI Chat] Building system prompt for tenant: ${account.tenant.name}`);
      const senderInfo = {
        isStaff: context.isStaff || false,
        staffInfo: context.staffInfo,
        customerPhone: context.customerPhone,
      };
      const systemPrompt = await this.buildSystemPrompt(
        account.tenant,
        config,
        context.intent,
        senderInfo
      );
      console.log(`[WhatsApp AI Chat] System prompt built (${systemPrompt.length} chars), isStaff: ${senderInfo.isStaff}`);

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
      let editRequest: any = null;

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
                mileage: args.mileage || undefined, // Keep undefined if not provided
                color: args.color || 'Unknown',
                transmission: args.transmission || 'Manual',
              };
            } else if (toolCall.function.name === 'edit_vehicle') {
              const args = JSON.parse(toolCall.function.arguments);

              console.log('[WhatsApp AI Chat] ✏️ AI detected vehicle edit request:', args);

              editRequest = {
                vehicleId: args.vehicle_id,
                field: args.field,
                oldValue: args.old_value,
                newValue: args.new_value,
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
        ...(editRequest && { editRequest }),
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
   * Personality: Professional, Formal, Friendly, Helpful
   */
  private static async buildSystemPrompt(
    tenant: any,
    config: any,
    intent: MessageIntent,
    senderInfo?: { isStaff: boolean; staffInfo?: { name: string; role: string; phone: string }; customerPhone: string }
  ): Promise<string> {
    // Professional, formal, friendly and helpful personality
    let systemPrompt = `Kamu adalah ${config.aiName}, asisten virtual profesional dari ${tenant.name} (showroom mobil bekas di ${tenant.city || "Indonesia"}).

IDENTITAS & KEPRIBADIAN:
- Profesional dan sopan dalam setiap interaksi
- Formal namun tetap ramah dan mudah didekati
- Helpful - selalu berusaha memberikan solusi terbaik
- Gunakan bahasa Indonesia yang baik dan benar

GAYA KOMUNIKASI:
- Sapa dengan "Bapak/Ibu" atau nama jika diketahui
- Gunakan kata-kata sopan: "silakan", "terima kasih", "mohon maaf"
- Hindari bahasa slang atau terlalu casual
- Emoji hanya seperlunya untuk keramahan (maksimal 1-2 per pesan)
- Berikan informasi lengkap namun ringkas (3-4 kalimat)

CARA MERESPONS:

1. PERTANYAAN TENTANG MOBIL (merk/budget/tahun/transmisi/km):
   → Berikan informasi lengkap dari stok yang tersedia
   → Sebutkan: Nama, Tahun, Harga, Kilometer, Transmisi
   → Tawarkan: "Apakah Bapak/Ibu ingin melihat fotonya?"

2. PERMINTAAN FOTO (iya/ya/mau/boleh/ok):
   → Langsung panggil tool "send_vehicle_images"
   → Sampaikan: "Berikut foto kendaraan yang dimaksud 👇"

3. PERMINTAAN FOTO LANGSUNG:
   → Langsung panggil tool "send_vehicle_images"

4. PERTANYAAN LAIN:
   → Jawab dengan informatif dan membantu
   → Arahkan ke solusi yang tepat

CONTOH PERCAKAPAN:

C: "ada Avanza matic ga?"
A: "Terima kasih atas pertanyaannya. Kami memiliki Avanza 2021 Matic dengan harga Rp 180 juta, kilometer 35.000, warna Silver. Apakah Bapak/Ibu berkenan melihat fotonya?"

C: "boleh"
A: [panggil send_vehicle_images: "Avanza"] "Berikut foto kendaraannya 👇"

C: "budget 100-150jt ada apa aja?"
A: "Untuk budget Rp 100-150 juta, kami memiliki beberapa pilihan menarik:\n• Honda Brio 2019 - Rp 125 juta\n• Toyota Agya 2020 - Rp 110 juta\nMohon informasikan jika ada yang ingin dilihat lebih lanjut."

C: "ga usah deh, km nya berapa?"
A: "Baik, tidak masalah. Untuk informasi kilometer:\n• Brio 2019: 45.000 km\n• Agya 2020: 30.000 km\nAda pertanyaan lain yang bisa kami bantu?"

C: "halo"
A: "Selamat datang di ${tenant.name}! Kami siap membantu Anda menemukan kendaraan impian. Silakan informasikan preferensi Anda seperti merk, budget, atau tipe kendaraan yang dicari."
`;

    // Add vehicle inventory context
    const vehicles = await this.getAvailableVehiclesDetailed(tenant.id);
    if (vehicles.length > 0) {
      systemPrompt += `\n📋 INVENTORY TERSEDIA (${vehicles.length} unit):\n`;
      systemPrompt += vehicles
        .slice(0, 10)
        .map(
          (v) =>
            `• ${v.make} ${v.model} ${v.year} - Rp ${this.formatPrice(Number(v.price))} | ${v.transmissionType || 'Manual'}${v.mileage ? ` | ${v.mileage.toLocaleString('id-ID')} km` : ''} | ${v.fuelType || 'Bensin'} | ${v.color || '-'}`
        )
        .join("\n");

      if (vehicles.length > 10) {
        systemPrompt += `\n... dan ${vehicles.length - 10} unit lainnya`;
      }
    }

    // Add registered staff contacts - ONLY use these, don't make up contacts!
    const staffMembers = await this.getRegisteredStaffContacts(tenant.id);
    if (staffMembers.length > 0) {
      systemPrompt += `\n\n📞 KONTAK STAFF RESMI (HANYA gunakan ini, JANGAN buat-buat nomor sendiri!):\n`;
      systemPrompt += staffMembers.map(s =>
        `• ${s.name} (${s.role}) - ${s.phone}`
      ).join("\n");
      systemPrompt += `\n\n⚠️ PENTING: Kalau customer mau hubungi staff/admin, HANYA kasih nomor dari daftar di atas. JANGAN PERNAH buat-buat nomor atau nama yang tidak ada di daftar!`;
    } else {
      // No staff registered - tell AI to not give any contact
      systemPrompt += `\n\n⚠️ PENTING: Belum ada staff terdaftar. Kalau customer mau hubungi langsung, bilang "Silakan lanjutkan percakapan di sini, tim kami akan membantu Anda." JANGAN buat-buat nomor telepon!`;
    }

    // Add sender identity information
    if (senderInfo) {
      systemPrompt += `\n\n👤 INFORMASI PENGIRIM PESAN INI:`;
      if (senderInfo.isStaff && senderInfo.staffInfo) {
        systemPrompt += `
- Status: ✅ STAFF TERDAFTAR
- Nama: ${senderInfo.staffInfo.name}
- Role: ${senderInfo.staffInfo.role}
- No HP: ${senderInfo.staffInfo.phone}

Jika pengirim bertanya "siapa saya?" atau "kamu tahu saya?", JAWAB bahwa mereka adalah staff terdaftar dengan nama dan role di atas.`;
      } else {
        systemPrompt += `
- Status: Customer/Pengunjung
- No HP: ${senderInfo.customerPhone}

Jika pengirim bertanya "siapa saya?", jawab bahwa mereka adalah customer yang belum terdaftar di sistem.`;
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
   * Get registered staff contacts for this tenant
   * Only returns ADMIN, MANAGER, SALES roles with phone numbers
   */
  private static async getRegisteredStaffContacts(tenantId: string): Promise<
    Array<{ name: string; role: string; phone: string }>
  > {
    const staffMembers = await prisma.user.findMany({
      where: {
        tenantId,
        role: { in: ["ADMIN", "MANAGER", "SALES"] },
        phone: { not: null },
      },
      select: {
        firstName: true,
        lastName: true,
        role: true,
        phone: true,
      },
      orderBy: [
        { role: "asc" }, // ADMIN first, then MANAGER, then SALES
        { firstName: "asc" },
      ],
    });

    return staffMembers
      .filter((s) => s.phone) // Extra filter for null phones
      .map((s) => ({
        name: `${s.firstName || ""} ${s.lastName || ""}`.trim() || "Staff",
        role: s.role === "ADMIN" ? "Admin" : s.role === "MANAGER" ? "Manager" : "Sales",
        phone: this.formatPhoneForDisplay(s.phone!),
      }));
  }

  /**
   * Format phone number for display (add dashes for readability)
   */
  private static formatPhoneForDisplay(phone: string): string {
    // Remove non-digits
    const digits = phone.replace(/\D/g, "");

    // Format Indonesian number: 0812-3456-7890
    if (digits.startsWith("62")) {
      const local = digits.slice(2); // Remove country code
      if (local.length >= 10) {
        return `0${local.slice(0, 3)}-${local.slice(3, 7)}-${local.slice(7)}`;
      }
    } else if (digits.startsWith("0")) {
      if (digits.length >= 10) {
        return `${digits.slice(0, 4)}-${digits.slice(4, 8)}-${digits.slice(8)}`;
      }
    }

    return phone; // Return original if can't format
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
   * Note: Database stores prices in IDR cents (Rp 250jt = 25000000000)
   * So we divide by 100 to get the actual Rupiah value
   */
  private static formatPrice(price: number): string {
    // Convert from cents to Rupiah
    const priceInRupiah = Math.round(price / 100);
    return new Intl.NumberFormat("id-ID").format(priceInRupiah);
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
    console.log('[WhatsApp AI Chat] Tenant ID:', tenantId);

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

      // Try a broader search if specific search failed - get ANY available vehicles
      console.log('[WhatsApp AI Chat] 🔄 Trying broader search for any available vehicles...');
      const anyVehicles = await prisma.vehicle.findMany({
        where: {
          tenantId,
          status: 'AVAILABLE',
        },
        include: {
          photos: {
            orderBy: { isMainPhoto: 'desc' },
            take: 2,
          },
        },
        take: 3,
        orderBy: { createdAt: 'desc' },
      });

      if (anyVehicles.length === 0) {
        console.log('[WhatsApp AI Chat] ❌ No vehicles available at all');
        return null;
      }

      console.log(`[WhatsApp AI Chat] Found ${anyVehicles.length} vehicles in broader search`);
      return this.buildImageArray(anyVehicles);
    }

    return this.buildImageArray(vehicles);
  }

  /**
   * Build image array from vehicles with proper URL handling
   */
  private static buildImageArray(vehicles: any[]): Array<{ imageUrl: string; caption?: string }> | null {
    // Build image array with fallback URLs
    // Convert relative URLs to full URLs for Aimeow
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://primamobil.id';
    console.log(`[WhatsApp AI Chat] Base URL for images: ${baseUrl}`);

    const images: Array<{ imageUrl: string; caption?: string }> = [];

    for (const v of vehicles) {
      console.log(`[WhatsApp AI Chat] Processing vehicle: ${v.make} ${v.model} ${v.year}`);
      console.log(`[WhatsApp AI Chat] Photos count: ${v.photos?.length || 0}`);

      if (!v.photos || v.photos.length === 0) {
        console.log(`[WhatsApp AI Chat] ⚠️ No photos for ${v.make} ${v.model}`);
        continue;
      }

      const photo = v.photos[0];
      console.log(`[WhatsApp AI Chat] Photo data:`, {
        id: photo.id,
        originalUrl: photo.originalUrl?.substring(0, 100),
        mediumUrl: photo.mediumUrl?.substring(0, 100),
        largeUrl: photo.largeUrl?.substring(0, 100),
      });

      // Prioritize JPG (originalUrl) for better WhatsApp mobile compatibility
      // WebP format (medium/large) may not display on some mobile devices
      // Fallback: originalUrl (JPG) → largeUrl → mediumUrl
      let imageUrl = photo.originalUrl || photo.largeUrl || photo.mediumUrl;

      if (!imageUrl) {
        console.log(`[WhatsApp AI Chat] ⚠️ No valid URL for ${v.make} ${v.model} photo`);
        continue;
      }

      // Convert relative URL to full URL
      if (imageUrl.startsWith('/')) {
        imageUrl = `${baseUrl}${imageUrl}`;
        console.log(`[WhatsApp AI Chat] Converted relative URL to: ${imageUrl}`);
      }

      // Ensure URL is properly encoded (handle spaces, special chars)
      try {
        const url = new URL(imageUrl);
        imageUrl = url.toString();
      } catch (e) {
        console.log(`[WhatsApp AI Chat] ⚠️ Invalid URL format, using as-is: ${imageUrl}`);
      }

      console.log(`[WhatsApp AI Chat] ✅ Final imageUrl: ${imageUrl}`);

      images.push({
        imageUrl,
        caption: `${v.make} ${v.model} ${v.year} - Rp ${this.formatPrice(Number(v.price))}\n${v.mileage ? `${v.mileage.toLocaleString('id-ID')} km • ` : ''}${v.transmissionType || 'Manual'} • ${v.color || '-'}`,
      });
    }

    console.log(`[WhatsApp AI Chat] ✅ Prepared ${images.length} vehicle images to send`);
    console.log(`[WhatsApp AI Chat] Image URLs:`, images.map(i => i.imageUrl));

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

    // Price filter (price in DB is already in Rupiah, not cents)
    if (criteria.min_price || criteria.max_price) {
      where.price = {};
      if (criteria.min_price) {
        where.price.gte = BigInt(criteria.min_price);
      }
      if (criteria.max_price) {
        where.price.lte = BigInt(criteria.max_price);
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
      } else if (trans === 'automatic' || trans === 'matic' || trans === 'at' || trans === 'cvt') {
        // Use AND with OR for automatic variants to avoid overwriting existing OR conditions
        where.AND = where.AND || [];
        where.AND.push({
          OR: [
            { transmissionType: { contains: 'automatic', mode: 'insensitive' } },
            { transmissionType: { contains: 'matic', mode: 'insensitive' } },
            { transmissionType: { contains: 'cvt', mode: 'insensitive' } },
          ],
        });
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
