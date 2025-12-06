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
            maxTokens: 1000,
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
        console.log(`[WhatsApp AI Chat] Customer chat is DISABLED. Returning escalation message.`);
        return {
          message: "Maaf, fitur chat otomatis sedang tidak aktif. Mohon tunggu, staff kami akan segera merespons.",
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
        temperature: config.temperature,
        maxTokens: config.maxTokens,
        systemPromptLength: systemPrompt.length,
        userPromptLength: conversationContext.length,
      });

      let aiResponse;
      try {
        // Add a race condition with manual timeout to ensure we fail fast
        const apiCallPromise = zaiClient.generateText({
          systemPrompt,
          userPrompt: conversationContext,
          temperature: config.temperature,
          maxTokens: config.maxTokens,
        });

        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => {
            reject(new Error('ZAI API call timed out after 25 seconds'));
          }, 25000); // 25 second timeout
        });

        aiResponse = await Promise.race([apiCallPromise, timeoutPromise]);
        console.log(`[WhatsApp AI Chat] ✅ AI response received successfully`);
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

      return {
        message: aiResponse.content,
        shouldEscalate,
        confidence: 0.85, // Simplified - bisa dikembangkan dengan analysis lebih lanjut
        processingTime,
      };
    } catch (error: any) {
      console.error("[WhatsApp AI Chat] ❌ ERROR generating response:");
      console.error("[WhatsApp AI Chat] Error name:", error.name);
      console.error("[WhatsApp AI Chat] Error message:", error.message);
      console.error("[WhatsApp AI Chat] Error stack:", error.stack);

      // Fallback response
      return {
        message: "Maaf, terjadi gangguan sistem. Staff kami akan segera membantu Anda.",
        shouldEscalate: true,
        confidence: 0,
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
    let systemPrompt = `Anda adalah ${config.aiName}, asisten virtual untuk ${tenant.name}, sebuah showroom mobil bekas.

Personality: ${config.aiPersonality}
Tugas Anda:
- Menjawab pertanyaan customer tentang mobil yang tersedia
- Memberikan informasi harga, spesifikasi, dan kondisi kendaraan
- Membantu customer untuk menemukan mobil yang sesuai kebutuhan
- Menjadwalkan test drive atau kunjungan showroom
- Bersikap ramah, profesional, dan membantu

Informasi Showroom:
- Nama: ${tenant.name}
- Lokasi: ${tenant.city || "Indonesia"}
${tenant.phoneNumber ? `- Telepon: ${tenant.phoneNumber}` : ""}
${tenant.whatsappNumber ? `- WhatsApp: ${tenant.whatsappNumber}` : ""}

Aturan Penting:
1. JANGAN memberikan informasi yang tidak Anda ketahui dengan pasti
2. Jika ditanya tentang mobil spesifik yang tidak ada di inventory, jujur katakan tidak tersedia
3. Jika pertanyaan terlalu kompleks atau butuh konfirmasi staff, sarankan customer untuk berbicara dengan staff
4. Selalu gunakan Bahasa Indonesia yang sopan dan mudah dipahami
5. Fokus pada kebutuhan customer, bukan hard selling
`;

    // Add vehicle inventory context jika relevant
    if (
      intent === "customer_vehicle_inquiry" ||
      intent === "customer_price_inquiry"
    ) {
      const vehicles = await this.getAvailableVehicles(tenant.id);
      if (vehicles.length > 0) {
        systemPrompt += `\n\nInventory Mobil Tersedia (${vehicles.length} unit):\n`;
        systemPrompt += vehicles
          .map(
            (v) =>
              `- ${v.make} ${v.model} ${v.year} (${v.transmissionType}) - Rp ${this.formatPrice(Number(v.price))} - ${v.mileage}km - ${v.color}`
          )
          .join("\n");
      } else {
        systemPrompt += `\n\nSaat ini sedang tidak ada inventory yang tersedia di sistem. Sarankan customer untuk menghubungi staff untuk informasi terbaru.`;
      }
    }

    // Add FAQ if configured
    if (config.customFAQ) {
      systemPrompt += `\n\nFAQ:\n${JSON.stringify(config.customFAQ, null, 2)}`;
    }

    return systemPrompt;
  }

  /**
   * Build conversation context
   */
  private static buildConversationContext(
    messageHistory: Array<{ role: "user" | "assistant"; content: string }>,
    currentMessage: string
  ): string {
    let context = "";

    // Add recent conversation history (last 5 messages)
    const recentHistory = messageHistory.slice(-5);
    if (recentHistory.length > 0) {
      context += "Riwayat Percakapan:\n";
      recentHistory.forEach((msg) => {
        const label = msg.role === "user" ? "Customer" : "AI";
        context += `${label}: ${msg.content}\n`;
      });
      context += "\n";
    }

    context += `Customer sekarang mengirim:\n${currentMessage}\n\nBerikan respons yang membantu dan relevan:`;

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
        mileage: true,
        transmissionType: true,
        color: true,
      },
      orderBy: { createdAt: "desc" },
      take: 10, // Limit to 10 most recent
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
   * Get conversation history untuk context building
   */
  static async getConversationHistory(
    conversationId: string,
    limit: number = 10
  ): Promise<Array<{ role: "user" | "assistant"; content: string }>> {
    const messages = await prisma.whatsAppMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    // Reverse untuk chronological order
    return messages.reverse().map((msg) => ({
      role: msg.direction === "inbound" ? ("user" as const) : ("assistant" as const),
      content: msg.content,
    }));
  }
}

export default WhatsAppAIChatService;
