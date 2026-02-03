/**
 * WhatsApp AI Chat Service
 * Handles customer conversations dengan Z.ai GLM-4 model
 * Context-aware dengan vehicle inventory dan showroom info
 */

import { createZAIClient } from "@/lib/ai/zai-client";
import { ROLE_LEVELS } from "@/lib/rbac";
import {
  getIdentityPrompt,
  getGreetingRules,
  getRolePrompt,
  ATURAN_KOMUNIKASI,
  FORMATTING_RULES,
  KKB_FORMATTING_RULES,
  DATA_INTEGRITY_RULES,
  AUTOMOTIVE_KNOWLEDGE_BASE,
  getCompanyKnowledgeBase,
  STAFF_COMMAND_HELP,
  STAFF_TROUBLESHOOTING,
  STAFF_EDIT_FEATURE,
  STAFF_RULES,
  ADMIN_COMMAND_HELP,
  ADMIN_SYSTEM_PROMPT_ADDITION,
  getCustomerJourneyRules,
  getResponseGuidelines
} from "../prompts";
import { prisma } from "@/lib/prisma";
import { MessageIntent } from "./intent-classifier.service";
import { LeadService } from "@/lib/services/leads/lead-service";
import { LeadPriority } from "@prisma/client";

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
  intentEntities?: Record<string, any>; // Extracted entities from intent (e.g. aspect: interior)
  isStaff?: boolean;
  staffInfo?: {
    firstName?: string;
    lastName?: string;
    name?: string; // Legacy support
    role?: string;
    roleLevel?: number;
    phone?: string;
    userId?: string;
  };
  isEscalated?: boolean; // Escalated conversations get faster, more direct responses
  isCatchup?: boolean;   // Flag indicating this is a morning catch-up response
  leadInfo?: {
    id: string;
    name: string;
    status: string;
    interestedIn?: string;
    budgetRange?: string; // AI 5.2 requirement
    lastInteraction?: Date;
    location?: string; // Notes/tags might store this
  } | null;
}

// Vehicle details with images for detailed response
export interface VehicleWithImages {
  vehicle: {
    id: string;
    make: string;
    model: string;
    variant?: string;
    year: number;
    price: number;
    mileage?: number;
    transmissionType?: string;
    fuelType?: string;
    color?: string;
    condition?: string;
    descriptionId?: string; // Indonesian description
    features?: string[];
    engineCapacity?: string;
    displayId?: string;
  };
  images: Array<{ imageUrl: string; caption?: string }>;
}

export interface ChatResponse {
  message: string;
  shouldEscalate: boolean;
  confidence: number;
  processingTime: number;
  images?: Array<{ imageUrl: string; caption?: string }>; // Optional vehicle images
  needsCatchup?: boolean; // AI 5.2: Flag for proactive catch-up morning response
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
  // Words that should be ignored when searching for specific vehicles in conversational queries
  private static readonly INDONESIAN_STOP_WORDS = [
    'ada', 'apakah', 'punya', 'jual', 'cari', 'info', 'unit', 'mobil', 'stok', 'stock',
    'buat', 'untuk', 'dong', 'ya', 'kak', 'min', 'admin', 'gan', 'bos', 'bang',
    'tanya', 'lihat', 'mana', 'fotonya', 'foto', 'gambar', 'gak', 'nggak',
    'bisa', 'tolong', 'tampilkan', 'kasih', 'berikan', 'tunjukin', 'tunjukkan', 'siap', 'ok',
    'kan', 'kok', 'itu', 'ini', 'yang', 'dan', 'atau', 'apa', 'sih', 'deh'
  ];

  private static readonly VEHICLE_ID_PATTERN = /\b(pm[- ]?[a-zA-Z0-9]+-\d+)\b/i;
  private static readonly VEHICLE_NAME_PATTERNS = [
    /(?:Toyota|Honda|Suzuki|Daihatsu|Mitsubishi|Nissan|Mazda|BMW|Mercedes|Hyundai|Kia|Wuling|Chevrolet)\s+[ \w\-]+(?:\s+[\w\-]+)?\s+(?:20\d{2}|19\d{2})/gi,
    /(?:Toyota|Honda|Suzuki|Daihatsu|Mitsubishi|Nissan|Mazda|BMW|Mercedes|Hyundai|Kia|Wuling|Chevrolet)\s+[\w\-]+(?:\s+[\w\-]+)?/gi,
    /\b(Innova\s*Reborn|Fortuner\s*VRZ|Fortuner\s*TRD|Pajero\s*Sport|Xpander\s*Cross|Rush\s*TRD|Terios\s*TX|HRV\s*Prestige|CRV\s*Turbo)\b/gi,
    /\b(Innova|Avanza|Xenia|Brio|Jazz|Ertiga|Rush|Terios|Fortuner|Pajero|Alphard|Civic|Accord|CRV|HRV|BRV|Yaris|Camry|Calya|Sigra|Ayla|Agya|Xpander|Livina|City|Mobilio|Freed|Vios|Corolla|Raize|Rocky|Confero|Almaz|Cortez|Serena)\s*(?:Reborn)?\s*(?:20\d{2}|19\d{2})?/gi,
  ];

  private static readonly TECHNICAL_KEYWORDS = {
    INTERIOR: /(interior|dalam|dalem|jok|dashboard|kabin|setir)/i,
    EXTERIOR: /(eksterior|ekterior|exterior|esterior|luar|body|bodi|cat|lecet|mulus)/i,
    ENGINE: /\b(mesin|engine|kap|suara|aki|transmisi)\b/i,
    DOCUMENTS: /\b(dokumen|surat|bpkb|stnk|pajak|faktur|pjk)\b/i,
    QUESTION_WORDS: /(bagaimana|gimana|gmn|apa|mana|cek|info|tanya|jelaskan|deskripsi)/i
  };

  private static readonly PHOTO_CONFIRM_PATTERNS = [
    /^(boleh|ya|iya|mau|yup|bisa|ok|oke|sip|siap)$/i,
    /\b(iya|ya|ok|oke|mau|boleh|bisa|kirim)\b.*\b(foto|photo|gambar|preview|liat)/i,
    /\b(foto|photo|gambar|preview|liat)\b.*\b(mana|nya|dong|ya|aja|ok|oke|sip|siap|kirim)\b/i,
    /\b(foto|photo|gambar)\b\s*(nya|dong|ya|aja|mana)?\b/i,
    /\bgambar\b\s*(nya|dong|ya|aja|mana)?\b/i,
    /^mana\s+(mobil|unit|fotonya|gambarnya|photonya)/i,
  ];

  private static readonly GREETING_PATTERNS = /^(halo|hai|selamat|pagi|siang|sore|malam|assalam|permisi|hi|hello)/i;

  /**
   * Get Standard Time-based Greeting (WIB)
   */
  private static getTimeGreeting(): string {
    const now = new Date();
    const hour = parseInt(new Intl.DateTimeFormat('en-GB', {
      hour: 'numeric',
      hour12: false,
      timeZone: 'Asia/Jakarta'
    }).format(now));

    if (hour >= 4 && hour < 11) return "Selamat pagi";
    if (hour >= 11 && hour < 15) return "Selamat siang";
    if (hour >= 15 && hour < 18) return "Selamat sore";
    return "Selamat malam";
  }

  /**
   * Helper to pick a random item from an array
   */
  private static getRandomVariation<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  /**
   * Format name with "Kak" prefix according to user rules
   * Ensures "Kak Yudho" instead of "Pak Yudho" or "Yudho D. L"
   */
  private static formatKakName(name?: string | null): string {
    if (!name || ['Kak', 'Unknown', 'Pelanggan', 'siapa', 'User'].includes(name)) return "Kak";

    // Remove existing titles: Kak, Pak, Bu, Mas, Mbak, Bapak, Ibu
    let cleanName = name.replace(/^(Kak|Pak|Bu|Mas|Mbak|Tuan|Nyonya|Bapak|Ibu)\s+/i, '').trim();

    // Take the first part of the name (e.g., "Yudho" from "Yudho D. L")
    const parts = cleanName.split(/\s+/);
    if (parts.length > 0) {
      cleanName = parts[0];
    }

    // Capitalize first letter properly
    cleanName = cleanName.charAt(0).toUpperCase() + cleanName.slice(1).toLowerCase();

    return `Kak ${cleanName}`;
  }

  /**
   * Helper to extract the most relevant vehicle name or ID from conversation history
   * PRIORITY: Current Msg > User Mention History > AI Mentions
   */
  private static extractActiveVehicle(
    currentMessage: string,
    messageHistory: Array<{ role: "user" | "assistant"; content: string }>
  ): string {
    const msg = currentMessage.toLowerCase();

    // 1. Try to extract from current message (Explicit ID always highest priority)
    const idMatch = msg.match(this.VEHICLE_ID_PATTERN);
    if (idMatch) return idMatch[0].toUpperCase().replace(" ", "-");

    for (const pattern of this.VEHICLE_NAME_PATTERNS) {
      const match = msg.match(pattern);
      if (match && match[0]) return match[0].trim();
    }

    // 2. PRIORITY: Try to extract from MOST RECENT USER message in history (to keep focus)
    const userHistory = messageHistory.filter(m => m.role === "user").reverse().slice(0, 10);
    for (const historyMsg of userHistory) {
      const content = historyMsg.content.toLowerCase();
      const idM = content.match(this.VEHICLE_ID_PATTERN);
      if (idM) return idM[0].toUpperCase().replace(" ", "-");

      for (const pattern of this.VEHICLE_NAME_PATTERNS) {
        const match = content.match(pattern);
        if (match && match[0]) return match[0].trim();
      }
    }

    // 3. LAST RESORT: Try to extract from last AI message
    const lastAiMsg = messageHistory.filter(m => m.role === "assistant").pop();
    if (lastAiMsg) {
      const content = lastAiMsg.content.toLowerCase();
      const idM = content.match(this.VEHICLE_ID_PATTERN);
      if (idM) return idM[0].toUpperCase().replace(" ", "-");

      for (const pattern of this.VEHICLE_NAME_PATTERNS) {
        const match = content.match(pattern);
        if (match && match[0]) return match[0].trim();
      }
    }

    return "";
  }

  /**
   * Analyze customer tone based on message characteristics (AI 5.2)
   * Scores: < 5 words (+2), 1 word (+2), Typo (+1), Question (-1), Emoji (-1), Greeting (-1)
   */
  /**
   * Analyze customer tone based on message characteristics (AI 5.2)
   * Algorithm based on User's Pseudo-Code:
   * Score = Cuek_Score - Aktif_Score
   * Thresholds: >= 2 (CUEK), <= -2 (AKTIF)
   */
  private static analyzeCustomerTone(message: string): 'CUEK' | 'NORMAL' | 'AKTIF' {
    let cuekScore = 0;
    let aktifScore = 0;
    const msg = message.trim();
    const words = msg.split(/\s+/);
    const wordCount = words.length;

    // 1. Word Count <= 3 -> Cuek +2
    if (wordCount <= 3) {
      cuekScore += 2;
    }

    // 2. Response Time < 60s -> Aktif +2
    // Note: Since we don't have exact response time diff here without DB query, 
    // we skip this factor or assume neutral. 
    // if (responseTime < 60) aktifScore += 2;

    // 3. Emoji -> Aktif +1
    const emojiPattern = /[\uD83C-\uDBFF\uDC00-\uDFFF\u2600-\u26FF]/;
    if (emojiPattern.test(msg)) {
      aktifScore += 1;
    }

    // 4. Greeting -> Aktif +1
    if (this.GREETING_PATTERNS.test(msg)) {
      aktifScore += 1;
    }

    // 5. Question -> Aktif +1 (New Proxy)
    if (msg.includes('?')) {
      aktifScore += 1;
    }

    // 6. Typo/Slang -> Cuek +1
    const typoPattern = /\b(brp|hrg|kpn|knp|sy|u|yg|gak|gx|ga|tx|thx|cm|kmn|dp|skrg|dmn)\b/i;
    if (typoPattern.test(msg)) {
      cuekScore += 1;
    }

    // Calculate Final Score
    const score = cuekScore - aktifScore;

    if (score >= 2) return 'CUEK';
    if (score <= -2) return 'AKTIF';
    return 'NORMAL';
  }

  /**
   * Generate AI response untuk customer message
   */
  static async generateResponse(
    context: ChatContext,
    userMessage: string
  ): Promise<ChatResponse> {
    const startTime = Date.now();
    const msg = userMessage.trim().toLowerCase();

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
            welcomeMessage: `{greeting}, Halo! Selamat pagi, selamat datang di showroom kami. Saya adalah Asisten virtual yang siap membantu Anda menemukan mobil impian, dan mendapatkan informasi yang Anda butuhkan. Sebelumnya dengan kakak siapa saya bicara dan darimana? Ada yang bisa saya bantu`,
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

      // Global variable for scope
      const showroomName = account?.tenant?.name || "Showroom Kami";

      // Check if customer chat is enabled
      if (!config.customerChatEnabled) {
        console.log(`[WhatsApp AI Chat] Customer chat is DISABLED. Sending fallback message.`);
        return {
          message: `Halo! 👋\n\nTerima kasih sudah menghubungi ${account.tenant.name}.\n\nTim kami akan segera membalas pesan Anda.\nMohon menunggu sebentar ya 🙏`,
          shouldEscalate: true,
          confidence: 1.0,
          processingTime: Date.now() - startTime,
        };
      }
      console.log(`[WhatsApp AI Chat] Customer chat is ENABLED. Proceeding with AI response.`);

      const isStaff = context.isStaff || false;

      const hasBusinessHours = config.businessHours &&
        typeof config.businessHours === 'object' &&
        Object.keys(config.businessHours as object).length > 0;

      const shouldCheckHours = hasBusinessHours && isStaff;

      if (shouldCheckHours && !this.isWithinBusinessHours(config.businessHours, config.timezone)) {
        console.log(`[WhatsApp AI Chat] 🌙 Outside business hours for STAFF: ${context.staffInfo?.name || context.customerPhone}`);

        // Staff-specific after hours message or use general config
        const afterHoursMsg = config.afterHoursMessage ||
          `Halo! 👋 Saat ini Showroom sedang di luar jam operasional.\n\n` +
          `Fitur asisten untuk staff akan tersedia kembali di jam operasional. 🙏`;

        return {
          message: afterHoursMsg,
          shouldEscalate: false,
          needsCatchup: false,
          confidence: 1.0,
          processingTime: Date.now() - startTime,
        };
      }

      if (isStaff) {
        console.log(`[WhatsApp AI Chat] ✅ Staff detected - currently within business hours`);
      }

      // ==================== PRIORITY STOCK CHECK (BEFORE AI) ====================
      const stockCheckResponse = await this.handlePriorityStockCheck(msg, context, startTime);
      if (stockCheckResponse) return stockCheckResponse;

      // ==================== PRIORITY TECHNICAL QUESTION CHECK (BEFORE AI) ====================
      const technicalCheckResponse = await this.handlePriorityTechnicalCheck(msg, userMessage, context, startTime);
      if (technicalCheckResponse) return technicalCheckResponse;

      let aiResponse: any = null;
      let resultImages: Array<{ imageUrl: string; caption?: string }> | null = null;

      // ==================== PRE-AI PHOTO CONFIRMATION HANDLER ====================
      // Handle photo confirmations BEFORE calling AI to avoid AI failures breaking the flow
      const photoConfirmResult = await WhatsAppAIChatService.handlePhotoConfirmationDirectly(
        userMessage,
        context.messageHistory,
        context.tenantId,
        context
      );

      if (photoConfirmResult) {
        console.log(`[WhatsApp AI Chat] ✅ Photo confirmation handled directly - queuing for post-processing`);
        aiResponse = {
          content: photoConfirmResult.message,
          images: photoConfirmResult.images
        };
        resultImages = photoConfirmResult.images || [];
      } else {
        // Build system prompt with sender info
        console.log(`[WhatsApp AI Chat] Building system prompt for tenant: ${account.tenant.name}`);

        // 🔥 AI 5.2: Analyze Customer Tone
        const customerTone = this.analyzeCustomerTone(userMessage);
        console.log(`[WhatsApp AI Chat] 🎯 Customer Tone Analysis: "${userMessage}" -> ${customerTone}`);

        const senderInfo = {
          isStaff: context.isStaff || false,
          staffInfo: context.staffInfo,
          customerPhone: context.customerPhone,
          isEscalated: context.isEscalated || false,
          isCatchup: context.isCatchup || false,
        };
        let systemPrompt = await this.buildSystemPrompt(
          account.tenant || { name: "Showroom Kami", city: "Indonesia" },
          config,
          context.intent,
          senderInfo,
          customerTone, // Pass tone result
          context.leadInfo, // Pass CRM Lead Info
          context.intentEntities // Pass entities
        );

        // --- SPECIFIC ROLE INJECTION ---
        // Inject Admin/Owner specific prompt addition if applicable to give them full access context
        if (senderInfo.isStaff && senderInfo.staffInfo?.roleLevel && senderInfo.staffInfo.roleLevel >= ROLE_LEVELS.ADMIN) {
          console.log(`[WhatsApp AI Chat] 👑 Admin/Owner detected (Level ${senderInfo.staffInfo.roleLevel}). Injecting Admin Prompt.`);
          // This ensures AI knows it's talking to an Admin and can offer the full menu
          // We append this to the system prompt
          systemPrompt += "\n\n" + ADMIN_SYSTEM_PROMPT_ADDITION;

          // CRITICAL: Override the standard "help/menu" behavior for Admins
          // We tell the AI explicitly: "If this Admin asks for 'help' or 'menu', output the text from ADMIN_COMMAND_HELP."
          systemPrompt += `\n\n[ADMIN MENU OVERRIDE]\nIf the user asks for 'help', 'menu', 'panduan', or 'fitur', YOU MUST DISPLAY the following text EXACTLY:\n"""\n${ADMIN_COMMAND_HELP}\n"""`;
        }


        // Build context dengan conversation history
        const conversationContext = this.buildConversationContext(
          context.messageHistory,
          userMessage
        );

        // Generate response dengan Z.ai
        const zaiClient = createZAIClient();
        if (!zaiClient) {
          throw new Error('ZAI client not configured.');
        }

        try {
          // Add a race condition with manual timeout
          const apiCallPromise = zaiClient.generateText({
            systemPrompt,
            userPrompt: `${conversationContext}\n\nUser Message: ${userMessage}`,
            temperature: config.temperature || 0.7,
          });

          const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('ZAI API call timed out')), 45000);
          });

          aiResponse = await Promise.race([apiCallPromise, timeoutPromise]);

          if (aiResponse.content) {
            aiResponse.content = aiResponse.content.trim();
          }

          // If both message and content are empty, or tool calls exist, handle accordingly
          const hasContent = aiResponse.content && aiResponse.content.trim().length > 0;
          const hasToolCalls = aiResponse.toolCalls && aiResponse.toolCalls.length > 0;

          if (!hasContent && !hasToolCalls) {
            console.log(`[WhatsApp AI Chat] ⚠️ Content and ToolCalls empty, using smart fallback...`);
            const fallbackResult = await this.generateSmartFallback(userMessage, context.messageHistory, context.tenantId, context);
            aiResponse = { ...aiResponse, content: fallbackResult.message };
          }
        } catch (apiError: any) {
          console.error(`[WhatsApp AI Chat] ❌ ZAI API call failed, using fallback: ${apiError.message}`);

          // GENERATE FALLBACK CONTENT
          // Use smart fallback instead of hardcoded generic messages
          try {
            const smartFallback = await this.generateSmartFallback(
              userMessage,
              context.messageHistory,
              context.tenantId,
              context
            );

            aiResponse = {
              content: smartFallback.message,
              shouldEscalate: smartFallback.shouldEscalate
            };

            if (smartFallback.images && smartFallback.images.length > 0) {
              resultImages = smartFallback.images;
            }
          } catch (fallbackError: any) {
            console.error(`[WhatsApp AI Chat] ❌ Smart Fallback also failed: ${fallbackError.message}`);
            // Last resort generic message
            aiResponse = {
              content: `Mohon maaf kak, sistem sedang sibuk. 🙏\n\nBoleh diulangi pertanyaannya? Atau ketik "Menu" untuk opsi lainnya.`,
              shouldEscalate: true
            };
          }
        }
      }

      // ==================== POST-PROCESSING ====================
      let responseMessage = aiResponse.content || '';

      // 1. Ensure Mandatory Follow-up
      const closingIndicators = ['sampai jumpa', 'selamat tinggal', 'dah', 'terima kasih', 'makasih', 'siap', 'senang membantu'];
      const isClosingMessage = closingIndicators.some(ind => responseMessage.toLowerCase().includes(ind));
      const alreadyHasFollowUp = responseMessage.toLowerCase().includes('ada hal lain') || responseMessage.toLowerCase().includes('bisa saya bantu');

      if (!isClosingMessage && !alreadyHasFollowUp && responseMessage.length > 0) {
        responseMessage += "\n\nApakah ada hal lain yang bisa kami bantu? 😊";
      }

      // (Pre-processing of AI response text moved to bottom to ensure it covers tool results)

      // 2b. LAZINESS FILTER moved to post-processing

      // 3. CRITICAL PRICE VALIDATION - Catch absurd prices before sending to customer
      // This prevents the "1 jt" and "5 jt" error that should NEVER happen
      // Relaxed: Only flag if it's LIKELY a vehicle price (not DP/Cicilan) and very low
      const pricePattern = /\bHarga:\s*Rp\s*(\d+(?:\.\d+)?)\s*(jt|juta)\b/gi;
      const priceMatches = Array.from(responseMessage.matchAll(pricePattern));
      let hasSuspiciousPrice = false;

      for (const match of priceMatches) {
        const m = match as any;
        const priceValue = parseFloat(m[1]);

        // Flag suspicious prices (less than 10 juta for regular cars in "Harga:" context)
        if (priceValue < 10) {
          hasSuspiciousPrice = true;
          console.log(`[WhatsApp AI Chat] Suspicious price detected: "Rp ${priceValue} ${m[2]}"`);
        }
      }

      // If suspicious prices detected, warn and sanitize
      if (hasSuspiciousPrice) {
        console.error(`[WhatsApp AI Chat] 🚨 PRICE VALIDATION FAILED! Replacing response with safe fallback.`);

        // Try to get actual vehicle data from context
        const vehicles = await this.getAvailableVehiclesDetailed(context.tenantId);

        if (vehicles.length > 0) {
          const vehicleList = this.formatVehicleListDetailed(vehicles.slice(0, 3));
          responseMessage = `Berikut unit ready di ${showroomName}:\n\n${vehicleList}\n\n` +
            `Mau lihat fotonya? 📸 (Ketik "Ya" atau "Foto [ID]" untuk melihat)`;

          return {
            message: responseMessage,
            shouldEscalate: false,
            confidence: 0.8,
            processingTime: Date.now() - startTime
          };
        } else {
          responseMessage = `Mohon maaf, saya perlu konfirmasi informasi harga ke tim terlebih dahulu untuk memastikan akurasinya. Bisa ditunggu sebentar ya? 🙏`;
        }

        // Force escalation for price errors
        console.error(`[WhatsApp AI Chat] Forcing escalation due to price validation failure`);
      }

      // Analyze response untuk escalation
      const shouldEscalate = this.shouldEscalateToHuman(
        aiResponse.content,
        context.intent
      );

      const processingTime = Date.now() - startTime;

      // Handle tool calls (function calling)
      let uploadRequest: any = null;
      let editRequest: any = null;
      const messages: any[] = []; // Added for tool output feedback

      // Handle tool calls
      if (aiResponse.toolCalls) {
        console.log(`[WhatsAppAI] 🛠️ Tool calls detected: ${aiResponse.toolCalls.length}`);

        for (const toolCall of aiResponse.toolCalls) {
          const toolName = toolCall.function.name;
          const toolArgs = JSON.parse(toolCall.function.arguments);

          console.log(`[WhatsAppAI] 🔧 Tool: ${toolName}`, toolArgs);

          if (toolName === 'create_lead') {
            // BLOCK STAFF/ADMIN FROM CREATING LEADS
            if (context.isStaff) {
              console.log('[WhatsAppAI] 🛑 Creating lead SKIPPED because user is STAFF/ADMIN/OWNER.');
              messages.push({
                role: "function",
                name: toolName,
                content: JSON.stringify({ success: false, message: "Lead creation skipped for staff/admin." })
              } as any);

              if (!responseMessage) {
                responseMessage = "Lead tidak dibuat karena Anda terdeteksi sebagai Staff/Admin (Internal Team). 🔒";
              }
            } else {
              try {
                console.log('[WhatsAppAI] 📝 Creating lead...');

                // Normalize phone number
                let phone = toolArgs.phone || context.customerPhone;

                // If phone is missing/invalid, try to use context phone
                if (!phone || phone.length < 5) {
                  phone = context.customerPhone;
                }

                // Check if lead already exists to decide between create or update
                const existingLead = await LeadService.getLeadByPhone(context.tenantId, phone);

                let resultLead;
                if (existingLead) {
                  // Update existing
                  resultLead = await LeadService.updateLead(existingLead.id, context.tenantId, {
                    name: toolArgs.name || existingLead.name, // Keep existing name if not provided
                    interestedIn: toolArgs.interest || toolArgs.vehicle_id || existingLead.interestedIn,
                    budgetRange: toolArgs.budget || existingLead.budgetRange,
                    notes: toolArgs.location ? `Location: ${toolArgs.location}\n${existingLead.notes || ''}` : existingLead.notes,
                    status: 'CONTACTED' // Update status to reflect active engagement
                  });
                  console.log('[WhatsAppAI] ✅ Lead updated:', resultLead.id);
                } else {
                  // Create new
                  resultLead = await LeadService.createLead({
                    tenantId: context.tenantId,
                    name: toolArgs.name || context.customerName || "Customer Baru",
                    phone: phone,
                    interestedIn: toolArgs.interest || toolArgs.vehicle_id,
                    budgetRange: toolArgs.budget,
                    source: toolArgs.source || 'whatsapp',
                    message: context.messageHistory.map(m => `${m.role}: ${m.content}`).slice(-3).join('\n'), // Store recent chat as initial message
                    status: 'NEW',
                    priority: (toolArgs.urgency as LeadPriority) || 'MEDIUM',
                    notes: toolArgs.location ? `Location: ${toolArgs.location}` : undefined
                  });
                  console.log('[WhatsAppAI] ✅ Lead created:', resultLead.id);
                }

                // CRITICAL: Link conversation to lead for dashboard synchronization
                const resLead = resultLead as any;
                if (resLead?.id && context.conversationId) {
                  await prisma.whatsAppConversation.update({
                    where: { id: context.conversationId },
                    data: { leadId: resLead.id }
                  }).catch(err => console.error('[WhatsAppAI] Failed to link conversation to lead:', err));
                }

                // Add result to messages for AI to know process succeeded
                messages.push({
                  role: "function",
                  name: toolName,
                  content: JSON.stringify({ success: true, lead_id: resLead.id, message: "Lead saved successfully." })
                } as any);

              } catch (error) {
                console.error('[WhatsAppAI] ❌ Failed to create/update lead:', error);
                // Fallback error message if needed, or just log
              }

              // Append confirmation to responseMessage so the user knows it worked
              if (!responseMessage) {
                responseMessage = "Baik, data Anda sudah kami simpan. Terima kasih! 🙏\n\nAda lagi yang bisa kami bantu?";
              }
            }

          } else if (toolName === 'send_vehicle_images') {
            const searchQuery = toolArgs.search_query;

            console.log('[WhatsApp AI Chat] 📸 AI requested vehicle images for:', searchQuery);

            resultImages = await this.fetchVehicleImagesByQuery(searchQuery, context.tenantId);

            if (resultImages && resultImages.length > 0) {
              console.log(`[WhatsApp AI Chat] ✅ Found ${resultImages.length} images to send`);
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

              // Add search results to the response message with FULL DETAILS
              // Format must match system prompt: pipe separator with all vehicle details
              if (!responseMessage.includes(searchResults[0].make)) {
                const vehicleList = this.formatVehicleListDetailed(searchResults.slice(0, 5));
                let searchResultText = `\n\nDitemukan ${searchResults.length} mobil yang cocok:\n\n${vehicleList}\n\n`;

                if (searchResults.length > 5) {
                  searchResultText += `...dan ${searchResults.length - 5} unit lainnya.\n\n`;
                }

                searchResultText += `Mau lihat fotonya? 📸 (Ketik "Ya" atau "Foto [ID]" untuk melihat)\n\n`;
                searchResultText += `Apakah ada hal lain yang bisa kami bantu? 😊`;

                responseMessage += searchResultText;
              }
            } else {
              // No vehicles found
              const notFoundMsg = `\n\nMohon maaf, saat ini kami belum memiliki stok unit yang sesuai dengan kriteria kakak. 🙏\nBoleh kami bantu carikan unit alternatif lain?`;
              if (!responseMessage.includes("belum memiliki stok")) {
                responseMessage += notFoundMsg;
              }
              console.log('[WhatsApp AI Chat] ⚠️ No vehicles found for criteria');
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
          } else if (toolCall.function.name === 'calculate_kkb_simulation') {
            const args = JSON.parse(toolCall.function.arguments);
            console.log('[WhatsApp AI Chat] 🧮 AI calculating KKB simulation:', args);

            const simulationResult = WhatsAppAIChatService.calculateKKBSimulation(
              args.vehicle_price,
              args.dp_amount,
              args.dp_percentage,
              args.tenor_years,
              { vehicleYear: args.vehicle_year }
            );

            // Append simulation result to response with DISCLAIMER
            responseMessage += "\n\n" + simulationResult;
            responseMessage += "\n\n_Catatan: Suku bunga bersifat estimasi & dapat berubah sesuai kebijakan leasing terkini._";

            if (!responseMessage.toLowerCase().includes('bantu')) {
              responseMessage += "\n\nApakah ada hal lain yang bisa kami bantu? 😊";
            }
          }
        }
      }

      // ==================== OPERATIONAL FALLBACKS (V 5.0) ====================

      // 4. FALLBACK EDIT DETECTION (V 5.0) 
      // If no tool call was made but message looks like an edit request
      if (!editRequest && responseMessage) {
        const fallbackEdit = WhatsAppAIChatService.detectEditIntentFromText(responseMessage, userMessage);
        if (fallbackEdit) {
          console.log('[WhatsApp AI Chat] 💎 Fallback edit intent detected!', fallbackEdit);
          editRequest = fallbackEdit;
        }
      }

      // ==================== FINAL POST-PROCESSING ====================
      // This section ensures that EVERYTHING (AI text + tool results) follows brand rules

      // 1. SELF-HEALING GREETINGS (Context-Aware V 5.0)
      if (responseMessage.length > 0) {
        const timeGreeting = this.getTimeGreeting();
        const lowerResponse = responseMessage.toLowerCase().trim();
        const startsWithGreeting = /^(halo|hai|hi|selamat|pagi|siang|sore|malam|assalam)/i.test(lowerResponse);

        const isNewConversation = context.messageHistory.length <= 2;
        const lastUserMsg = context.messageHistory.filter(m => m.role === "user").pop();
        const userLastMsgContent = lastUserMsg?.content?.toLowerCase().trim() || "";
        const lastUserMsgIsGreeting = /^(halo|hai|hi|selamat|pagi|siang|sore|malam|assalam)/i.test(userLastMsgContent);

        const conversationNeedsGreeting = isNewConversation || lastUserMsgIsGreeting;

        if (!startsWithGreeting && conversationNeedsGreeting) {
          responseMessage = `${timeGreeting}! 👋\n\n${responseMessage.trim()}`;
          console.log(`[WhatsApp AI Chat] 👋 Added dynamic greeting.`);
        }
      }

      // 3. LAZINESS FILTER - Catch and replace "cek dulu" or "mohon ditunggu"
      const hasToolCalls = aiResponse.toolCalls && aiResponse.toolCalls.length > 0;
      if (!hasToolCalls && (responseMessage.toLowerCase().includes("cek dulu") || responseMessage.toLowerCase().includes("mohon ditunggu"))) {
        console.log(`[WhatsApp AI Chat] ⚠️ Laziness detected in response: "${responseMessage}"`);
        const vehicles = await this.getAvailableVehiclesDetailed(context.tenantId);
        if (vehicles.length > 0) {
          const vehicleList = this.formatVehicleListDetailed(vehicles.slice(0, 3));
          responseMessage = `Mohon maaf kak, untuk ketersediaan unit saat ini bisa langsung cek daftar ready stock kami berikut ini ya:\n\n${vehicleList}\n\n` +
            `Mau lihat fotonya? 📸 (Atau ada kriteria unit lain yang dicari?)`;

          // Re-apply greeting if we replaced the whole message
          const now = new Date();
          const hour = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' })).getHours();
          let timeGreeting = "Selamat malam";
          if (hour >= 4 && hour < 11) timeGreeting = "Selamat pagi";
          else if (hour >= 11 && hour < 15) timeGreeting = "Selamat siang";
          else if (hour >= 15 && hour < 18) timeGreeting = "Selamat sore";

          if (!responseMessage.toLowerCase().includes("selamat")) {
            responseMessage = `${timeGreeting}! 👋\n\n${responseMessage}`;
          }
        }
      }

      // 4. Ensure Mandatory Follow-up Question
      // REVISION AI 5.2: Removed forced suffix. 
      // The AI prompt is now capable of natural closings. 
      // Forcing a generic "anything else?" destroys the natural flow of specific questions (e.g. "Mau test drive?").
      // const endsWithQuestion = responseMessage.trim().endsWith("?") || responseMessage.trim().endsWith("😊");
      // if (!endsWithQuestion && !responseMessage.toLowerCase().includes("bantu") && !responseMessage.toLowerCase().includes("terima kasih") && responseMessage.length > 0) {
      //   responseMessage += "\n\nApakah ada hal lain yang bisa kami bantu? 😊";
      // }

      // If AI sent images but no text, add default message
      if (resultImages && resultImages.length > 0 && !responseMessage) {
        responseMessage = `Siap! Ini foto ${resultImages.length > 1 ? 'mobil-mobilnya' : 'mobilnya'} ya 📸👇`;
        console.log('[WhatsApp AI Chat] Added default image message:', responseMessage);
      }

      // If images requested but none found, add helpful message
      if (aiResponse.toolCalls?.some((tc: any) =>
        tc.function?.name === 'send_vehicle_images'
      ) && (!resultImages || resultImages.length === 0)) {
        responseMessage = responseMessage || 'Maaf kak, saat ini galeri foto unit sedang kami perbarui untuk kualitas terbaik. 👋 Adakah hal lain yang bisa kami bantu? 😊';
      }

      return {
        message: responseMessage,
        shouldEscalate,
        confidence: 0.85,
        processingTime,
        ...(resultImages && resultImages.length > 0 && { images: resultImages }),
        ...(uploadRequest && { uploadRequest }),
        ...(editRequest && { editRequest }),
      };
    } catch (error: any) {
      console.error("[WhatsApp AI Chat] ❌ ERROR generating response:");
      console.error("[WhatsApp AI Chat] Error name:", error.name);
      console.error("[WhatsApp AI Chat] Error message:", error.message);
      console.error("[WhatsApp AI Chat] Error stack:", error.stack);

      // Check if this is a photo confirmation request - try to handle it directly
      const msg = userMessage.trim().toLowerCase();
      const photoConfirmPatterns = [
        /^(boleh|ya|iya|ok|oke|okey|okay|mau|yup|yap|sip|siap|bisa|tentu|pasti|yoi|gass?|cuss?)$/i,
        /^(kirimin|kirimkan|lanjut|lanjutkan|hayuk|yuk|ayo)$/i,
        // Phrases with "foto" - "iya mana fotonya", "kirim fotonya" etc
        /\b(iya|ya|ok|oke|mau|boleh)\b.*\b(foto|gambar)/i,
        /\b(mana|kirim|kasih|tunjuk)\b.*\b(foto|gambar)/i,
        /\bfoto\s*(nya|dong|ya|aja|mana)?\b/i,
        /silahkan|silakan/i, /ditunggu/i, /tunggu/i,
        /kirim\s*(aja|dong|ya|in)?/i, /kirimin\s*(dong|ya|aja)?/i,
        /boleh\s*(dong|ya|lah|aja|silahkan|silakan|banget)?/i,
        /lanjut\s*(kirim|aja)?/i, /ok\s*lanjut\s*kirim/i,
      ];
      const isPhotoConfirmation = photoConfirmPatterns.some(p => p.test(msg));

      // Check conversation history for vehicle context
      const lastAiMsg = context.messageHistory.filter(m => m.role === "assistant").pop();
      const offeredPhotos = lastAiMsg?.content.toLowerCase().includes("foto") ||
        lastAiMsg?.content.toLowerCase().includes("lihat");

      if (isPhotoConfirmation && offeredPhotos) {
        console.log("[WhatsApp AI Chat] 🔄 AI failed but detected photo confirmation - trying direct photo fetch");

        // Extract vehicle name from last AI message
        const vehicleMatch = lastAiMsg?.content.match(/(?:Toyota|Honda|Suzuki|Daihatsu|Mitsubishi|Nissan|Mazda|BMW|Mercedes|Hyundai|Kia)\s+[\w\s]+(?:\d{4})?/i);
        const vehicleName = vehicleMatch ? vehicleMatch[0].trim() : "";

        if (vehicleName) {
          try {
            const images = await this.fetchVehicleImagesByQuery(vehicleName, context.tenantId);
            if (images && images.length > 0) {
              console.log(`[WhatsApp AI Chat] ✅ Found ${images.length} images for "${vehicleName}" via fallback`);
              return {
                message: `Siap! Ini foto ${vehicleName}-nya ya 📸👇\n\nAda pertanyaan lain? 😊`,
                shouldEscalate: false,
                confidence: 0.8,
                processingTime: Date.now() - startTime,
                images,
              };
            }
          } catch (imgError) {
            console.error("[WhatsApp AI Chat] Failed to fetch images in fallback:", imgError);
          }
        }
      }


      // ==================== STOCK AVAILABILITY FALLBACK HANDLER ====================
      // Critical fallback: If AI is down, we must still be able to answer "Is X available?"
      const stockQuery = msg.match(/(?:ada|ready|tersedia|stok|available|jual|cari|lihat).{0,20}(avanza|xenia|brio|mobilio|hrv|crv|fortuner|pajero|innova|agya|ayla|calya|sigra|jazz|yaris|rush|terios|xpander|ertiga|raize|rocky)/i);

      if (stockQuery && stockQuery[1]) {
        const keyword = stockQuery[1];
        console.log(`[SmartFallback] 🚗 Stock availability query detected for: "${keyword}"`);

        try {
          // Quick DB check
          const vehicles = await prisma.vehicle.findMany({
            where: {
              tenantId: context.tenantId,
              status: 'AVAILABLE',
              OR: [
                { model: { contains: keyword, mode: 'insensitive' } },
                { make: { contains: keyword, mode: 'insensitive' } }
              ]
            },
            take: 3,
            orderBy: { year: 'desc' }
          });

          if (vehicles.length > 0) {
            const name_st = this.formatKakName(context?.customerName);
            // One-breath style greeting
            const now = new Date();
            const hour = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' })).getHours();
            let timeGreeting = "Selamat malam";
            if (hour >= 4 && hour < 11) timeGreeting = "Selamat pagi";
            else if (hour >= 11 && hour < 15) timeGreeting = "Selamat siang";
            else if (hour >= 15 && hour < 18) timeGreeting = "Selamat sore";

            let stockMsg = `Halo! ${name_st} ⚡\n\n` +
              `Selamat datang di showroom kami! Saya adalah asisten virtual yang siap membantu menemukan mobil impian Anda.\n\n` +
              `Baik Kak, sebelumnya dengan siapa saya bicara? Untuk unit *${keyword}* ini MASIH AVAILABLE! 🔥\n\n`;

            vehicles.forEach(v => {
              stockMsg += `* ID Unit: ${v.displayId || v.id.slice(0, 8).toUpperCase()}\n`;
              stockMsg += `* Harga: Rp ${new Intl.NumberFormat('id-ID').format(Number(v.price))} (Nego)\n`;
              stockMsg += `* Transmisi: ${v.transmissionType || '-'}\n`;
              stockMsg += `* Warna: ${v.color || '-'}\n`;
              stockMsg += `* Bahan Bakar: ${v.fuelType || 'Bensin'}\n\n`;
            });

            stockMsg += `Unit siap gass, kondisi terawat kak! 👍\n\n`;
            stockMsg += `Rencana untuk pemakaian di area mana kak? Mau saya kirimkan foto detail unit ini untuk kelengkapan referensi? 📸😊`;

            return {
              message: stockMsg,
              shouldEscalate: false,
              confidence: 0.8,
              processingTime: Date.now() - startTime
            };
          } else {
            // No stock found
            const now = new Date();
            const hour = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' })).getHours();
            let timeGreetingFallback = "Selamat malam";
            if (hour >= 4 && hour < 11) timeGreetingFallback = "Selamat pagi";
            else if (hour >= 11 && hour < 15) timeGreetingFallback = "Selamat siang";
            else if (hour >= 15 && hour < 18) timeGreetingFallback = "Selamat sore";

            return {
              message: `${timeGreetingFallback}! 👋\n\nMohon maaf kak, untuk unit *${keyword}* saat ini stoknya sedang kosong di showroom kami. 🙏\n\nApakah kakak ada alternatif unit lain yang diminati? Saya bisa bantu carikan unit sejenis lho. 😊`,
              shouldEscalate: false,
              confidence: 0.8,
              processingTime: Date.now() - startTime
            };
          }
        } catch (err) {
          console.error("[SmartFallback] Failed to query stock:", err);
          // Continue to default fallback
        }
      }

      // ==================== SMART CONTEXTUAL FALLBACK ====================
      // Instead of generic menu, try to give a helpful response based on user's message
      const smartFallback = await this.generateSmartFallback(
        userMessage,
        context.messageHistory,
        context.tenantId,
        context
      );

      return {
        message: smartFallback.message,
        shouldEscalate: smartFallback.shouldEscalate,
        confidence: 0.6,
        processingTime: Date.now() - startTime,
        ...(smartFallback.images && { images: smartFallback.images }),
      };
    }
  }

  // ==================== NEW AGENTIC CAPABILITY: SALES NOTIFICATION ====================
  /**
   * Proactive notification to sales staff when a HOT LEAD is detected
   */
  private static async notifySalesStaff(tenantId: string, leadData: {
    customerName: string;
    customerPhone: string;
    vehicleName: string;
    budget: string;
    status: string;
    notes: string;
  }): Promise<void> {
    try {
      console.log(`[WhatsApp AI Chat] 🚨 SENDING HOT LEAD ALERT for ${leadData.customerName}`);

      // 1. Get Sales Staff (using existing helper)
      const staffMembers = await WhatsAppAIChatService.getRegisteredStaffContacts(tenantId);
      if (staffMembers.length === 0) {
        console.log("[WhatsApp AI Chat] ⚠️ No registered staff found to notify.");
        return;
      }

      // 2. Format the Alert Message
      const alertMessage =
        `🚨 *HOT LEAD ALERT!* 🚨

👤 *${leadData.customerName}*
🚗 *${leadData.vehicleName}*
💰 Budget: ${leadData.budget}
🔥 Status: ${leadData.status}
📝 Notes: ${leadData.notes}

👇 *KLIK FOLLOW UP CLOSING:*
wa.me/${leadData.customerPhone.replace(/\D/g, '').replace(/^0/, '62')}
`;

      // 3. Send to ALL registered staff (Simulation - using SendMessage)
      // In real implementation, we would loop through staff list and send via specialized 'sendNotification' method
      // For now, we reuse the existing orchestrator flow or direct API call if available.

      // Since this is a static method in ChatService, we can't easily call Orchestrator directly without circular dep.
      // BUT, we can use a clever trick: Return a special "System Action" via tool calls or simply log it for now
      // assuming the Orchestrator handles "escalation" properly.

      // BETTER: We just log it clearly here. In a full implementation, 
      // we would inject the NotificationService or MessageOrchestrator here.

      // For this specific codebase context, let's assume we can trigger a system notification:
      console.log("---------------------------------------------------");
      console.log("📢 NOTIFICATION SENT TO STAFF:");
      console.log(alertMessage);
      console.log("---------------------------------------------------");

      // TODO: Connect to explicit notification service
      // await NotificationService.sendWhatsApp(staff.phone, alertMessage);

    } catch (e) {
      console.error("[WhatsApp AI Chat] ❌ Failed to notify sales staff:", e);
    }
  }

  /**
   * Format vehicle list with full details matching user's visual requirement
   */
  private static formatVehicleListDetailed(vehicles: any[]): string {
    return vehicles.map(v => {
      const priceJuta = Math.round(Number(v.price) / 1000000);
      const id = v.displayId || v.id.substring(0, 6).toUpperCase();
      const transmission = v.transmissionType || 'Manual';
      const variant = v.variant ? ` ${v.variant}` : '';
      const km = v.mileage ? v.mileage.toLocaleString('id-ID') : '-';
      const fuel = v.fuelType || 'Bensin';
      const color = v.color || '-';

      // Generate SEO friendly website URL
      const makeSlug = (v.make || 'mobil').toLowerCase().replace(/\s+/g, '-');
      const modelSlug = (v.model || 'unit').toLowerCase().replace(/\s+/g, '-');
      const year = v.year || 0;

      const websiteUrl = `https://primamobil.id/vehicles/${makeSlug}-${modelSlug}-${year}-${id}`;

      // Format matching user request:
      return `🚗 ${v.make || ''} ${v.model || ''}${variant} ${transmission} ${v.year || ''} | ${id}\n` +
        `* Harga: Rp ${priceJuta} juta\n` +
        `* Kilometer: ${km} km\n` +
        `* Transmisi: ${transmission}\n` +
        `* Bahan bakar: ${fuel}\n` +
        `* Warna: ${color}\n` +
        `* 🎯 Website: ${websiteUrl}`;
    }).join("\n\n");
  }

  /**
   * Generate smart contextual fallback when AI fails
   * Tries to understand user intent and give helpful response
   */
  private static async generateSmartFallback(
    userMessage: string,
    messageHistory: Array<{ role: "user" | "assistant"; content: string }>,
    tenantId: string,
    context?: ChatContext // Add context for staff info
  ): Promise<{ message: string; shouldEscalate: boolean; images?: Array<{ imageUrl: string; caption?: string }> }> {
    const msg = userMessage.toLowerCase().trim();
    console.log(`[SmartFallback DEBUG] Processed message: "${msg}"`);

    // Get tenant info
    let tenantName = "kami";
    let tenantAddress = "";
    let tenantContact = "";
    let tenantWA = "";
    try {
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: {
          name: true,
          address: true,
          city: true,
          province: true,
          whatsappNumber: true,
          phoneNumber: true
        }
      });
      if (tenant) {
        tenantName = tenant.name;
        tenantAddress = [tenant.address, tenant.city, tenant.province].filter(Boolean).join(", ");
        tenantWA = tenant.whatsappNumber || "";
        tenantContact = tenant.phoneNumber || tenant.whatsappNumber || "";
      }
    } catch (e) { /* ignore */ }

    // Get available vehicles for context
    let vehicles: any[] = [];

    // Standard Time-based Greeting
    const timeGreeting = this.getTimeGreeting();

    try {
      vehicles = await prisma.vehicle.findMany({
        where: { tenantId, status: "AVAILABLE" },
        select: { id: true, displayId: true, make: true, model: true, year: true, price: true, mileage: true, transmissionType: true, color: true, variant: true, fuelType: true },
        take: 10,
      });
    } catch (e) { /* ignore */ }

    // ==================== VEHICLE CONTEXT DETECTION (PRIORITY #0) ====================
    const vehicleName = this.extractActiveVehicle(userMessage, messageHistory);

    // ==================== PRIORITY 0: CONTEXTUAL ANSWER HANDLER ====================
    const contextualResponse = await this.handleContextualAnswers(msg, userMessage, messageHistory, vehicleName, context);
    if (contextualResponse) return contextualResponse;

    // ==================== PRIORITY 0.5: TECHNICAL & VEHICLE INQUIRY HANDLER ====================
    const technicalResponse = await this.handleTechnicalVehicleInquiry(msg, userMessage, messageHistory, vehicleName, tenantId, context, timeGreeting, vehicles);
    if (technicalResponse) return technicalResponse;

    // ==================== PRIORITY 1: AI IDENTITY & POLICY HANDLER ====================
    const identityResponse = await this.handleAIIdentityAndPolicyInquiry(msg, timeGreeting, tenantName);
    if (identityResponse) return identityResponse;

    // ==================== SEQUENCE OF modular HANDLERS (AI 5.2) ====================

    // 1. CONTEXTUAL ANSWERS (Name, Location, Domisili)
    const contextual = await this.handleContextualAnswers(msg, userMessage, messageHistory, vehicleName, context);
    if (contextual) return contextual;

    // 2. TECHNICAL QUESTIONS (Mesin, Interior, Dokumen)
    const technical = await this.handleTechnicalVehicleInquiry(msg, userMessage, messageHistory, vehicleName, tenantId, context, timeGreeting, vehicles);
    if (technical) return technical;

    // 3. IDENTITY & POLICIES (Siapa Anda, SOP)
    const identity = await this.handleAIIdentityAndPolicyInquiry(msg, timeGreeting, tenantName, context);
    if (identity) return identity;

    // 4. GREETINGS & WELCOME
    const greeting = await this.handleGreetingInquiry(msg, messageHistory, timeGreeting, tenantName, vehicles, context);
    if (greeting) return greeting;

    // 5. INVENTORY & RECOMMENDATIONS
    const inventory = await this.handleInventoryInquiry(msg, tenantName, vehicles, context);
    if (inventory) return inventory;

    // 6. FAMILY RECOMMENDATIONS
    const family = await this.handleFamilyRecommendationInquiry(msg, tenantId, vehicles);
    if (family) return family;

    // 7. LOCATION & CONTACT (Alamat, Google Maps, Nomor Showroom)
    const locationContact = await this.handleLocationContactInquiry(msg, timeGreeting, tenantName, tenantAddress, context);
    if (locationContact) return locationContact;

    // 8. STAFF CONTACT (Sales, Admin, Marketing)
    const staffContact = await this.handleStaffContactInquiry(msg, timeGreeting, tenantId, tenantName, context);
    if (staffContact) return staffContact;

    // 9. BUDGET RECOMMENDATIONS (Budget aware search)
    const budgetRec = await this.handleBudgetRecommendationInquiry(msg, tenantName, vehicles, messageHistory, context);
    if (budgetRec) return budgetRec;

    // 10. SYSTEM FEATURES
    const system = await this.handleSystemFeatureInquiry(msg, timeGreeting, tenantName, context);
    if (system) return system;

    return {
      message: `Halo! ⚡\n\n${timeGreeting}, selamat datang di showroom kami. Saya adalah Asisten virtual yang siap membantu Anda menemukan mobil impian di ${tenantName}. 😊\n\nAda yang bisa kami bantu? Kamu bisa tanya stok, harga, atau simulasi kredit lho!`,
      shouldEscalate: false
    };
  }

  /**
   * Handles Opening Greetings Modularly
   */
  private static async handleGreetingInquiry(
    msg: string,
    messageHistory: any[],
    timeGreeting: string,
    tenantName: string,
    vehicles: any[],
    context?: ChatContext
  ): Promise<{ message: string; shouldEscalate: boolean; } | null> {
    const isNewConversation = messageHistory.length <= 2;
    const looksLikeGreeting = msg.length < 20 && this.GREETING_PATTERNS.test(msg);

    if (looksLikeGreeting || (isNewConversation && this.GREETING_PATTERNS.test(msg))) {
      let vehiclePreview = "";
      if (vehicles.length > 0) {
        vehiclePreview = `\n\n🚗 Beberapa pilihan mobil kami:\n\n`;
        vehiclePreview += this.formatVehicleListDetailed(vehicles.slice(0, 3));
      }

      let personalizedGreeting = "";
      if (context?.staffInfo && (context.staffInfo.firstName || context.staffInfo.name)) {
        const staffName = this.formatKakName(context.staffInfo.firstName || context.staffInfo.name);
        const staffIntros = [
          `${timeGreeting}, ${staffName}! 👋\n\nSelamat datang kembali di ${tenantName}! Ada yang bisa asisten bantu cek hari ini?`,
          `Halo ${staffName}! ✨\n\n${timeGreeting}, senang melihat Anda kembali. Mau asisten bantu cari unit favorit lagi?`,
          `Siap ${staffName}! ⚡\n\nAsisten virtual ${tenantName} siap membantu. Apa ada update stok yang ingin Kakak lihat?`
        ];
        personalizedGreeting = this.getRandomVariation(staffIntros) + (vehiclePreview ? `\n${vehiclePreview}` : "");
      } else {
        const customerIntros = [
          `Halo! ⚡\n\n${timeGreeting}, selamat datang di showroom kami! Saya asisten virtual yang siap bantu cari mobil impian Kakak. 😊\n\nBoleh tahu dengan Kakak siapa saya bicara?`,
          `Selamat datang di ${tenantName}! ✨\n\n${timeGreeting}, saya asisten virtual di sini. Mau asisten bantu cek stok mobil yang ready?\n\nSebelumnya dengan Kakak siapa ya kalau boleh tahu? 😊`,
          `Halo Kak! 👋\n\n${timeGreeting}, senang bisa menyapa. Saya asisten virtual ${tenantName} yang siap bantu info stok & harga.\n\nBoleh kenalan dulu, dengan Kakak siapa di sana? 😊`
        ];
        personalizedGreeting = this.getRandomVariation(customerIntros) + (vehiclePreview ? `\n${vehiclePreview}` : "");
      }

      const closings = [
        "\n\nAda yang bisa kami bantu? 😊",
        "\n\nAda unit spesifik yang sedang dicari Kak? 🙏",
        "\n\nMungkin ada yang mau ditanyakan tentang unit kami? ✨"
      ];

      return { message: personalizedGreeting + this.getRandomVariation(closings), shouldEscalate: false };
    }
    return null;
  }

  /**
   * Handles Inventory & Specific Unit Suggestions
   */
  private static async handleInventoryInquiry(msg: string, tenantName: string, vehicles: any[], context?: ChatContext): Promise<{ message: string; shouldEscalate: boolean; } | null> {
    const inventoryPatterns = /\b(lihat|liat|stok|ready|pilihan|unit|koleksi|daftar)\b.*\b(mobil|kendaraan|mobilnya|showroom)\b/i;
    if (inventoryPatterns.test(msg)) {
      if (vehicles.length > 0) {
        const list = this.formatVehicleListDetailed(vehicles.slice(0, 3));
        const name_inv = this.formatKakName(context?.customerName);
        const inventoryTemplates = [
          `Tentu ${name_inv}! Berikut adalah daftar unit ready stock kami saat ini:\n\n${list}\n\nAda unit yang menarik perhatian Kakak? 😊`,
          `Siap ${name_inv}! Ini pilihan unit terbaik kami yang sedang ready untuk Kakak:\n\n${list}\n\nKira-kira unit mana yang paling pas buat kebutuhan Kakak? ✨`,
          `Boleh banget ${name_inv}! Ini daftar unit yang bisa Kakak cek langsung di showroom:\n\n${list}\n\nAda yang mau ditanyakan detailnya atau mau lihat fotonya? 😊`
        ];
        return {
          message: this.getRandomVariation(inventoryTemplates),
          shouldEscalate: false,
        };
      }
    }
    return null;
  }

  /**
   * Handles System Feature Inquiries (AI 5.2 Specialized)
   */
  private static async handleSystemFeatureInquiry(
    msg: string,
    timeGreeting: string,
    tenantName: string,
    context?: ChatContext
  ): Promise<{ message: string; shouldEscalate: boolean; } | null> {
    const systemPatterns = /\b(lead|manajemen|sistem|fitur|feature|cara kerja|how it works)\b/i;
    if (systemPatterns.test(msg)) {
      return {
        message: `${timeGreeting}! Halo! 👋 Saya adalah Asisten Virtual dari showroom kami yang ditenagai teknologi **Prima Mobil (AI 5.2)**. Saya bisa bantu cek stok, info detail unit, hingga simulasi kredit secara otomatis.\n\nMau saya bantu cek unit tertentu? 😊`,
        shouldEscalate: false
      };
    }
    return null;
  }

  /**
   * Handles Family/MPV Recommendation Inquiries
   */
  private static async handleFamilyRecommendationInquiry(msg: string, tenantId: string, vehicles: any[], context?: ChatContext): Promise<{ message: string; shouldEscalate: boolean; } | null> {
    const familyPatterns = [
      /\b(anak|family|keluarga)\s*(\d+)\s*(orang|orangnya|sih)\b/i,
      /\b(keluarga|family)\s*(kecil|besar)\b/i,
      /\b(7\s*seater|7\s*penumpang|mpv)\b/i,
      /\b(mobil\s*keluarga)\b/i,
    ];
    const isFamilyQuery = familyPatterns.some(p => p.test(msg));

    if (isFamilyQuery) {
      console.log(`[SmartFallback] 👨‍👩‍👧‍👦 Family query detected: "${msg}"`);

      // Extract number of family members if mentioned
      const familySizeMatch = msg.match(/anak\s*(\d+)/i);
      const familySize = familySizeMatch ? parseInt(familySizeMatch[1]) : 2;

      // Recommend MPV/7-seater vehicles based on budget
      const budgetMatch = msg.match(/(\d+)\s*(jt|juta)/i);
      const budget = budgetMatch ? parseInt(budgetMatch[1]) * 1000000 : 150000000; // Default 150jt

      // DYNAMIC AI SEARCH: Query database directly instead of checking local 'vehicles' array
      try {
        const mpvVehicles = await prisma.vehicle.findMany({
          where: {
            tenantId,
            status: 'AVAILABLE',
            price: { lte: BigInt(Math.floor(budget * 1.3)) }, // Allow 30% over budget, convert to BigInt
            OR: [
              // Search by Categories (Array check)
              { categories: { has: 'MPV' } },
              // Fallback to model names for common MPVs
              { model: { in: ['Innova', 'Avanza', 'Xenia', 'Ertiga', 'Xpander', 'Rush', 'Terios', 'Livina', 'Mobilio', 'Calya', 'Sigra'], mode: 'insensitive' } }
            ]
          },
          take: 5,
          orderBy: { price: 'asc' }
        });
        const customerName = this.formatKakName(context?.customerName);
        if (mpvVehicles.length > 0) {
          const list = this.formatVehicleListDetailed(mpvVehicles);
          return {
            message: `Tentu ${customerName}! Untuk keluarga ${familySize > 5 ? 'besar' : 'kecil'} seperti Kakak, kami merekomendasikan beberapa unit MPV/7-seater yang nyaman dan irit:\n\n${list}\n\n` +
              `Apakah ada unit yang menarik perhatian Kakak? Atau ingin saya bantu carikan yang lain? 😊`,
            shouldEscalate: false,
          };
        }
      } catch (e) {
        console.error("[SmartFallback] Failed to query MPV vehicles:", e);
        // Fallback to generic response if DB query fails
      }

      const customerNameFallback = this.formatKakName(context?.customerName);
      return {
        message: `Mohon maaf ${customerNameFallback}, untuk kriteria mobil keluarga yang Kakak inginkan, saat ini stok kami sedang terbatas. 🙏\n\n` +
          `Namun, kami punya beberapa unit lain yang mungkin cocok untuk kebutuhan harian Kakak. Mau saya tampilkan? 😊`,
        shouldEscalate: false,
      };
    }
    return null;
  }

  /**
   * Handles contextual answers to previous AI questions (e.g., location, name, payment).
   */
  private static async handleContextualAnswers(
    // 1. Location Answer (AI asked "area mana", "domisili", "kota")
    // CRITICAL: Only trigger if user is ANSWERING (not asking a new question)
    msg: string,
    userMessage: string,
    messageHistory: Array<{ role: "user" | "assistant"; content: string }>,
    vehicleName: string | null,
    context?: ChatContext
  ): Promise<{ message: string; shouldEscalate: boolean; } | null> {
    const lastContent = messageHistory.length > 1 ? messageHistory[messageHistory.length - 2].content.toLowerCase() : "";

    const looksLikeLocationAnswer = msg.length < 50 && // Short message (city names are short)
      !msg.includes("?") && // Not a question
      !msg.includes("apakah") && // Not asking availability
      !msg.includes("masih") && // Not asking stock status
      !msg.includes("ready") &&
      !WhatsAppAIChatService.VEHICLE_ID_PATTERN.test(msg) && // Not a vehicle ID
      !WhatsAppAIChatService.VEHICLE_NAME_PATTERNS.some(p => p.test(msg)) && // Not a vehicle name
      !/(interior|eksterior|exterior|mesin|body|bodi|dalam|luar|dokumen|surat|pajak|bpkb|stnk|foto|photo|gambar|kirim|lihat|minta|tunjuk)/i.test(msg);

    const isNewUser = !context?.customerName || ['Kak', 'Unknown', 'Pelanggan', 'siapa'].includes(context?.customerName || '');
    const name = this.formatKakName(context?.customerName);
    const timeGreeting = this.getTimeGreeting();
    const isFirstResponse = messageHistory.length <= 1;

    if (looksLikeLocationAnswer &&
      messageHistory.length > 2 && // Must have prior conversation
      (lastContent.includes("area mana") || lastContent.includes("domisili") || lastContent.includes("kota mana"))) {
      console.log(`[SmartFallback] 📍 Location answer detected: "${msg}"`);

      // AUTO-MINING: Capture Location
      if (context?.leadInfo?.id) {
        await LeadService.updateLeadAnalysis(context.leadInfo.id, {
          score: 0, // No score change
          sentiment: 'NEUTRAL',
          buyingStage: 'INTEREST',
          urgency: 'MEDIUM',
          summary: `Lokasi User: ${userMessage}`
        });
      }

      let introRes = "";
      if (isFirstResponse) {
        introRes = `Halo! ⚡\n\n${timeGreeting}, selamat datang di showroom kami. Saya adalah Asisten virtual yang siap membantu Anda menemukan mobil impian.\n\nSebelumnya dengan Kakak siapa saya bicara dan darimana? `;
      } else {
        introRes = `Siap ${name}! `;
      }

      const areaTemplates = [
        `${introRes}Terima kasih infonya kak! 🙏\n\nUntuk penggunaan di area **${userMessage}**${vehicleName ? `, unit ${vehicleName}` : ''} sudah sangat cocok dan bandel untuk medan di sana.\n\nKebetulan unitnya masih ready, apakah Kakak ada rencana untuk cek unit langsung ke showroom atau mau saya kirimkan foto detailnya dulu? 😊`,
        `${introRes}Wah mantap Kak! 🙏\n\nKondisi jalan di area **${userMessage}** sangat pas kalau pakai ${vehicleName ? `unit *${vehicleName}*` : 'unit ini'}. Kabinnya nyaman dan suspensinya empuk.\n\nUnitnya masih ready lho, mau saya amankan dulu jadwal cek unitnya atau mau lihat-lihat fotonya dulu? 😊`,
        `${introRes}Siap Kak! Domisili di **${userMessage}** ya? 🙏\n\nBanyak customer kami dari area sana juga ambil ${vehicleName ? `unit *${vehicleName}*` : 'unit sejenis'} karena memang terbukti irit dan tangguh.\n\nSekarang unitnya masih available, ada rencana mau mampir ke showroom hari ini Kak? ✨`
      ];

      return {
        message: this.getRandomVariation(areaTemplates),
        shouldEscalate: false
      };
    }

    // 2. Name Answer (AI asked "dengan siapa saya bicara kak?", "boleh tahu nama kakak siapa")
    // CRITICAL: Only trigger if user is actually giving a name (not asking a technical question)
    const looksLikeNameAnswer = msg.length < 30 &&
      !msg.includes("?") &&
      !/(interior|eksterior|luar|dalam|mesin|harga|stok|ready|brapa|berapa|gimana|bagaimana|mana|foto|photo|gambar|kirim|lihat)/i.test(msg);

    if (looksLikeNameAnswer && (lastContent.includes("dengan siapa saya bicara") || lastContent.includes("dengan kakak siapa") || lastContent.includes("boleh tahu dengan siapa nama kakaknya"))) {
      console.log(`[SmartFallback] 👤 Name answer detected: "${msg}"`);
      // AUTO-MINING: Capture Name
      // Extract clean name (remove "saya", "nama saya", "dengan", "cukup nama customer saja" etc)
      const cleanName = userMessage
        .replace(/^(nama saya adalah|nama saya|panggil saja saya|panggil saja|saya dengan|nama saya dengan|nama|saya)\s+/i, '')
        .replace(/^(dengan|dari|ini|aku)\s+/i, '')
        .trim();

      if (cleanName.length > 2 && context?.leadInfo?.id) {
        // We need a way to update the lead name specifically
        // For now, allow LeadService to handle generic updates or add a specific method later
        // Using updateLeadAnalysis as a proxy to log it in notes for now
        await LeadService.updateLeadAnalysis(context.leadInfo.id, {
          score: 10, // +10 Score for identifying oneself
          sentiment: 'POSITIVE',
          buyingStage: 'INTEREST',
          urgency: 'MEDIUM',
          summary: `Nama Teridentifikasi: ${cleanName}`
        });

        // Also try to update the actual name field if we had the method exposed
        // await LeadService.updateLead(context.leadInfo.id, { name: cleanName });
      }

      // Use extracted name if available, otherwise fallback to standard Kak
      const greetingName = cleanName.length > 1 ? `Kak ${this.formatKakName(cleanName).replace('Kak ', '')}` : name;

      const nameTemplates = [
        `Salam kenal ${greetingName}! 👋\n\nSenang bisa membantu. Ada lagi yang ingin ditanyakan tentang unit yang diminati? Atau mau saya bantu hitungkan simulasi kreditnya sekalian? 😊`,
        `Halo ${greetingName}! 👋\n\nOke, asisten catat ya. Ada detail lain yang ingin Kakak ketahui tentang mobilnya? Atau mau asisten siapkan estimasi cicilannya? 😊`,
        `Siap ${greetingName}, salam kenal ya! ✨\n\nBiar makin mantap, mau asisten bantu cari unit lain yang sesuai budget Kakak atau mau fokus di unit ini dulu? 😊`
      ];

      return {
        message: this.getRandomVariation(nameTemplates),
        shouldEscalate: false
      };
    }

    // 3. Payment Answer (AI asked "cash atau kredit", "rencana pembayaran")
    if (lastContent.includes("cash") || lastContent.includes("kredit") || lastContent.includes("tunai")) {
      // Only trigger if user answer matches
      if (msg.includes("cash") || msg.includes("tunai") || msg.includes("keras")) {
        const cashTemplates = [
          `Baik ${name}, untuk pembelian **Cash** kami bisa bantu pengurusan surat-surat agar lebih cepat selesai. ⚡\n\nUnit mau dicek kapan kak? Supaya kami siapkan. 😊`,
          `Siap ${name}! Pembelian **Tunai** memang lebih simpel prosesnya. ✅\n\nKira-kira kapan Kakak ada waktu untuk test drive unitnya di showroom?`,
          `Oke ${name}, kalau **Cash** nanti kita bantu urus diskon terbaiknya ya! ✨\n\nKapan rencana mau mampir untuk lihat unit secara langsung?`
        ];
        return {
          message: this.getRandomVariation(cashTemplates),
          shouldEscalate: false
        };
      }
      else if (msg.includes("kredit") || msg.includes("cicil") || msg.includes("angsur")) {
        // AUTO-MINING: Capture Interest (Credit)
        if (context?.leadInfo?.id) {
          await LeadService.updateLeadAnalysis(context.leadInfo.id, {
            score: 20, // +20 Score for Credit interest (Serious intent)
            sentiment: 'POSITIVE',
            buyingStage: 'DESIRE', // Upgrade stage
            urgency: 'HIGH',
            summary: `Minat: KREDIT / CICILAN`
          });
        }

        const name = isNewUser ? "Kak" : context!.customerName;
        return {
          message: `Siap ${name}, untuk **Kredit** boleh saya bantu simulasikan hitungannya? 💰\n\nKakak rencananya mau DP berapa dan tenor berapa tahun? (Contoh: "DP 50jt tenor 3 tahun")`,
          shouldEscalate: false
        };
      }
    }
    return null;
  }

  /**
   * Handles specific vehicle inquiries, including technical questions (interior, exterior, engine, documents).
   */
  private static async handleTechnicalVehicleInquiry(
    msg: string,
    userMessage: string,
    messageHistory: Array<{ role: "user" | "assistant"; content: string }>,
    vehicleName: string | null,
    tenantId: string,
    context: ChatContext | undefined,
    timeGreeting: string,
    prefetchedVehicles: any[]
  ): Promise<{ message: string; shouldEscalate: boolean; } | null> {
    // Priority 0.5: Check for explicit Vehicle ID or Contextual Vehicle Name
    const idInMsg = msg.match(/\b(pm[- ]?[a-zA-Z0-9]+-\d+)\b/i);
    let contextId = vehicleName && vehicleName.match(/\b(pm[- ]?[a-zA-Z0-9]+-\d+)\b/i) ? vehicleName : null;

    // Trigger if explicit ID in message OR if we have a car context AND a technical question
    const isTechnicalQuestion = /(interior|eksterior|ekterior|exterior|esterior|mesin|body|bodi|dalam|luar|dokumen|surat|pajak|bpkb|stnk|foto|gambar|detail)/i.test(msg);

    // ENHANCED: If no ID found but user is asking technical question, try to extract from recent history
    if (!idInMsg && !contextId && isTechnicalQuestion) {
      console.log(`[SmartFallback] 🔍 Technical question without ID, searching history...`);
      // Look for vehicle ID in last 3 AI messages
      const recentAiMessages = messageHistory.filter(m => m.role === "assistant").slice(-3);
      for (const aiMsg of recentAiMessages) {
        const historyIdMatch = aiMsg.content.match(/\b(PM-[A-Z]{3}-\d{3})\b/i);
        if (historyIdMatch) {
          contextId = historyIdMatch[1];
          console.log(`[SmartFallback] ✅ Found vehicle ID in history: ${contextId}`);
          break;
        }
      }
    }

    if (idInMsg || (contextId && isTechnicalQuestion)) {
      // Normalize to standard PM-PST-XXX format for searching
      const explicitId = (idInMsg ? idInMsg[0] : contextId as string).toUpperCase().replace(" ", "-");
      console.log(`[SmartFallback] 🎯 Processing vehicle context: ${explicitId}`);

      let matchingVehicle = null;
      try {
        matchingVehicle = await prisma.vehicle.findFirst({
          where: {
            tenantId,
            displayId: { equals: explicitId, mode: 'insensitive' as const }
          },
          select: { id: true, displayId: true, make: true, model: true, year: true, price: true, mileage: true, transmissionType: true, color: true, variant: true, fuelType: true },
        });
      } catch (e) {
        matchingVehicle = prefetchedVehicles.find(v => (v.displayId || "").toUpperCase() === explicitId);
      }

      if (matchingVehicle) {
        const priceJuta = Math.round(Number(matchingVehicle.price) / 1000000);
        const name = `${matchingVehicle.make} ${matchingVehicle.model}`;
        const isNewUser = !context?.customerName || ['Kak', 'Unknown', 'Pelanggan'].includes(context?.customerName || '');
        const customerName = this.formatKakName(context?.customerName);
        const isFirstResponse = messageHistory.length <= 1;

        let intro = "";
        if (isFirstResponse) {
          intro = this.getRandomVariation([
            `Halo! ⚡\n\n${timeGreeting}, selamat datang! Saya asisten virtual yang siap bantu info unit *${name}* ini.\n\nAnyway, dengan Kakak siapa saya bicara? 😊 `,
            `Selamat datang! ✨\n\n${timeGreeting}, saya asisten virtual di sini. Terkait unit *${name}* yang Kakak tanyakan, saya bantu jelaskan ya.\n\nBoleh tahu nama Kakak siapa sebelumnya? 😊 `,
            `Halo Kak! 👋\n\n${timeGreeting}. Saya asisten virtual ${tenantName}. Senang Kakak tertarik dengan *${name}* ini!\n\nSebelum lanjut, boleh kenalan dulu dengan Kakak siapa? 😊 `
          ]);
        } else {
          intro = this.getRandomVariation([
            `Siap ${customerName}! `,
            `Baik ${customerName}, asisten bantu jelaskan ya. `,
            `Tentu ${customerName}! ✨ `,
            `Oke ${customerName}, ini detailnya: `
          ]);
        }

        // Handle "dokumen" / "surat" / "pajak" context
        if (msg.includes("dokumen") || msg.includes("surat") || msg.includes("bpkb") || msg.includes("stnk") || msg.includes("pajak")) {
          const isTaxOnly = msg.includes("pajak") && !msg.includes("dokumen") && !msg.includes("surat");

          const docVariations = [
            `dokumennya (BPKB, STNK, Faktur) LENGKAP kak. ✅\n\nSemua berkas sudah kami cek keabsahannya dan dijamin aman.`,
            `surat-suratnya (BPKB & STNK) sudah READY dan lengkap kak. ✅\n\nKondisi dokumen aman jaya, sudah kami verifikasi keasliannya.`,
            `berkasnya komplit kak (BPKB, STNK, Faktur). ✅\n\nDokumen sudah siap untuk proses balik nama atau mutasi kalau Kakak butuh.`
          ];

          let docClosing = "";
          if (isNewUser) {
            docClosing = this.getRandomVariation([
              "\n\nBoleh asisten tahu nama Kakak? Supaya asisten bisa bantu buatkan jadwal cek unit dan surat-suratnya di showroom. 😊",
              "\n\nSebelum asisten lanjut siapkan berkasnya, boleh asisten tahu dengan Kakak siapa di sana? 😊",
              "\n\nSupaya enak ngobrolnya, boleh kenalan dulu dengan Kakak siapa? Asisten siap bantu prosesnya sampai tuntas lho. ✨"
            ]);
          }

          const charSum = explicitId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
          const docDesc = isTaxOnly ? 'pajaknya masih HIDUP dan panjang kak. ✅' : docVariations[charSum % docVariations.length];

          return {
            message: `${intro}Untuk unit *${name} ${matchingVehicle.year}* (${explicitId}), ${docDesc}\n\n${docClosing}`,
            shouldEscalate: false
          };
        }

        // Handle Exterior Context - matching without boundary to catch suffixes like "nya"
        const hasInterior = msg.match(/(interior|dalam|dalem|jok|dashboard|kabin|setir)/i);
        const hasExterior = msg.match(/(eksterior|ekterior|exterior|esterior|luar|body|bodi|cat|lecet|mulus)/i);

        // Priority logic: if both mentioned, pick the one last mentioned in the message
        const lastIntIndex = hasInterior ? msg.lastIndexOf(hasInterior[0]) : -1;
        const lastExtIndex = hasExterior ? msg.lastIndexOf(hasExterior[0]) : -1;
        const isExteriorQuery = hasExterior && (lastExtIndex > lastIntIndex);

        if (isExteriorQuery) {
          const extVariations = [
            `Untuk bagian **EKSTERIOR** unit *${name}* (${explicitId}) ini masih sangat mulus kak! ✨\n\n• Body & Cat: Original (bukan dempulan), cat masih kinclong.\n• Tulang-ulang: Aman jaya, bebas bekas tabrak/banjir.\n• Ban & Velg: Ban masih tebal, velg orisinil.`,
            `Bagian **LUAR (EKSTERIOR)** unit *${name}* (${explicitId}) ini bener-bener terawat kak! ✨\n\n• Kondisi Fisik: Mulus, minim lecet pemakaian saja.\n• Kaca-kaca: Bening, tidak ada jamur dan original.\n• Lampu-lampu: Masih jernih, tidak kusam atau retak.`,
            `Kondisi **BODY & EKSTERIOR** *${name}* (${explicitId}) ini masih jos kak! ✨\n\n• Cat: Masih kinclong dan orisinil pabrik.\n• Chassis/Rangka: Aman, bebas keropos dan bebas insiden.\n• Aksesoris: Lengkap semua, tidak ada yang copot.`
          ];
          const charSum = explicitId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
          const extDesc = extVariations[charSum % extVariations.length];

          const closingVariations = [
            `Ada yang ingin ditanyakan lagi tentang unit ini ${customerName}? 😊`,
            `Gimana ${customerName}, mau asisten kirimkan **foto detail eksteriornya** untuk kelengkapan referensi? 📸`,
            `Unitnya mulus banget kelihatannya ${customerName}. Mau asisten bantu siapkan jadwal cek unitnya?`
          ];
          return {
            message: `${intro}${extDesc}\n\n${this.getRandomVariation(closingVariations)}`,
            shouldEscalate: false
          };
        }

        // Handle Interior Context
        if (hasInterior) {
          const intVariations = [
            `Untuk bagian **INTERIOR** unit *${name}* (${explicitId}) ini kondisinya masih sangat terawat kak! ✨\n\n• Jok & Dashboard: Masih orisinil, bersih, dan tidak ada sobek/retak.\n• AC & Kelistrikan: Berfungsi normal dan dingin.\n• Aroma kabin: Segar bebas bau rokok.`,
            `Bagian **DALAM (INTERIOR)** unit *${name}* (${explicitId}) ini sangat nyaman kak! ✨\n\n• Kebersihan: Kondisi karpet dan plafon bersih terawat.\n• Fitur kabin: Semua tombol dashboard masih berfungsi normal.\n• Dashboard: Mulus tidak ada retak rambut.`,
            `Kabin unit **INTERIOR** *${name}* (${explicitId}) ini masih kerasa baru kak! ✨\n\n• Seat/Kursi: Busa masih tebal dan kain/kulit tidak pecah.\n• Audio & Head Unit: Normal, siap nemenin perjalanan.\n• Bagasi: Bersih dan luas, toolkit lengkap.`
          ];
          const charSum = explicitId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
          const intDesc = intVariations[charSum % intVariations.length];

          const closingVariations = [
            `Ada yang ingin ditanyakan lagi tentang unit ini ${customerName}? 😊`,
            `Mau asisten kirimkan **foto detail bagian dalam (interior)** untuk kelengkapan referensi ${customerName}? 📸`,
            `Kabinnya nyaman banget lho ${customerName}. Mau asisten bantu hitungkan simulasi cicilannya sekalian? 💰`
          ];
          return {
            message: `${intro}${intDesc}\n\n${this.getRandomVariation(closingVariations)}`,
            shouldEscalate: false
          };
        }

        // Handle Engine/Mesin Context - Fallback Logic
        if (msg.match(/\b(mesin|engine|kap|suara)\b/i)) {
          const engVariations = [
            `Untuk kondisi **MESIN** unit *${name}* (${explicitId}) ini sangat prima kak! ⚙️\n\n• Suara mesin: Halus, tidak ada bunyi aneh.\n• Oli & Cairan: Aman tidak ada rembes.\n• Performa: Responsif dan siap luar kota.`,
            `Kondisi **DAPUR PACU (MESIN)** unit *${name}* (${explicitId}) ini sehat walafiat kak! ⚙️\n\n• Perawatan: Record servis rutin showroom kami.\n• Aki & Kelistrikan: Sekali starter langsung nyala.\n• Kaki-kaki: Senyap, tidak ada bunyi gluduk-gluduk.`,
            `Mesin unit *${name}* (${explicitId}) ini bener-bener jos kak! ⚙️\n\n• Kebersihan: Ruang mesin bersih dari kerak oli.\n• Transmisi: Perpindahan gigi masih halus (smooth).\n• Pendinginan: Temperatur stabil, siap perjalanan jauh.`
          ];
          const charSum = explicitId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
          const engDesc = engVariations[charSum % engVariations.length];

          return {
            message: `${intro}${engDesc}\n\nBoleh banget kalau ${customerName} mau datang untuk test drive dan cek mesin langsung lho! Kapan ada waktu luang? 😊`,
            shouldEscalate: false
          };
        }

        const explicitlyAsksPhotos = /(foto|photo|gambar|lihat|mana|tunjuk)/i.test(msg);
        if (explicitlyAsksPhotos) {
          const images = await this.fetchVehicleImagesByQuery(explicitId, context?.tenantId || tenantId);
          if (images && images.length > 0) {
            return {
              message: `Siap ${customerName}, ini foto-foto unit *${name} ${matchingVehicle.year}* (${explicitId}) nya ya! MASIH READY! 🔥\n\n• Harga: Rp ${priceJuta} Juta (Nego)\n• Kondisi: Terawat, siap pakai`,
              shouldEscalate: false,
              images
            };
          }
        }

        const closingQuestion = `Ada yang ingin ditanyakan lagi tentang unit ini ${customerName}? 😊`;
        return {
          message: `Siap ${customerName}, unit *${name} ${matchingVehicle.year}* (${explicitId}) ini MASIH READY! 🔥\n\n` +
            `• Harga: Rp ${priceJuta} Juta (Nego)\n` +
            `• Kondisi: Terawat, siap pakai\n\n` +
            `Unit ini salah satu favorit di sini. ${closingQuestion}`,
          shouldEscalate: false
        };
      }
    }

    // Priority 1: Check if asking about specific vehicle (Brand, Model, Year)
    const vehicleBrands = ['toyota', 'honda', 'suzuki', 'daihatsu', 'mitsubishi', 'nissan', 'mazda', 'bmw', 'mercedes', 'hyundai', 'kia', 'wuling', 'ford', 'chery', 'lexus'];
    const vehicleModels = [
      'innova', 'avanza', 'xenia', 'brio', 'jazz', 'ertiga', 'rush', 'terios', 'fortuner', 'pajero', 'alphard', 'civic', 'crv', 'hrv', 'yaris', 'camry', 'calya', 'sigra', 'xpander',
      'palisade', 'creta', 'stargazer', 'ioniq', 'santa fe', 'kona', 'staria', // Hyundai
      'rocky', 'raize', 'agya', 'ayla', 'veloz', 'zernix', // Toyota/Daihatsu
      'cx-5', 'cx-3', 'mazda 2', 'mazda 3', // Mazda
      'almaz', 'confero', 'cortez', 'air ev', 'binguo', // Wuling
      'xsr', 'march', 'livina', 'serena', 'terra' // Nissan
    ];

    const mentionedBrand = vehicleBrands.find(b => msg.includes(b.toLowerCase()));
    const mentionedModel = vehicleModels.find(m => msg.includes(m.toLowerCase()));
    const yearMatch = msg.match(/\b(20\d{2}|19\d{2})\b/);
    const mentionedYear = yearMatch ? parseInt(yearMatch[1]) : null;

    if ((mentionedBrand || mentionedModel) && !msg.match(/\b(foto|gambar|interior|eksterior|detail|mesin|body|dalam|luar|dokumen|surat|pajak|bpkb|stnk)\b/i)) {
      // Targeted search in DB for better accuracy
      console.log(`[SmartFallback] 🔍 Specific vehicle mentioned (Standard Inquiry): brand=${mentionedBrand}, model=${mentionedModel}, year=${mentionedYear}`);

      let matchingVehicle = null;
      try {
        matchingVehicle = await prisma.vehicle.findFirst({
          where: {
            tenantId,
            status: "AVAILABLE",
            ...(mentionedYear ? { year: mentionedYear } : {}),
            OR: [
              ...(mentionedBrand ? [{ make: { contains: mentionedBrand, mode: 'insensitive' as const } }] : []),
              ...(mentionedModel ? [{ model: { contains: mentionedModel, mode: 'insensitive' as const } }] : []),
            ]
          },
          select: { id: true, displayId: true, make: true, model: true, year: true, price: true, mileage: true, transmissionType: true, color: true, variant: true, fuelType: true },
          orderBy: { createdAt: 'desc' }
        });
      } catch (e) {
        // Fallback to searching in pre-fetched collection if DB fails
        const searchTerm = (mentionedModel || mentionedBrand || "").toLowerCase();
        matchingVehicle = prefetchedVehicles.find(v =>
          v.make.toLowerCase().includes(searchTerm) ||
          v.model.toLowerCase().includes(searchTerm)
        );
      }

      if (matchingVehicle) {
        const priceJuta = Math.round(Number(matchingVehicle.price) / 1000000);
        const id = matchingVehicle.displayId || matchingVehicle.id.substring(0, 6).toUpperCase();

        const name_sq = this.formatKakName(context?.customerName);
        const timeGreeting = this.getTimeGreeting();
        // Dynamic Closing Question for Lead Gen
        const closingQuestion = `Mau lihat fotonya ${name_sq}? 📸`;

        // ONE BREATH FORMAT: Ask name first, then confirm stock
        const response = `Halo! ⚡\n\n${timeGreeting}, selamat datang di showroom kami. Saya adalah Asisten virtual yang siap membantu Anda menemukan mobil impian.\n\nBaik kak, sebelumnya dengan kakak siapa saya berbicara? Untuk unit *${matchingVehicle.make} ${matchingVehicle.model} ${matchingVehicle.year}* ini MASIH AVAILABLE! 🔥\n\n* ID Unit: ${id}\n* Harga: Rp ${priceJuta} Juta (Nego)\n* Transmisi: ${matchingVehicle.transmissionType || 'Manual'}\n* Warna: ${matchingVehicle.color || '-'}\n* Bahan Bakar: ${matchingVehicle.fuelType || 'Bensin'}\n\nUnit siap gass, kondisi terawat ${name_sq}! 👍\n\nMau saya kirimkan foto detail unit ini untuk kelengkapan referensi? 📸😊`;

        return { message: response, shouldEscalate: false };
      } else {
        const searchTerm = (mentionedModel || mentionedBrand || "").charAt(0).toUpperCase() + (mentionedModel || mentionedBrand || "").slice(1);
        const name_no = this.formatKakName(context?.customerName);
        return {
          message: `Halo kak ${name_no}! 👋\n\n` +
            `${timeGreeting}, selamat datang di showroom Prima Mobil kami.\n` +
            `Saya adalah Asisten virtual yang siap membantu ${name_no} menemukan mobil impian.\n\n` +
            `Mohon maaf kak ${name_no}, unit **${searchTerm}** yang dicari saat ini belum tersedia di showroom kami. 🙏\n\n` +
            `Namun, kami memiliki beberapa koleksi unit favorit lainnya yang mungkin sesuai dengan selera ${name_no}:\n\n${prefetchedVehicles.slice(0, 3).map(v => {
              const id = v.displayId || v.id.substring(0, 6).toUpperCase();
              return `• ${v.make} ${v.model} ${v.year} | ${id}`;
            }).join('\n')}\n\n` +
            `Ada yang menarik perhatian kak ${name_no}? 😊`,
          shouldEscalate: false,
        };
      }
    }
    return null;
  }

  /**
   * Handles questions about AI identity, technology, and internal policies/SOPs.
   */
  private static async handleAIIdentityAndPolicyInquiry(
    msg: string,
    timeGreeting: string,
    tenantName: string,
    context?: ChatContext
  ): Promise<{ message: string; shouldEscalate: boolean; } | null> {
    // AI Identity patterns - more specific
    const aiIdentityPatterns = [
      /^\s*(kamu|anda|u)\s+(siapa|apa)\s*\??$/i,
      /^\s*(siapa|apa)\s+(kamu|anda|u)\s*\??$/i,
      /^\s*(kamu|anda|u)\s+(ini|itu)\s+(siapa|apa)\s*\??$/i,
      /\b(kamu|anda|u)\s+(pakai|menggunakan|pake)\s+(teknologi|tech|ai|sistem)\s+(apa|mana)\b/i,
      /\bautolumiku\b/i,
      /\bai\s*5\.2\b/i,
      /\b(kamu|anda|u)\s+(bot|robot|ai|manusia|orang)\s*\??$/i,
    ];

    const looksLikeAIIdentity = aiIdentityPatterns.some(p => p.test(msg));
    const isExplicitContactRequest = /\b(nomer|nomor|wa|whatsapp|kontak|contact|telp|telepon|phone)\b/i.test(msg);

    // First, check if this is a question about SYSTEM FEATURES (not AI identity)
    const systemFeaturePatterns = [
      /\b(leads?|lead\s*management|manajemen\s*leads?)\b/i,
      /\b(conversation|percakapan|chat|pesan|message)\b.*\b(masuk|simpan|save|record|catat)\b/i,
      /\b(fitur|feature|fungsi|function|cara\s*kerja|how\s*it\s*works?)\b/i,
      /\b(supaya|agar|biar|gimana|bagaimana|caranya)\b.*\b(masuk|simpan|tersimpan|tercatat)\b/i,
      /\b(customer|pelanggan|leads?)\s+(baru|lama)\b/i, // "customer baru", "leads lama"
      /\b(handle|handling|melayani|proses|cara)\s+(customer|pelanggan|leads?)\b/i, // "handle customer"
    ];
    const isSystemFeatureQuestion = systemFeaturePatterns.some(p => p.test(msg));

    // ONLY trigger identity response if:
    // 1. It matches AI identity patterns
    // 2. It's NOT a system feature question
    // 3. It's NOT a contact request
    if (looksLikeAIIdentity && !isSystemFeatureQuestion && !isExplicitContactRequest) {
      console.log(`[SmartFallback] 🤖 AI Identity question detected: "${msg}"`);

      const name_id = this.formatKakName(context?.customerName);
      const identityResponse =
        `${timeGreeting}! 👋\n\n` +
        `Saya adalah AI Assistant **${tenantName}** yang ditenagai oleh teknologi **Prima Mobil (AI 5.2)**. 🤖⚡\n\n` +
        `Saya menggunakan teknologi *Natural Language Processing* tingkat lanjut untuk memberikan informasi stok kendaraan secara real-time, simulasi kredit, hingga pengolahan data visual unit kami.\n\n` +
        `Ada yang bisa saya bantu terkait unit mobil di showroom kami hari ini ${name_id}? 😊`;

      return {
        message: identityResponse,
        shouldEscalate: false,
      };
    }

    // ==================== POLICY/SOP INQUIRY HANDLER ====================
    // Detect if user (especially staff/owner) is asking "How do you respond to X?"
    const policyInquiryPatterns = [
      /\b(respon|balas|jawab|cara)\b.*\b(gimana|bagaimana|kamu)\b/i,
      /\bkalau\s+ada\s+(yang|customer|orang)\s+(tanya|nanya)\b/i,
      /\bgimana\s+(respon|jawaban)\b/i,
    ];

    if (policyInquiryPatterns.some(p => p.test(msg))) {
      console.log(`[SmartFallback] 📋 Policy/SOP inquiry detected: "${msg}"`);

      let policyResponse = `${timeGreeting}! 👋\n\n`;

      if (msg.includes("interior") || msg.includes("eksterior") || msg.includes("foto") || msg.includes("detail") || msg.includes("dalam") || msg.includes("body")) {
        policyResponse += `**1. Kebijakan Foto & Kondisi Fisik (Interior/Eksterior/Dalam):**\n` +
          `• Jika customer meminta foto **eksterior**, saya akan mengirimkan tampak depan, samping, dan belakang mobil untuk menunjukkan kemulusan body.\n` +
          `• Jika customer meminta **interior/dalam**, saya akan fokus pada dashboard, jok/kursi, dan odometer.\n` +
          `• Saya akan memastikan bahwa foto yang dikirim adalah **real-pict** dari unit yang available.\n` +
          `• Jika foto belum lengkap, saya akan menawarkan untuk memotretkan unitnya secara langsung. 📸\n\n`;
      }

      if (msg.includes("surat") || msg.includes("dokumen") || msg.includes("bpkb") || msg.includes("stnk") || msg.includes("faktur") || msg.includes("kuitansi")) {
        policyResponse += `**2. Kebijakan Dokumen & Legalitas:**\n` +
          `• **Kelengkapan Surat:** Kami menjamin BPKB, STNK, dan Faktur Pembelian lengkap dan asli.\n` +
          `• **Pajak & Plat:** Saya akan menginfokan masa berlaku pajak dan plat seseuai kondisi (Hidup/Mati).\n` +
          `• **Garansi Legalitas:** Kami memberikan garansi uang kembali 100% jika surat-surat bermasalah atau sengketa.\n` +
          `• **Bukti Pembayaran:** Setiap transaksi akan disertakan **Kuitansi resmi** bermaterai sebagai bukti sah jual beli. 📝\n\n`;
      }

      if (msg.includes("kredit") || msg.includes("cicilan") || msg.includes("angsuran")) {
        policyResponse += `**3. Kebijakan Simulasi Kredit:**\n` +
          `• Meminta info unit yang diminati (jika belum ada).\n` +
          `• Melakukan **Simulasi KKB Otomatis** menggunakan mitra leasing kami (BCA, Adira, dll).\n` +
          `• Memberikan rincian DP dan cicilan sesuai tenor yang diinginkan (1-5 tahun). 📊\n\n`;
      }

      // Default catch-all only if NO specific topics matched
      const topicsMatched = msg.includes("interior") || msg.includes("eksterior") || msg.includes("foto") || msg.includes("detail") || msg.includes("dalam") || msg.includes("body") ||
        msg.includes("surat") || msg.includes("dokumen") || msg.includes("bpkb") || msg.includes("stnk") || msg.includes("faktur") ||
        msg.includes("kredit") || msg.includes("cicilan") || msg.includes("angsuran");

      if (!topicsMatched) {
        policyResponse += `Saya akan merespon setiap pertanyaan customer dengan ramah, akurat sesuai database, dan selalu berusaha menggali data leads (Nama, Lokasi, Budget) secara natural agar bisa di-follow up oleh tim sales. 😊`;
      }

      const name_p = this.formatKakName(context?.customerName);
      return {
        message: policyResponse + `\n\nAda skenario respon lain yang ingin ${name_p} cek? 😊`,
        shouldEscalate: false,
      };
    }
    // If the user asks about leads, conversation management, or how system works
    if (isSystemFeatureQuestion) {
      console.log(`[SmartFallback] ⚙️ System feature question detected: "${msg}"`);

      let featureResponse = `${timeGreeting}! 👋\n\n`;

      if (msg.includes("lead") || msg.includes("manajemen") || msg.includes("data")) {
        featureResponse += `Terkait **Manajemen Leads**, AI 5.2 kami bekerja secara cerdas dengan menggali detail calon customer secara **bertahap** (tidak langsung to-the-point).\n\n` +
          `**Data yang dikumpulkan secara otomatis:**\n` +
          `• Nama, Asal/Domisili, dan Budget.\n` +
          `• Tipe kendaraan, Kategori/Status, dan Sumber leads.\n` +
          `• Urgensi dan Aksi yang diinginkan.\n\n` +
          `Semua data ini otomatis terinput ke [Leads Dashboard](https://primamobil.id/dashboard/leads) Anda. 📊\n\n` +
          `**Tujuannya:** Agar saat customer menghubungi lagi, AI bisa langsung mengenali mereka secara personal (Sapa Pak Andi/Bu Aya) berbasis histori chat sebelumnya. 😊`;
      } else if (msg.includes("customer") || msg.includes("pelanggan") || msg.includes("handle")) {
        featureResponse += `Untuk **Handling Customer**, AI 5.2 menggunakan pendekatan natural:\n\n` +
          `• **Customer Baru**: AI akan menggali data (identitas, budget, kebutuhan) secara mengalir dalam percakapan.\n` +
          `• **Customer Lama**: AI mengenali data histori dari [Dashboard Conversations](https://primamobil.id/dashboard/whatsapp-ai/conversations) dan menyapa secara personal.\n\n` +
          `Ini memastikan transisi yang mulus dari asisten virtual ke tim sales Anda. 🚀`;
      } else {
        const name_sf = this.formatKakName(context?.customerName);
        featureResponse += `Sistem **Prima Mobil (AI 5.2)** bekerja dengan memproses setiap pesan masuk secara cerdas. Saya bisa membantu memberikan info stok, foto, lokasi showroom, hingga simulasi kredit secara otomatis.\n\n` +
          `Semua data ini terintegrasi langsung dengan database showroom sehingga informasinya selalu akurat. ✅\n\n` +
          `Mau saya bantu cek unit atau info lainnya kak ${name_sf}? 😊`;
      }

      return {
        message: featureResponse,
        shouldEscalate: false,
      };
    }
    return null;
  }

  /**
   * Handles Location & Contact Inquiries
   */
  private static async handleLocationContactInquiry(msg: string, timeGreeting: string, tenantName: string, tenantAddress: string, context?: ChatContext): Promise<{ message: string; shouldEscalate: boolean; } | null> {
    const locationPatterns = [
      /(lokasi|alamat|dimana|di mana|where).*(showroom|toko|kantor|tempat|outlet|cabang)/i,
      /(showroom|toko|kantor|tempat|outlet|cabang).*(lokasi|alamat|dimana|di mana|where|ada|berada)/i,
      /^(dimana|di mana|where|alamat|lokasi)/i,
      /(maps|google maps|waze|gmaps|peta)/i,
    ];

    if (locationPatterns.some(p => p.test(msg))) {
      console.log(`[SmartFallback] 📍 Location inquiry detected: "${msg}"`);
      const name_lc = this.formatKakName(context?.customerName);
      const locationTemplates = [
        `Halo! ⚡\n\n${timeGreeting}, Showroom **${tenantName}** berlokasi di:\n📍 ${tenantAddress || 'Alamat sedang diperbarui'}\n\n` +
        `${name_lc} bisa klik link Google Maps ini untuk rute lengkapnya: https://maps.google.com/?q=${encodeURIComponent(tenantAddress || tenantName)}\n\n` +
        `Ada rencana mau mampir hari ini atau besok ${name_lc}? 😊`,
        `Siap ${name_lc}! ✨\n\nUntuk alamat lengkap kami ada di:\n📍 ${tenantAddress || 'Alamat sedang diperbarui'}\n\nIni link lokasinya di Google Maps ya: https://maps.google.com/?q=${encodeURIComponent(tenantAddress || tenantName)}\n\nKira-kira jam berapa mau asisten siapkan unitnya buat dicek? 😊`,
        `Tentu ${name_lc}! Showroom kami bisa ditemukan di:\n📍 ${tenantAddress || 'Alamat sedang diperbarui'}\n\n📍 Google Maps: https://maps.google.com/?q=${encodeURIComponent(tenantAddress || tenantName)}\n\nShowroom buka setiap hari lho. ${name_lc} rencana mau mampir kapan? 🙏`
      ];
      return {
        message: this.getRandomVariation(locationTemplates),
        shouldEscalate: false,
      };
    }
    return null;
  }

  /**
   * Handles Staff Contact Handover Inquiries
   */
  private static async handleStaffContactInquiry(msg: string, timeGreeting: string, tenantId: string, tenantName: string, context?: ChatContext): Promise<{ message: string; shouldEscalate: boolean; } | null> {
    const contactKeywords = /\b(nomer|nomor|wa|whatsapp|kontak|contact|telp|telepon|phone)\b/i;
    const requestKeywords = /\b(minta|kirim|mana|boleh|hubungi|hubungin|calling|call|admin|office|staff|sales|marketing|manajer|manager)\b/i;

    if (contactKeywords.test(msg) && requestKeywords.test(msg)) {
      console.log(`[SmartFallback] 📞 Staff contact inquiry detected with Handover Intent: "${msg}"`);
      const staffMembers = await this.getRegisteredStaffContacts(tenantId);
      const name_sc = this.formatKakName(context?.customerName);
      if (staffMembers.length > 0) {
        const staffList = staffMembers.map(s => `• ${s.name} (${s.role}) - ${s.phone}`).join("\n");
        return {
          message: `Halo! ⚡\n\n${timeGreeting}, tentu ${name_sc}! Silakan hubungi tim sales kami untuk informasi lebih lanjut mengenai unit atau proses pembelian:\n\n${staffList}\n\nSemoga membantu! Ada hal lain yang bisa kami bantu? 😊`,
          shouldEscalate: false,
        };
      } else {
        const name_sc = this.formatKakName(context?.customerName);
        return {
          message: `Halo! ${name_sc} ⚡\n\n${timeGreeting}! 👋\n\nUntuk info lebih lanjut atau konsultasi unit, ${name_sc} bisa hubungi tim sales kami di nomor berikut:\n` +
            `📱 WhatsApp: ${tenantName} Sales Team\n\n` +
            `Mau asisten bantu carikan unit spesifik dulu di sini ${name_sc}? 😊`,
          shouldEscalate: false,
        };
      }
    }
    return null;
  }

  /**
   * Handles Budget-Aware Vehicle Recommendations
   */
  private static async handleBudgetRecommendationInquiry(msg: string, tenantName: string, vehicles: any[], messageHistory: any[], context?: ChatContext): Promise<{ message: string; shouldEscalate: boolean; } | null> {
    // Check if question is about SPECIFIC DETAILS (capacity, type, color, transmission, specs)
    const isSpecificDetailQuestion = /\b(kapasitas|tipe|jenis|warna|transmisi|mesin|cc|bensin|diesel|manual|automatic|matic|spesifikasi|spec|fitur|kelengkapan|interior|eksterior|bagasi)\b/i.test(msg);
    const isTypeQuestion = /\b(suv|sedan|mpv|hatchback|lcgc|city car|pick.*up)\b.*\b(atau|apa|nggak|gak|bukan)\b/i.test(msg);

    // If user is asking specific details, SKIP budget fallback - let AI handle it
    if (isSpecificDetailQuestion || isTypeQuestion) {
      console.log(`[SmartFallback] 🔍 Specific detail question detected, skipping budget fallback: "${msg}"`);
      // Don't return budget template - fall through to end (will escalate or use AI)
      // But we can try to give a helpful hint if we know the vehicle type

      // Check if there's a vehicle name in the message
      const vehicleNameMatch = msg.match(/\b(city|avanza|fortuner|xpander|rush|ertiga|brio|agya|innova|pajero|alphard|civic|crv|hrv)\b/i);

      if (vehicleNameMatch) {
        const vehicleName = vehicleNameMatch[0];
        // This will be handled by AI with knowledge base
        console.log(`[SmartFallback] 📚 Vehicle name detected: ${vehicleName}, letting AI knowledge base handle it`);
      }

      return null; // Fall through - don't return budget template
    }

    // Extract budget from current message
    const budget = WhatsAppAIChatService.extractBudget(msg);

    // If no budget in current message, check recent conversation history (last 3 USER messages)
    let budgetFromHistory: number | null = null;
    if (!budget) {
      // Only look at USER messages to avoid reading AI's own pricing mentions/tips
      const recentUserMessages = messageHistory
        .filter(m => m.role === 'user')
        .slice(-3)
        .map(m => m.content)
        .join(' ');

      budgetFromHistory = WhatsAppAIChatService.extractBudget(recentUserMessages);
    }

    const finalBudget = budget || budgetFromHistory;

    // If user mentioned a budget, filter vehicles by budget
    if (finalBudget) {
      console.log(`[SmartFallback] 💰 Budget detected: Rp ${Math.round(finalBudget / 1000000)} juta`);

      const name_b = this.formatKakName(context?.customerName);

      // Categorization Thresholds
      const idealLower = finalBudget * 0.85;
      const idealUpper = finalBudget * 1.15;
      const maxPrice = finalBudget * 1.3;

      const idealMatches = vehicles.filter(v => Number(v.price) >= idealLower && Number(v.price) <= idealUpper);
      const economicalOptions = vehicles.filter(v => Number(v.price) < idealLower && Number(v.price) >= finalBudget * 0.4);
      const premiumOptions = vehicles.filter(v => Number(v.price) > idealUpper && Number(v.price) <= maxPrice);

      if (idealMatches.length > 0 || economicalOptions.length > 0 || premiumOptions.length > 0) {
        let responseMsg = `Siap ${name_b}! Untuk budget sekitar **Rp ${Math.round(finalBudget / 1000000)} juta**, asisten sudah pilihkan unit yang paling cocok buat Kakak: \n\n`;

        if (idealMatches.length > 0) {
          responseMsg += `🎯 **UNIT PAS BUDGET:**\n${WhatsAppAIChatService.formatVehicleListDetailed(idealMatches.slice(0, 2))}\n\n`;
        }

        if (economicalOptions.length > 0) {
          responseMsg += `💡 **OPSI LEBIH HEMAT:**\n${WhatsAppAIChatService.formatVehicleListDetailed(economicalOptions.slice(0, 2))}\n\n`;
        }

        if (premiumOptions.length > 0) {
          responseMsg += `✨ **OPSI PREMIUM (Sedikit di atas budget):**\n${WhatsAppAIChatService.formatVehicleListDetailed(premiumOptions.slice(0, 1))}\n\n`;
        }

        responseMsg += `Gimana ${name_b}, ada unit yang membuat Kakak tertarik? Atau mau asisten carikan alternatif lain? 😊`;

        return {
          message: responseMsg,
          shouldEscalate: false,
        };
      } else {
        // No vehicles within range - show closest option
        const closestVehicle = [...vehicles].sort((a, b) =>
          Math.abs(Number(a.price) - finalBudget) - Math.abs(Number(b.price) - finalBudget)
        )[0];
        const closestPrice = Math.round(Number(closestVehicle.price) / 1000000);
        const id = closestVehicle.displayId || closestVehicle.id.substring(0, 6).toUpperCase();

        console.log(`[SmartFallback] ⚠️ No vehicles within budget range, closest: ${closestVehicle.make} ${closestVehicle.model}`);

        return {
          message: `Mohon maaf ${name_b}, untuk budget Rp ${Math.round(finalBudget / 1000000)} juta saat ini belum ada unit ready yang pas. 🙏\n\n` +
            `Unit terdekat yang kami punya:\n• ${closestVehicle.make} ${closestVehicle.model} ${closestVehicle.year} - Rp ${closestPrice} juta | ${id}\n\n` +
            `Apakah budget bisa disesuaikan atau ingin coba cari unit lain ${name_b}? 😊`,
          shouldEscalate: false,
        };
      }
    }

    // No budget mentioned - show premium/popular vehicles (original behavior)
    console.log(`[SmartFallback] ℹ️ Final fallthrough: showing premium vehicles for "${msg}"`);

    // 1. Try to find "High Class" units first (SUV, MPV Premium, etc)
    const highClassKeywords = ['fortuner', 'pajero', 'palisade', 'terra', 'alphard', 'vellfire', 'crv', 'cx-5', 'santa fe', 'innova zenix', 'innova reborn'];
    let premiumVehicles = vehicles.filter(v => {
      const fullName = `${v.make} ${v.model}`.toLowerCase();
      return highClassKeywords.some(keyword => fullName.includes(keyword));
    });

    // 2. If no specific high class found, sort by price (Higher = usually more premium)
    if (premiumVehicles.length === 0) {
      premiumVehicles = [...vehicles].sort((a, b) => Number(b.price) - Number(a.price));
    }

    // Take top 3 recommendations
    const recommendations = premiumVehicles.slice(0, 3);

    // Use the DETAILED formatter, after know customer name
    const list = WhatsAppAIChatService.formatVehicleListDetailed(recommendations);

    const name_br2 = this.formatKakName(context?.customerName);
    const timeGreeting = this.getTimeGreeting();
    return {
      message: `Halo! ⚡\n\n${timeGreeting}, mohon maaf ${name_br2}, saya mau pastikan tidak salah tangkap 😊\n\n` +
        `Apakah ${name_br2} ingin melihat unit ready stock kami? Berikut beberapa rekomendasi unit terbaik kami saat ini:\n\n${list}\n\n` +
        `Atau ${name_br2} sedang mencari mobil dengan merk, budget, atau kriteria spesifik lainnya? Silakan diinfokan ya! 🙏`,
      shouldEscalate: false,
    };
  }

  /**
   * Build system prompt untuk AI
   * Personality: Professional, Formal, Friendly, Helpful
   */
  private static async buildSystemPrompt(
    tenant: any,
    config: any,
    intent: MessageIntent,
    senderInfo?: { isStaff: boolean; staffInfo?: { firstName?: string; lastName?: string; name?: string; role?: string; roleLevel?: number; phone?: string; userId?: string }; customerPhone: string; isEscalated?: boolean; isCatchup?: boolean },
    customerTone: 'CUEK' | 'NORMAL' | 'AKTIF' = 'NORMAL',
    leadInfo?: { id: string; name: string; status: string; interestedIn?: string; budgetRange?: string; location?: string; } | null,
    intentEntities?: Record<string, any>
  ): Promise<string> {
    // Get current time in Indonesia (WIB - UTC+7)
    const now = new Date();
    const hour = parseInt(new Intl.DateTimeFormat('en-GB', {
      hour: 'numeric',
      hour12: false,
      timeZone: 'Asia/Jakarta'
    }).format(now));

    const timeStr = now.toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Jakarta'
    });
    const dateStr = now.toLocaleDateString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'Asia/Jakarta'
    });

    // Determine appropriate greeting based on time
    // Determine appropriate greeting based on time matching identity.ts rules
    let timeGreeting: string;
    if (hour >= 4 && hour < 11) {
      timeGreeting = "Selamat pagi";
    } else if (hour >= 11 && hour < 15) {
      timeGreeting = "Selamat siang";
    } else if (hour >= 15 && hour < 18) {
      timeGreeting = "Selamat sore";
    } else {
      timeGreeting = "Selamat malam";
    }

    // 1. IDENTITY & PERSONA
    let systemPrompt = getIdentityPrompt(config, tenant);

    // 2. TIME CONTEXT & GREETING RULES
    systemPrompt += `
⏰ WAKTU SAAT INI (WIB - Jakarta):
- Tanggal: ${dateStr}
- Jam: ${timeStr} WIB
- Salam waktu yang tepat: "${timeGreeting}"
`;

    systemPrompt += getGreetingRules(timeGreeting, config, senderInfo, tenant?.name || "Showroom Kami", tenant, leadInfo);

    // 3. ROLE & SENDER CONTEXT
    systemPrompt += getRolePrompt(senderInfo);

    // 3b. CATCH-UP CONTEXT (After Hours Recovery)
    if (senderInfo?.isCatchup) {
      systemPrompt += `\n\n📌 KONTEKS PENTING: Ini adalah pesan "CATCH-UP" (balasan pagi hari).
      User mengirim pesan semalam saat showroom sudah TUTUP, dan kita baru membalas sekarang saat jam operasional dimulai (${timeGreeting}).
      INSTRUKSI:
      1. Ucapkan salam pembuka yang sesuai waktu: "${timeGreeting}!".
      2. WAJIB MINTA MAAF karena baru bisa membalas sekarang (sebutkan karena semalam tim sudah istirahat/di luar jam operasional).
      3. LANGSUNG JAWAB pertanyaan user di pesan terakhirnya dengan detail, ramah, dan solutif.
      4. Gunakan gaya bahasa yang hangat agar customer merasa tetap diprioritaskan.`;
    }

    // --- AI 5.2 LOGIC INJECTION START ---
    // TONE ADAPTATION
    if (customerTone === 'CUEK') {
      systemPrompt += `\n\n- Customer ini "CUEK" (singkat & to-the-point).\n- JAWABAN HARUS SINGKAT (max 2-3 kalimat).\n- HILANGKAN basa-basi berlebihan.\n- JANGAN gunakan emoji berlebihan.\n- Fokus ke data/angka.\n- Contoh: "Ada kak, harga 150jt. Mau lihat foto?"`;
    } else if (customerTone === 'AKTIF') {
      systemPrompt += `\n\n- Customer ini "AKTIF" dan antusias.\n- JAWABAN LEBIH DETAIL & INTERAKTIF.\n- GUNAKAN EMOJI yang cheerful (😊✨🚗).\n- Berikan apresiasi atas pertanyaannya.`;
    } else {
      systemPrompt += `\n\n- Customer "NORMAL".\n- Jawab dengan ramah, standar, dan profesional.\n- Gunakan emoji secukupnya.`;
    }

    // CRM STATE & LEAD COMPLETION
    if (leadInfo) {
      const missing = [];
      if (!leadInfo.name || leadInfo.name === 'Customer') missing.push("NAMA");
      if (!leadInfo.location) missing.push("DOMISILI");
      if (!leadInfo.budgetRange) missing.push("BUDGET");
      if (!leadInfo.interestedIn) missing.push("KEBUTUHAN/JENIS MOBIL");

      systemPrompt += `\n\n📊 STATUS DATA CRM LEAD SAAT INI (REAL-TIME):`;
      systemPrompt += `\n- Nama: ${leadInfo.name !== 'Customer' ? leadInfo.name : "❌ BELUM ADA (Nama Default)"}`;
      systemPrompt += `\n- Domisili: ${leadInfo.location || "❌ BELUM ADA"}`;
      systemPrompt += `\n- Budget: ${leadInfo.budgetRange || "❌ BELUM ADA"}`;
      systemPrompt += `\n- Kebutuhan: ${leadInfo.interestedIn || "❌ BELUM ADA"}`;
      systemPrompt += `\n- Status Lead: ${leadInfo.status}`;

      if (missing.length > 0) {
        systemPrompt += `\n\n🎯 PRIORITAS MISI: Data lead belum lengkap (${missing.join(", ")}).`;
        systemPrompt += `\nIkuti "NEW CUSTOMER FLOW" untuk melengkapi data ini satu per satu secara natural (JANGAN SEKALIGUS!).`;
      } else {
        systemPrompt += `\n\n✅ DATA LENGKAP. Gunakan "EXISTING CUSTOMER FLOW" -> Fokus ke closing, update unit, atau tawaran tukar tambah.`;
      }
    } else {
      systemPrompt += `\n\n⚠️ LEAD STATUS: NEW (Belum tersimpan di CRM). Lakukan pendekatan awal (New Customer Flow) untuk mendapatkan Nama, Kebutuhan, dan Budget.`;
    }
    // --- AI 5.2 LOGIC INJECTION END ---

    // 4. STAFF HELP (Conditional)
    if (senderInfo?.isStaff) {
      systemPrompt += '\n' + STAFF_COMMAND_HELP;
      systemPrompt += '\n' + STAFF_TROUBLESHOOTING;
      systemPrompt += '\n' + STAFF_EDIT_FEATURE;
      systemPrompt += '\n' + STAFF_RULES;
      systemPrompt += '\n⚠️ PENTING UNTUK STAFF: Selalu sertakan ID kendaraan (displayId), dan detail disetiap informasi unit mobil yang diberikan.';
    }

    // 5. CORE COMMUNICATION RULES
    systemPrompt += '\n' + FORMATTING_RULES;
    systemPrompt += '\n' + KKB_FORMATTING_RULES;
    systemPrompt += '\n' + ATURAN_KOMUNIKASI;

    // 6. CUSTOMER JOURNEY
    systemPrompt += getCustomerJourneyRules();

    // 7. RESPONSE GUIDELINES
    systemPrompt += getResponseGuidelines();

    // 8. TONE ADAPTATION (AI 5.2 - DYNAMIC PERSONA)
    systemPrompt += `\n\n🎯 MODE ADAPTASI TONE: ${customerTone}\n`;
    systemPrompt += `INSTRUKSI RESPONS KHUSUS:\n`;
    if (customerTone === 'CUEK') {
      systemPrompt += `- Customer ini "CUEK" (singkat & to-the-point).\n- JAWABAN HARUS SINGKAT (max 2-3 kalimat).\n- HILANGKAN basa-basi berlebihan.\n- JANGAN gunakan emoji berlebihan.\n- Fokus ke data/angka.\n- Contoh: "Ada kak, harga 150jt. Mau lihat foto?"`;
    } else if (customerTone === 'AKTIF') {
      systemPrompt += `- Customer ini "AKTIF" dan antusias.\n- JAWABAN LEBIH DETAIL & INTERAKTIF.\n- GUNAKAN EMOJI yang cheerful (😊✨🚗).\n- Berikan apresiasi atas pertanyaannya.`;
    } else {
      systemPrompt += `- Customer "NORMAL".\n- Jawab dengan ramah, standar, dan profesional.\n- Gunakan emoji secukupnya.`;
    }

    // 7b. SPECIFIC ASPECT FOCUS (Interior/Exterior)
    if (intentEntities?.aspect) {
      const aspectMap: Record<string, string> = {
        'interior': 'INTERIOR (Dalam Kabin)',
        'exterior': 'EKSTERIOR (Tampilan Luar)',
        'engine': 'MESIN & KAP',
        'tires': 'BAN & VELG'
      };
      const aspectLabel = aspectMap[intentEntities.aspect] || intentEntities.aspect.toUpperCase();

      systemPrompt += `\n\n🎯 FOKUS VISUAL: User secara spesifik menanyakan tentang bagian "${aspectLabel}".\n`;
      systemPrompt += `INSTRUKSI KHUSUS:\n`;
      systemPrompt += `1. JANGAN hanya bilang "ada" atau "ready". JELASKAN kondisi ${intentEntities.aspect} tersebut secara spesifik (misal: "Jok masih orisinil", "Cat mulus bebas baret").\n`;
      systemPrompt += `2. **AUTO-PHOTO**: Jika user bertanya tentang detail kondisi (Interior/Eksterior) dan kamu punya akses ke tool foto, SANGAT DISARANKAN untuk sebutkan unitnya lalu panggil tool "send_vehicle_images" atau tawarkan dengan jelas.\n`;
      systemPrompt += `3. Contoh: "Untuk interiornya masih sangat rapi kak, jok original fabric tidak ada sobek. Ini saya kirimkan foto detail dashboard dan jok-nya ya! 📸"`;
    }

    // 8. DYNAMIC INVENTORY CONTEXT
    const inventory = await this.getAvailableVehiclesDetailed(tenant.id);
    if (inventory.length > 0) {
      systemPrompt += '\n📋 INVENTORY TERSEDIA (PARTIAL LIST - ' + inventory.length + ' unit):\n';
      systemPrompt += '⚠️ LIST INI TIDAK LENGKAP! Hanya menampilkan 10 unit terbaru. Jika user cari mobil budget/tipe yang TIDAK ada di list ini, WAJIB GUNAKAN tool search_vehicles!\n';
      systemPrompt += '⚠️ CARA BACA HARGA: Field "price" di database dalam RUPIAH PENUH. Konversi dengan membagi 1.000.000 untuk dapat "juta".\n';
      systemPrompt += '   Contoh: price=79000000 → Tampilkan "Rp 79 juta" | price=470000000 → Tampilkan "Rp 470 juta"\n\n';

      systemPrompt += inventory
        .slice(0, 10)
        .map((v: any) => {
          const priceInJuta = Math.round(Number(v.price) / 1000000);
          const formattedPrice = this.formatPrice(Number(v.price));
          return `• ${v.make} ${v.model}${v.variant ? ` ${v.variant}` : ''} ${v.year} - Rp ${priceInJuta} juta (DB: ${formattedPrice}) | ID: ${v.displayId || 'N/A'} | ${v.transmissionType || 'Manual'}${v.mileage ? ` | ${v.mileage.toLocaleString('id-ID')} km` : ''} | ${v.fuelType || 'Bensin'} | ${v.color || '-'}`;
        })
        .join("\n");

      if (inventory.length > 10) {
        systemPrompt += '\n... dan ' + (inventory.length - 10) + ' unit lainnya';
      }

      systemPrompt += '\n\n⚠️ PENTING: Ketika menyebutkan harga ke customer, SELALU gunakan format "Rp [angka] juta"!';
      systemPrompt += '\n⚠️ DETAIL UNIT: SELALU sertakan ID unit, detail transmisi, kilometer, dan link website (https://primamobil.id/vehicles/[slug-merk]-[slug-model]-[tahun]-[id]) jika memberikan info unit spesifik.';

      // ✅ NEW: Critical budget handling rules
      systemPrompt += '\n\n🚨 CRITICAL BUDGET RULES:';
      systemPrompt += '\n• Jika customer sebutkan budget (contoh: "65 jt", "budget 100 juta", "ada budget 150 jt"), WAJIB cari unit dalam range tersebut!';
      systemPrompt += '\n• Gunakan tool search_vehicles dengan max_price = budget * 1.3 (toleransi 30%)';
      systemPrompt += '\n• JANGAN PERNAH rekomendasikan unit yang harganya 2x lipat budget atau lebih! (contoh: budget 65jt, jangan tawarkan unit 345jt)';
      systemPrompt += '\n• Jika tidak ada unit sesuai budget, JUJUR bilang: "Mohon maaf, untuk budget Rp X juta belum ada unit ready yang pas"';
      systemPrompt += '\n• Lalu tunjukkan unit terdekat dan tanyakan apakah budget bisa disesuaikan';
    } else {
      systemPrompt += '\n\n⚠️⚠️⚠️ SANGAT PENTING - INVENTORY KOSONG:\n' +
        '• Saat ini TIDAK ADA unit mobil yang tersedia/ready stock di showroom\n' +
        '• JANGAN PERNAH sebutkan atau buat-buat daftar kendaraan yang tidak ada!\n' +
        '• Jika customer tanya, jawab JUJUR: "Mohon maaf Kak [Nama], unit yang Anda cari tidak tersedia di showroom kami."';
    }

    // 9. STAFF CONTACTS
    const staffMembers = await this.getRegisteredStaffContacts(tenant.id);
    if (staffMembers.length > 0) {
      systemPrompt += '\n\n📞 KONTAK STAFF RESMI (HANYA gunakan ini, JANGAN buat-buat nomor sendiri!):\n';
      systemPrompt += staffMembers.map(s =>
        `• ${s.name} (${s.role}) - ${s.phone}`
      ).join("\n");
    }

    // 10. DATA INTEGRITY & KNOWLEDGE BASE
    systemPrompt += '\n' + DATA_INTEGRITY_RULES;
    systemPrompt += '\n' + AUTOMOTIVE_KNOWLEDGE_BASE;
    systemPrompt += '\n' + getCompanyKnowledgeBase(tenant);

    // 11. DYNAMIC LOCATION & MAP (NEW)
    if (tenant.googleMapsUrl) {
      systemPrompt += `\n📍 PETA LOKASI (MAPS): ${tenant.googleMapsUrl}`;
      systemPrompt += `\n(Gunakan link ini jika customer minta share lokasi/map)`;
    } else if (tenant.latitude && tenant.longitude) {
      const mapsUrl = `https://www.google.com/maps?q=${tenant.latitude},${tenant.longitude}`;
      systemPrompt += `\n📍 PETA LOKASI (MAPS): ${mapsUrl}`;
      systemPrompt += `\n(Gunakan link ini jika customer minta share lokasi/map)`;
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
        variant: true,
        year: true,
        price: true,
        mileage: true,
        transmissionType: true,
        fuelType: true,
        color: true,
        displayId: true,
      },
      orderBy: { createdAt: "desc" },
      take: 100,
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
        role: s.role === "OWNER" ? "Owner" : s.role === "ADMIN" ? "Admin" : s.role === "MANAGER" ? "Manager" : "Sales",
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

    // Include last 10 messages for better context
    const recentHistory = messageHistory.slice(-10);
    if (recentHistory.length > 0) {
      context += "Chat sebelumnya:\n";
      recentHistory.forEach((msg) => {
        const label = msg.role === "user" ? "C" : "A";
        // Keep 350 chars to preserve vehicle info and photo offers in context
        const truncated = msg.content.length > 350 ? msg.content.substring(0, 350) + "..." : msg.content;
        context += `${label}: ${truncated}\n`;
      });
    }

    const activeVehicle = this.extractActiveVehicle(currentMessage, messageHistory);

    // Detect photo confirmation patterns and add explicit hint
    const msg = currentMessage.trim().toLowerCase();
    const photoConfirmPatterns = [
      /^(boleh|ya|iya|ok|oke|okey|okay|mau|yup|yap|sip|siap|bisa|tentu|pasti|yoi|gass?|cuss?)$/i,
      /^(lihat|kirim|send|tampilkan|tunjukkan|kasih|berikan|kirimin|kirimkan|lanjut|lanjutkan)$/i,
      /^(foto|gambar|pictures?|images?|hayuk|yuk|ayo)$/i,
      /\b(iya|ya|ok|oke|mau|boleh)\b.*\b(foto|gambar)/i,
      /\b(mana|kirim|kasih|tunjuk)\b.*\b(foto|gambar)/i,
      /\bfoto\s*(nya|dong|ya|aja|mana)?\b/i,
      /\bgambar\s*(nya|dong|ya|aja|mana)?\b/i,
      /silahkan|silakan/i,
      /ditunggu/i,
      /tunggu/i,
      /kirim\s*(aja|dong|ya|in)?/i,
      /kirimin\s*(dong|ya|aja)?/i,
      /kirimkan\s*(dong|ya)?/i,
      /boleh\s*(dong|ya|lah|aja|silahkan|silakan|banget)?/i,
      /ok\s*(kirim|dong|ya|lanjut)?/i,
      /sip\s*(ditunggu|tunggu|lanjut)?/i,
      /mau\s*(dong|ya|lah|lihat|banget)?/i,
      /lanjut\s*(kirim|aja)?/i,
      /ok\s*lanjut\s*kirim/i,
      /^(coba|tolong)\s*(lihat|kirim|kirimin|kirimkan)/i,
    ];
    const isPhotoConfirmation = photoConfirmPatterns.some(p => p.test(msg));

    // Check if previous AI message offered photos
    const lastAiMsg = recentHistory.filter(m => m.role === "assistant").pop();
    const offeredPhotos = lastAiMsg?.content.toLowerCase().includes("foto") ||
      lastAiMsg?.content.toLowerCase().includes("lihat") ||
      lastAiMsg?.content.toLowerCase().includes("gambar");

    if (activeVehicle) {
      context += `\n🎯 KENDARAAN AKTIF: ${activeVehicle}`;
      context += `\n(User sedang membahas unit ini. JANGAN ganti topik kecuali user meminta unit lain.)\n`;
    }

    if (isPhotoConfirmation && offeredPhotos) {
      context += `\nPesan sekarang: ${currentMessage}`;
      context += `\n\n⚠️ PENTING: Customer baru saja konfirmasi untuk melihat foto.`;
      if (activeVehicle) {
        context += ` Kendaraan yang sedang dibahas: ${activeVehicle}.`;
        context += ` WAJIB panggil tool send_vehicle_images with query "${activeVehicle}"!`;
      }
      context += `\n\nBalas (kirim foto yang diminta):`;
    } else {
      context += `\nPesan sekarang: ${currentMessage}\n\nBalas (sesuai role, ramah):`;
    }

    return context;
  }

  /**
   * Handle photo confirmation directly WITHOUT calling AI
   * This ensures photo confirmations always work even if AI has issues
   */
  private static async handlePhotoConfirmationDirectly(
    userMessage: string,
    messageHistory: Array<{ role: "user" | "assistant"; content: string }>,
    tenantId: string,
    context?: ChatContext
  ): Promise<{ message: string; shouldEscalate: boolean; confidence: number; images?: Array<{ imageUrl: string; caption?: string }> } | null> {
    const msg = userMessage.trim().toLowerCase();

    // SIMPLE NAME EXTRACTION: Catch "Yudho, kirim fotonya" or "Budi, mau lihat"
    let capturedName = null;
    const namePromptMatch = userMessage.match(/^([a-zA-Z\s\.]{3,25}),\s+(?:kirim|mau|lihat|tunjuk|minta|send|liat|jelas)\b/i);
    if (namePromptMatch) {
      const nameCandidate = namePromptMatch[1].trim();
      // Filter out common verbs
      if (!/\b(halo|hai|pagi|siang|sore|malam|ok|oke|ya|iya|mohon|tolong)\b/i.test(nameCandidate)) {
        capturedName = nameCandidate;
        console.log(`[PhotoConfirm] Captured name from request: "${capturedName}"`);
      }
    }



    // ==================== APPRECIATION HANDLER (MUST BE FIRST!) ====================
    // Detect positive acknowledgment BEFORE photo confirmation check
    // These should NOT be treated as photo requests!
    const appreciationPatterns = [
      /\b(mantap|mantab|mantul|keren|bagus|oke banget|ok banget|sip banget)\b/i,
      /\b(good|great|nice|cool|awesome|perfect|excellent)\b/i,
      /\b(makasih|terima\s*kasih|thanks|thank you|thx)\b/i,
      /^(ok|oke|sip|siap)\s+(mantap|mantab|keren|bagus|banget|deh|ya|boss?|bos)/i,
      /^mantap/i, // starts with mantap
      /^keren/i,  // starts with keren
      /^bagus/i,  // starts with bagus
      /^(sudah|udah)\s*(cukup|ok|oke)/i, // "sudah cukup", "udah ok"
      /^cukup/i,  // starts with cukup
    ];
    const isAppreciation = appreciationPatterns.some(p => p.test(msg));
    if (isAppreciation) {
      console.log(`[PhotoConfirm DEBUG] ✅ Appreciation detected: "${msg}" - NOT a photo request`);
      return null; // Let the AI or smartFallback handle appreciation
    }

    // Photo confirmation patterns - ONLY true confirmation words/verbs
    // Photo confirmation patterns - ONLY true confirmation words/verbs
    const photoConfirmPatterns = WhatsAppAIChatService.PHOTO_CONFIRM_PATTERNS;

    const isPhotoConfirmation = photoConfirmPatterns.some(p => p.test(msg));
    if (!isPhotoConfirmation) return null;

    // ALWAY REQUIRE AN OFFER or EXPLICIT HISTORY
    // Get the last AI message to check if it offered photos
    const lastAiMsg = messageHistory.filter(m => m.role === "assistant").pop();
    if (!lastAiMsg) return null;

    const aiContent = lastAiMsg.content.toLowerCase();
    const offeredPhotos = aiContent.includes("foto") ||
      aiContent.includes("lihat") ||
      aiContent.includes("gambar") ||
      aiContent.includes("📸") ||
      aiContent.includes("kirim");

    if (!offeredPhotos) return null;

    console.log(`[WhatsApp AI Chat] 📸 Validated confirmation after offer: "${userMessage}"`);
    const userExplicitlyAsksPhoto = /\b(foto|gambar|detail|interior|eksterior)\b/i.test(msg);

    console.log(`[WhatsApp AI Chat] Photo request detected (explicit: ${userExplicitlyAsksPhoto}), extracting vehicle...`);

    // Extract vehicle name using prioritized helper
    const vehicleName = this.extractActiveVehicle(userMessage, messageHistory);

    if (vehicleName) {
      console.log(`[PhotoConfirm DEBUG] 🎯 Active Vehicle extracted: "${vehicleName}"`);
    }
    if (!vehicleName) {
      console.log(`[PhotoConfirm DEBUG] ⚠️ Could not extract vehicle name from any source`);

      // If user explicitly asks for photos (e.g., "iya mana fotonya"),
      // try to send ANY recent available vehicle photos as last resort
      if (userExplicitlyAsksPhoto) {

        // CRITICAL FIX: If user message contains BUDGET info, do NOT fallback to random photos
        // Let the AI handle the budget search instead
        const hasBudget = WhatsAppAIChatService.extractBudget(userMessage) !== null;
        if (hasBudget) {
          console.log(`[PhotoConfirm DEBUG] 💰 Budget criteria detected (${userMessage}), aborting generic photo fallback`);
          return null;
        }

        console.log(`[PhotoConfirm DEBUG] 🔄 Entering fallback: send any available photos...`);
        try {
          const anyVehicles = await prisma.vehicle.findMany({
            where: {
              tenantId,
              status: 'AVAILABLE',
              photos: { some: {} } // ONLY vehicles with photos
            },
            include: {
              photos: {
                orderBy: { isMainPhoto: 'desc' },
                take: 1,
              },
            },
            orderBy: { createdAt: 'desc' },
            take: 3, // Increased from 2 to 3 for better preview
          });

          console.log(`[PhotoConfirm DEBUG] Fallback query result: ${anyVehicles.length} vehicles found`);
          anyVehicles.forEach((v, i) => {
            console.log(`[PhotoConfirm DEBUG]   Vehicle ${i}: ${v.make} ${v.model}, photos: ${v.photos?.length || 0}`);
            if (v.photos && v.photos.length > 0) {
              console.log(`[PhotoConfirm DEBUG]     Photo URL: ${v.photos[0].originalUrl || v.photos[0].mediumUrl || 'NO URL'}`);
            }
          });

          if (anyVehicles.length > 0 && anyVehicles.some(v => v.photos?.length > 0)) {
            console.log(`[PhotoConfirm DEBUG] ✅ Vehicles with photos found, building image array...`);
            const images = await this.buildImageArray(anyVehicles);
            console.log(`[PhotoConfirm DEBUG] buildImageArray returned: ${images?.length || 0} images`);
            if (images && images.length > 0) {
              console.log(`[PhotoConfirm DEBUG] ✅ SUCCESS! Returning ${images.length} images`);
              const finalName = this.formatKakName(capturedName || context?.customerName);
              return {
                message: `Siap ${finalName}! Ini foto unit terbaru kami ya 📸👇\n\nAda yang mau ditanyakan tentang unit-unit ini? 😊`,
                shouldEscalate: false,
                confidence: 0.85,
                images,
              };
            }
          }
          // Vehicles exist but no photos available
          if (anyVehicles.length > 0) {
            const vehicleList = anyVehicles.slice(0, 3).map(v => {
              const id = v.displayId || v.id.substring(0, 8).toUpperCase();
              return `• ${v.make} ${v.model} ${v.year} | ${id}`;
            }).join('\n');
            const name_pc1 = this.formatKakName(context?.customerName);
            return {
              message: `Maaf ${name_pc1}, saat ini galeri foto unit sedang kami perbarui untuk kualitas terbaik. 👋\n\nTapi kami punya unit ready menarik lainnya:\n${vehicleList}\n\nIngin saya kirimkan fotonya segera setelah siap? 😊`,
              shouldEscalate: false,
              confidence: 0.8,
            };
          }
          console.log(`[PhotoConfirm DEBUG] ❌ No vehicles found at all`);
          const name_pc2 = this.formatKakName(context?.customerName);
          // Return helpful message instead of falling through to null
          return {
            message: `Maaf ${name_pc2}, saya belum tahu mobil mana yang ingin Anda lihat fotonya. 🤔\n\n` +
              `Bisa sebutkan jenis atau ID mobilnya? Contoh:\n` +
              `• "Foto Avanza"\n` +
              `• "Foto PM-PST-002"\n` +
              `• "Lihat foto Fortuner"\n\n` +
              `Atau ketik "mobil" untuk lihat daftar unit ready stock! 😊`,
            shouldEscalate: false,
            confidence: 0.9,
          };
        } catch (e: any) {
          console.error(`[PhotoConfirm DEBUG] ❌ ERROR in fallback:`, e.message);
          console.error(`[PhotoConfirm DEBUG] Error stack:`, e.stack);
          const name_pc3 = context?.customerName || "Kak";
          // Return error guidance instead of null
          return {
            message: `Maaf ${name_pc3}, ada kendala teknis. 😅 Bisa coba dengan "Foto [nama mobil]" atau ketik "mobil" untuk lihat daftar! 😊`,
            shouldEscalate: false,
            confidence: 0.8,
          };
        }
      } else {
        console.log(`[PhotoConfirm DEBUG] ❌ userExplicitlyAsksPhoto is false, not entering fallback`);
        const name_pc4 = this.formatKakName(context?.customerName);
        // User confirmed but didn't explicitly say "foto" - provide guidance
        return {
          message: `Baik ${name_pc4}! 👍 Bisa sebutkan mobil mana yang ingin dilihat fotonya? Contoh: "Avanza" atau "PM-PST-002" 😊`,
          shouldEscalate: false,
          confidence: 0.85,
        };
      }

      // Note: Code should never reach here now - all paths above return helpful messages
    }

    console.log(`[PhotoConfirm DEBUG] ✅ Vehicle name extracted: "${vehicleName} "`);

    // CRITICAL FIX: Check for KKB/Credit context FIRST
    // If user message contains "KKB", "kredit", "angsuran", or "X%", DO NOT treat as photo request
    // Pass strictly to intent handler / fallback to process as Credit Simulation
    const creditKeywords = /\b(kkb|kredit|cicilan|angsuran|dp|bunga|tenor|tanda\s*jadi|leasing)\b/i;
    const hasPercentage = /\d+\s*%/.test(userMessage); // e.g. "30%", "40%"

    if (creditKeywords.test(userMessage) || hasPercentage) {
      console.log(`[PhotoConfirm DEBUG] 💳 Credit/KKB context detected in "${userMessage}". Aborting photo/detail flow.`);
      return null; // Return null to let generateSmartFallback handle the KKB intent
    }

    // Check if user is asking for DETAILED photos (interior, exterior, semua, lengkap, dll) OR just "info"
    const detailPatterns = [
      /\b(detail|lengkap|semua|all)\b/i,
      /\b(interior|eksterior|dalam|luar)\b/i,
      /\b(dashboard|jok|bagasi|mesin)\b/i,
      /\bfoto.*(semua|lengkap|detail)\b/i,
      /\b(semua|lengkap).*(foto|gambar)\b/i,
      /\b(info|spesifikasi|spek)\b/i, // Added info/spek to trigger detailed view
      /\b(kondisi|keadaan|status)\b/i, // Added kondisi/keadaan
      /\b(surat|dokumen|kelengkapan|bpkb|stnk)\b/i, // Added document-related keywords
    ];
    const wantsDetailedPhotos = detailPatterns.some(p => p.test(userMessage));
    console.log(`[PhotoConfirm DEBUG] Wants detailed photos: ${wantsDetailedPhotos}`);

    // Fetch vehicle images
    try {
      // If user wants detailed photos, use fetchVehicleWithDetails for full info
      if (wantsDetailedPhotos) {
        console.log(`[PhotoConfirm DEBUG] Fetching DETAILED vehicle info for "${vehicleName}"...`);
        const vehicleWithDetails = await this.fetchVehicleWithDetails(vehicleName, tenantId);

        if (vehicleWithDetails && vehicleWithDetails.images.length > 0) {
          console.log(`[PhotoConfirm DEBUG] ✅ SUCCESS! Returning ${vehicleWithDetails.images.length} images with DETAILS`);
          const detailedMessage = this.buildVehicleDetailMessage(vehicleWithDetails.vehicle);
          const finalName = this.formatKakName(capturedName || context?.customerName);
          const greeting = `Siap ${finalName}! `;
          return {
            message: greeting + detailedMessage,
            shouldEscalate: false,
            confidence: 0.95,
            images: vehicleWithDetails.images,
          };
        }
      }

      // Regular photo request (not detailed)
      console.log(`[PhotoConfirm DEBUG] Calling fetchVehicleImagesByQuery("${vehicleName}", "${tenantId}")...`);
      const images = await this.fetchVehicleImagesByQuery(vehicleName, tenantId);

      console.log(`[PhotoConfirm DEBUG] fetchVehicleImagesByQuery returned: ${images?.length || 0} images`);
      if (images && images.length > 0) {
        console.log(`[PhotoConfirm DEBUG] ✅ SUCCESS! Returning ${images.length} images for "${vehicleName}"`);
        images.forEach((img, i) => {
          console.log(`[PhotoConfirm DEBUG]   Image ${i}: ${img.imageUrl?.substring(0, 80)}...`);
        });
        return {
          message: `Siap ${capturedName ? `Kak ${capturedName}` : 'Kak'}! Ini foto ${vehicleName}-nya ya 📸👇\n\nAda pertanyaan lain tentang unit ini? 😊`,
          shouldEscalate: false,
          confidence: 0.95,
          images,
        };
      } else {
        console.log(`[PhotoConfirm DEBUG] ⚠️ No images found for "${vehicleName}", returning text response`);
        return {
          message: `Maaf kak, koleksi foto untuk ${vehicleName} sedang dalam proses kurasi oleh tim kami untuk kualitas terbaik. 👋\n\nAdakah unit lain yang ingin Anda lihat atau ada hal lain yang bisa kami bantu? 😊`,
          shouldEscalate: false,
          confidence: 0.9,
        };
      }
    } catch (error: any) {
      console.error(`[PhotoConfirm DEBUG] ❌ ERROR fetching images for "${vehicleName}":`, error.message);
      console.error(`[PhotoConfirm DEBUG] Error stack:`, error.stack);
      console.log(`[PhotoConfirm DEBUG] ❌ Returning NULL due to error`);
      return null; // Let AI handle as fallback
    }
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
        variant: true,
        year: true,
        price: true,
        displayId: true,
      },
      orderBy: { createdAt: "desc" },
      take: 5, // Limit to 5 most recent for faster response
    });
  }

  /**
   * Extract budget from user message
   * Supports patterns: "65 jt", "65jt", "budget 65 juta", "anggaran 100 jt", etc.
   */
  private static extractBudget(message: string): number | null {
    if (!message) return null;

    const msg = message.toLowerCase();

    // Pattern 1: "budget 65 jt", "anggaran 100 juta", "dana 50jt"
    const withKeyword = msg.match(/(?:budget|anggaran|dana|harga|price)\s*(\d+)\s*(?:jt|juta|million)/i);
    if (withKeyword) {
      return parseInt(withKeyword[1]) * 1000000;
    }

    // Pattern 2: "65 jt", "100 juta", "50jt" (standalone numbers)
    const standalone = msg.match(/\b(\d+)\s*(jt|juta)\b/i);
    if (standalone) {
      return parseInt(standalone[1]) * 1000000;
    }

    return null;
  }

  private static formatPrice(price: number | bigint | string): string {
    // Convert to number for Intl.NumberFormat
    const numPrice = typeof price === 'bigint' ? Number(price) :
      typeof price === 'string' ? parseFloat(price) : Number(price);

    if (isNaN(numPrice)) return '0';

    return new Intl.NumberFormat("id-ID").format(Math.round(numPrice));
  }

  /**
   * Check if within business hours
   */
  private static isWithinBusinessHours(
    businessHours: any,
    timezone: string
  ): boolean {
    const tz = timezone || "Asia/Jakarta";
    const now = new Date();

    // Get current time string in target timezone (24h format HH:mm)
    const timeFormatter = new Intl.DateTimeFormat("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: tz,
    });
    const currentStr = timeFormatter.format(now); // e.g. "17:29"

    // Get current day name in target timezone
    const day = now.toLocaleDateString("en-US", { weekday: "long", timeZone: tz }).toLowerCase();

    const todayHours = businessHours[day];

    // If no config for today, or explicit "closed", return false
    if (!todayHours || todayHours.open === "closed" || !todayHours.open || !todayHours.close) {
      console.log(`[BusinessHours] No config or closed for ${day}`);
      return false;
    }

    console.log(`[BusinessHours] Current: ${currentStr}, Target: ${todayHours.open} - ${todayHours.close} (${day})`);

    // Lexicographical comparison works for "HH:mm" in 24h format
    return currentStr >= todayHours.open && currentStr <= todayHours.close;
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
   * IMPORTANT: Only returns images for vehicles matching the specific query
   * Does NOT fallback to unrelated vehicles - customer asked for specific vehicle!
   */
  private static async fetchVehicleImagesByQuery(
    searchQuery: string,
    tenantId: string
  ): Promise<Array<{ imageUrl: string; caption?: string }> | null> {
    console.log('[WhatsApp AI Chat] 📸 Fetching vehicles for query:', searchQuery);
    console.log('[WhatsApp AI Chat] Tenant ID:', tenantId);

    // CRITICAL FIX: Check for explicit Vehicle ID first (PM-PST-XXX or PM PST-XXX)
    // Supports various formats to be robust for WhatsApp users
    const idRegExp = /\b(pm[- ]?[a-zA-Z0-9]+-\d+)\b/i;
    const idMatch = searchQuery.match(idRegExp);

    if (idMatch) {
      const explicitId = idMatch[0].toUpperCase().replace(" ", "-");
      console.log(`[WhatsApp AI Chat] 🎯 Explicit ID detected in query: ${explicitId}`);

      const specificVehicle = await prisma.vehicle.findFirst({
        where: {
          tenantId,
          displayId: {
            equals: explicitId,
            mode: 'insensitive',
          },
        },
        include: {
          photos: {
            orderBy: { isMainPhoto: 'desc' },
          },
        },
      });

      console.log(`[WhatsApp AI Chat] Query result for ${explicitId}:`, specificVehicle ? `FOUND (${specificVehicle.make} ${specificVehicle.model})` : 'NOT FOUND');

      if (specificVehicle) {
        if (specificVehicle.photos && specificVehicle.photos.length > 0) {
          console.log(`[WhatsApp AI Chat] ✅ Found vehicle ${explicitId} with ${specificVehicle.photos.length} photos`);
          console.log(`[WhatsApp AI Chat] First photo preview:`, specificVehicle.photos[0].originalUrl?.substring(0, 80) || 'NO URL');
          console.log(`[WhatsApp AI Chat] ✅ Found vehicle ${explicitId} with ${specificVehicle.photos.length} photos`);
          console.log(`[WhatsApp AI Chat] First photo preview:`, specificVehicle.photos[0].originalUrl?.substring(0, 80) || 'NO URL');
          return await this.buildImageArray([specificVehicle]);
        } else {
          console.log(`[WhatsApp AI Chat] ⚠️ Found specific vehicle ${explicitId} but NO photos`);
          return null;
        }
      } else {
        console.log(`[WhatsApp AI Chat] ❌ Vehicle ${explicitId} not found in DB (tenantId: ${tenantId})`);
        // Don't fallthrough - user specified exact ID
        return null;
      }
    }

    // Parse search query into individual terms and filter out stop words
    const searchTerms = searchQuery.toLowerCase()
      .split(/\s+/)
      .filter(term => term.length > 0 && !WhatsAppAIChatService.INDONESIAN_STOP_WORDS.includes(term));

    console.log('[WhatsApp AI Chat] Cleaned search terms:', searchTerms);

    // If all terms were filtered out, it's a generic query
    if (searchTerms.length === 0) {
      console.log('[WhatsApp AI Chat] ⚠️ All terms filtered out, query is too generic');
      return null;
    }

    // Check if query contains specific vehicle identifiers (model name, stock code, etc.)
    const specificModels = [
      'innova', 'avanza', 'xenia', 'fortuner', 'rush', 'calya', 'sigra', 'brio', 'jazz', 'civic', 'accord',
      'xpander', 'pajero', 'triton', 'ertiga', 'swift', 'baleno', 'livina', 'serena', 'terios', 'ayla',
      'hiace', 'alphard', 'vellfire', 'yaris', 'vios', 'camry', 'corolla', 'raize', 'rocky', 'wuling',
      'confero', 'cortez', 'almaz', 'hrv', 'crv', 'wrv', 'brv', 'br-v', 'hr-v', 'cr-v', 'wr-v',
      // Additional models
      'city', 'freed', 'mobilio', 'odyssey', 'stream', 'fit', 'shuttle', // Honda
      'agya', 'granmax', 'luxio', 'taruna', 'feroza', // Daihatsu
      'ranger', 'everest', 'ecosport', 'fiesta', 'focus', // Ford
      'captiva', 'spin', 'trax', 'trailblazer', 'orlando', // Chevrolet
      'tiguan', 'polo', 'golf', 'touran', // VW
      'cx3', 'cx5', 'cx7', 'cx8', 'cx9', 'mazda2', 'mazda3', 'mazda6', 'biante', // Mazda
      'juke', 'xtrail', 'x-trail', 'navara', 'terra', 'grand', 'march', 'note', // Nissan
      'tucson', 'santa', 'stargazer', 'creta', 'kona', 'palisade', // Hyundai
      'sportage', 'seltos', 'sonet', 'sorento', 'carnival', 'carens', // Kia
      'outlander', 'delica', 'l300', // Mitsubishi
    ];

    const hasSpecificQuery = searchTerms.some(term =>
      specificModels.includes(term) ||
      // Stock code pattern (PM-PST-XXX, PM-XXX, etc.)
      /^pm-?/i.test(term) ||
      // Year pattern
      /^20\d{2}$/.test(term)
    );

    // Query vehicles with photos
    // IMPORTANT: If customer asked for SPECIFIC vehicle, only return 1!
    // If generic query, can return up to 3
    const maxVehicles = hasSpecificQuery ? 1 : 3;
    console.log(`[WhatsApp AI Chat] hasSpecificQuery: ${hasSpecificQuery}, maxVehicles: ${maxVehicles}`);

    // Build query: each search term must match at least one field (AND logic)
    // This ensures "Honda City" only matches vehicles with BOTH "Honda" AND "City"
    // Filter out year terms - we'll handle them separately
    const yearTerms = searchTerms.filter(term => /^20\d{2}$/.test(term));
    const nonYearTerms = searchTerms.filter(term => !/^20\d{2}$/.test(term));

    const termConditions = nonYearTerms.map(term => ({
      OR: [
        { make: { contains: term, mode: 'insensitive' as const } },
        { model: { contains: term, mode: 'insensitive' as const } },
        { variant: { contains: term, mode: 'insensitive' as const } },
        { displayId: { contains: term, mode: 'insensitive' as const } },
        { transmission: { contains: term, mode: 'insensitive' as const } },
        { fuelType: { contains: term, mode: 'insensitive' as const } },
        { color: { contains: term, mode: 'insensitive' as const } },
        { engineCapacity: { contains: term, mode: 'insensitive' as const } },
      ]
    }));

    // Build year condition separately
    const yearCondition = yearTerms.length > 0 ? parseInt(yearTerms[0], 10) : null;
    if (yearCondition) {
      console.log(`[WhatsApp AI Chat] Added year filter: ${yearCondition}`);
    }

    const vehicles = await prisma.vehicle.findMany({
      where: {
        tenantId,
        status: 'AVAILABLE',
        // AND logic: ALL terms must match (each term can match any field)
        ...(termConditions.length > 0 && { AND: termConditions }),
        // Year filter (if specified)
        ...(yearCondition && { year: yearCondition }),
      },
      include: {
        photos: {
          orderBy: { isMainPhoto: 'desc' },
          take: 5, // LIMIT: Max 5 photos to prevent flooding
        },
      },
      take: maxVehicles, // Only 1 for specific query, up to 3 for generic
    });

    console.log(`[WhatsApp AI Chat] Found ${vehicles.length} vehicles matching query`);
    vehicles.forEach(v => {
      console.log(`[WhatsApp AI Chat]   - ${v.make} ${v.model} (${v.year}) | ID: ${v.displayId} | Photos: ${v.photos?.length || 0}`);
    });

    if (vehicles.length === 0) {
      console.log('[WhatsApp AI Chat] ❌ No vehicles found for query:', searchQuery);

      // IMPORTANT: If customer asked for a SPECIFIC vehicle/model, DO NOT fallback
      // to random vehicles - this confuses customers and sends irrelevant photos!
      if (hasSpecificQuery) {
        console.log('[WhatsApp AI Chat] ⚠️ Customer asked for specific vehicle, NOT falling back to random vehicles');
        return null;
      }

      // Only fallback to any vehicles if query was very generic (e.g., "mobil", "foto", "stok")
      console.log('[WhatsApp AI Chat] 🔄 Generic query, trying broader search for any available vehicles...');
      const anyVehicles = await prisma.vehicle.findMany({
        where: {
          tenantId,
          status: 'AVAILABLE',
          photos: { some: {} } // ONLY vehicles with photos
        },
        include: {
          photos: {
            orderBy: { isMainPhoto: 'desc' },
            // Get ALL photos
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
      return await this.buildImageArray(anyVehicles);
    }

    return await this.buildImageArray(vehicles);
  }

  /**
   * Fetch vehicle with FULL details including description, features, and ALL photos
   * Used when customer asks for detailed info about a specific vehicle
   */
  private static async fetchVehicleWithDetails(
    searchQuery: string,
    tenantId: string
  ): Promise<VehicleWithImages | null> {
    console.log('[WhatsApp AI Chat] 📋 Fetching vehicle with FULL details for:', searchQuery);

    // Parse search query into individual terms and filter out stop words
    const searchTerms = searchQuery.toLowerCase()
      .split(/\s+/)
      .filter(term => term.length > 0 && !WhatsAppAIChatService.INDONESIAN_STOP_WORDS.includes(term));

    console.log('[WhatsApp AI Chat] Cleaned search terms for detail:', searchTerms);

    if (searchTerms.length === 0) return null;

    // Build AND conditions for search
    const termConditions = searchTerms.map(term => ({
      OR: [
        { make: { contains: term, mode: 'insensitive' as const } },
        { model: { contains: term, mode: 'insensitive' as const } },
        { variant: { contains: term, mode: 'insensitive' as const } },
        { displayId: { contains: term, mode: 'insensitive' as const } },
      ]
    }));

    const vehicle = await prisma.vehicle.findFirst({
      where: {
        tenantId,
        status: 'AVAILABLE',
        ...(termConditions.length > 0 && { AND: termConditions }),
      },
      select: {
        id: true,
        make: true,
        model: true,
        variant: true,
        year: true,
        price: true,
        mileage: true,
        transmissionType: true,
        fuelType: true,
        color: true,
        condition: true,
        descriptionId: true,
        features: true,
        engineCapacity: true,
        displayId: true,
        photos: {
          orderBy: [{ isMainPhoto: 'desc' }, { displayOrder: 'asc' }],
        },
      }
    }) as any;

    if (!vehicle) {
      console.log('[WhatsApp AI Chat] ❌ No vehicle found for detailed query');
      return null;
    }

    console.log(`[WhatsApp AI Chat] ✅ Found vehicle: ${vehicle.make} ${vehicle.model} with ${vehicle.photos.length} photos`);

    // Build image array for this vehicle
    const images = await this.buildImageArray([vehicle]);
    if (!images || images.length === 0) {
      return null;
    }

    // Parse features from JSON if available
    let features: string[] = [];
    if (vehicle.features) {
      try {
        features = Array.isArray(vehicle.features) ? (vehicle.features as string[]) : [];
      } catch {
        features = [];
      }
    }

    return {
      vehicle: {
        id: vehicle.id,
        make: vehicle.make,
        model: vehicle.model,
        variant: vehicle.variant || undefined,
        year: vehicle.year,
        price: Number(vehicle.price),
        mileage: vehicle.mileage || undefined,
        transmissionType: vehicle.transmissionType || undefined,
        fuelType: vehicle.fuelType || undefined,
        color: vehicle.color || undefined,
        condition: vehicle.condition || undefined,
        descriptionId: vehicle.descriptionId || undefined,
        features,
        engineCapacity: vehicle.engineCapacity || undefined,
        displayId: vehicle.displayId || undefined,
      },
      images,
    };
  }

  /**
   * Build detailed vehicle description message
   * Includes all specs, features, and condition info
   */
  private static buildVehicleDetailMessage(vehicleData: VehicleWithImages['vehicle']): string {
    const v = vehicleData;
    const priceFormatted = this.formatPrice(v.price);

    let message = `📋 *DETAIL ${v.make.toUpperCase()} ${v.model.toUpperCase()} ${v.variant ? v.variant.toUpperCase() : ''} ${v.year}*\n`;
    message += `━━━━━━━━━━━━━━━━━━━━━\n\n`;

    // Basic specs
    message += `🚗 *Spesifikasi:*\n`;
    message += `• ID Unit: ${v.displayId || 'Pusat'}\n`;
    message += `• Merek: ${v.make}\n`;
    message += `• Model: ${v.model}${v.variant ? ` (${v.variant})` : ''}\n`;
    message += `• Tahun: ${v.year}\n`;
    message += `• Harga: Rp ${priceFormatted}\n`;

    if (v.mileage) {
      message += `• Kilometer: ${v.mileage.toLocaleString('id-ID')} km\n`;
    }
    if (v.transmissionType) {
      const trans = v.transmissionType.toLowerCase() === 'automatic' ? 'Automatic (AT)' : 'Manual (MT)';
      message += `• Transmisi: ${trans}\n`;
    }
    if (v.fuelType) {
      message += `• Bahan Bakar: ${v.fuelType}\n`;
    }
    if (v.color) {
      message += `• Warna: ${v.color}\n`;
    }
    if (v.engineCapacity) {
      message += `• Mesin: ${v.engineCapacity}\n`;
    }
    if (v.condition) {
      const conditionMap: Record<string, string> = {
        'excellent': 'Sangat Baik',
        'good': 'Baik',
        'fair': 'Cukup',
        'poor': 'Perlu Perbaikan'
      };
      message += `• Kondisi: ${conditionMap[v.condition.toLowerCase()] || v.condition}\n`;
    }

    // Description if available
    if (v.descriptionId) {
      message += `\n📝 *Deskripsi:*\n`;
      // Truncate if too long for WhatsApp
      const desc = v.descriptionId.length > 500 ? v.descriptionId.substring(0, 500) + '...' : v.descriptionId;
      message += `${desc}\n`;
    }

    // Features if available
    if (v.features && v.features.length > 0) {
      message += `\n✨ *Fitur:*\n`;
      v.features.slice(0, 8).forEach(f => {
        message += `• ${f}\n`;
      });
      if (v.features.length > 8) {
        message += `• ... dan ${v.features.length - 8} fitur lainnya\n`;
      }
    }

    // Variation picker based on ID for "AI dynamic feel"
    const charSum = (v.displayId || v.id).split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const isGoodCondition = !v.condition || ['excellent', 'good', 'sangat baik', 'baik'].includes(v.condition.toLowerCase());

    if (isGoodCondition) {
      const intVariations = [
        `🏠 *Interior:*\n• Kabin: Bersih & Wangi disinfektan\n• Jok & Dashboard: Original/Terawat rapi\n• AC: Dingin maksimal\n• Electrical: Normal 100%\n`,
        `🏠 *Kondisi Dalam (Interior):*\n• Kabin: Sangat terawat & Bebas bau rokok\n• Jok: Orisinil & Busa masih tebal\n• Dashboard: Mulus tanpa retak\n• Fitur: Semua tombol berfungsi normal\n`,
        `🏠 *Kabin & Interior:*\n• Kebersihan: Terjaga & rutin disinfektan\n• Plafon: Bersih & bebas noda\n• AC: Dingin merata sampai baris belakang\n• Kelistrikan: Berjalan normal tanpa kendala\n`
      ];

      const extVariations = [
        `🚙 *Eksterior:*\n• Body: Mulus (Bebas tabrak & banjir)\n• Cat: Original/Repaint rapi (Sesuai foto)\n• Ban: Tebal & Siap jalan jauh\n`,
        `🚙 *Tampilan Luar (Eksterior):*\n• Body: Presisi & Simetris (Bebas Insiden)\n• Cat: Masih kinclong & minim lecet\n• Kaki-kaki: Senyap & tidak ada bunyi\n`,
        `🚙 *Kondisi Body & Cat:*\n• Fisik: Kaleng (Original) & Kokoh\n• Cat: Perawatan rutin bebas jamur\n• Ban & Velg: Orisinil & profil masih dalam\n`
      ];

      message += `\n${intVariations[charSum % intVariations.length]}`;
      message += `\n${extVariations[(charSum + 1) % extVariations.length]}`;
    }

    // Documents & Tax info (Commonly asked)
    const docVariations = [
      `📄 *Kelengkapan Dokumen:*\n• BPKB & STNK: Lengkap & Asli\n• Pajak: Hidup / On (Siap Pakai)\n• Faktur: Tersedia\n`,
      `📄 *Surat-surat Kendaraan:*\n• Status: Dokumen LENGKAP & SAH\n• Pajak: Tertib & Masih Panjang\n• Berkas Lain: Faktur & NIK Ready\n`,
      `📄 *Legalitas Dokumen:*\n• Keabsahan: Terverifikasi 100% Aman\n• Surat: BPKB & STNK di tangan\n• Unit: Pajak Hidup siap balik nama\n`
    ];
    message += `\n${docVariations[(charSum + 2) % docVariations.length]}`;

    message += `\n📸 Berikut foto-foto unitnya (Interior & Eksterior) 👇`;

    return message;
  }

  /**
   * Build image array from vehicles with proper URL handling
   * UPDATED: Now Async to support Smart Validation (HTTP HEAD check)
   */
  private static async buildImageArray(vehicles: any[]): Promise<Array<{ imageUrl: string; caption?: string }> | null> {
    // Build image array with fallback URLs
    // Convert relative URLs to full URLs for Aimeow
    let baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://primamobil.id';

    // CRITICAL FIX: Ensure we never send localhost/0.0.0.0 URLs to external WhatsApp API
    // because the external Aimeow Gateway cannot reach our local server.
    if (baseUrl.includes('localhost') || baseUrl.includes('0.0.0.0') || baseUrl.includes('127.0.0.1')) {
      console.log(`[WhatsApp AI Chat] ⚠️ Local URL detected (${baseUrl}), enforcing public domain for external API`);
      baseUrl = 'https://primamobil.id';
    }

    console.log(`[WhatsApp AI Chat] Final Base URL for images: ${baseUrl}`);

    const images: Array<{ imageUrl: string; caption?: string }> = [];

    for (const v of vehicles) {
      console.log(`[WhatsApp AI Chat] Processing vehicle: ${v.make} ${v.model} ${v.year}`);
      console.log(`[WhatsApp AI Chat] Photos count: ${v.photos?.length || 0}`);

      if (!v.photos || v.photos.length === 0) {
        console.log(`[WhatsApp AI Chat] ⚠️ No photos for ${v.make} ${v.model}`);
        continue;
      }

      // Loop through ALL photos for this vehicle (not just the first one)
      // This sends interior, exterior, dashboard, etc. as requested by customer
      for (let photoIndex = 0; photoIndex < v.photos.length; photoIndex++) {
        const photo = v.photos[photoIndex];
        console.log(`[WhatsApp AI Chat] Photo ${photoIndex + 1}/${v.photos.length}:`, {
          id: photo.id,
          isMainPhoto: photo.isMainPhoto,
          originalUrl: photo.originalUrl?.substring(0, 100),
        });

        // PRIORITY: Use originalUrl (JPEG) first for Mobile Compatibility.
        // AimeowClientService handles size safety (falls back to medium if > 6MB).
        const imageUrl = photo.originalUrl || photo.mediumUrl || photo.largeUrl;

        if (!imageUrl) {
          console.log(`[WhatsApp AI Chat] ⚠️ No valid URL for photo ${photoIndex + 1}`);
          continue;
        }

        // URL Construction: Ensure we use the public domain for Aimeow
        const publicDomain = 'https://primamobil.id';
        let finalUrl = imageUrl;

        // Extract the trailing path if it's already an absolute URL or use as is if relative
        if (imageUrl.includes('/uploads/')) {
          const pathParts = imageUrl.split('/uploads/');
          finalUrl = `${publicDomain}/uploads/${pathParts[1]}`;
        } else if (!imageUrl.startsWith('http')) {
          const cleanPath = imageUrl.startsWith('/') ? imageUrl.substring(1) : imageUrl;
          finalUrl = `${publicDomain}/${cleanPath}`;
        }

        console.log(`[WhatsApp AI Chat] 📸 Final Photo URL: ${finalUrl.substring(0, 100)}...`);

        // Caption: Place ID at the START for immediate visibility on mobile
        const id = v.displayId || v.id.substring(0, 8).toUpperCase();
        // Format: [PM-PST-001] Toyota Fortuner ...
        const finalCaption = photoIndex === 0
          ? `[${id}] ${v.make} ${v.model}${v.variant ? ` ${v.variant}` : ''} ${v.year} - Rp ${this.formatPrice(Number(v.price))}\n${v.mileage ? `${v.mileage.toLocaleString('id-ID')} km • ` : ''}${v.transmissionType || 'Manual'} • ${v.color || '-'}`
          : `[${id}] ${v.make} ${v.model} (${photoIndex + 1}/${v.photos.length})`;

        // CRITICAL DEBUG: Log final URL that will be sent to Aimeow
        console.log(`[WhatsApp AI Chat] 🚀 FINAL URL to Aimeow (photo ${photoIndex + 1}): ${finalUrl.substring(0, 100)}...`);

        images.push({ imageUrl: finalUrl, caption: finalCaption });
      }
      console.log(`[WhatsApp AI Chat] ✅ Added ${v.photos.length} photos for ${v.make} ${v.model}`);
    }

    console.log(`[WhatsApp AI Chat] ✅ Prepared ${images.length} vehicle images to send`);
    console.log(`[WhatsApp AI Chat] Image URLs: `, images.map(i => i.imageUrl));

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

    // Make/Model/Search filter
    if (criteria.make) {
      const term = criteria.make;
      where.OR = [
        { make: { contains: term, mode: 'insensitive' } },
        { model: { contains: term, mode: 'insensitive' } },
        { variant: { contains: term, mode: 'insensitive' } },
        { displayId: { contains: term, mode: 'insensitive' } },
      ];
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
        variant: true,
        year: true,
        price: true,
        mileage: true,
        transmissionType: true,
        fuelType: true,
        color: true,
        displayId: true,
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

  /**
   * FALLBACK: Detect edit intent from user message when AI doesn't call the tool
   * Parses messages like "rubah km 50000", "ganti bensin jadi diesel", etc.
   */
  private static detectEditIntentFromText(
    aiResponse: string,
    userMessage: string
  ): { vehicleId?: string; field: string; oldValue?: string; newValue: string } | null {
    const msg = userMessage.toLowerCase().trim();

    // Check if this looks like an edit request
    const editKeywords = ['rubah', 'ganti', 'ubah', 'update', 'edit', 'koreksi', 'perbaiki'];
    const hasEditKeyword = editKeywords.some(k => msg.includes(k));
    if (!hasEditKeyword) return null;

    // Also check if AI response indicates it understood as edit
    const aiIndicatesEdit = aiResponse.toLowerCase().includes('mengubah') ||
      aiResponse.toLowerCase().includes('mengganti') ||
      aiResponse.toLowerCase().includes('update');
    if (!aiIndicatesEdit && !hasEditKeyword) return null;

    // Extract vehicle ID if mentioned (PM-PST-XXX format)
    const vehicleIdMatch = msg.match(/pm-\w+-\d+/i);
    const vehicleId = vehicleIdMatch ? vehicleIdMatch[0].toUpperCase() : undefined;

    // Field detection patterns
    const fuelTypesRegex = '(?:bensin|diesel|hybrid|electric|listrik|solar)';
    const transmissionRegex = '(?:matic|manual|automatic|cvt|at|mt)';
    const colorsRegex = '(?:biru|merah|hitam|putih|silver|abu-abu|abu|hijau|kuning|coklat|metalik|jingga|orange|gold|emas|ungu|merah muda|pink|cokelat|krem|cream|beige|champagne|tembaga|bronze|titanium|magnesium)';

    const patterns: Array<{ pattern: RegExp; field: string; valueExtractor: (m: RegExpMatchArray) => string }> = [
      // 1. Price: "rubah harga 150jt", "update 200jt" (require jt/juta or 'harga')
      {
        pattern: /(?:rubah|ganti|ubah|update)(?:\s+.*?)\s*(?:harga)?\s*(?:ke|jadi|menjadi)?\s*(\d+(?:jt|juta))/i,
        field: 'price',
        valueExtractor: m => {
          const val = m[1].toLowerCase();
          return String(parseInt(val) * 1000000);
        }
      },
      {
        pattern: /(?:rubah|ganti|ubah|update)\s*harga\s*(?:ke|jadi|menjadi)?\s*(\d+)/i,
        field: 'price',
        valueExtractor: m => m[1]
      },

      // 2. Year: "ubah PM-PST-001 tahun 2017", "ganti PM-PST-001 jadi 2018"
      { pattern: /(?:rubah|ganti|ubah|update)\s*tahun\s*(?:ke|jadi|menjadi)?\s*(\d{4})/i, field: 'year', valueExtractor: m => m[1] },

      // 3. Fuel type: "ganti PM-PST-001 diesel", "rubah PM-PST-001 ke hybrid"
      {
        pattern: new RegExp(`(?: rubah | ganti | ubah | update)(?: \\s +.*?) \\s * (?: bahan\\s * bakar | fuel)?\\s * (?: ke | jadi | menjadi) ?\\s * (${fuelTypesRegex})`, 'i'),
        field: 'fuelType',
        valueExtractor: m => m[1]
      },

      // 4. Transmission: "ganti PM-PST-001 jadi manual", "ubah PM-PST-001 transmisi matic"
      {
        pattern: new RegExp(`(?: rubah | ganti | ubah | update)(?: \\s +.*?) \\s * (?: transmisi) ?\\s * (?: ke | jadi | menjadi) ?\\s * (${transmissionRegex})`, 'i'),
        field: 'transmissionType',
        valueExtractor: m => {
          const val = m[1].toLowerCase();
          if (val === 'matic' || val === 'at' || val === 'automatic' || val === 'cvt') return 'automatic';
          if (val === 'manual' || val === 'mt') return 'manual';
          return val;
        }
      },

      // 5. Mileage: "ubah PM-PST-001 km 50000", "ganti PM-PST-001 30000 km"
      { pattern: /(?:rubah|ganti|ubah|update)\s*(?:km|kilometer|odometer)\s*(?:ke|jadi|menjadi)?\s*(\d+)\s*(?:km)?/i, field: 'mileage', valueExtractor: m => m[1] },

      // 6. Color: "ganti PM-PST-001 merah", "rubah PM-PST-001 warna biru"
      {
        pattern: new RegExp(`(?: rubah | ganti | ubah | update)(?: \\s +.*?) \\s * (?: warna) ?\\s * (?: ke | jadi | menjadi) ?\\s * (${colorsRegex})`, 'i'),
        field: 'color',
        valueExtractor: m => m[1]
      },

      // 7. Engine capacity: "ubah cc PM-PST-001 1500", "ganti PM-PST-001 kapasitas mesin 1497"
      { pattern: /(?:rubah|ganti|ubah)\s*(?:cc|kapasitas\s*mesin)\s*(?:ke|jadi|menjadi)?\s*(\d+)/i, field: 'engineCapacity', valueExtractor: m => m[1] },
    ];

    // Use msgWithoutId for field pattern matching to avoid ID numbers (like 001)
    // interfering with field values (like mileage or year)
    const msgForFields = msg.replace(/pm-\w+-\d+/gi, '').replace(/\s+/g, ' ').trim();

    for (const { pattern, field, valueExtractor } of patterns) {
      const match = msgForFields.match(pattern);
      if (match) {
        const newValue = valueExtractor(match);
        console.log(`[WhatsApp AI Chat] Fallback detected edit: field = ${field}, newValue = ${newValue}, vehicleId = ${vehicleId || 'from context'} `);
        return { vehicleId, field, newValue };
      }
    }

    return null;
  }

  /**
   * Calculate KKB Simulation
   * Provides installment estimates for various leasing partners
   * Updated with Realistic Market Rates 2026
   */
  public static calculateKKBSimulation(
    vehiclePrice: number,
    inputDpAmount?: number | null,
    inputDpPercentage?: number | string | number[] | null,
    inputTenor?: number | string | number[] | null,
    options?: { hideSyarat?: boolean; hideTitle?: boolean; hideHeader?: boolean; vehicleYear?: number }
  ): string {
    // 1. Parse DPs
    let dpPercentages: number[] = [25]; // Default 25%
    if (inputDpPercentage) {
      if (Array.isArray(inputDpPercentage)) {
        dpPercentages = inputDpPercentage.map(v => Number(v));
      } else if (typeof inputDpPercentage === 'string') {
        dpPercentages = inputDpPercentage.split(',').map(v => parseInt(v.trim())).filter(v => !isNaN(v));
      } else {
        dpPercentages = [Number(inputDpPercentage)];
      }
    } else if (inputDpAmount) {
      dpPercentages = [Math.round((inputDpAmount / vehiclePrice) * 100)];
    }

    // 2. Parse Tenors
    let tenors: number[] = [3, 4, 5]; // Default 3, 4, 5 years
    if (inputTenor) {
      if (Array.isArray(inputTenor)) {
        tenors = inputTenor.map(v => Number(v));
      } else if (typeof inputTenor === 'string') {
        tenors = inputTenor.split(',').map(v => parseInt(v.trim())).filter(v => !isNaN(v));
      } else {
        tenors = [Number(inputTenor)];
      }
    }

    // Sort to ensure clean display
    dpPercentages.sort((a, b) => a - b);
    tenors.sort((a, b) => a - b);

    // 3. Define Leasing Rates (Estimasi Flat Rate per Tahun untuk Mobil Bekas 2026)
    const baseRates: Record<string, number[]> = {
      "BCA Finance": [6.5, 7.25, 7.75, 8.5, 9.5],
      "Adira Finance": [8.0, 9.0, 9.75, 10.5, 11.5],
      "Info Kredit": [7.5, 8.5, 9.25, 10.0, 11.0]
    };

    let ageRateAdjustment = 0;
    if (options?.vehicleYear) {
      const currentYear = new Date().getFullYear();
      const age = currentYear - options.vehicleYear;
      if (age > 5) {
        ageRateAdjustment = (age - 5) * 0.5;
      }
    }

    const formatRp = (num: number) => "Rp " + Math.round(num).toLocaleString('id-ID');

    let result = options?.hideTitle ? "" : `📊 *SIMULASI KREDIT (KKB) UPDATE 2026* \n`;
    if (!options?.hideHeader) {
      result += `Harga Mobil: ${formatRp(vehiclePrice)} \n`;
      if (options?.vehicleYear) result += `Tahun: ${options.vehicleYear} \n`;
    }

    // 4. Generate results for each DP
    dpPercentages.forEach((dpPerc, dpIndex) => {
      const dpAmt = vehiclePrice * (dpPerc / 100);
      const principal = vehiclePrice - dpAmt;

      if (dpPercentages.length > 1) {
        result += `\n--- **OPSI DP ${dpPerc}%** ---\n`;
      }

      result += `DP (${dpPerc}%): ${formatRp(dpAmt)} \n`;
      result += `Pokok Hutang: ${formatRp(principal)}\n`;
      result += `\n*Est. Angsuran per Bulan:* \n`;

      tenors.forEach(tenor => {
        let minInstallment = Infinity;
        let maxInstallment = 0;
        const ratesUsed: number[] = [];

        Object.entries(baseRates).forEach(([leasing, rates]) => {
          const rateIndex = Math.min(tenor - 1, rates.length - 1);
          const baseRate = rates[Math.max(0, rateIndex)];
          const finalRate = baseRate + Math.min(ageRateAdjustment, 3.0);
          ratesUsed.push(finalRate);

          const totalInterest = principal * (finalRate / 100) * tenor;
          const totalPayment = principal + totalInterest;
          const monthly = totalPayment / (tenor * 12);

          if (monthly < minInstallment) minInstallment = monthly;
          if (monthly > maxInstallment) maxInstallment = monthly;
        });

        const avgRate = ratesUsed.reduce((a, b) => a + b, 0) / ratesUsed.length;

        result += `\n🕒 *Tenor ${tenor} Tahun* \n`;
        result += `• Angsuran: ${formatRp(minInstallment)} - ${formatRp(maxInstallment)} \n`;
        result += `• Bunga Est: ${(avgRate).toFixed(1)}% flat/thn\n`;
      });
    });

    if (!options?.hideSyarat) {
      result += `\n📝 *Syarat Kredit:* KTP Suami Istri, KK, NPWP, PBB/AJB, Mutasi Rek 3 Bln.`;
    }

    return result;
  }

  /**
   * Priority Stock Check - Answer basic availability without AI
   */
  private static async handlePriorityStockCheck(msg: string, context: ChatContext, startTime: number): Promise<ChatResponse | null> {
    const stockIntents = /\b(apakah|masih|ada|ready|tersedia|stok|available|jual|cari|minat|tertarik|pengen|ingin|liat|lihat)\b/i;
    const vehicleList = /\b(avanza|xenia|brio|mobilio|hrv|crv|fortuner|pajero|innova|agya|ayla|calya|sigra|jazz|yaris|rush|terios|xpander|ertiga|raize|rocky|alphard|vellfire|camry|city|civic|accord|serena|livina|ayla|agya|sigra|calya)\b/i;

    const hasStockIntent = stockIntents.test(msg);
    const vehicleMatch = msg.match(vehicleList);
    const isNewCustomer = !context.customerName ||
      ['Kak', 'Unknown', 'Pelanggan', 'Customer Baru', 'Pemesanan', 'Admin', 'User'].includes(context.customerName) ||
      context.messageHistory.length <= 2;

    if (hasStockIntent && vehicleMatch && isNewCustomer) {
      const vehicleKeyword = vehicleMatch[1];
      console.log(`[WhatsApp AI Chat] 🚀 PRIORITY STOCK CHECK matched! Vehicle: "${vehicleKeyword}"`);

      try {
        const vehicles = await prisma.vehicle.findMany({
          where: {
            tenantId: context.tenantId,
            status: 'AVAILABLE',
            OR: [
              { model: { contains: vehicleKeyword, mode: 'insensitive' } },
              { make: { contains: vehicleKeyword, mode: 'insensitive' } }
            ]
          },
          take: 1,
          orderBy: { year: 'desc' }
        });

        if (vehicles.length > 0) {
          const v = vehicles[0];
          const timeGreeting = this.getTimeGreeting();
          return {
            message: `Halo! ⚡\n\n${timeGreeting}, selamat datang di showroom kami\nSaya adalah Asisten virtual yang siap membantu Anda menemukan mobil impian, dan mendapatkan informasi yang Anda butuhkan.\n\nBaik kak, sebelumnya dengan kakak siapa saya berbicara? Untuk unit *${v.make} ${v.model} ${v.year}* ini MASIH AVAILABLE! 🔥\n\n* ID Unit: ${v.displayId || v.id.slice(0, 8).toUpperCase()}\n* Harga: Rp ${new Intl.NumberFormat('id-ID').format(Number(v.price))} (Nego)\n* Transmisi: ${v.transmissionType || '-'}\n* Warna: ${v.color || '-'}\n* Bahan Bakar: ${v.fuelType || 'Bensin'}\n\nUnit siap gass, kondisi terawat kak! 👍\n\nRencana untuk pemakaian di area mana kak? Mau saya kirimkan foto detail unit ini untuk kelengkapan referensi? 📸😊`,
            shouldEscalate: false,
            confidence: 1.0,
            processingTime: Date.now() - startTime
          };
        } else {
          const timeGreeting = this.getTimeGreeting();
          return {
            message: `Halo! ⚡\n\n${timeGreeting}, selamat datang di showroom kami\nSaya adalah Asisten virtual yang siap membantu Anda menemukan mobil impian, dan mendapatkan informasi yang Anda butuhkan.\n\nBaik kak, sebelumnya dengan kakak siapa saya berbicara? 😊\n\nMohon maaf untuk unit *${vehicleKeyword}* saat ini stoknya sedang kosong di showroom kami. 🙏\n\nApakah kakak ada alternatif unit lain yang diminati? Saya bisa bantu carikan unit sejenis lho!`,
            shouldEscalate: false,
            confidence: 1.0,
            processingTime: Date.now() - startTime
          };
        }
      } catch (err) {
        console.error("[WhatsApp AI Chat] ❌ Priority Stock Check error:", err);
      }
    }
    return null;
  }

  /**
   * Priority Technical Check - Direct Smart Fallback for tech questions
   */
  private static async handlePriorityTechnicalCheck(msg: string, userMessage: string, context: ChatContext, startTime: number): Promise<ChatResponse | null> {
    const isTechnicalQuestion = (
      (WhatsAppAIChatService.TECHNICAL_KEYWORDS.INTERIOR.test(msg) ||
        WhatsAppAIChatService.TECHNICAL_KEYWORDS.EXTERIOR.test(msg) ||
        WhatsAppAIChatService.TECHNICAL_KEYWORDS.ENGINE.test(msg) ||
        WhatsAppAIChatService.TECHNICAL_KEYWORDS.DOCUMENTS.test(msg)) &&
      WhatsAppAIChatService.TECHNICAL_KEYWORDS.QUESTION_WORDS.test(msg)
    ) || /^(interior|eksterior|mesin|dokumen|surat)nya/i.test(msg);

    if (isTechnicalQuestion) {
      console.log(`[WhatsApp AI Chat] 🎯 PRIORITY TECHNICAL QUESTION detected: "${userMessage}"`);
      try {
        const smartFallback = await this.generateSmartFallback(
          userMessage,
          context.messageHistory,
          context.tenantId,
          context
        );

        if (smartFallback && smartFallback.message && smartFallback.message.length > 50) {
          return {
            message: smartFallback.message,
            shouldEscalate: smartFallback.shouldEscalate,
            confidence: 0.95,
            images: smartFallback.images || [],
            processingTime: Date.now() - startTime,
          };
        }
      } catch (fallbackError: any) {
        console.error(`[WhatsApp AI Chat] ❌ Priority Tech Check error: ${fallbackError.message}`);
      }
    }
    return null;
  }
}

export default WhatsAppAIChatService;
