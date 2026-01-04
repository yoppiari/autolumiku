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
    firstName?: string;
    lastName?: string;
    name?: string; // Legacy support
    role?: string;
    roleLevel?: number;
    phone?: string;
    userId?: string;
  };
  isEscalated?: boolean; // Escalated conversations get faster, more direct responses
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
            welcomeMessage: `{greeting}! Halo, terima kasih sudah menghubungi kami. Lagi cari mobil apa nih? Bisa sebutkan merk, budget, atau kebutuhannya ya!`,
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
        console.log(`[WhatsApp AI Chat] Customer chat is DISABLED. Sending fallback message.`);
        return {
          message: `Halo! 👋\n\nTerima kasih sudah menghubungi ${account.tenant.name}.\n\nTim kami akan segera membalas pesan Anda.\nMohon menunggu sebentar ya 🙏`,
          shouldEscalate: true,
          confidence: 1.0,
          processingTime: Date.now() - startTime,
        };
      }
      console.log(`[WhatsApp AI Chat] Customer chat is ENABLED. Proceeding with AI response.`);

      // Check business hours (optional) - STAFF BYPASS business hours check
      const isStaff = context.isStaff || false;
      const shouldCheckHours = config.businessHours && config.afterHoursMessage && !isStaff;
      if (shouldCheckHours && !this.isWithinBusinessHours(config.businessHours, config.timezone)) {
        console.log(`[WhatsApp AI Chat] Outside business hours, returning after-hours message`);
        return {
          message: config.afterHoursMessage || "Kami sedang tutup. Silakan hubungi lagi pada jam operasional.",
          shouldEscalate: false,
          confidence: 1.0,
          processingTime: Date.now() - startTime,
        };
      }

      if (isStaff) {
        console.log(`[WhatsApp AI Chat] ✅ Staff detected - bypassing business hours check`);
      }

      // ==================== PRE-AI PHOTO CONFIRMATION HANDLER ====================
      // Handle photo confirmations BEFORE calling AI to avoid AI failures breaking the flow
      const photoConfirmResult = await this.handlePhotoConfirmationDirectly(
        userMessage,
        context.messageHistory,
        context.tenantId
      );
      if (photoConfirmResult) {
        console.log(`[WhatsApp AI Chat] ✅ Photo confirmation handled directly - bypassing AI`);
        return {
          ...photoConfirmResult,
          processingTime: Date.now() - startTime,
        };
      }

      // Build system prompt with sender info
      console.log(`[WhatsApp AI Chat] Building system prompt for tenant: ${account.tenant.name}`);
      const senderInfo = {
        isStaff: context.isStaff || false,
        staffInfo: context.staffInfo,
        customerPhone: context.customerPhone,
        isEscalated: context.isEscalated || false,
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
      const tenantName = account.tenant.name || "Showroom";
      try {
        // Add a race condition with manual timeout (60s max for better UX)
        const apiCallPromise = zaiClient.generateText({
          systemPrompt,
          userPrompt: conversationContext,
          temperature: 0.3, // Low temperature for consistent, factual responses
        });

        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(new Error('ZAI API call timed out after 60 seconds'));
          }, 60000); // 30 second timeout - faster feedback for customers
        });

        aiResponse = await Promise.race([apiCallPromise, timeoutPromise]);

        // Trim leading/trailing whitespace from AI response
        if (aiResponse.content) {
          aiResponse.content = aiResponse.content.trim();
        }

        console.log(`[WhatsApp AI Chat] ✅ AI response received successfully`);
        console.log(`[WhatsApp AI Chat] Content length:`, aiResponse.content?.length || 0);

        // If content is empty, use smart fallback with tenant name
        if (!aiResponse.content || aiResponse.content.length === 0) {
          console.log(`[WhatsApp AI Chat] ⚠️ Content empty, using smart fallback...`);
          // Generate contextual fallback based on user message
          const fallbackResult = await this.generateSmartFallback(
            userMessage,
            context.messageHistory,
            context.tenantId,
            context
          );
          aiResponse = {
            ...aiResponse,
            content: fallbackResult.message,
          };
        }

        console.log(`[WhatsApp AI Chat] Response content (first 100 chars): ${aiResponse.content.substring(0, 100)}...`);
      } catch (apiError: any) {
        console.error(`[WhatsApp AI Chat] ❌ ZAI API call failed:`);
        console.error(`[WhatsApp AI Chat] API Error name:`, apiError.name);
        console.error(`[WhatsApp AI Chat] API Error message:`, apiError.message);
        throw apiError;
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

      // 2. Initial Greeting Check (First message in conversation)
      if (context.messageHistory.length <= 2 && responseMessage.length > 0) {
        // Get time-based greeting for Indonesian context
        const now = new Date();
        const wibTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
        const hour = wibTime.getHours();
        let timeGreeting = "Selamat malam";
        if (hour >= 4 && hour < 11) timeGreeting = "Selamat pagi";
        else if (hour >= 11 && hour < 15) timeGreeting = "Selamat siang";
        else if (hour >= 15 && hour < 18) timeGreeting = "Selamat sore";

        // Prepend time greeting if not already there
        if (!responseMessage.toLowerCase().includes(timeGreeting.toLowerCase())) {
          responseMessage = `${timeGreeting}! 👋\n\n${responseMessage}`;
        }
      }

      // 3. CRITICAL PRICE VALIDATION - Catch absurd prices before sending to customer
      // This prevents the "1 jt" and "5 jt" error that should NEVER happen
      const pricePattern = /\bRp\s*(\d+(?:\.\d+)?)\s*(jt|juta)\b/gi;
      const priceMatches = responseMessage.matchAll(pricePattern);
      let hasSuspiciousPrice = false;

      for (const match of priceMatches) {
        const priceValue = parseFloat(match[1]);

        // Flag suspicious prices (less than 10 juta for regular cars)
        if (priceValue < 10) {
          hasSuspiciousPrice = true;
          console.error(`[WhatsApp AI Chat] ❌❌❌ CRITICAL ERROR: Suspicious price detected: "Rp ${priceValue} ${match[2]}"`);
          console.error(`[WhatsApp AI Chat] This is likely a formatting error. Original response: ${responseMessage.substring(0, 200)}`);
        }
      }

      // If suspicious prices detected, warn and sanitize
      if (hasSuspiciousPrice) {
        console.error(`[WhatsApp AI Chat] 🚨 PRICE VALIDATION FAILED! Replacing response with safe fallback.`);

        // Try to get actual vehicle data from context
        const vehicles = await this.getAvailableVehiclesDetailed(context.tenantId);

        if (vehicles.length > 0) {
          const vehicleList = vehicles.slice(0, 3).map(v => {
            const priceJuta = Math.round(Number(v.price) / 1000000);
            return `• ${v.make} ${v.model} ${v.year} - Rp ${priceJuta} juta`;
          }).join('\n');

          responseMessage = `Hmm, bisa diperjelas kebutuhannya? 🤔\n\nIni beberapa unit ready di ${tenantName}:\n${vehicleList}\n\nAtau sebutkan merk/budget yang dicari ya! 😊`;
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

                // Add search results to the response message with FULL DETAILS
                // Format must match system prompt: pipe separator with all vehicle details
                if (!responseMessage.includes(searchResults[0].make)) {
                  let searchResultText = `\n\nDitemukan ${searchResults.length} mobil yang cocok:\n\n`;

                  searchResults.slice(0, 5).forEach(v => {
                    const priceJuta = Math.round(Number(v.price) / 1000000);
                    const id = v.displayId || v.id.substring(0, 6).toUpperCase();
                    const transmission = v.transmissionType || '-';
                    const fuel = v.fuelType || '-';
                    const color = v.color || '-';
                    const km = v.mileage ? v.mileage.toLocaleString('id-ID') : '-';

                    // Format: 🚗 [Make] [Model] [Variant] [Transmission] [Year] | [ID]
                    const variant = v.variant ? ` ${v.variant}` : '';
                    searchResultText += `🚗 ${v.make} ${v.model}${variant} ${transmission} ${v.year} | ${id}\n`;
                    searchResultText += `* Harga: Rp ${priceJuta} juta\n`;
                    searchResultText += `* Kilometer: ${km} km\n`;
                    searchResultText += `* Transmisi: ${transmission}\n`;
                    searchResultText += `* Bahan bakar: ${fuel}\n`;
                    searchResultText += `* Warna: ${color}\n`;

                    // Add website link
                    const modelSlug = v.model.toLowerCase().replace(/\s+/g, '-');
                    const makeSlug = v.make.toLowerCase();
                    searchResultText += `* 🎯 Website: https://primamobil.id/vehicles/${makeSlug}-${modelSlug}-${v.year}-${id}\n\n`;
                  });

                  if (searchResults.length > 5) {
                    searchResultText += `...dan ${searchResults.length - 5} unit lainnya.\n\n`;
                  }

                  searchResultText += `Mau lihat fotonya? 📸 (silahkan berikan respon: mau/ boleh/ silahkan/ baik kirim/ iya kirim/ kirimkan/ iya boleh)\n\n`;
                  searchResultText += `Apakah ada hal lain yang bisa kami bantu? 😊`;

                  responseMessage += searchResultText;
                }
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

      // Build final response message
      // (responseMessage already has the content from AI or post-processing)

      // FALLBACK: If AI responded with edit intent text but didn't call the tool, parse it manually
      if (!editRequest && context.isStaff && responseMessage) {
        const editFallback = this.detectEditIntentFromText(responseMessage, userMessage);
        if (editFallback) {
          console.log('[WhatsApp AI Chat] ⚠️ FALLBACK: AI responded with text but no tool call, parsing manually:', editFallback);
          editRequest = editFallback;
          responseMessage = ''; // Clear the text response, let orchestrator handle the edit
        }
      }

      // If AI sent images but no text, add default message
      if (images && images.length > 0 && !responseMessage) {
        responseMessage = `Siap! Ini foto ${images.length > 1 ? 'mobil-mobilnya' : 'mobilnya'} ya 📸👇`;
        console.log('[WhatsApp AI Chat] Added default image message:', responseMessage);
      }

      // If images requested but none found, add helpful message
      if (aiResponse.toolCalls?.some(tc =>
        tc.type === 'function' && 'function' in tc && tc.function.name === 'send_vehicle_images'
      ) && (!images || images.length === 0)) {
        responseMessage = responseMessage || 'Wah, maaf ya foto mobilnya belum tersedia saat ini 🙏 Ada yang lain yang bisa dibantu? 😊';
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

    // Get tenant info
    let tenantName = "kami";
    try {
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { name: true }
      });
      if (tenant) tenantName = tenant.name;
    } catch (e) { /* ignore */ }

    // Get available vehicles for context
    let vehicles: any[] = [];
    try {
      vehicles = await prisma.vehicle.findMany({
        where: { tenantId, status: "AVAILABLE" },
        select: { make: true, model: true, year: true, price: true, mileage: true, transmissionType: true, color: true },
        take: 10,
      });
    } catch (e) { /* ignore */ }

    // ==================== GREETING HANDLER (OPENING GREETING) ====================
    // Detect greeting patterns for new conversations
    const greetingPatterns = [
      /^(halo|hai|hello|hi|hey)$/i,
      /^(pagi|siang|sore|malam)$/i,
      /^selamat\s+(pagi|siang|sore|malam)/i,
      /^(assalamualaikum|assalamu'?alaikum)/i,
      /^(halo|hai|hi)\s+(kak|mas|mbak|pak|bu)/i,
      /^(permisi|maaf)\s*(ganggu)?/i,
    ];
    const isGreeting = greetingPatterns.some(p => p.test(msg));
    const isNewConversation = messageHistory.length <= 2;

    // Check if it looks like a greeting (short message, starts with greeting word)
    const looksLikeGreeting = msg.length < 20 && /^(halo|hai|hi|pagi|siang|sore|malam|selamat|assalam)/i.test(msg);

    if (isGreeting || (isNewConversation && looksLikeGreeting)) {
      console.log(`[SmartFallback] 👋 Greeting detected: "${msg}" - sending warm welcome`);

      // Get time-based greeting
      const now = new Date();
      const wibTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
      const hour = wibTime.getHours();
      let timeGreeting = "Selamat pagi";
      if (hour >= 11 && hour < 15) timeGreeting = "Selamat siang";
      else if (hour >= 15 && hour < 18) timeGreeting = "Selamat sore";
      else if (hour >= 18 || hour < 4) timeGreeting = "Selamat malam";

      // Build vehicle preview
      let vehiclePreview = "";
      if (vehicles.length > 0) {
        const topVehicles = vehicles.slice(0, 3);
        vehiclePreview = "\n\n🚗 *Beberapa pilihan mobil kami:*\n";
        for (const v of topVehicles) {
          const priceJuta = Math.round(v.price / 1000000);
          vehiclePreview += `• ${v.make} ${v.model} ${v.year} - Rp ${priceJuta} Juta\n`;
        }
        vehiclePreview += `\n_Ketik nama mobil untuk info lebih lengkap!_`;
      }

      // Check if user is identified (staff/admin/owner)
      let personalizedGreeting = "";
      if (context && context.staffInfo && (context.staffInfo.firstName || context.staffInfo.name)) {
        const userName = context.staffInfo.firstName || context.staffInfo.name;
        const userRole = context.staffInfo.role || '';
        const roleLabel = userRole.toUpperCase() === 'OWNER' ? 'Owner' :
          userRole.toUpperCase() === 'ADMIN' ? 'Admin' :
            userRole.toUpperCase() === 'SUPER_ADMIN' ? 'Super Admin' :
              userRole.toUpperCase() === 'SALES' ? 'Sales' : 'Staff';

        console.log(`[SmartFallback] 👤 Personalized greeting for ${userName} (${roleLabel})`);

        personalizedGreeting = `${timeGreeting}, ${userName}! 👋\n\n`;
        personalizedGreeting += `Selamat datang kembali di ${tenantName}!\n`;
        personalizedGreeting += `Saya mengenali Anda sebagai ${roleLabel} Prima Mobil. `;
        personalizedGreeting += `Ada yang bisa saya bantu hari ini?${vehiclePreview}`;
      } else {
        // Generic greeting for unidentified users
        personalizedGreeting = `${timeGreeting}! 👋\n\n`;
        personalizedGreeting += `Halo, selamat datang di ${tenantName}!\n\n`;
        personalizedGreeting += `Saya adalah Asisten virtual yang siap membantu Anda menemukan mobil impian dan mendapatkan informasi yang Anda butuhkan.\n\n`;
        personalizedGreeting += `Ada yang bisa kami bantu?${vehiclePreview}`;
      }

      return {
        message: personalizedGreeting + "\n\nApakah ada hal lain yang bisa kami bantu? 😊",
        shouldEscalate: false,
      };
    }

    // ==================== FAMILY/MPV RECOMMENDATION HANDLER ====================
    // Detect family size and recommend appropriate vehicles
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

      // Filter for MPV/7-seater vehicles within budget
      const mpvVehicles = vehicles.filter(v => {
        const price = Number(v.price);
        const isMPV = [
          'Innova', 'Avanza', 'Xenia', 'Ertiga', 'Xpander', 'Rush', 'Terios',
          'Grand Livina', 'Livina', 'Spin', 'Apv', 'Luxio',
          'Pregio', 'Travello', 'Elf'
        ].some(model => v.model.includes(model) || v.make.includes(model));

        return isMPV && price <= budget * 1.3; // Allow 30% over budget
      });

      if (mpvVehicles.length > 0) {
        const list = mpvVehicles.slice(0, 3).map(v => {
          const priceJuta = Math.round(Number(v.price) / 1000000);
          return `• ${v.make} ${v.model} ${v.year} - Rp ${priceJuta} juta (MPV)`;
        }).join('\n');

        return {
          message: `Untuk keluarga dengan ${familySize} anak, rekomendasi saya MPV 7-seater ini cocok! 👨‍👩‍👧‍👦\n\n` +
            `Kenapa MPV?\n` +
            `• Kapasitas 7 penumpang, muat seluruh keluarga\n` +
            `• Bagasi luas untuk bawaan anak-anak\n` +
            `• Suspensi nyaman untuk perjalanan keluarga\n` +
            `• Hemat bahan bakar\n\n` +
            `Berikut pilihannya di budget sekitar Rp ${Math.round(budget / 1000000)} juta:\n\n${list}\n\n` +
            `Mau info detail yang mana? 😊`,
          shouldEscalate: false,
        };
      } else {
        return {
          message: `Untuk keluarga dengan ${familySize} anak, saya sarankan MPV 7-seater seperti Innova, Avanza, atau Xpander 👨‍👩‍👧‍👦\n\n` +
            `Sayangnya belum ada stok MPV saat ini 😔\n\n` +
            `Mau info jenis mobil lain yang ada? 😊`,
          shouldEscalate: false,
        };
      }
    }

    // ==================== APPRECIATION/ACKNOWLEDGMENT HANDLER ====================
    // Detect positive acknowledgment phrases (mantap, keren, bagus, etc.)
    // These should NOT be treated as photo requests!
    const appreciationPatterns = [
      /\b(mantap|mantab|mantul|keren|bagus|oke banget|ok banget|sip banget)\b/i,
      /\b(good|great|nice|cool|awesome|perfect)\b/i,
      /\b(makasih|terima\s*kasih|thanks|thank you)\b/i,
      /^(ok|oke|sip|siap)\s+(mantap|mantab|keren|bagus|banget|deh|ya)/i,
      /^mantap/i, // starts with mantap
      /^keren/i,  // starts with keren
      /^bagus/i,  // starts with bagus
    ];
    const isAppreciation = appreciationPatterns.some(p => p.test(msg));

    if (isAppreciation) {
      console.log(`[SmartFallback] ✅ Appreciation detected: "${msg}" - responding positively`);
      return {
        message: `Terima kasih! 🙏😊 Senang bisa membantu.\n\nAda yang lain yang bisa kami bantu? 🚗`,
        shouldEscalate: false,
      };
    }

    // ==================== STOP COMMAND ====================
    // Check if user wants to stop receiving photos
    const stopPatterns = [
      /^(stop|berhenti|cukup|udah|sudah|kagak|ndak|gak|nga)$/i,
      /\b(stop|berhenti|cukup|jangan)\s*(kirim|kasi|tunjuk|lagi|terus)\b/i,
      /\b(cukup|udah|sudah)\b.*(foto|gambar|itu)\b/i,
    ];
    const isStopCommand = stopPatterns.some(p => p.test(msg));

    if (isStopCommand) {
      console.log(`[SmartFallback] 🛑 Stop command detected: "${msg}"`);
      return {
        message: `Siap, saya stop! 👍\n\nAda yang lain bisa saya bantu? 😊`,
        shouldEscalate: false,
      };
    }

    // ==================== PHOTO CONFIRMATION HANDLER (CRITICAL FIX) ====================
    // Handle photo confirmations FIRST before other fallbacks
    // IMPORTANT: Check if photos were already sent recently to prevent spam
    const photoConfirmPatterns = [
      /^(boleh|ya|iya|mau|yup|bisa)$/i, // Removed "ok", "oke", "sip", "siap" as they can be appreciation
      /\b(iya|ya|ok|oke|mau|boleh)\b.*\b(foto|gambar)/i,
      /\b(mana|kirim|kasih|tunjuk|lihat)\b.*\b(foto|gambar)/i,
      /\bfoto\s*(nya|dong|ya|aja|mana)?\b/i,
      /\bgambar\s*(nya|dong|ya|aja|mana)?\b/i,
      /^mana\s/i, // "mana fotonya", "mana gambarnya"
    ];
    const isPhotoConfirmation = photoConfirmPatterns.some(p => p.test(msg));

    // Determine vehicle name from query or history first
    const vehiclePatterns = [
      /pm-[a-zA-Z0-9]+-\d+/i, // Unit IDs like PM-PST-001
      /(?:Toyota|Honda|Suzuki|Daihatsu|Mitsubishi|Nissan|Mazda|BMW|Mercedes|Hyundai|Kia|Wuling)\s+[\w\-]+(?:\s+[\w\-]+)?\s*(?:20\d{2}|19\d{2})?/gi,
      /\b(Innova\s*Reborn?|Fortuner|Pajero\s*Sport|Xpander|Rush|Terios|Ertiga|Avanza|Xenia|Brio|Jazz|Calya|Sigra|Ayla|Agya|HRV|CRV|BRV|Yaris|Camry|Alphard|City|Civic)\s*(?:20\d{2}|19\d{2})?\b/gi,
    ];

    let vehicleName = "";
    const lastAiMsg = messageHistory.filter(m => m.role === "assistant").pop();

    // Try to extract from current message
    for (const pattern of vehiclePatterns) {
      const match = msg.match(pattern);
      if (match && match[0]) {
        vehicleName = match[0].trim();
        break;
      }
    }

    // Try to extract from last AI message if not in current
    if (!vehicleName && lastAiMsg) {
      for (const pattern of vehiclePatterns) {
        const match = lastAiMsg.content.match(pattern);
        if (match && match[0]) {
          vehicleName = match[0].trim();
          break;
        }
      }
    }

    // Detect correction/objection keywords
    const correctionKeywords = ['bukan', 'salah', 'keliru', 'nggak', 'gak', 'bkn', 'kok', 'tadi', 'yang saya cari', 'yang saya maksud'];
    const isCorrection = (correctionKeywords.some(k => msg.includes(k)) && (msg.includes('kirim') || msg.includes('itu') || msg.includes('tadi'))) ||
      (msg.startsWith('kok ') || msg.startsWith('bukan '));

    if (isCorrection) {
      console.log(`[SmartFallback] ⚠️ Correction detected: "${msg}"`);
      return {
        message: `Waduh, mohon maaf Bapak/Ibu! 🙏 Sepertinya saya salah memberikan informasi tadi. \n\nBisa diinfokan kembali unit apa yang sedang Bapak/Ibu cari? Saya akan pastikan datanya benar kali ini. 😊`,
        shouldEscalate: true, // Escalate to human because AI made a mistake
      };
    }

    // Check if photos were already sent recently (last 3 messages) for THIS specific vehicle
    const recentPhotosSent = messageHistory
      .slice(-3)
      .filter(m => m.role === "assistant" &&
        m.content.includes("Ini foto") &&
        (vehicleName ? m.content.toLowerCase().includes(vehicleName.toLowerCase().split(' ')[0]) : true));

    if (recentPhotosSent.length > 0 && isPhotoConfirmation) {
      console.log(`[SmartFallback] ⚠️ Photos for ${vehicleName || 'vehicle'} already sent recently, skipping to prevent spam`);
      return {
        message: `Foto-foto unit ${vehicleName || ''} sudah saya kirimkan di atas ya Bapak/Ibu 😊\n\nApakah ada bagian detail lain yang ingin dilihat? Atau ada pertanyaan tentang unit ini?`,
        shouldEscalate: false,
      };
    }

    // Check if user explicitly asks for photos (contains "foto", "gambar", "mana fotonya" etc)
    const userExplicitlyAsksPhoto = msg.includes("foto") || msg.includes("gambar") ||
      /mana.*(foto|gambar)/i.test(msg) ||
      msg.startsWith("mana ");

    console.log(`[SmartFallback] Photo check: msg="${msg}", isPhotoConfirmation=${isPhotoConfirmation}, explicit=${userExplicitlyAsksPhoto}`);

    if (isPhotoConfirmation || userExplicitlyAsksPhoto) {
      console.log(`[SmartFallback] 📸 Photo request detected: "${userMessage}"`);

      // Get the last AI message
      const lastAiMsg = messageHistory.filter(m => m.role === "assistant").pop();

      // Extract vehicle from AI message or conversation history
      const vehiclePatterns = [
        /(?:Toyota|Honda|Suzuki|Daihatsu|Mitsubishi|Nissan|Mazda|BMW|Mercedes|Hyundai|Kia|Wuling)\s+[\w\-]+(?:\s+[\w\-]+)?\s*(?:20\d{2}|19\d{2})?/gi,
        /\b(Innova\s*Reborn?|Fortuner|Pajero\s*Sport|Xpander|Rush|Terios|Ertiga|Avanza|Xenia|Brio|Jazz|Calya|Sigra|Ayla|Agya|HRV|CRV|BRV|Yaris|Camry|Alphard|City|Civic)\s*(?:20\d{2}|19\d{2})?\b/gi,
      ];

      // vehicleName is already extracted above

      // Check if user is asking for DETAILED photos
      const detailPatterns = [
        /\b(detail|lengkap|semua|all)\b/i,
        /\b(interior|eksterior|dalam|luar)\b/i,
        /\b(dashboard|jok|bagasi|mesin)\b/i,
        /\bfoto.*(semua|lengkap|detail)\b/i,
        /\b(semua|lengkap).*(foto|gambar)\b/i,
      ];
      const wantsDetailedPhotos = detailPatterns.some(p => p.test(msg));
      console.log(`[SmartFallback] Wants detailed photos: ${wantsDetailedPhotos}`);

      // Try to fetch photos
      try {
        if (vehicleName) {
          // If user wants detailed photos, fetch with full details
          if (wantsDetailedPhotos) {
            console.log(`[SmartFallback] 📋 Fetching DETAILED vehicle info for: "${vehicleName}"`);
            const vehicleWithDetails = await this.fetchVehicleWithDetails(vehicleName, tenantId);
            if (vehicleWithDetails && vehicleWithDetails.images.length > 0) {
              console.log(`[SmartFallback] ✅ Found ${vehicleWithDetails.images.length} images with DETAILS!`);
              const detailedMessage = this.buildVehicleDetailMessage(vehicleWithDetails.vehicle);
              return {
                message: detailedMessage,
                shouldEscalate: false,
                images: vehicleWithDetails.images,
              };
            }
          }

          // Regular photo request
          console.log(`[SmartFallback] 🚗 Trying to fetch images for: "${vehicleName}"`);
          const images = await this.fetchVehicleImagesByQuery(vehicleName, tenantId);
          if (images && images.length > 0) {
            console.log(`[SmartFallback] ✅ Found ${images.length} images!`);
            return {
              message: `Siap! Ini foto ${vehicleName}-nya ya 📸👇\n\nAda pertanyaan lain tentang unit ini? 😊`,
              shouldEscalate: false,
              images,
            };
          }
        }

        // No specific vehicle or no images - try ANY available vehicles
        console.log(`[SmartFallback] 🔄 Trying to fetch any available vehicle photos...`);
        const anyVehicles = await prisma.vehicle.findMany({
          where: { tenantId, status: 'AVAILABLE' },
          include: {
            photos: { orderBy: { isMainPhoto: 'desc' }, take: 1 },
          },
          orderBy: { createdAt: 'desc' },
          take: 3,
        });

        console.log(`[SmartFallback] Found ${anyVehicles.length} vehicles, checking photos...`);

        if (anyVehicles.length > 0) {
          const vehiclesWithPhotos = anyVehicles.filter(v => v.photos && v.photos.length > 0);
          console.log(`[SmartFallback] Vehicles with photos: ${vehiclesWithPhotos.length}`);

          if (vehiclesWithPhotos.length > 0) {
            const images = this.buildImageArray(vehiclesWithPhotos);
            if (images && images.length > 0) {
              const label = vehicleName ? `${vehicleName}` : "unit terbaru kami";
              return {
                message: `Ini foto ${label} ya 📸👇\n\nMau info detail yang mana? 😊`,
                shouldEscalate: false,
                images,
              };
            }
          }

          // Vehicles exist but NO photos at all
          const vehicleList = anyVehicles.slice(0, 3).map(v => `• ${v.make} ${v.model} ${v.year}`).join('\n');
          console.log(`[SmartFallback] ⚠️ No photos available, returning vehicle list`);
          return {
            message: `Maaf, foto belum tersedia saat ini 🙏\n\nTapi ada unit ready nih:\n${vehicleList}\n\nMau info detail yang mana? 😊`,
            shouldEscalate: false,
          };
        }
      } catch (photoError) {
        console.error(`[SmartFallback] Error in photo handling:`, photoError);
      }

      // FINAL FALLBACK: User asked for photos but we couldn't get any
      // NEVER fall through to generic response!
      console.log(`[SmartFallback] ⚠️ Final fallback for photo request`);
      if (vehicles.length > 0) {
        const vehicleList = vehicles.slice(0, 3).map(v => `• ${v.make} ${v.model} ${v.year}`).join('\n');
        return {
          message: `Maaf, sedang ada kendala menampilkan foto 🙏\n\nUnit yang tersedia:\n${vehicleList}\n\nMau info detail yang mana? 😊`,
          shouldEscalate: false,
        };
      }
      return {
        message: `Maaf, sedang ada kendala teknis untuk menampilkan foto 🙏\n\nSilakan coba lagi atau tanyakan info unit yang tersedia ya! 😊`,
        shouldEscalate: false,
      };
    }
    // ==================== END PHOTO CONFIRMATION HANDLER ====================

    // Pattern matching for user intent
    const vehicleBrands = ['toyota', 'honda', 'suzuki', 'daihatsu', 'mitsubishi', 'nissan', 'mazda', 'bmw', 'mercedes', 'hyundai', 'kia', 'wuling'];
    const vehicleModels = ['innova', 'avanza', 'xenia', 'brio', 'jazz', 'ertiga', 'rush', 'terios', 'fortuner', 'pajero', 'alphard', 'civic', 'crv', 'hrv', 'yaris', 'camry', 'calya', 'sigra', 'xpander'];

    // Check if asking about specific vehicle
    const mentionedBrand = vehicleBrands.find(b => msg.includes(b));
    const mentionedModel = vehicleModels.find(m => msg.includes(m));

    if (mentionedBrand || mentionedModel) {
      // User asking about specific vehicle - try to find it
      const searchTerm = mentionedModel || mentionedBrand || "";
      const matchingVehicle = vehicles.find(v =>
        v.make.toLowerCase().includes(searchTerm) ||
        v.model.toLowerCase().includes(searchTerm)
      );

      if (matchingVehicle) {
        const price = Number(matchingVehicle.price).toLocaleString('id-ID'); // Fix: Remove / 100 division
        const response = `Ada nih ${matchingVehicle.make} ${matchingVehicle.model} ${matchingVehicle.year}! 🚗✨\n\n` +
          `💰 Harga: Rp ${price}\n` +
          `⚙️ Transmisi: ${matchingVehicle.transmissionType || 'Manual'}\n` +
          `${matchingVehicle.mileage ? `📊 Kilometer: ${matchingVehicle.mileage.toLocaleString('id-ID')} km\n` : ''}` +
          `🎨 Warna: ${matchingVehicle.color || '-'}\n\n` +
          `Mau lihat fotonya? 📸`;

        return { message: response, shouldEscalate: false };
      } else {
        return {
          message: `Wah, maaf ya ${searchTerm.charAt(0).toUpperCase() + searchTerm.slice(1)} belum tersedia saat ini 🙏\n\n` +
            `Tapi ada pilihan lain nih 🚗✨\n${vehicles.slice(0, 3).map(v => `• ${v.make} ${v.model} ${v.year}`).join('\n')}\n\n` +
            `Mau info yang mana? 😊`,
          shouldEscalate: false,
        };
      }
    }

    // Check if asking about price/budget
    const priceMatch = msg.match(/(\d+)\s*(jt|juta|rb|ribu)/i);
    if (priceMatch || msg.includes('harga') || msg.includes('budget') || msg.includes('murah')) {
      const budget = priceMatch ? parseInt(priceMatch[1]) * (priceMatch[2].toLowerCase().includes('jt') || priceMatch[2].toLowerCase().includes('juta') ? 1000000 : 1000) : 0;

      let relevantVehicles = vehicles;
      if (budget > 0) {
        // Fix: Price is already in Rupiah, no division needed
        relevantVehicles = vehicles.filter(v => Number(v.price) <= budget * 1.2);
      }

      if (relevantVehicles.length > 0) {
        const list = relevantVehicles.slice(0, 3).map(v => {
          // Fix: Price is already in Rupiah, convert to juta for display
          const priceJuta = Math.round(Number(v.price) / 1000000);
          return `• ${v.make} ${v.model} ${v.year} - Rp ${priceJuta} juta`;
        }).join('\n');

        return {
          message: `Ada beberapa pilihan ${budget > 0 ? `di budget Rp ${budget / 1000000} juta` : ''} nih! 💰✨\n\n${list}\n\nMau info detail yang mana? 😊`,
          shouldEscalate: false,
        };
      }
    }

    // Check if greeting
    if (/^(halo|hai|hello|hi|sore|pagi|siang|malam|selamat)/i.test(msg)) {
      // Be honest about inventory status
      if (vehicles.length === 0) {
        return {
          message: `Halo! Terima kasih sudah menghubungi ${tenantName}.\n\n` +
            `Mohon maaf, saat ini stok kami sedang kosong. 🙏\n\n` +
            `Bisa leave kontak kamu? Nanti kami kabari kalau sudah ada unit baru yang ready. 😊`,
          shouldEscalate: false,
        };
      }
      return {
        message: `Halo! Terima kasih sudah menghubungi ${tenantName}.\n\n` +
          `Saat ini ada ${vehicles.length} unit mobil ready stock. Lagi cari mobil apa nih? Bisa sebutkan merk, budget, atau kebutuhannya ya!`,
        shouldEscalate: false,
      };
    }

    // Check if complaint/frustration
    if (/kaku|nyebelin|ga (jelas|responsif|bisa)|muter|bingung|kesal|males/i.test(msg)) {
      return {
        message: `Waduh, maaf banget ya atas ketidaknyamanannya 🙏😔\n\n` +
          `Coba langsung aja sebutin kebutuhannya, misal:\n` +
          `• "Cari Avanza budget 150 juta"\n` +
          `• "Ada Innova matic?"\n` +
          `• "Mobil keluarga 7 seater"\n\n` +
          `Pasti kami bantu carikan! 💪😊`,
        shouldEscalate: false,
      };
    }

    // Check if wants to leave/cancel
    if (/ga jadi|cancel|batal|pergi|showroom lain|bye|dadah/i.test(msg)) {
      return {
        message: `Baik, terima kasih sudah mampir ke ${tenantName}! 🙏✨\n` +
          `Semoga ketemu mobil impiannya ya. Sampai jumpa! 👋😊`,
        shouldEscalate: false,
      };
    }

    // Default: Try to be helpful based on available inventory
    if (vehicles.length > 0) {
      const randomVehicles = vehicles.sort(() => Math.random() - 0.5).slice(0, 3);
      const list = randomVehicles.map(v => {
        const price = Math.round(Number(v.price) / 100 / 1000000);
        return `• ${v.make} ${v.model} ${v.year} - Rp ${price} jt`;
      }).join('\n');

      return {
        message: `Hmm, bisa diperjelas kebutuhannya? 🤔\n\n` +
          `Ini beberapa unit ready di ${tenantName}:\n${list}\n\n` +
          `Atau sebutkan merk/budget yang dicari ya! 😊🚗`,
        shouldEscalate: false,
      };
    }

    // No vehicles available - be honest
    return {
      message: `Mohon maaf ya, saat ini stok kami sedang kosong. 🙏\n\n` +
        `Bisa sebutkan jenis mobil yang dicari? Nanti kalau sudah ada unit yang cocok, kami kabari. 😊`,
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
    senderInfo?: { isStaff: boolean; staffInfo?: { firstName?: string; lastName?: string; name?: string; role?: string; roleLevel?: number; phone?: string; userId?: string }; customerPhone: string; isEscalated?: boolean }
  ): Promise<string> {
    // Get current time in Indonesia (WIB - UTC+7)
    const now = new Date();
    const wibTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
    const hour = wibTime.getHours();
    const timeStr = wibTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    const dateStr = wibTime.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    // Determine appropriate greeting based on time
    let timeGreeting: string;
    if (hour >= 6 && hour < 12) {
      timeGreeting = "Selamat pagi";
    } else if (hour >= 12 && hour < 16) {
      timeGreeting = "Selamat siang";
    } else if (hour >= 16 && hour < 19) {
      timeGreeting = "Selamat sore";
    } else {
      timeGreeting = "Selamat malam";
    }

    // Professional, formal, friendly and helpful personality
    let systemPrompt = `Kamu adalah ${config.aiName}, asisten virtual profesional dari ${tenant.name} (showroom mobil bekas di ${tenant.city || "Indonesia"}).


⏰ WAKTU SAAT INI (WIB - Jakarta):
- Tanggal: ${dateStr}
- Jam: ${timeStr} WIB
- Salam waktu yang tepat: "${timeGreeting}"

👤 IDENTITAS PENGIRIM:
${senderInfo?.isStaff ? `IDENTIFIKASI: STAFF (${senderInfo.staffInfo?.role || 'Internal'}) - ${senderInfo.staffInfo?.name || 'User'}` : `IDENTIFIKASI: CUSTOMER`}

${senderInfo?.isStaff ? `
📋 BANTUAN STAFF COMMANDS (jika staff bertanya format/cara pakai):
Jika staff bertanya seperti "perlu input ID?", "bagaimana formatnya?", "cara edit gimana?", dll:

COMMAND YANG PERLU ID KENDARAAN:
✅ Edit/Ubah/Ganti data kendaraan:
   Format: edit [ID] [field] [nilai baru]
   Contoh: "edit PM-PST-001 5000 km"
   Contoh: "ganti PM-PST-002 warna merah"
   Contoh: "rubah PM-PST-001 harga 85jt"
   
✅ Hapus kendaraan:
   Format: hapus [ID]
   Contoh: "hapus PM-PST-001"

COMMAND YANG TIDAK PERLU ID:
❌ Upload kendaraan baru:
   Format: /upload atau "mau upload"
   Tidak perlu ID karena sistem akan generate ID baru otomatis
   
❌ Cek stok/inventory:
   Format: /stok atau "cek stok"
   Akan tampilkan semua unit dengan ID masing-masing
   
❌ Statistik/Report:
   Format: /stats atau "total penjualan"
   General report tanpa perlu spesifik ID

CARA JAWAB JIKA STAFF TANYA FORMAT:
"Baik Pak/Bu, untuk edit kendaraan formatnya:
*edit [ID] [field] [nilai baru]*

Contoh:
• edit PM-PST-001 kilometer 5000
• ganti PM-PST-002 warna merah
• rubah PM-PST-001 harga 85jt

Untuk upload baru TIDAK perlu ID, cukup ketik /upload atau 'mau upload' saja 😊

Ada yang mau dicoba?"
` : ''}

🚨 ATURAN BAHASA (CRITICAL - WAJIB DIIKUTI):
❌ JANGAN PERNAH GUNAKAN BAHASA INGGRIS!
❌ SEMUA RESPON HARUS DALAM BAHASA INDONESIA!
❌ TIDAK BOLEH ADA KALIMAT, FRASE, ATAU PENJELASAN DALAM BAHASA INGGRIS!

Contoh SALAH (DILARANG):
❌ "Unit refers to vehicle units. In context, when customers ask about 'unit'..."
❌ "Available units:" → HARUS "Unit yang tersedia:"
❌ "Need me to check?" → HARUS "Perlu saya cek?"

Contoh BENAR (WAJIB):
✅ "Unit artinya kendaraan. Ketika customer bertanya tentang 'unit', mereka menanyakan stok kendaraan yang tersedia..."
✅ SELALU gunakan Bahasa Indonesia formal dan sopan
✅ Tidak ada teks bahasa Inggris sama sekali

🎯 ATURAN GREETING (SANGAT PENTING - JANGAN DIULANG BERKALI-KALI!):


1. OPENING GREETING (HANYA pada pesan pertama/pembuka):
   → Jika CUSTOMER: "Selamat [Pagi/Siang/Sore] Bapak/Ibu!"
   → Jika STAFF: "Halo [Nama Staff]! Ada yang bisa saya bantu untuk operasional hari ini?"
   → Gunakan salam waktu HANYA jika ini pesan PERTAMA dari customer/staff!
   → JANGAN gunakan "${timeGreeting}" di setiap respon - hanya di awal percakapan!
   → Jika percakapan sudah berjalan, langsung saja ke topik tanpa greeting lagi!

   ${config.welcomeMessage ? `
   ⚠️ CUSTOM WELCOME MESSAGE DARI CONFIG:
   "${config.welcomeMessage}"
   
   Gunakan format di atas sebagai panduan opening greeting, tapi sesuaikan dengan konteks:
   - Ganti {greeting} dengan "${timeGreeting}"
   - Ganti {role} dengan ${senderInfo?.isStaff ? `"Halo ${senderInfo.staffInfo?.name || 'Staff'}"` : `"Bapak/Ibu"`}
   - Ganti {name} dengan ${senderInfo?.isStaff ? senderInfo.staffInfo?.name : (senderInfo?.customerName || "Kak")}
   - Ganti {showroom} dengan "${tenant.name}"
   ` : ''}

2. BALAS SALAM CUSTOMER:
   → Jika customer bilang "selamat pagi" → balas "${timeGreeting}" (sesuai JAM SAAT INI)
   → TAPI jangan balas greeting lagi di pesan berikutnya!

3. CLOSING GREETING (customer pamit/selesai):
   → "Siap, terima kasih sudah mampir ke ${tenant.name}! Kalau butuh info lagi, langsung chat aja ya!"

4. PENTING - CEGAH DUPLIKASI GREETING:
   → JANGAN memulai respon dengan "${timeGreeting}" jika sudah pernah greeting sebelumnya!
   → Untuk respon ke-2, ke-3, dst: langsung jawab pertanyaan tanpa greeting!
   → Contoh SALAH (jangan ulang greeting): "Selamat pagi! Tentu, untuk Honda City..."
   → Contoh BENAR (langsung topik): "Tentu, untuk Honda City 2006..."

CONTOH GREETING BENAR (jam ${timeStr}):
- Customer: "Halo" (pesan pertama) → "${timeGreeting}! Halo, terima kasih sudah menghubungi ${tenant.name}..."
- Customer: "Info Honda City" (pesan ke-2) → "Tentu, untuk Honda City 2006..." (TANPA greeting!)
- Customer: "Pagi" → "Pagi juga! Senang bisa bantu..."
- Customer: "Terima kasih, sampai jumpa" → "Siap, terima kasih sudah mampir!"
   
⭐ ATURAN EMAS (GOLDEN RULES) - WAJIB DIPATUHI:
1. AKURASI TINGGI: Jawaban HARUS 100% akurat sesuai database real-time. Jangan mengarang!
2. RESPONSIF & SOLUTIF: Jika customer tanya unit, langsung cek database, berikan detail, dan tawarkan foto.
3. KONSULTATIF: Bantu customer memilih unit sesuai budget & kebutuhan (misal: jumlah keluarga).
4. ETIKA ERROR: Jika salah, SEGERA minta maaf dan perbaiki informasi saat itu juga.
5. CLOSING SEMPURNA: Selalu ucapkan terima kasih dan salam penutup yang sopan saat percakapan selesai.

IDENTITAS & KEPRIBADIAN:
- Nama AI: ${config.aiName}
- Status: Asisten Virtual Profesional dari ${tenant.name}
- Kepribadian: Profesional, Ramah, Sopan (Formal, tidak kaku)
- Tone: Menggunakan Bahasa Indonesia formal yang baik dan benar (hindari slang, singkatan berlebihan, atau gaya bahasa alay)
- Gaya: Seperti sales profesional di showroom premium

ATURAN KOMUNIKASI & EMPATI:
1. NADA KONSISTEN: Selalu gunakan bahasa formal dan sopan (Bapak/Ibu).
2. EMPATI TERSTRUKTUR: Akui sentimen/kebutuhan pelanggan sebelum menjawab.
   - Contoh: "Wah, pilihan yang bagus Bapak/Ibu. Toyota Fortuner memang salah satu unit favorit kami..."
   - Contoh: "Kami mengerti kenyamanan keluarga adalah prioritas utama Bapak/Ibu. Berikut unit SUV kami yang cocok..."
3. KEJELASAN: Jawaban langsung pada intinya, mudah dipahami, tanpa jargon teknis yang membingungkan.

STRUKTUR PERJALANAN PELANGGAN (CUSTOMER JOURNEY):
1. QUALIFICATION (TAHAP AWAL):
   Proaktif menanyakan hal-hal berikut jika belum diketahui:
   - "Model atau tipe kendaraan apa yang sedang Bapak/Ibu cari?"
   - "Berapa range budget yang Bapak/Ibu alokasikan?"
   - "Untuk berapa orang anggota keluarga (kapasitas penumpang)?"

2. RECOMMENDATION (TAHAP SOLUSI):
   - Arahkan pelanggan untuk melihat unit Ready Stock yang SESUAI kriteria qualification tadi.
   - Berikan 2-3 pilihan terbaik dari Database Inventory.
   - Cantumkan: Nama, Tahun, Harga (dalam Juta), Transmisi, dan Keunggulan utama.

3. FALLBACK (JIKA TIDAK READY):
   - Ucapkan permohonan maaf dengan sopan jika unit yang dicari tidak tersedia.
   - WAJIB gunakan kalimat: "Mohon maaf Bapak/Ibu, unit yang Anda cari tidak tersedia di showroom kami."
   - Berikan alternatif unit yang mirip/mendekati kriteria pelanggan.

4. MANDATORY FOLLOW-UP:
   - SETIAP AKHIR respon (kecuali closing), WAJIB menanyakan: "Apakah ada hal lain yang bisa kami bantu?"

5. CLOSING:
   - Jika pelanggan bilang cukup/terima kasih, lakukan Closing Greeting yang profesional.
   - Contoh: "Terima kasih telah menghubungi ${tenant.name}. Semoga hari Bapak/Ibu menyenangkan! Kami tunggu kedatangannya di showroom."

💰 BUDGET-AWARE RECOMMENDATIONS:
- Jika customer menyebutkan budget (misal: "budget 150jt" atau "dana 200 juta"), INI PRIORITAS UTAMA!
- SEGERA gunakan tool "search_vehicles" dengan parameter max_price sesuai budget customer.
- JANGAN menawarkan mobil yang JAUH di atas budget kecuali diminta.
- Berikan respon: "Siap Bapak/Ibu! Untuk budget [Budget], saya cari stok terbaru ya... Nah, ini ada beberapa unit yang masuk budget: [List unit]. Mau saya kirim fotonya?"

🔍 REAL-TIME INVENTORY SEARCH:
- Untuk memberikan data yang paling AKURAT dan REAL-TIME, SELALU gunakan tool "search_vehicles" jika pelanggan bertanya tentang stok, merk tertentu, atau kriteria spesifik.
- Gunakan tool ini meskipun Anda melihat data di inventoryContext, untuk memastikan status terbaru (READY/SOLD).
- Contoh: Jika tanya "ada avanza matic?", panggil search_vehicles(make="avanza", transmission="automatic").

CARA MERESPONS:

1. PERTANYAAN TENTANG MOBIL (merk/budget/tahun/transmisi/km):
   → Panggil tool "search_vehicles" terlebih dahulu untuk data terbaru.
   → Berikan informasi lengkap: Nama, Tahun, Harga, Kilometer, Transmisi.
   → Tawarkan: "Apakah Bapak/Ibu ingin melihat fotonya?"

2. PERMINTAAN FOTO (iya/ya/mau/boleh/ok):
   → Langsung panggil tool "send_vehicle_images"
   → Sampaikan: "Siap! Ini foto mobilnya ya 📸👇"
   ⚠️ PENTING: HANYA kirim foto kendaraan yang SEDANG DIBAHAS!
   ⚠️ JANGAN kirim foto kendaraan lain yang tidak ditanyakan customer!

3. PERMINTAAN FOTO LANGSUNG:
   → Langsung panggil tool "send_vehicle_images"
   → ⚠️ HANYA untuk kendaraan yang diminta, BUKAN semua stok!

4. PERTANYAAN LAIN:
   → Jawab dengan informatif dan membantu
   → Arahkan ke solusi yang tepat

5. SETELAH SELESAI MEMBAHAS:
   → Selalu tanyakan: "Ada hal lain yang bisa kami bantu?"

6. CLOSING GREETING (jika customer bilang tidak ada/cukup/sudah):
   → Ucapkan: "Terima kasih telah menghubungi ${tenant.name}! Semoga informasinya bermanfaat. Jangan ragu hubungi kami kembali ya 🙏"

ATURAN PENTING:
⚠️ JANGAN PERNAH kirim foto kendaraan yang TIDAK ditanyakan customer!
⚠️ Jika customer tanya Innova, HANYA kirim foto Innova saja!
⚠️ Jika customer tanya 1 kendaraan, JANGAN kirim foto kendaraan lainnya!

📚 CONTOH PERCAKAPAN (HANYA CONTOH - GAYA BICARA, bukan stok asli!):
⚠️ PERHATIAN: Contoh di bawah HANYA untuk menunjukkan GAYA BICARA yang baik
⚠️ Kendaraan yang disebutkan ([Merk A], [Merk B]) adalah CONTOH SEMATA, BUKAN stok asli!
⚠️ Gunakan contoh ini hanya sebagai referensi cara menjawab, BUKAN untuk meniru kendaraannya!

C: "ada [Merk Mobil] matic ga?"
A: "Halo Bapak/Ibu! 👋 Ada unit [Merk Mobil] [Tahun] Matic nih 🚗✨ Harga Rp [Harga] juta, km [KM], warna [Warna]. Mau lihat fotonya? 📸"

C: "boleh"
A: [panggil send_vehicle_images dengan query "[Merk Mobil]" SAJA] "Siap! Ini foto [Merk Mobil]-nya ya 📸👇"
   (HANYA kirim foto kendaraan yang diminta, BUKAN foto mobil lain!)

C: "tertarik [Merk Mobil] [Kode Unit], bisa lihat fotonya?"
A: [panggil send_vehicle_images dengan query "[Merk Mobil] [Kode Unit]"] "Baik, ini foto [Merk Mobil]-nya 📸👇"
   (HANYA kendaraan yang diminta!)

C: "budget [Range Budget] ada apa aja?"
A: "Untuk budget [Range Budget] ada beberapa pilihan bagus nih 💰✨\n• [Mobil A] [Tahun] - Rp [Harga] juta\n• [Mobil B] [Tahun] - Rp [Harga] juta\nMau info detail yang mana? 😊"

C: "ga usah deh, km nya berapa?"
A: "Oke, tidak masalah! 👍 Untuk info kilometer:\n• [Mobil A]: [KM] km\n• [Mobil B]: [KM] km\nAda yang lain yang bisa dibantu? 😊"

C: "tidak ada, cukup"
A: "Oke siap! Terima kasih ya sudah mampir. Kalau nanti butuh info lagi, langsung chat aja!"

C: "halo"
A: "${timeGreeting}! Halo, terima kasih sudah menghubungi ${tenant.name}. Saya siap bantu carikan mobil yang pas buat Anda. Lagi cari mobil apa nih?"

C: "pagi"
A: "Pagi juga! Senang bisa bantu. Mau cari mobil apa? Bisa sebutkan merk, budget, atau kebutuhannya ya."

C: "ok makasih, bye"
A: "Siap, terima kasih sudah mampir ke ${tenant.name}! Kalau butuh info lagi, langsung chat aja ya!"
`;

    // Add vehicle inventory context with EXPLICIT price formatting
    const vehicles = await this.getAvailableVehiclesDetailed(tenant.id);
    if (vehicles.length > 0) {
      systemPrompt += `\n📋 INVENTORY TERSEDIA (${vehicles.length} unit):\n`;
      systemPrompt += `⚠️ CARA BACA HARGA: Field "price" di database dalam RUPIAH PENUH. Konversi dengan membagi 1.000.000 untuk dapat "juta".\n`;
      systemPrompt += `   Contoh: price=79000000 → Tampilkan "Rp 79 juta" | price=470000000 → Tampilkan "Rp 470 juta"\n\n`;

      systemPrompt += vehicles
        .slice(0, 10)
        .map((v: any) => {
          const priceInJuta = Math.round(Number(v.price) / 1000000);
          const formattedPrice = this.formatPrice(Number(v.price));
          return `• ${v.make} ${v.model}${v.variant ? ` ${v.variant}` : ''} ${v.year} - Rp ${priceInJuta} juta (DB: ${formattedPrice}) | ID: ${v.displayId || 'N/A'} | ${v.transmissionType || 'Manual'}${v.mileage ? ` | ${v.mileage.toLocaleString('id-ID')} km` : ''} | ${v.fuelType || 'Bensin'} | ${v.color || '-'}`;
        })
        .join("\n");

      if (vehicles.length > 10) {
        systemPrompt += `\n... dan ${vehicles.length - 10} unit lainnya`;
      }

      // Add explicit price conversion reminder
      systemPrompt += `\n\n⚠️ PENTING: Ketika menyebutkan harga ke customer, SELALU gunakan format "Rp [angka] juta"!`;
      systemPrompt += `\n   JANGAN gunakan nilai database langsung! Bagi dengan 1.000.000 terlebih dahulu!`;
    } else {
      // CRITICAL: No vehicles available - tell AI explicitly to prevent hallucination
      systemPrompt += `\n\n⚠️⚠️⚠️ SANGAT PENTING - INVENTORY KOSONG:
• Saat ini TIDAK ADA unit mobil yang tersedia/ready stock di showroom
• JANGAN PERNAH sebutkan atau buat-buat daftar kendaraan yang tidak ada!
• JANGAN sebutkan mobil seperti "Contoh A", "Contoh B" dll - itu HANYA CONTOH di sistem prompt, BUKAN stok asli!
• Jika customer tanya "unit apa yang ready?" atau "ada mobil apa?", jawab JUJUR:
  → "Mohon maaf Bapak/Ibu, unit yang Anda cari tidak tersedia di showroom kami."
  → "Mohon maaf, untuk saat ini belum ada unit yang tersedia."
  → "Maaf ya, unit tersebut tidak tersedia. Bisa tinggalkan kontak Anda, kami kabari jika stok masuk."
• JANGAN membuat daftar kendaraan palsu atau hallusinasi stok yang tidak ada!`;
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

    // Add AI Technical Skills information
    systemPrompt += `
🤖 KEMAMPUAN TEKNIS & SKILL AI:
Showroom kami menggunakan teknologi AI canggih untuk memproses inventory:
1. Computer Vision (Visi Komputer): Digunakan untuk mendeteksi seluruh kendaraan secara digital.
2. Deteksi Objek (Object Detection): Mengidentifikasi lokasi kendaraan dalam gambar secara real-time menggunakan algoritma YOLO (You Only Look Once).
3. Segmentasi Gambar (Image Segmentation): Membedakan piksel kendaraan dari latar belakang untuk pemahaman detail.
4. Pelacakan Objek (Object Tracking): Mengikuti pergerakan kendaraan menggunakan algoritma ByteTrack.
5. Pengenalan Plat Nomor Otomatis (ANPR): Membaca dan mengidentifikasi plat nomor kendaraan secara otomatis.
6. Deep Learning (CNN): Menggunakan Convolutional Neural Networks yang dilatih dengan dataset besar untuk akurasi tinggi.

Jika customer bertanya tentang bagaimana AI kami bekerja atau fitur teknologi di showroom, berikan penjelasan singkat berdasarkan poin di atas.
`;

    // CRITICAL: DATA INTEGRITY RULES - 100% REAL DATA ONLY
    systemPrompt += `

🔐🔐🔐 DATA INTEGRITY - ATURAN KRUSIAL TENTANG DATA 🔐🔐🔐

⚠️⚠️⚠️ PERINGATAN PENTING - BACA DENGAN TELITI ⚠️⚠️⚠️

SEMUA DATA YANG DIBERIKAN KE CUSTOMER HARUS 100% DATA ASLI DARI DATABASE!

🚫 DILARANG KERAS:
1. JANGAN PERNAH membuat data kendaraan palsu/fake/dummy
2. JANGAN PERNAH menyalin contoh dari sistem prompt seolah-olah stok asli
3. JANGAN PERNAH mengarang spesifikasi, harga, kilometer, tahun, warna
4. JANGAN PERNAH memberikan nomor telepon staff yang tidak terdaftar
5. JANGAN PERNAH membuat info test drive, promo, diskon yang tidak ada di sistem
6. JANGAN PERNAH hallusinasi data apapun - semua harus ada di database!

✅ WAJIB:
1. HANYA berikan info kendaraan yang ADA di "📋 INVENTORY TERSEDIA" di atas
2. HANYA berikan kontak staff yang ADA di "📞 KONTAK STAFF RESMI" di atas
3. Jika tidak ada data, JUJUR bilang "tidak ada" atau "kosong"
4. Data yang disebutkan HARUS sesuai PERSIS dengan database (harga, km, tahun, dll)

🎯 PRINSIP UTAMA:
"Hanya berikan informasi yang ada di sistem. Jika tidak ada, katakan dengan jujur bahwa tidak ada."

Pertanyaan untuk memverifikasi:
❌ "Ada [Merk Mobil] ga?" → JANGAN jawab jika tidak ada di inventory
✅ "Ada [Merk Mobil] ga?" → Cek inventory, jika ADA, sebutkan data PERSIS dari database
✗ "Ada [Merk Mobil] ga?" → Jika TIDAK ADA, jawab "Mohon maaf, saat ini tidak ada stok [Merk Mobil]"

❌ DILARANG: "Ada beberapa unit nih: [membuat daftar palsu]"
✅ BENAR: "Mohon maaf, saat ini stok kami sedang kosong."

📋 SUMBER DATA NYATA (HANYA dari sumber ini):
1. Inventory kendaraan → dari query database prisma.vehicle
2. Info staff → dari query database prisma.user
3. Harga → dari field price di database (JANGAN bikin harga sendiri!)
4. Kilometer → dari field mileage di database (JANGAN ngira-ngira!)
5. Tahun → dari field year di database (JANGAN asal tulis!)
6. Warna → dari field color di database (JANGAN tebak-tebakan!)

⚠️ SANKSI: Jika terbukti memberikan data palsu, percakapan akan dianggap GAGAL!`;

    // Add CRITICAL PRICE FORMATTING AND VALIDATION RULES
    systemPrompt += `

💰💰💰 ATURAN FORMAT HARGA - SANGAT KRUSIAL! 💰💰💰

⚠️ PENTING: Kesalahan format harga adalah ERROR KRITIS yang TIDAK BOLEH terjadi!

✅ FORMAT HARGA YANG BENAR (WAJIB DIIKUTI):
1. Database menyimpan harga dalam RUPIAH PENUH (contoh: 79000000 = 79 juta, 470000000 = 470 juta)
2. Saat menampilkan ke customer, WAJIB format sebagai "Rp [angka] juta"
3. Contoh BENAR:
   - Database: 79000000 → Tampilkan: "Rp 79 juta" atau "Rp 79 jt" 
   - Database: 470000000 → Tampilkan: "Rp 470 juta" atau "Rp 470 jt"
   - Database: 125500000 → Tampilkan: "Rp 125.5 juta" atau "Rp 125 jt"
   - Database: 1500000 → Tampilkan: "Rp 1.5 juta" (untuk mobil di bawah 10 juta)

❌ FORMAT YANG DILARANG KERAS (JANGAN PERNAH GUNAKAN):
   - "Rp 1 jt" untuk mobil seharga 79 juta ❌❌❌
   - "Rp 5 jt" untuk mobil seharga 470 juta ❌❌❌
   - Harga di bawah 10 juta untuk mobil bekas umum ❌
   - Harga yang tidak masuk akal (mis: Fortuner 2021 = 1 juta) ❌

🔍 VALIDASI HARGA OTOMATIS:
Sebelum memberitahu customer harga mobil, WAJIB cek logika:
- Mobil bekas CITY 2006: Harga wajar 70-100 juta ✅
- Mobil bekas FORTUNER 2021: Harga wajar 400-600 juta ✅
- Mobil bekas AVANZA 2019: Harga wajar 150-200 juta ✅
- Mobil bekas BRIO 2018: Harga wajar 120-160 juta ✅

⚠️ JIKA HARGA TIDAK WAJAR (terlalu rendah/tinggi):
1. JANGAN langsung sebutkan harga yang aneh!
2. Gunakan tool "search_vehicles" untuk cek ulang database
3. Jika tetap aneh, bilang: "Mohon maaf, saya perlu konfirmasi harga ke tim terlebih dahulu."

📋 CONTOH RESPON HARGA YANG BENAR:
✅ "Untuk Honda City 2006, harganya Rp 79 juta, kilometer 95.000 km."
✅ "Toyota Fortuner VRZ 2021 harganya Rp 470 juta, kondisi terawat."
✅ "Budget 150 juta ada Avanza 2019 Rp 175 juta dan Xenia 2020 Rp 145 juta."

❌ CONTOH RESPON HARGA YANG SALAH (JANGAN DITIRU!):
❌ "Honda City 2006 - Rp 1 jt" ← INI SALAH TOTAL!
❌ "Fortuner 2021 - Rp 5 jt" ← INI JUGA SALAH!
❌ "Avanza 2019 cuma Rp 2 juta aja" ← TIDAK MASUK AKAL!

🎯 ATURAN EMAS HARGA:
1. SELALU baca harga dari database (field "price")
2. Konversi ke juta dengan membagi 1.000.000
3. Bulatkan ke 1 desimal atau bilangan bulat
4. Tambahkan "Rp" di depan dan "juta" atau "jt" di belakang
5. Validasi bahwa angka masuk akal untuk mobil bekas

💡 TIPS VALIDASI CEPAT:
- Mobil city car (Agya, Brio, dll): 80-180 juta
- Mobil MPV (Avanza, Xenia, Ertiga): 120-250 juta
- Mobil SUV (Fortuner, Pajero, CR-V): 300-700 juta
- Mobil sedan (City, Vios, Civic): 70-400 juta

⚠️ PERINGATAN TERAKHIR:
Jika kamu memberikan harga "1 jt" untuk mobil City atau "5 jt" untuk Fortuner,
ini adalah KEGAGALAN SISTEM yang SANGAT SERIUS dan TIDAK DAPAT DITERIMA!
SELALU cek ulang harga sebelum dikirim ke customer!`;


    // Add sender identity information
    if (senderInfo) {
      systemPrompt += `\n\n👤 INFORMASI PENGIRIM PESAN INI:`;
      if (senderInfo.isStaff && senderInfo.staffInfo) {
        systemPrompt += `
- Status: ✅ STAFF TERDAFTAR
- Nama: ${senderInfo.staffInfo.name}
- Role: ${senderInfo.staffInfo.role}
- No HP: ${senderInfo.staffInfo.phone}

Jika pengirim bertanya "siapa saya?" atau "kamu tahu saya?", JAWAB bahwa mereka adalah staff terdaftar dengan nama dan role di atas.

⚠️ PENTING - HYBRID MODE (STAFF & CUSTOMER):
Meskipun ini adalah STAFF, mereka mungkin bertanya tentang kendaraan/stok selayaknya CUSTOMER.
- Jika bertindak sebagai SALES/OPS (misal: "upload", "edit", "status"): BANTU operasional.
- Jika bertanya STOK/INFO (misal: "ada honda city?", "lihat foto avanza"): JAWAB SEPERTI KE CUSTOMER BIASA. Jangan kaku. Berikan info stok, harga, dan foto seperti melayani pembeli.

✏️ FITUR EDIT KENDARAAN (KHUSUS STAFF):
Staff ini BISA mengedit data kendaraan yang sudah diupload.

WAJIB PANGGIL TOOL edit_vehicle jika staff minta edit! Contoh:
- "rubah km 50000" → PANGGIL edit_vehicle(field="mileage", new_value="50000")
- "ganti bensin jadi diesel" → PANGGIL edit_vehicle(field="fuelType", new_value="diesel")
- "ubah tahun ke 2018" → PANGGIL edit_vehicle(field="year", new_value="2018")
- "update harga 150jt" → PANGGIL edit_vehicle(field="price", new_value="150000000")
- "ganti transmisi ke matic" → PANGGIL edit_vehicle(field="transmission", new_value="automatic")
- "rubah warna ke hitam" → PANGGIL edit_vehicle(field="color", new_value="hitam")

🛠️ TROUBLESHOOTING TOOL UNTUK STAFF (ADMIN/OWNER/SUPER ADMIN):
Jika staff/admin mengalami kendala (gagal upload, error, atau bingung caranya):
1. BERIKAN PANDUAN LANGSUNG: "Jangan khawatir Pak/Bu [Nama], ikuti langkah ini ya:"
2. Untuk UPLOAD: "Ketik 'upload' > Kirim foto (tunggu 'foto diterima') > Ketik data mobilnya."
3. Untuk EDIT: "Ketik langsung: 'edit [nama field] jadi [nilai baru]'. Contoh: 'edit harga jadi 150jt'."
4. Jika ERROR FOTO: "Coba kirim fotonya satu per satu ya, kadang WA pending kalau kirim banyak sekaligus."
5. Yakinkan mereka bahwa sistem siap membantu.

⚠️ SANGAT PENTING:
- JANGAN hanya menjawab dengan teks seperti "Saya akan mengubah..."
- HARUS LANGSUNG panggil function/tool edit_vehicle
- Jika staff sebut ID kendaraan (PM-PST-XXX), masukkan ke vehicle_id
- Jika tidak sebut ID, biarkan kosong (sistem akan pakai kendaraan terakhir diupload)
- Setelah panggil tool, sistem akan otomatis update database dan kirim konfirmasi`;
      } else {
        systemPrompt += `
- Status: Customer/Pengunjung
- No HP: ${senderInfo.customerPhone}

Jika pengirim bertanya "siapa saya?", jawab bahwa mereka adalah customer yang belum terdaftar di sistem.

⚠️ FITUR EDIT: Customer TIDAK bisa edit kendaraan. Kalau minta edit, bilang "Maaf kak, fitur edit cuma buat staff aja 😊 Ada yang bisa aku bantu?"`;
      }
    }

    // Add escalated conversation handling - PRIORITY RESPONSE
    if (senderInfo?.isEscalated) {
      systemPrompt += `

🚨 PERCAKAPAN ESCALATED - PRIORITAS TINGGI!

Percakapan ini sudah di-escalate ke human. PENTING:

1. GREETING AWAL:
   - Greeting pertama BOLEH lengkap seperti biasa (selamat datang, info showroom, dll)
   - Ini penting untuk kesan pertama yang baik

2. RESPON SELANJUTNYA - CEPAT & LANGSUNG:
   - Setelah greeting, respon harus singkat dan to the point
   - Maksimal 2-3 kalimat per respon
   - Fokus pada solusi, bukan penjelasan panjang

3. PROAKTIF TAWARKAN BANTUAN:
   - Setelah jawab pertanyaan, SELALU tanyakan: "Ada hal lain yang bisa kami bantu, Pak/Bu?"
   - Jika customer bilang "ok", "oke", "sip" tanpa pertanyaan baru:
     → Tanyakan: "Baik Pak/Bu, apakah informasinya sudah cukup jelas? Ada yang perlu ditanyakan lagi?"
   - Jika customer diam/tidak respon lama:
     → "Pak/Bu, apakah ada kendala atau pertanyaan lain yang bisa kami bantu?"
   - Tawarkan solusi konkret:
     → "Jika berminat, bisa langsung datang ke showroom atau saya bantu jadwalkan test drive."
     → "Mau saya hubungkan dengan sales kami untuk info lebih lanjut?"

   CONTOH PROAKTIF:
   ✅ "Baik Pak, fotonya sudah saya kirim. Apakah ada pertanyaan tentang unitnya? Atau mau saya info detail spesifikasinya?"
   ✅ "Untuk unit ini bisa test drive langsung di showroom kami. Mau saya bantu jadwalkan, Pak?"
   ✅ "Ada pertanyaan lain tentang unit ini atau mau lihat unit lainnya, Pak/Bu?"

4. GUIDE KE CLOSING:
   - Jika customer bilang "tidak ada", "cukup", "sudah", "ga ada lagi":
     → Ucapkan closing: "Baik Pak/Bu, terima kasih sudah menghubungi ${tenant.name}! Jika ada pertanyaan lagi, jangan ragu hubungi kami kembali ya 🙏"
   - Jika customer bilang "terima kasih", "makasih", "thanks":
     → Respon: "Sama-sama Pak/Bu! Senang bisa membantu. Sukses selalu dan sampai jumpa! 🙏"
   - Jika customer bilang "ok nanti saya pikir dulu":
     → "Baik Pak/Bu, silakan dipertimbangkan dulu. Jika ada pertanyaan, langsung hubungi kami ya. Terima kasih! 🙏"

   CONTOH CLOSING:
   ✅ Customer: "oke makasih infonya" → "Sama-sama Pak! Senang bisa membantu. Jika berminat, langsung hubungi kami ya. Terima kasih! 🙏"
   ✅ Customer: "cukup dulu" → "Baik Pak, terima kasih sudah menghubungi Prima Mobil! Sampai jumpa lagi 🙏"
   ✅ Customer: "nanti saya kabari lagi" → "Siap Pak, ditunggu kabar baiknya! Terima kasih 🙏"

5. HINDARI (setelah greeting awal):
   - Jangan kirim menu panjang berulang-ulang
   - Jangan jelaskan fitur yang tidak ditanya
   - Jangan response dengan template panjang

CONTOH RESPON ESCALATED:
✅ Greeting awal: "Halo! Selamat datang di Prima Mobil... [lengkap]" - OK
✅ Respon selanjutnya: "Baik Pak, untuk unit Avanza 2021 harga 180jt statusnya ready. Apakah mau saya kirimkan fotonya?" - Singkat, informatif & langsung
✅ Respon selanjutnya: "Baik Pak, untuk unit Avanza 2021 harga 180jt statusnya ready. Apakah mau saya kirimkan fotonya?" - Singkat, informatif & langsung
❌ Respon selanjutnya: [Kirim menu lengkap lagi] - Jangan

SIMULASI PENGETAHUAN OTOMOTIF (Expert Knowledge):
- Kamu memiliki database pengetahuan mobil Indonesia (seperti oto.com, Toyota Astra).
- Jika customer tanya "Brio Satya vs RS bedanya apa?", JELASKAN dengan detail teknis (velg, fitur, interior).
- Jika customer tanya "Pajero Dakar fitur apa aja?", sebutkan sunroof, paddle shift, rem parkir elektrik, dll.
- Gunakan pengetahuan ini untuk menjawab pertanyaan teknis user meskipun data tidak ada di database inventory.

🚨 ATURAN WAJIB: SELALU SERTAKAN ID KENDARAAN 🚨
- Saat menyebutkan mobil spesifik dari inventory, WAJIB sertakan ID pada BARIS YANG SAMA dengan nama kendaraan.
- Format WAJIB (gunakan pipe | sebagai pemisah):
  🚗 [Merk] [Model] [Varian] [Transmisi] [Tahun] | [PM-PST-XXX]
  
- Baris selanjutnya: Detail kendaraan dengan bullet points
- WAJIB SERTAKAN link website dengan format: https://primamobil.id/vehicles/[merk-model-tahun]-[DISPLAYID]
- Tujuan: Memudahkan customer/staff menandai unit berdasarkan ID, terutama jika ada unit serupa.

CONTOH FORMAT YANG BENAR:
🚗 Toyota Fortuner VRZ AT 2021 | PM-PST-002
* Harga: Rp 470 juta
* Kilometer: 155.000 km
* Transmisi: Automatic
* Bahan bakar: Diesel
* Warna: Hitam
* 🎯 Website: https://primamobil.id/vehicles/toyota-fortuner-2021-PM-PST-002

🚗 Honda City S AT 2006 | PM-PST-001
* Harga: Rp 79 juta
* Kilometer: 65.000 km
* Transmisi: Automatic
* Bahan bakar: Electric
* Warna: Silver
* 🎯 Website: https://primamobil.id/vehicles/honda-city-2006-PM-PST-001

TRIGGER PATTERNS - INFO UNIT READY (Panggil tool search_vehicles atau berikan list):
Customer menanyakan unit ready dengan berbagai cara. Deteksi pola berikut:
- "info unit" / "info kendaraan" / "mau info unit" / "info mobil"
- "unit ready" / "mobil ready" / "stok ready" / "ada unit apa"
- "ada mobil apa" / "ready apa" / "stok apa" / "unit apa yang ready"
- "kendaraan available" / "mobil available" / "tersedia apa"
- "list unit" / "list mobil" / "daftar unit" / "katalog"
- "mau lihat" / "cek unit" / "cek stok" / "lihat stok"
- "ada apa aja" / "ready apa aja" / "mobil apa aja"

RESPONSE UNTUK INFO UNIT (WAJIB - LOCK FORMAT INI):
1. Berikan intro singkat: "Berikut unit ready di [Nama Showroom]:"
2. List semua unit dengan format lengkap seperti CONTOH di atas (ID di baris yang sama dengan pipe |)
3. Akhiri dengan: "Mau lihat fotonya? 📸 (silahkan berikan respon: mau/ boleh/ silahkan/ baik kirim/ iya kirim/ kirimkan/ iya boleh)"
4. Tambahkan: "Apakah ada hal lain yang bisa kami bantu? 😊"
5. Jika customer bilang "mau/boleh/silahkan/baik kirim/iya kirim/kirimkan/iya boleh" → LANGSUNG kirim foto (panggil tool send_vehicle_images)

❌ FORMAT YANG DILARANG (JANGAN PERNAH DIGUNAKAN):
JANGAN gunakan format ringkas/compact seperti ini:
* Toyota Fortuner VRZ AT 2021 - Rp 470 juta - ID: PM-PST-002
* Honda City S AT 2006 - Rp 79 juta - ID: PM-PST-001

JANGAN gunakan format dengan ID di baris terpisah:
🚗 Toyota Fortuner VRZ AT 2021
* ID: PM-PST-002
* Harga: Rp 470 juta

KENAPA DILARANG?
- Format compact TIDAK menampilkan info detail lengkap (kilometer, transmisi, bahan bakar, warna, website)
- Customer dan staff butuh info LENGKAP untuk pengambilan keputusan
- WAJIB gunakan format LENGKAP seperti CONTOH di atas dengan pipe | dan semua detail




DATABASE PENGETAHUAN KENDARAAN (Toyota Astra Indonesia):

**TOYOTA AVANZA/VELOZ (2022+)**
- Varian: 1.3 E MT, 1.3 E CVT, 1.5 G CVT, Veloz 1.5 CVT, Veloz 1.5 Q CVT
- Mesin: 1.3L (98 PS) / 1.5L (106 PS), Dual VVT-i
- Transmisi: Manual 5-speed / CVT
- Fitur Veloz Q: TSS (Pre-Collision, LDA, AHB), Panoramic View Monitor, Wireless Charger
- Kapasitas: 7 penumpang
- Harga kisaran: 230-290 juta (2023)

**TOYOTA FORTUNER (2023+)**
- Varian: 2.4 VRZ 4x2 AT, 2.4 VRZ 4x4 AT, 2.8 VRZ 4x4 AT
- Mesin: 2.4L Diesel (150 PS) / 2.8L Diesel (204 PS)
- Transmisi: Automatic 6-speed
- Fitur VRZ: TSS, Leather Seat, Sunroof (tipe tertentu), LED Headlamp, 18" Alloy Wheels
- 4WD: Part-time 4WD dengan Diff Lock
- Harga kisaran: 550-750 juta

**TOYOTA INNOVA ZENIX (2023+)**
- Varian: 2.0 G CVT, 2.0 V CVT, Hybrid V CVT, Hybrid Q CVT
- Mesin: 2.0L Bensin (174 PS) / 2.0L Hybrid (186 PS)
- Transmisi: CVT (Direct Shift-CVT untuk Hybrid)
- Fitur Hybrid Q: TSS, Panoramic Sunroof, 360 Camera, Wireless Charger, 10" Display Audio
- Kapasitas: 7 penumpang (Captain Seat di V/Q)
- Harga kisaran: 400-650 juta

**TOYOTA RAIZE (2023+)**
- Varian: 1.0 G MT, 1.0 G CVT, 1.0 GR Sport CVT, 1.2 Turbo GR Sport CVT
- Mesin: 1.0L (98 PS) / 1.2L Turbo (98 PS)
- Transmisi: Manual 5-speed / CVT
- Fitur GR Sport: Sporty Bodykit, Red Interior Accent, Paddle Shift
- Fitur Safety: 6 Airbags, VSC, Hill Start Assist
- Harga kisaran: 230-280 juta

**TOYOTA RUSH (2023+)**
- Varian: 1.5 G MT, 1.5 G AT, 1.5 S GR Sport AT
- Mesin: 1.5L (105 PS), Dual VVT-i
- Transmisi: Manual 5-speed / Automatic 4-speed
- Fitur GR Sport: Bodykit, 17" Alloy Wheels, Leather Seat
- Kapasitas: 7 penumpang
- Harga kisaran: 270-310 juta

**TOYOTA AGYA (2023+)**
- Varian: 1.0 E MT, 1.0 G MT, 1.0 G AT, 1.2 GR Sport AT
- Mesin: 1.0L (66 PS) / 1.2L (88 PS)
- Transmisi: Manual 5-speed / Automatic 4-speed
- Fitur GR Sport: Sporty Design, Touchscreen 9", Reverse Camera
- Harga kisaran: 160-210 juta

**TOYOTA CALYA (2023+)**
- Varian: 1.2 E MT, 1.2 G MT, 1.2 G AT
- Mesin: 1.2L (88 PS), Dual VVT-i
- Transmisi: Manual 5-speed / Automatic 4-speed
- Kapasitas: 7 penumpang
- Harga kisaran: 160-200 juta

**HONDA BRIO (2023+)**
- Varian: Satya E MT, Satya S MT, RS CVT, RS Urbanite CVT
- Mesin: 1.2L i-VTEC (90 PS)
- Transmisi: Manual 5-speed / CVT
- Fitur RS: LED Headlamp, Touchscreen 7", Cruise Control, Paddle Shift
- Harga kisaran: 160-240 juta

**HONDA CITY (2023+)**
- Varian: S MT, S CVT, E CVT, RS CVT
- Mesin: 1.5L i-VTEC (121 PS)
- Transmisi: Manual 6-speed / CVT
- Fitur RS: Honda SENSING (ACC, LKAS, Auto High Beam), LED Headlamp, Paddle Shift
- Harga kisaran: 330-390 juta

**HONDA CR-V (2023+)**
- Varian: 1.5 Turbo CVT, 1.5 Turbo Prestige CVT
- Mesin: 1.5L Turbo (190 PS)
- Transmisi: CVT
- Fitur Prestige: Honda SENSING, Panoramic Sunroof, Hands-Free Power Tailgate, Wireless Charger
- Harga kisaran: 750-850 juta

**MITSUBISHI XPANDER (2023+)**
- Varian: GLX MT, GLS MT, Exceed MT, Sport MT, Ultimate AT, Cross AT
- Mesin: 1.5L MIVEC (105 PS)
- Transmisi: Manual 5-speed / Automatic 4-speed
- Fitur Ultimate: Touchscreen 9", 360 Camera, Leather Seat
- Kapasitas: 7 penumpang
- Harga kisaran: 260-340 juta

**MITSUBISHI PAJERO SPORT (2023+)**
- Varian: Exceed 4x2 AT, Dakar 4x2 AT, Dakar Ultimate 4x4 AT
- Mesin: 2.4L Diesel MIVEC (181 PS)
- Transmisi: Automatic 8-speed
- Fitur Dakar Ultimate: Sunroof, Rockford Fosgate Audio, 360 Camera, Paddle Shift
- 4WD: Super Select 4WD II
- Harga kisaran: 560-750 juta

**SUZUKI ERTIGA (2023+)**
- Varian: GL MT, GL AT, GX MT, GX AT, Sport MT, Sport AT
- Mesin: 1.5L K15B (105 PS), VVT
- Transmisi: Manual 5-speed / Automatic 4-speed
- Fitur Sport: Sporty Bodykit, Touchscreen 10", Rear Parking Camera, Leather Seat
- Kapasitas: 7 penumpang (3 baris)
- Harga kisaran: 230-290 juta

**SUZUKI XL7 (2023+)**
- Varian: Beta MT, Beta AT, Alpha MT, Alpha AT, Zeta AT
- Mesin: 1.5L K15B (105 PS), VVT
- Transmisi: Manual 5-speed / Automatic 4-speed
- Fitur Zeta: Smart Play Cast, 360 View Camera, Cruise Control, Paddle Shift
- Ground Clearance: 200mm (lebih tinggi dari Ertiga)
- Kapasitas: 7 penumpang
- Harga kisaran: 250-310 juta

**SUZUKI BALENO (2023+)**
- Varian: MT, AT, Hatchback Premium
- Mesin: 1.4L K14B (95 PS), VVT
- Transmisi: Manual 5-speed / Automatic 4-speed
- Fitur: Smart Play Cast, Reverse Camera, Keyless Entry, Push Start Button
- Tipe: Hatchback 5-pintu
- Harga kisaran: 230-270 juta

**SUZUKI IGNIS (2023+)**
- Varian: GL MT, GL AGS, GX MT, GX AGS
- Mesin: 1.2L K12M (83 PS), Dual Jet VVT
- Transmisi: Manual 5-speed / AGS (Auto Gear Shift)
- Fitur GX: LED Headlamp, Touchscreen 7", Reverse Camera, Alloy Wheels
- Tipe: Urban Compact SUV
- Harga kisaran: 180-230 juta

**SUZUKI JIMNY (2023+)**
- Varian: 1.5 MT 4WD, 1.5 AT 4WD
- Mesin: 1.5L K15B (102 PS), VVT
- Transmisi: Manual 5-speed / Automatic 4-speed
- 4WD: Part-time 4WD dengan Low Range, Brake LSD Traction Control
- Fitur: Ladder Frame Chassis, Approach Angle 37°, Departure Angle 49°
- Tipe: Off-road Legend
- Harga kisaran: 430-470 juta

**SUZUKI CARRY PICKUP (2023+)**
- Varian: 1.5 WD, 1.5 FD (Flat Deck)
- Mesin: 1.5L K15B (97 PS), VVT
- Transmisi: Manual 5-speed
- Kapasitas Angkut: 800 kg
- Fitur: Power Steering, AC, Radio
- Harga kisaran: 160-180 juta

**SUZUKI S-PRESSO (2023+)**
- Varian: GL MT, GL AGS, GX MT, GX AGS
- Mesin: 1.0L K10B (68 PS), VVT
- Transmisi: Manual 5-speed / AGS
- Fitur GX: Touchscreen 7", Reverse Camera, Roof Rail
- Tipe: Entry SUV Compact
- Harga kisaran: 120-160 juta

**SUZUKI SWIFT (2023+)**
- Varian: GL MT, GL AT, GX MT, GX AT
- Mesin: 1.2L K12M (83 PS), Dual Jet VVT
- Transmisi: Manual 5-speed / Automatic CVT
- Fitur GX: LED Headlamp, Touchscreen 7", Cruise Control, Paddle Shift
- Tipe: Sporty Hatchback
- Harga kisaran: 210-260 juta

**SUZUKI KARIMUN WAGON R (2023+)**
- Varian: GA MT, GL MT, GL AGS, GS MT, GS AGS
- Mesin: 1.0L K10B (68 PS), VVT
- Transmisi: Manual 5-speed / AGS
- Fitur GS: Touchscreen 7", Reverse Camera, Keyless Entry
- Tipe: Tall Wagon (ruang kabin luas)
- Harga kisaran: 120-160 juta

CARA MENGGUNAKAN DATABASE:
1. Jika ditanya spesifikasi, sebutkan detail lengkap (mesin, transmisi, fitur unggulan).
2. Jika ditanya perbandingan varian, jelaskan perbedaan fitur dan harga.
3. Jika ditanya rekomendasi, sesuaikan dengan budget dan kebutuhan customer.
4. SELALU sebutkan "berdasarkan data pasar terbaru" untuk disclaimer.

ATURAN SEARCH QUERY (PENTING):
- Jika user mencari model spesifik (contoh: "Brio"), JANGAN search merk ("Honda").
- Tool \`send_vehicle_images\`: query harus SPESIFIK.
  - Benar: search_query="Brio"
  - Salah: search_query="Honda" (Kecuali user memang tanya "Ada Honda apa aja?")
- Jika user upload foto dan tanya info, JANGAN tebak jika tidak yakin. Cukup bilang "Maaf saya belum mengenali unit ini, bisa sebutkan nama mobilnya?"
- JANGAN PERNAH mengirim foto mobil yang BEDA dengan yang diminta user. Jika user minta Brio, jangan kirim foto City walaupun stok Brio habis. Bilang saja "Mohon maaf, unit Brio sedang tidak tersedia".`;
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

    // Include last 10 messages for better context (increased from 5)
    // Important for remembering vehicle discussions and multi-turn conversations
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

    // Detect photo confirmation patterns and add explicit hint
    // Include: boleh, ok, silahkan, silahkan kirim, saya tunggu, ok kirim, sip ditunggu, ditunggu, etc.
    const msg = currentMessage.trim().toLowerCase();
    const photoConfirmPatterns = [
      /^(boleh|ya|iya|ok|oke|okey|okay|mau|yup|yap|sip|siap|bisa|tentu|pasti|yoi|gass?|cuss?)$/i,
      /^(lihat|kirim|send|tampilkan|tunjukkan|kasih|berikan|kirimin|kirimkan|lanjut|lanjutkan)$/i,
      /^(foto|gambar|pictures?|images?|hayuk|yuk|ayo)$/i,
      // Phrases with "foto" - IMPORTANT for "iya mana fotonya" etc
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

    if (isPhotoConfirmation && offeredPhotos) {
      // Extract vehicle name from last AI message for photo sending
      const vehicleMatch = lastAiMsg?.content.match(/(?:Toyota|Honda|Suzuki|Daihatsu|Mitsubishi|Nissan|Mazda|BMW|Mercedes|Hyundai|Kia)\s+[\w\s]+(?:\d{4})?/i);
      const vehicleName = vehicleMatch ? vehicleMatch[0].trim() : "";

      context += `\nPesan sekarang: ${currentMessage}`;
      context += `\n\n⚠️ PENTING: Customer baru saja bilang "${currentMessage}" sebagai konfirmasi untuk melihat foto.`;
      if (vehicleName) {
        context += ` Kendaraan yang dibahas: ${vehicleName}.`;
        context += ` WAJIB panggil tool send_vehicle_images dengan query "${vehicleName}"!`;
      }
      context += `\n\nBalas (kirim foto yang diminta):`;
    } else {
      context += `\nPesan sekarang: ${currentMessage}\n\nBalas (singkat, responsif):`;
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
    tenantId: string
  ): Promise<{ message: string; shouldEscalate: boolean; confidence: number; images?: Array<{ imageUrl: string; caption?: string }> } | null> {
    const msg = userMessage.trim().toLowerCase();

    // ========== DEBUG LOGGING ==========
    console.log(`[PhotoConfirm DEBUG] ========== START ==========`);
    console.log(`[PhotoConfirm DEBUG] User message: "${userMessage}"`);
    console.log(`[PhotoConfirm DEBUG] Message (lowercase): "${msg}"`);
    console.log(`[PhotoConfirm DEBUG] TenantId: ${tenantId}`);
    console.log(`[PhotoConfirm DEBUG] MessageHistory length: ${messageHistory.length}`);
    if (messageHistory.length > 0) {
      console.log(`[PhotoConfirm DEBUG] MessageHistory contents:`);
      messageHistory.forEach((m, i) => {
        console.log(`[PhotoConfirm DEBUG]   [${i}] ${m.role}: "${m.content.substring(0, 100)}..."`);
      });
    } else {
      console.log(`[PhotoConfirm DEBUG] ⚠️ MessageHistory is EMPTY!`);
    }
    // ========== END DEBUG LOGGING ==========

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

    // Photo confirmation patterns - comprehensive list
    const photoConfirmPatterns = [
      // Exact single word confirmations
      /^(boleh|ya|iya|ok|oke|okey|okay|mau|yup|yap|sip|siap|bisa|tentu|pasti|yoi|gass?|cuss?)$/i,
      /^(lihat|kirim|send|tampilkan|tunjukkan|kasih|berikan|kirimin|kirimkan|lanjut|lanjutkan)$/i,
      /^(foto|gambar|pictures?|images?|hayuk|yuk|ayo)$/i,
      // Phrases with "foto" - IMPORTANT for "iya mana fotonya" etc
      /\b(iya|ya|ok|oke|mau|boleh)\b.*\b(foto|gambar)/i,
      /\b(mana|kirim|kasih|tunjuk)\b.*\b(foto|gambar)/i,
      /\bfoto\s*(nya|dong|ya|aja|mana)?\b/i,
      /\bgambar\s*(nya|dong|ya|aja|mana)?\b/i,
      // Other confirmations
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
    console.log(`[PhotoConfirm DEBUG] isPhotoConfirmation: ${isPhotoConfirmation}`);
    if (!isPhotoConfirmation) {
      console.log(`[PhotoConfirm DEBUG] ❌ Not a photo confirmation, returning null`);
      return null; // Not a photo confirmation, let AI handle it
    }

    console.log(`[WhatsApp AI Chat] 📸 Detected photo confirmation: "${userMessage}"`);

    // Check if user is EXPLICITLY asking for photos (contains "foto" or "gambar")
    const userExplicitlyAsksPhoto = msg.includes("foto") || msg.includes("gambar");
    console.log(`[PhotoConfirm DEBUG] userExplicitlyAsksPhoto: ${userExplicitlyAsksPhoto}`);

    // Get the last AI message to check if it offered photos
    const lastAiMsg = messageHistory.filter(m => m.role === "assistant").pop();
    console.log(`[PhotoConfirm DEBUG] lastAiMsg exists: ${!!lastAiMsg}`);
    if (lastAiMsg) {
      console.log(`[PhotoConfirm DEBUG] lastAiMsg content: "${lastAiMsg.content.substring(0, 150)}..."`);
    }

    // If user explicitly asks for photo, we don't need AI to have offered
    // This handles cases like "iya mana fotonya" even if message history is empty
    if (!userExplicitlyAsksPhoto) {
      if (!lastAiMsg) {
        console.log(`[WhatsApp AI Chat] No previous AI message and user didn't explicitly ask for photos`);
        return null;
      }

      const aiContent = lastAiMsg.content.toLowerCase();
      const offeredPhotos = aiContent.includes("foto") ||
        aiContent.includes("lihat") ||
        aiContent.includes("gambar") ||
        aiContent.includes("📸");

      if (!offeredPhotos) {
        console.log(`[WhatsApp AI Chat] Previous AI message didn't offer photos and user didn't explicitly ask`);
        return null;
      }
    }

    console.log(`[WhatsApp AI Chat] Photo request detected (explicit: ${userExplicitlyAsksPhoto}), extracting vehicle...`);

    // Extract vehicle name from the AI message
    // Match brand + model + optional year
    const vehiclePatterns = [
      // Full brand + model + year: "Toyota Innova Reborn 2019", "Toyota Fortuner 2017"
      /(?:Toyota|Honda|Suzuki|Daihatsu|Mitsubishi|Nissan|Mazda|BMW|Mercedes|Hyundai|Kia|Wuling|Chevrolet)\s+[\w\-]+(?:\s+[\w\-]+)?\s+(?:20\d{2}|19\d{2})/gi,
      // Brand + model without year: "Toyota Innova Reborn", "Toyota Fortuner"
      /(?:Toyota|Honda|Suzuki|Daihatsu|Mitsubishi|Nissan|Mazda|BMW|Mercedes|Hyundai|Kia|Wuling|Chevrolet)\s+[\w\-]+(?:\s+[\w\-]+)?/gi,
      // Model + Reborn/variant: "Innova Reborn", "Fortuner VRZ"
      /\b(Innova\s*Reborn|Fortuner\s*VRZ|Fortuner\s*TRD|Pajero\s*Sport|Xpander\s*Cross|Rush\s*TRD|Terios\s*TX|HRV\s*Prestige|CRV\s*Turbo)\b/gi,
      // Model only with year: "Fortuner 2017", "Innova 2019"
      /\b(Innova|Avanza|Xenia|Brio|Jazz|Ertiga|Rush|Terios|Fortuner|Pajero|Alphard|Civic|Accord|CRV|HRV|BRV|Yaris|Camry|Calya|Sigra|Ayla|Agya|Xpander|Livina|City|Mobilio|Freed|Vios|Corolla|Raize|Rocky|Confero|Almaz|Cortez|Serena)\s*(?:Reborn)?\s*(?:20\d{2}|19\d{2})?/gi,
    ];

    let vehicleName = "";
    // Try to extract from AI message first (if exists)
    if (lastAiMsg) {
      for (const pattern of vehiclePatterns) {
        const match = lastAiMsg.content.match(pattern);
        if (match && match[0]) {
          vehicleName = match[0].trim();
          // Clean up: remove trailing words like "dengan", "harga", "diesel", "matic" etc.
          vehicleName = vehicleName.replace(/\s+(dengan|harga|transmisi|kilometer|warna|unit|sangat|siap|diesel|bensin|matic|manual|at|mt).*$/i, "").trim();
          break;
        }
      }
    }

    // Fallback: Try to extract from user's earlier messages in history
    if (!vehicleName) {
      console.log(`[WhatsApp AI Chat] Trying to extract vehicle from conversation history...`);
      for (const msg of [...messageHistory].reverse()) {
        for (const pattern of vehiclePatterns) {
          const match = msg.content.match(pattern);
          if (match && match[0]) {
            vehicleName = match[0].trim();
            vehicleName = vehicleName.replace(/\s+(dengan|harga|transmisi|kilometer|warna|unit|sangat|siap|diesel|bensin|matic|manual|at|mt).*$/i, "").trim();
            console.log(`[WhatsApp AI Chat] Found vehicle in history: "${vehicleName}"`);
            break;
          }
        }
        if (vehicleName) break;
      }
    }

    // Last resort: Try to extract vehicle from user's CURRENT message
    if (!vehicleName) {
      console.log(`[WhatsApp AI Chat] Trying to extract vehicle from current user message...`);
      const currentMsg = userMessage.toLowerCase();
      const vehicleModels = ['innova', 'avanza', 'xenia', 'brio', 'jazz', 'ertiga', 'rush', 'terios', 'fortuner', 'pajero', 'alphard', 'civic', 'accord', 'crv', 'hrv', 'brv', 'yaris', 'camry', 'calya', 'sigra', 'ayla', 'agya', 'xpander', 'livina', 'city', 'mobilio', 'freed', 'vios', 'corolla'];
      for (const model of vehicleModels) {
        if (currentMsg.includes(model)) {
          vehicleName = model.charAt(0).toUpperCase() + model.slice(1);
          console.log(`[WhatsApp AI Chat] Found vehicle in current message: "${vehicleName}"`);
          break;
        }
      }
    }

    // Still no vehicle? Check user messages for vehicle mentions
    if (!vehicleName && messageHistory.length > 0) {
      console.log(`[WhatsApp AI Chat] Checking user messages for vehicle mentions...`);
      const userMessages = messageHistory.filter(m => m.role === "user");
      for (const msg of [...userMessages].reverse()) {
        const vehicleModels = ['innova', 'avanza', 'xenia', 'brio', 'jazz', 'ertiga', 'rush', 'terios', 'fortuner', 'pajero', 'alphard', 'civic', 'accord', 'crv', 'hrv', 'brv', 'yaris', 'camry', 'calya', 'sigra', 'ayla', 'agya', 'xpander', 'livina', 'city', 'mobilio', 'freed', 'vios', 'corolla'];
        for (const model of vehicleModels) {
          if (msg.content.toLowerCase().includes(model)) {
            vehicleName = model.charAt(0).toUpperCase() + model.slice(1);
            console.log(`[WhatsApp AI Chat] Found vehicle in user history: "${vehicleName}"`);
            break;
          }
        }
        if (vehicleName) break;
      }
    }

    if (!vehicleName) {
      console.log(`[PhotoConfirm DEBUG] ⚠️ Could not extract vehicle name from any source`);

      // If user explicitly asks for photos (e.g., "iya mana fotonya"),
      // try to send ANY recent available vehicle photos as last resort
      if (userExplicitlyAsksPhoto) {
        console.log(`[PhotoConfirm DEBUG] 🔄 Entering fallback: send any available photos...`);
        try {
          const anyVehicles = await prisma.vehicle.findMany({
            where: { tenantId, status: 'AVAILABLE' },
            include: {
              photos: {
                orderBy: { isMainPhoto: 'desc' },
                take: 1,
              },
            },
            orderBy: { createdAt: 'desc' },
            take: 2,
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
            const images = this.buildImageArray(anyVehicles);
            console.log(`[PhotoConfirm DEBUG] buildImageArray returned: ${images?.length || 0} images`);
            if (images && images.length > 0) {
              console.log(`[PhotoConfirm DEBUG] ✅ SUCCESS! Returning ${images.length} images`);
              return {
                message: `Ini foto unit terbaru kami ya 📸👇\n\nAda yang mau ditanyakan tentang unit-unit ini? 😊`,
                shouldEscalate: false,
                confidence: 0.85,
                images,
              };
            }
          }
          // Vehicles exist but no photos available
          if (anyVehicles.length > 0) {
            const vehicleList = anyVehicles.slice(0, 3).map(v => `• ${v.make} ${v.model} ${v.year}`).join('\n');
            console.log(`[PhotoConfirm DEBUG] ⚠️ Vehicles found but no photos, returning list`);
            return {
              message: `Maaf, foto belum tersedia saat ini 🙏\n\nTapi ada unit ready nih:\n${vehicleList}\n\nMau info detail yang mana? 😊`,
              shouldEscalate: false,
              confidence: 0.8,
            };
          }
          console.log(`[PhotoConfirm DEBUG] ❌ No vehicles found at all`);
        } catch (e: any) {
          console.error(`[PhotoConfirm DEBUG] ❌ ERROR in fallback:`, e.message);
          console.error(`[PhotoConfirm DEBUG] Error stack:`, e.stack);
        }
      } else {
        console.log(`[PhotoConfirm DEBUG] ❌ userExplicitlyAsksPhoto is false, not entering fallback`);
      }

      console.log(`[PhotoConfirm DEBUG] ❌ Returning NULL from handlePhotoConfirmationDirectly`);
      return null;
    }

    console.log(`[PhotoConfirm DEBUG] ✅ Vehicle name extracted: "${vehicleName}"`);

    // Check if user is asking for DETAILED photos (interior, exterior, semua, lengkap, dll)
    const detailPatterns = [
      /\b(detail|lengkap|semua|all)\b/i,
      /\b(interior|eksterior|dalam|luar)\b/i,
      /\b(dashboard|jok|bagasi|mesin)\b/i,
      /\bfoto.*(semua|lengkap|detail)\b/i,
      /\b(semua|lengkap).*(foto|gambar)\b/i,
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
          return {
            message: detailedMessage,
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
          message: `Siap! Ini foto ${vehicleName}-nya ya 📸👇\n\nAda pertanyaan lain tentang unit ini? 😊`,
          shouldEscalate: false,
          confidence: 0.95,
          images,
        };
      } else {
        console.log(`[PhotoConfirm DEBUG] ⚠️ No images found for "${vehicleName}", returning text response`);
        return {
          message: `Wah, maaf ya foto ${vehicleName} belum tersedia saat ini 🙏\n\nAda yang lain yang bisa kami bantu? 😊`,
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
   * Format price to Indonesian format
   * Note: Database stores prices in full Rupiah (Rp 79jt = 79000000)
   * No division needed - prices are already in correct format
   */
  private static formatPrice(price: number): string {
    // Price is already in Rupiah, just format it
    return new Intl.NumberFormat("id-ID").format(Math.round(price));
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
   * IMPORTANT: Only returns images for vehicles matching the specific query
   * Does NOT fallback to unrelated vehicles - customer asked for specific vehicle!
   */
  private static async fetchVehicleImagesByQuery(
    searchQuery: string,
    tenantId: string
  ): Promise<Array<{ imageUrl: string; caption?: string }> | null> {
    console.log('[WhatsApp AI Chat] 📸 Fetching vehicles for query:', searchQuery);
    console.log('[WhatsApp AI Chat] Tenant ID:', tenantId);

    // Parse search query into individual terms and filter out stop words
    const searchTerms = searchQuery.toLowerCase()
      .split(/\s+/)
      .filter(term => term.length > 0 && !this.INDONESIAN_STOP_WORDS.includes(term));

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
      return this.buildImageArray(anyVehicles);
    }

    return this.buildImageArray(vehicles);
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
      .filter(term => term.length > 0 && !this.INDONESIAN_STOP_WORDS.includes(term));

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
    const images = this.buildImageArray([vehicle]);
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

    message += `\n📸 Berikut foto-foto unitnya 👇`;

    return message;
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

      // Loop through ALL photos for this vehicle (not just the first one)
      // This sends interior, exterior, dashboard, etc. as requested by customer
      for (let photoIndex = 0; photoIndex < v.photos.length; photoIndex++) {
        const photo = v.photos[photoIndex];
        console.log(`[WhatsApp AI Chat] Photo ${photoIndex + 1}/${v.photos.length}:`, {
          id: photo.id,
          isMainPhoto: photo.isMainPhoto,
          originalUrl: photo.originalUrl?.substring(0, 100),
        });

        // Prioritize JPG (originalUrl) for better WhatsApp mobile compatibility
        // WebP format (medium/large) may not display on some mobile devices
        // Fallback: originalUrl (JPG) → largeUrl → mediumUrl
        let imageUrl = photo.originalUrl || photo.largeUrl || photo.mediumUrl;

        if (!imageUrl) {
          console.log(`[WhatsApp AI Chat] ⚠️ No valid URL for photo ${photoIndex + 1}`);
          continue;
        }

        // Convert relative URL to full URL
        if (imageUrl.startsWith('/')) {
          imageUrl = `${baseUrl}${imageUrl}`;
        }

        // Ensure URL is properly encoded (handle spaces, special chars)
        try {
          const url = new URL(imageUrl);
          imageUrl = url.toString();
        } catch (e) {
          console.log(`[WhatsApp AI Chat] ⚠️ Invalid URL format, using as-is: ${imageUrl}`);
        }

        // Caption: only show full details on first photo, simpler for rest
        const caption = photoIndex === 0
          ? `${v.make} ${v.model}${v.variant ? ` ${v.variant}` : ''} ${v.year} - Rp ${this.formatPrice(Number(v.price))}\n${v.mileage ? `${v.mileage.toLocaleString('id-ID')} km • ` : ''}${v.transmissionType || 'Manual'} • ${v.color || '-'}`
          : `${v.make} ${v.model} ${v.year} (${photoIndex + 1}/${v.photos.length})`;

        images.push({ imageUrl, caption });
      }
      console.log(`[WhatsApp AI Chat] ✅ Added ${v.photos.length} photos for ${v.make} ${v.model}`);
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
    const patterns: Array<{ pattern: RegExp; field: string; valueExtractor: (m: RegExpMatchArray) => string }> = [
      // Mileage: "rubah km 50000", "km jadi 50000", "update kilometer 30000"
      { pattern: /(?:rubah|ganti|ubah|update|edit)\s*(?:km|kilometer|odometer)\s*(?:ke|jadi|menjadi)?\s*(\d+)/i, field: 'mileage', valueExtractor: m => m[1] },
      { pattern: /(?:km|kilometer)\s*(?:ke|jadi|menjadi)\s*(\d+)/i, field: 'mileage', valueExtractor: m => m[1] },

      // Fuel type: "ganti bensin jadi diesel", "ubah ke diesel"
      { pattern: /(?:rubah|ganti|ubah)\s*(?:bahan\s*bakar|fuel|bensin|solar)?\s*(?:ke|jadi|menjadi)\s*(diesel|bensin|hybrid|electric|listrik)/i, field: 'fuelType', valueExtractor: m => m[1] },
      { pattern: /(?:rubah|ganti|ubah)\s*(bensin|diesel|hybrid|electric)\s*(?:ke|jadi|menjadi)\s*(diesel|bensin|hybrid|electric|listrik)/i, field: 'fuelType', valueExtractor: m => m[2] },

      // Year: "ganti tahun ke 2018", "ubah tahun 2016 jadi 2018"
      { pattern: /(?:rubah|ganti|ubah|update)\s*tahun\s*(?:\d+\s*)?(?:ke|jadi|menjadi)\s*(\d{4})/i, field: 'year', valueExtractor: m => m[1] },
      { pattern: /tahun\s*(?:ke|jadi|menjadi)\s*(\d{4})/i, field: 'year', valueExtractor: m => m[1] },

      // Price: "update harga 150jt", "ganti harga ke 200000000"
      {
        pattern: /(?:rubah|ganti|ubah|update)\s*harga\s*(?:ke|jadi|menjadi)?\s*(\d+(?:jt|juta)?)/i, field: 'price', valueExtractor: m => {
          const val = m[1].toLowerCase();
          if (val.includes('jt') || val.includes('juta')) {
            return String(parseInt(val) * 1000000);
          }
          return val;
        }
      },

      // Transmission: "ganti transmisi ke matic", "ubah ke manual"
      {
        pattern: /(?:rubah|ganti|ubah)\s*(?:transmisi)?\s*(?:ke|jadi|menjadi)\s*(matic|manual|automatic|cvt|at|mt)/i, field: 'transmission', valueExtractor: m => {
          const val = m[1].toLowerCase();
          if (val === 'matic' || val === 'at' || val === 'automatic') return 'automatic';
          if (val === 'manual' || val === 'mt') return 'manual';
          return val;
        }
      },

      // Color: "ganti warna ke hitam", "ubah warna putih jadi merah"
      { pattern: /(?:rubah|ganti|ubah)\s*warna\s*(?:\w+\s*)?(?:ke|jadi|menjadi)\s*(\w+)/i, field: 'color', valueExtractor: m => m[1] },

      // Engine capacity: "ubah cc ke 1500", "ganti kapasitas mesin 1497"
      { pattern: /(?:rubah|ganti|ubah)\s*(?:cc|kapasitas\s*mesin)\s*(?:ke|jadi|menjadi)?\s*(\d+)/i, field: 'engineCapacity', valueExtractor: m => m[1] },
    ];

    for (const { pattern, field, valueExtractor } of patterns) {
      const match = msg.match(pattern);
      if (match) {
        const newValue = valueExtractor(match);
        console.log(`[WhatsApp AI Chat] Fallback detected edit: field=${field}, newValue=${newValue}, vehicleId=${vehicleId || 'from context'}`);
        return { vehicleId, field, newValue };
      }
    }

    return null;
  }
}

export default WhatsAppAIChatService;
