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
  isEscalated?: boolean; // Escalated conversations get faster, more direct responses
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
        // Add a race condition with manual timeout (30s max for better UX)
        const apiCallPromise = zaiClient.generateText({
          systemPrompt,
          userPrompt: conversationContext,
        });

        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(new Error('ZAI API call timed out after 30 seconds'));
          }, 30000); // 30 second timeout - faster feedback for customers
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
            context.tenantId
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
        context.tenantId
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
    tenantId: string
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

    // ==================== PHOTO CONFIRMATION HANDLER (CRITICAL FIX) ====================
    // Handle photo confirmations FIRST before other fallbacks
    // IMPORTANT: This MUST return a photo-related response, NEVER fall through!
    const photoConfirmPatterns = [
      /^(boleh|ya|iya|ok|oke|mau|yup|sip|siap|bisa)$/i,
      /\b(iya|ya|ok|oke|mau|boleh)\b.*\b(foto|gambar)/i,
      /\b(mana|kirim|kasih|tunjuk|lihat)\b.*\b(foto|gambar)/i,
      /\bfoto\s*(nya|dong|ya|aja|mana)?\b/i,
      /\bgambar\s*(nya|dong|ya|aja|mana)?\b/i,
      /^mana\s/i, // "mana fotonya", "mana gambarnya"
    ];
    const isPhotoConfirmation = photoConfirmPatterns.some(p => p.test(msg));

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

      let vehicleName = "";

      // Try to extract from last AI message first
      if (lastAiMsg) {
        for (const pattern of vehiclePatterns) {
          const match = lastAiMsg.content.match(pattern);
          if (match && match[0]) {
            vehicleName = match[0].trim()
              .replace(/\s+(dengan|harga|transmisi|kilometer|warna|unit|sangat|siap|diesel|bensin|matic|manual|yang).*$/i, "")
              .trim();
            console.log(`[SmartFallback] Found vehicle in AI message: "${vehicleName}"`);
            break;
          }
        }
      }

      // Fallback: check all messages in history
      if (!vehicleName) {
        const vehicleModelsLower = ['innova', 'avanza', 'xenia', 'brio', 'jazz', 'ertiga', 'rush', 'terios', 'fortuner', 'pajero', 'alphard', 'civic', 'crv', 'hrv', 'brv', 'yaris', 'camry', 'calya', 'sigra', 'xpander', 'city'];
        for (const historyMsg of [...messageHistory].reverse()) {
          for (const model of vehicleModelsLower) {
            if (historyMsg.content.toLowerCase().includes(model)) {
              vehicleName = model.charAt(0).toUpperCase() + model.slice(1);
              console.log(`[SmartFallback] Found vehicle in history: "${vehicleName}"`);
              break;
            }
          }
          if (vehicleName) break;
        }
      }

      // Try to fetch photos
      try {
        if (vehicleName) {
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
        const price = Math.round(Number(matchingVehicle.price) / 100).toLocaleString('id-ID');
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
        relevantVehicles = vehicles.filter(v => Number(v.price) / 100 <= budget * 1.2);
      }

      if (relevantVehicles.length > 0) {
        const list = relevantVehicles.slice(0, 3).map(v => {
          const price = Math.round(Number(v.price) / 100 / 1000000);
          return `• ${v.make} ${v.model} ${v.year} - Rp ${price} jt`;
        }).join('\n');

        return {
          message: `Ada beberapa pilihan ${budget > 0 ? `di budget Rp ${budget/1000000} juta` : ''} nih! 💰✨\n\n${list}\n\nMau info detail yang mana? 😊`,
          shouldEscalate: false,
        };
      }
    }

    // Check if greeting
    if (/^(halo|hai|hello|hi|sore|pagi|siang|malam|selamat)/i.test(msg)) {
      return {
        message: `Halo! Selamat datang di ${tenantName}! 👋😊\n\n` +
          `Saat ini tersedia ${vehicles.length} unit kendaraan 🚗✨\n\n` +
          `Silakan info mobil yang dicari atau sebutkan budget-nya, kami bantu carikan yang cocok ya!`,
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

    // Ultimate fallback
    return {
      message: `Maaf, ada kendala teknis nih 🙏 Bisa diulang pertanyaannya?`,
      shouldEscalate: true,
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
    senderInfo?: { isStaff: boolean; staffInfo?: { name: string; role: string; phone: string }; customerPhone: string; isEscalated?: boolean }
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
- Gunakan emoji untuk membuat percakapan lebih hangat dan friendly 😊
- Emoji yang cocok: 👋 (salam), 🚗 (mobil), 📸 (foto), ✨ (highlight), 💰 (harga), 📋 (info), 🙏 (terima kasih), 😊 (ramah), 👍 (ok)
- Berikan informasi lengkap namun ringkas (3-4 kalimat)

CARA MERESPONS:

1. PERTANYAAN TENTANG MOBIL (merk/budget/tahun/transmisi/km):
   → Berikan informasi lengkap dari stok yang tersedia
   → Sebutkan: Nama, Tahun, Harga, Kilometer, Transmisi
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

CONTOH PERCAKAPAN BENAR:

C: "ada Avanza matic ga?"
A: "Halo Bapak/Ibu! 👋 Ada unit Avanza 2021 Matic nih 🚗✨ Harga Rp 180 juta, km 35.000, warna Silver. Mau lihat fotonya? 📸"

C: "boleh"
A: [panggil send_vehicle_images dengan query "Avanza" SAJA] "Siap! Ini foto Avanza-nya ya 📸👇"
   (HANYA kirim foto Avanza, BUKAN foto mobil lain!)

C: "tertarik Innova Reborn PM-PST-005, bisa lihat fotonya?"
A: [panggil send_vehicle_images dengan query "Innova Reborn PM-PST-005"] "Baik, ini foto Innova Reborn-nya 📸👇"
   (HANYA Innova yang diminta, JANGAN kirim foto Calya, Fortuner, dll!)

C: "budget 100-150jt ada apa aja?"
A: "Untuk budget Rp 100-150 juta ada beberapa pilihan bagus nih 💰✨\n• Honda Brio 2019 - Rp 125 juta\n• Toyota Agya 2020 - Rp 110 juta\nMau info detail yang mana? 😊"

C: "ga usah deh, km nya berapa?"
A: "Oke, tidak masalah! 👍 Untuk info kilometer:\n• Brio 2019: 45.000 km\n• Agya 2020: 30.000 km\nAda yang lain yang bisa dibantu? 😊"

C: "tidak ada, cukup"
A: "Siap, terima kasih sudah menghubungi ${tenant.name}! 🙏✨ Semoga infonya bermanfaat. Kalau ada pertanyaan lagi, langsung hubungi kami ya! 👋"

C: "halo"
A: "Halo! Selamat datang di ${tenant.name}! 👋😊 Kami siap bantu carikan mobil impian Anda. Silakan info merk, budget, atau tipe mobil yang dicari ya! 🚗✨"
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

Jika pengirim bertanya "siapa saya?" atau "kamu tahu saya?", JAWAB bahwa mereka adalah staff terdaftar dengan nama dan role di atas.

✏️ FITUR EDIT KENDARAAN (KHUSUS STAFF):
Staff ini BISA mengedit data kendaraan yang sudah diupload.

WAJIB PANGGIL TOOL edit_vehicle jika staff minta edit! Contoh:
- "rubah km 50000" → PANGGIL edit_vehicle(field="mileage", new_value="50000")
- "ganti bensin jadi diesel" → PANGGIL edit_vehicle(field="fuelType", new_value="diesel")
- "ubah tahun ke 2018" → PANGGIL edit_vehicle(field="year", new_value="2018")
- "update harga 150jt" → PANGGIL edit_vehicle(field="price", new_value="150000000")
- "ganti transmisi ke matic" → PANGGIL edit_vehicle(field="transmission", new_value="automatic")
- "rubah warna ke hitam" → PANGGIL edit_vehicle(field="color", new_value="hitam")

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
❌ Respon selanjutnya: [Kirim menu lengkap lagi] - Jangan`;
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

    // Fetch vehicle images
    try {
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
   * IMPORTANT: Only returns images for vehicles matching the specific query
   * Does NOT fallback to unrelated vehicles - customer asked for specific vehicle!
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
    const termConditions = searchTerms.map(term => ({
      OR: [
        { make: { contains: term, mode: 'insensitive' as const } },
        { model: { contains: term, mode: 'insensitive' as const } },
        { variant: { contains: term, mode: 'insensitive' as const } },
        { displayId: { contains: term, mode: 'insensitive' as const } },
      ]
    }));

    const vehicles = await prisma.vehicle.findMany({
      where: {
        tenantId,
        status: 'AVAILABLE',
        // AND logic: ALL terms must match (each term can match any field)
        ...(termConditions.length > 0 && { AND: termConditions }),
      },
      include: {
        photos: {
          orderBy: { isMainPhoto: 'desc' },
          take: 2, // Get main photo + 1 backup
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
      { pattern: /(?:rubah|ganti|ubah|update)\s*harga\s*(?:ke|jadi|menjadi)?\s*(\d+(?:jt|juta)?)/i, field: 'price', valueExtractor: m => {
        const val = m[1].toLowerCase();
        if (val.includes('jt') || val.includes('juta')) {
          return String(parseInt(val) * 1000000);
        }
        return val;
      }},

      // Transmission: "ganti transmisi ke matic", "ubah ke manual"
      { pattern: /(?:rubah|ganti|ubah)\s*(?:transmisi)?\s*(?:ke|jadi|menjadi)\s*(matic|manual|automatic|cvt|at|mt)/i, field: 'transmission', valueExtractor: m => {
        const val = m[1].toLowerCase();
        if (val === 'matic' || val === 'at' || val === 'automatic') return 'automatic';
        if (val === 'manual' || val === 'mt') return 'manual';
        return val;
      }},

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
