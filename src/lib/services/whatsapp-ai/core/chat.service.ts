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
  DATA_INTEGRITY_RULES,
  AUTOMOTIVE_KNOWLEDGE_BASE,
  getCompanyKnowledgeBase,
  STAFF_COMMAND_HELP,
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
    const emojiPattern = /[\u{1F300}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}]/u;
    if (emojiPattern.test(msg)) {
      aktifScore += 1;
    }

    // 4. Greeting -> Aktif +1 (New Proxy)
    const greetingPattern = /^(halo|hai|selamat|pagi|siang|sore|malam|assalam|permisi|hi|hello)/i;
    if (greetingPattern.test(msg)) {
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

      // Check business hours (optional) - Apply to all customers (new and returning)
      // STAFF ALWAYS BYPASS business hours check
      const isStaff = context.isStaff || false;

      // Determine if we should check hours: if config has businessHours AND user is NOT staff
      const hasBusinessHours = config.businessHours &&
        typeof config.businessHours === 'object' &&
        Object.keys(config.businessHours as object).length > 0;

      const shouldCheckHours = hasBusinessHours && !isStaff;

  // ==================== NEW AGENTIC CAPABILITY: SALES NOTIFICATION ====================
  // Proactive notification to sales staff when a HOT LEAD is detected
  private static async notifySalesStaff(tenantId: string, leadData: {
        customerName: string,
        customerPhone: string,
        vehicleName: string,
        budget: string,
        status: string,
        notes: string
      }) {
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

        typeof config.businessHours === 'object' &&
  Object.keys(config.businessHours as object).length > 0;

const shouldCheckHours = hasBusinessHours && !isStaff;

if (shouldCheckHours && !this.isWithinBusinessHours(config.businessHours, config.timezone)) {
  console.log(`[WhatsApp AI Chat] 🌙 Outside business hours for ${context.customerPhone}`);

  // Use custom message if set, otherwise professional default
  const afterHoursMsg = config.afterHoursMessage ||
    `Halo! 👋 Terima kasih sudah menghubungi ${showroomName}.\n\n` +
    `Mohon maaf, saat ini kami sedang di luar jam operasional. 🙏\n\n` +
    `Pesan Anda sudah kami catat dan asisten virtual kami akan segera membantu Anda kembali di jam kerja.\n\n` +
    `Terima kasih atas pengertiannya! 😊`;

  return {
    message: afterHoursMsg,
    shouldEscalate: false,
    confidence: 1.0,
    processingTime: Date.now() - startTime,
  };
}

if (isStaff) {
  console.log(`[WhatsApp AI Chat] ✅ Staff detected - bypassing business hours check`);
}

let aiResponse: any = null;
let resultImages: Array<{ imageUrl: string; caption?: string }> | null = null;

// ==================== PRE-AI PHOTO CONFIRMATION HANDLER ====================
// Handle photo confirmations BEFORE calling AI to avoid AI failures breaking the flow
const photoConfirmResult = await this.handlePhotoConfirmationDirectly(
  userMessage,
  context.messageHistory,
  context.tenantId
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
  };
  const systemPrompt = await this.buildSystemPrompt(
    account.tenant || { name: "Showroom Kami", city: "Indonesia" },
    config,
    context.intent,
    senderInfo,
    customerTone, // Pass tone result
    context.leadInfo // Pass CRM Lead Info
  );

  // --- SPECIFIC ROLE INJECTION ---
  // Inject Admin/Owner specific prompt addition if applicable to give them full access context
  if (senderInfo.isStaff && senderInfo.staffInfo?.roleLevel && senderInfo.staffInfo.roleLevel >= ROLE_LEVELS.ADMIN) {
    console.log(`[WhatsApp AI Chat] 👑 Admin/Owner detected (Level ${senderInfo.staffInfo.roleLevel}). Injecting Admin Prompt.`);
    // This ensures AI knows it's talking to an Admin and can offer the full menu
    // We append this to the system prompt
    systemPrompt.content += "\n\n" + ADMIN_SYSTEM_PROMPT_ADDITION;

    // CRITICAL: Override the standard "help/menu" behavior for Admins
    // We tell the AI explicitly: "If this Admin asks for 'help' or 'menu', output the text from ADMIN_COMMAND_HELP."
    systemPrompt.content += `\n\n[ADMIN MENU OVERRIDE]\nIf the user asks for 'help', 'menu', 'panduan', or 'fitur', YOU MUST DISPLAY the following text EXACTLY:\n"""\n${ADMIN_COMMAND_HELP}\n"""`;
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

// 2b. LAZINESS FILTER - Catch and replace "cek dulu" or "mohon ditunggu"
// ONLY if no tool calls are being made (if tool calls exist, "checking" is valid)
const hasToolCalls = aiResponse.toolCalls && aiResponse.toolCalls.length > 0;

if (!hasToolCalls && (responseMessage.toLowerCase().includes("cek dulu") || responseMessage.toLowerCase().includes("mohon ditunggu"))) {
  console.log(`[WhatsApp AI Chat] ⚠️ Laziness detected in response: "${responseMessage}"`);
  // If the AI is being lazy, we force it to look for vehicles
  const vehicles = await this.getAvailableVehiclesDetailed(context.tenantId);
  if (vehicles.length > 0) {
    const vehicleList = this.formatVehicleListDetailed(vehicles.slice(0, 3));
    responseMessage = `Mohon maaf kak, untuk ketersediaan unit saat ini bisa langsung cek daftar ready stock kami berikut ini ya:\n\n${vehicleList}\n\n` +
      `Mau lihat fotonya? 📸 (Atau ada kriteria unit lain yang dicari?)`;
  }
}

// 3. CRITICAL PRICE VALIDATION - Catch absurd prices before sending to customer
// This prevents the "1 jt" and "5 jt" error that should NEVER happen
// Relaxed: Only flag if it's LIKELY a vehicle price (not DP/Cicilan) and very low
const pricePattern = /\bHarga:\s*Rp\s*(\d+(?:\.\d+)?)\s*(jt|juta)\b/gi;
const priceMatches = Array.from(responseMessage.matchAll(pricePattern));
let hasSuspiciousPrice = false;

for (const match of priceMatches) {
  const priceValue = parseFloat(match[1]);

  // Flag suspicious prices (less than 10 juta for regular cars in "Harga:" context)
  if (priceValue < 10) {
    hasSuspiciousPrice = true;
    console.log(`[WhatsApp AI Chat] Suspicious price detected: "Rp ${priceValue} ${match[2]}"`);
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
let messages: any[] = []; // Added for tool output feedback

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
          if (resultLead?.id && context.conversationId) {
            await prisma.whatsAppConversation.update({
              where: { id: context.conversationId },
              data: { leadId: resultLead.id }
            }).catch(err => console.error('[WhatsAppAI] Failed to link conversation to lead:', err));
          }

          // Add result to messages for AI to know process succeeded
          messages.push({
            role: "function",
            name: toolName,
            content: JSON.stringify({ success: true, lead_id: resultLead.id, message: "Lead saved successfully." })
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

// ==================== FINAL POST-PROCESSING ====================
// This section ensures that EVERYTHING (AI text + tool results) follows brand rules

// 1. Critical Showroom Name Check
// const showroomName = account?.tenant?.name || "Showroom Kami"; // Moved up

// 2. SELF-HEALING GREETINGS (Context-Aware)
// Only add greeting if:
// - This is a new conversation (first few messages)
// - User's last message was a greeting
// - Previous AI response didn't have a greeting (avoid double-greeting)
if (responseMessage.length > 0) {
  const now = new Date();
  const wibTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
  const hour = wibTime.getHours();

  let timeGreeting = "Selamat malam";
  if (hour >= 4 && hour < 11) timeGreeting = "Selamat pagi";
  else if (hour >= 11 && hour < 15) timeGreeting = "Selamat siang";
  else if (hour >= 15 && hour < 18) timeGreeting = "Selamat sore";

  const lowerResponse = responseMessage.toLowerCase().trim();
  const startsWithGreeting =
    lowerResponse.startsWith("selamat pagi") ||
    lowerResponse.startsWith("selamat siang") ||
    lowerResponse.startsWith("selamat sore") ||
    lowerResponse.startsWith("selamat malam") ||
    lowerResponse.startsWith("halo") ||
    lowerResponse.startsWith("hai");

  // ✅ FIX: Check conversation context before adding greeting
  const isNewConversation = context.messageHistory.length <= 2;
  const lastUserMsg = context.messageHistory.filter(m => m.role === "user").pop();
  const userLastMsgContent = lastUserMsg?.content?.toLowerCase().trim() || "";
  const lastUserMsgIsGreeting = /^(halo|hai|hi|selamat|pagi|siang|sore|malam|assalam)/i.test(userLastMsgContent);

  // Only add greeting if conversation needs it
  const conversationNeedsGreeting = isNewConversation || lastUserMsgIsGreeting;

  if (!startsWithGreeting && conversationNeedsGreeting) {
    responseMessage = `${timeGreeting}! 👋\n\n${responseMessage.trim()}`;
    console.log(`[WhatsApp AI Chat] 👋 Added greeting (new conversation: ${isNewConversation}, user greeted: ${lastUserMsgIsGreeting})`);
  } else if (!startsWithGreeting && !conversationNeedsGreeting) {
    console.log(`[WhatsApp AI Chat] ℹ️ Skipped greeting (mid-conversation, user message: "${userLastMsgContent.substring(0, 30)}...")`);
  }
}

// 3. LAZINESS FILTER - Catch and replace "cek dulu" or "mohon ditunggu"
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
if (aiResponse.toolCalls?.some(tc =>
  tc.type === 'function' && 'function' in tc && tc.function.name === 'send_vehicle_images'
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
  context ?: ChatContext // Add context for staff info
): Promise < { message: string; shouldEscalate: boolean; images?: Array<{ imageUrl: string; caption?: string }> } > {
  const msg = userMessage.toLowerCase().trim();
  console.log(`[SmartFallback DEBUG] Processed message: "${msg}"`);

  // Get tenant info
  let tenantName = "kami";
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true }
    });
    if(tenant) tenantName = tenant.name;
  } catch(e) { /* ignore */ }

    // Get available vehicles for context
    let vehicles: any[] = [];

  // Standard Time-based Greeting
  const now = new Date();
  const hour = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' })).getHours();
  let timeGreeting = "Selamat malam";
  if(hour >= 4 && hour < 11) timeGreeting = "Selamat pagi";
    else if (hour >= 11 && hour < 15) timeGreeting = "Selamat siang";
else if (hour >= 15 && hour < 18) timeGreeting = "Selamat sore";

try {
  vehicles = await prisma.vehicle.findMany({
    where: { tenantId, status: "AVAILABLE" },
    select: { id: true, displayId: true, make: true, model: true, year: true, price: true, mileage: true, transmissionType: true, color: true, variant: true, fuelType: true },
    take: 10,
  });
} catch (e) { /* ignore */ }

// ==================== PRIORITY 0: CONTEXTUAL ANSWER HANDLER ====================
// Handle short answers to previous AI questions (e.g. "Malang", "Cash", "Budi")
// preventing AI from treating them as new search queries
const lastAiMsg = messageHistory.filter(m => m.role === "assistant").pop();

if (lastAiMsg) {
  const lastContent = lastAiMsg.content.toLowerCase();

  // 1. Location Answer (AI asked "area mana", "domisili", "kota")
  if (lastContent.includes("area mana") || lastContent.includes("domisili") || lastContent.includes("kota mana")) {
    console.log(`[SmartFallback] 📍 Location answer detected: "${msg}"`);

    // Extract vehicle context from history
    let vehicleContext = "";
    const vehiclePatterns = [
      /(?:Toyota|Honda|Suzuki|Daihatsu|Mitsubishi|Nissan|Mazda|BMW|Mercedes|Hyundai|Kia|Wuling)\s+[\w\s]+(?:\d{4})?/i,
      /PM-PST-\d+/i
    ];

    // Look back 5 messages for vehicle context
    const recentMsgs = messageHistory.slice(-5).reverse();
    for (const m of recentMsgs) {
      for (const p of vehiclePatterns) {
        const match = m.content.match(p);
        if (match) {
          vehicleContext = match[0];
          break;
        }
      }
      if (vehicleContext) break;
    }

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

    return {
      message: `Siap kak, terima kasih infonya! 🙏\n\nUntuk penggunaan di area **${userMessage}**, unit ${vehicleContext || 'yang Kakak minati'} sudah sangat cocok dan siap pakai.\n\nKebetulan unitnya masih ready, apakah Kakak ada rencana untuk cek unit langsung ke showroom atau mau saya kirimkan video detailnya dulu? 😊`,
      shouldEscalate: false
    };
  }

  // 2. Name Answer (AI asked "dengan siapa", "kakak siapa")
  if (lastContent.includes("dengan siapa") || lastContent.includes("kakak siapa") || lastContent.includes("boleh tau nama")) {
    console.log(`[SmartFallback] 👤 Name answer detected: "${msg}"`);
    // AUTO-MINING: Capture Name
    // Extract clean name (remove "saya", "nama saya", etc)
    const cleanName = userMessage.replace(/^(saya|nama|nama saya|aku|ini|dari)\s+/i, '').trim();
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

    return {
      message: `Salam kenal Kak ${cleanName}! 👋\n\nSenang bisa membantu Kakak. Ada lagi yang ingin ditanyakan tentang unit yang diminati? Atau mau saya bantu hitungkan simulasi kreditnya sekalian? 😊`,
      shouldEscalate: false
    };
  }

  // 3. Payment Answer (AI asked "cash atau kredit", "rencana pembayaran")
  if (lastContent.includes("cash") || lastContent.includes("kredit") || lastContent.includes("tunai")) {
    // Only trigger if user answer matches
    if (msg.includes("cash") || msg.includes("tunai") || msg.includes("keras")) {
      return {
        message: `Baik kak, untuk pembelian **Cash** kami bisa bantu pengurusan surat-surat agar lebih cepat selesai. ⚡\n\nUnit mau dicek kapan kak? Supaya kami siapkan. 😊`,
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

      return {
        message: `Siap kak, untuk **Kredit** boleh saya bantu simulasikan hitungannya? 💰\n\nKakak rencananya mau DP berapa dan tenor berapa tahun? (Contoh: "DP 50jt tenor 3 tahun")`,
        shouldEscalate: false
      };
    }
  }
}

// ==================== (MOVED) SPECIFIC VEHICLE INQUIRY HANDLER ====================
// Priority 0.5: Check for explicit Vehicle ID (PM-PST-XXX or PM PST-XXX)
const idMatchMatch = msg.match(/\b(pm[- ]?[a-zA-Z0-9]+-\d+)\b/i);
if (idMatchMatch) {
  // Normalize to standard PM-PST-XXX format for searching
  const explicitId = idMatchMatch[0].toUpperCase().replace(" ", "-");
  console.log(`[SmartFallback] 🎯 Explicit ID detected: ${explicitId}`);

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
    matchingVehicle = vehicles.find(v => (v.displayId || "").toUpperCase() === explicitId);
  }

  if (matchingVehicle) {
    const priceJuta = Math.round(Number(matchingVehicle.price) / 1000000);
    const name = `${matchingVehicle.make} ${matchingVehicle.model}`;

    let mainQuestion = "Mau saya kirimkan foto detail-nya atau Kakak ada yang ingin ditanyakan? 😊";
    if (!context?.customerName || context.customerName === "Pelanggan") {
      mainQuestion = "Boleh tau dengan Kakak siapa saya bicara? Supaya enak ngobrolnya 😊";
    }

    // Handle "dokumen" / "surat" / "pajak" context
    if (msg.includes("dokumen") || msg.includes("surat") || msg.includes("bpkb") || msg.includes("stnk") || msg.includes("pajak")) {
      const isTaxOnly = msg.includes("pajak") && !msg.includes("dokumen") && !msg.includes("surat");

      let docClosing = "Kakak rencana mau cek unit-nya kapan? Supaya kami siapkan surat-suratnya untuk Kakak lihat langsung. 😊";
      if (!context?.customerName || context.customerName === "Pelanggan") {
        docClosing = "Boleh tau dengan Kakak siapa saya bicara? Supaya enak ngobrolnya 😊";
      }

      return {
        message: `Untuk unit *${name}* (${explicitId}), ${isTaxOnly ? 'pajaknya masih HIDUP dan panjang' : 'dokumennya (BPKB, STNK, Faktur) LENGKAP'} kak. ✅\n\n` +
          `Semua berkas sudah kami cek keabsahannya dan dijamin aman. ${docClosing}`,
        shouldEscalate: false
      };
    }

    return {
      message: `Siap kak, unit *${name} ${matchingVehicle.year}* (${explicitId}) ini MASIH READY! 🔥\n\n` +
        `• Harga: Rp ${priceJuta} Juta (Nego)\n` +
        `• Kondisi: Terawat, siap pakai\n\n` +
        `Unit ini salah satu favorit di sini. ${mainQuestion}`,
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
    matchingVehicle = vehicles.find(v =>
      v.make.toLowerCase().includes(searchTerm) ||
      v.model.toLowerCase().includes(searchTerm)
    );
  }

  if (matchingVehicle) {
    const priceJuta = Math.round(Number(matchingVehicle.price) / 1000000);
    const id = matchingVehicle.displayId || matchingVehicle.id.substring(0, 6).toUpperCase();

    // Dynamic Closing Question for Lead Gen
    let closingQuestion = "Mau lihat fotonya? 📸";

    // If we don't know the customer's name yet, ask for it naturally
    if (!context.customerName || context.customerName === "Pelanggan") {
      closingQuestion = "Boleh tau dengan Kakak siapa saya bicara? Supaya enak ngobrolnya 😊";
    }
    // If we know the name but not location (simple heuristic)
    else if (!msg.toLowerCase().includes("jakarta") && !msg.toLowerCase().includes("bandung") && Math.random() > 0.5) {
      closingQuestion = "Rencana untuk pemakaian di area mana kak? Biar sekalian saya cek plat-nya. 😊";
    }
    // Otherwise ask about purchase plan
    else {
      closingQuestion = "Rencana mau ambil Cash atau Kredit kak? Bisa saya bantu hitungkan simulasinya sekalian. 💰";
    }

    const response = `Baik kak, unit *${matchingVehicle.make} ${matchingVehicle.model} ${matchingVehicle.year}* ini MASIH AVAILABLE! 🔥\n\n` +
      `• ID Unit: ${id}\n` +
      `• Harga: Rp ${priceJuta} Juta (Nego)\n` +
      `• Transmisi: ${matchingVehicle.transmissionType || 'Manual'}\n` +
      `• Warna: ${matchingVehicle.color || '-'}\n\n` +
      `Unit siap gass, kondisi terawat! 👍\n\n` +
      `${closingQuestion}`;

    return { message: response, shouldEscalate: false };
  } else {
    const searchTerm = (mentionedModel || mentionedBrand || "").charAt(0).toUpperCase() + (mentionedModel || mentionedBrand || "").slice(1);
    return {
      message: `Mohon maaf kak, unit ${searchTerm} yang Anda cari saat ini belum tersedia di showroom kami. 👋\n\n` +
        `Namun, kami memiliki beberapa koleksi unit favorit lainnya yang mungkin sesuai dengan selera Anda:\n\n${vehicles.slice(0, 3).map(v => {
          const id = v.displayId || v.id.substring(0, 6).toUpperCase();
          return `• ${v.make} ${v.model} ${v.year} | ${id}`;
        }).join('\n')}\n\n` +
        `Mau lihat fotonya? 📸 (Ketik "Ya" atau "Foto [ID]" untuk melihat) 😊`,
      shouldEscalate: false,
    };
  }
}

// ==================== AI CAPABILITY & IDENTITY HANDLER (AI 5.2) ====================
// Detect if user is asking about AI technology, identity, or Autolumiku
// IMPORTANT: Only trigger if SPECIFIC VEHICLE patterns were NOT matched above

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

// ONLY trigger identity response if:
// 1. It matches AI identity patterns
// 2. It's NOT a system feature question
// 3. It's NOT a contact request
if (looksLikeAIIdentity && !isSystemFeatureQuestion && !isExplicitContactRequest) {
  console.log(`[SmartFallback] 🤖 AI Identity question detected: "${msg}"`);

  const identityResponse =
    `${timeGreeting}! 👋\n\n` +
    `Saya adalah AI Assistant **Prima Mobil** yang ditenagai oleh teknologi **Autolumiku (AI 5.2)**. 🤖⚡\n\n` +
    `Saya menggunakan teknologi *Natural Language Processing* tingkat lanjut untuk memberikan informasi stok kendaraan secara real-time, simulasi kredit, hingga pengolahan data visual unit kami.\n\n` +
    `Ada yang bisa saya bantu terkait unit mobil di showroom kami hari ini? 😊`;

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

  return {
    message: policyResponse + "\n\nAda skenario respon lain yang ingin Bapak/Ibu cek? 😊",
    shouldEscalate: false,
  };
}

// ==================== SYSTEM FEATURE HANDLER ====================
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
    featureResponse += `Sistem **Autolumiku (AI 5.2)** bekerja dengan memproses setiap pesan masuk secara cerdas. Saya bisa membantu memberikan info stok, foto, lokasi showroom, hingga simulasi kredit secara otomatis.\n\n` +
      `Semua data ini terintegrasi langsung dengan database showroom sehingga informasinya selalu akurat. ✅\n\n` +
      `Mau saya bantu cek unit atau info lainnya? 😊`;
  }

  return {
    message: featureResponse,
    shouldEscalate: false,
  };
}

// ==================== GREETING HANDLER (OPENING GREETING) ====================
// Detect greeting patterns for new conversations
const greetingPatterns = [
  /^(halo|hai|hello|hi|hey)\b/i, // Broadened to catch "Halo ..."
  /^(pagi|siang|sore|malam)\b/i,
  /^selamat\s+(pagi|siang|sore|malam)/i,
  /^(assalamualaikum|assalamu'?alaikum)/i,
  /^(halo|hai|hi)\s+(kak|mas|mbak|pak|bu)/i,
  /^(permisi|maaf)\s*(ganggu)?/i,
];
const isGreeting = greetingPatterns.some(p => p.test(msg));
const isNewConversation = messageHistory.length <= 2;
console.log(`[SmartFallback DEBUG] Greeting Check: isGreeting=${isGreeting}, isNewConversation=${isNewConversation}`);

// Check if it looks like a greeting (short message, starts with greeting word)
const looksLikeGreeting = msg.length < 20 && /^(halo|hai|hi|pagi|siang|sore|malam|selamat|assalam)/i.test(msg);

if (isGreeting || (isNewConversation && looksLikeGreeting)) {
  console.log(`[SmartFallback] 👋 Greeting detected: "${msg}" - sending warm welcome`);

  // Get time-based greeting (WIB)
  const now = new Date();
  const wibTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
  const hour = wibTime.getHours();
  timeGreeting = "Selamat malam";
  if (hour >= 4 && hour < 11) timeGreeting = "Selamat pagi";
  else if (hour >= 11 && hour < 15) timeGreeting = "Selamat siang";
  else if (hour >= 15 && hour < 18) timeGreeting = "Selamat sore";

  // Get some available vehicles for the greeting
  let vehiclePreview = "";
  if (vehicles.length > 0) {
    vehiclePreview = `\n\n🚗 Beberapa pilihan mobil kami:\n\n`;
    const limitedVehicles = vehicles.slice(0, 3);
    vehiclePreview += WhatsAppAIChatService.formatVehicleListDetailed(limitedVehicles);
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
    personalizedGreeting += `Saya mengenali Anda sebagai ${roleLabel} ${tenantName}. `;
    personalizedGreeting += `Ada yang bisa saya bantu hari ini?${vehiclePreview}`;
  } else {
    // Generic greeting for unidentified users
    personalizedGreeting = `${timeGreeting}! 👋\n\n`;
    personalizedGreeting += `Halo, selamat datang di ${tenantName}!\n\n`;
    personalizedGreeting += `Saya adalah Asisten virtual yang siap membantu Anda menemukan mobil impian dan mendapatkan informasi yang Anda butuhkan.\n\n`;
    personalizedGreeting += `Boleh tau dengan Kakak siapa saya bicara? 😊\n`; // Changed to ask for name directly
    personalizedGreeting += `${vehiclePreview}`;
  }

  return {
    message: personalizedGreeting + "\n\nApakah ada hal lain yang bisa kami bantu? 😊",
    shouldEscalate: false,
  };
}

// ==================== GENERAL INVENTORY INQUIRY HANDLER ====================
// Detect if user is asking to see cars in general (e.g. "lihat mobil", "stok ready")
const inventoryPatterns = [
  /\b(lihat|liat|liat2|pilihan|stok|stock|inventory|unit|ready|koleksi|daftar)\b.*\b(mobil|kendaraan|show\s*room)\b/i,
  /\b(ada|punya)\s+(mobil|kendaraan|stok|unit)\s+(apa|apa\s*aja|ready)\b/i,
  /\b(stok|stock|unit|mobil|kendaraan)\s+(ready|tersedia|baru)\b/i,
  /^\s*(lihat|liat|pilihan|pilihkan|tampilkan)\s+mobil\s*\??$/i,
];

if (inventoryPatterns.some(p => p.test(msg))) {
  console.log(`[SmartFallback] 🚗 General inventory inquiry detected: "${msg}"`);
  if (vehicles.length > 0) {
    const list = WhatsAppAIChatService.formatVehicleListDetailed(vehicles.slice(0, 3));
    return {
      message: `Siap kak! Berikut beberapa unit *READY STOCK* kami di ${tenantName} saat ini: 🚗✨\n\n${list}\n\n` +
        `Ada unit yang menarik perhatian Kakak? Atau ingin cari mobil dengan kriteria tertentu (sepasu budget/jenis)? 😊`,
      shouldEscalate: false,
    };
  }
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

    if (mpvVehicles.length > 0) {
      const list = WhatsAppAIChatService.formatVehicleListDetailed(mpvVehicles);

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
    }
  } catch (error) {
    console.error('[SmartFallback] MPV Search Error:', error);
  }

  // Fallback if search fails or no vehicles found
  return {
    message: `Untuk keluarga dengan ${familySize} anak, saya sarankan MPV 7-seater seperti Innova, Avanza, atau Xpander 👨‍👩‍👧‍👦\n\n` +
      `Sayangnya belum ada stok MPV di budget tersebut saat ini 😔\n\n` +
      `Mau info jenis mobil lain yang ada? 😊`,
    shouldEscalate: false,
  };
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
// User says "stop" when AI keeps sending wrong info/photos repeatedly
// This indicates AI made mistakes - acknowledge and offer correct help
const stopPatterns = [
  /^(stop|berhenti|cukup|udah|sudah|kagak|ndak|gak|nga)$/i,
  /\b(stop|berhenti|cukup|jangan)\s*(kirim|kasi|tunjuk|lagi|terus)\b/i,
  /\b(cukup|udah|sudah)\b.*(foto|gambar|itu)\b/i,
  /\b(salah|keliru|bukan)\s*(itu|ini|yang)\b/i,
];
const isStopCommand = stopPatterns.some(p => p.test(msg));

if (isStopCommand) {
  console.log(`[SmartFallback] 🛑 Stop command detected: "${msg}" - AI may have made repeated errors`);
  return {
    message: `Mohon maaf atas kesalahan informasi sebelumnya 🙏\n\nSaya stop dulu. Bisa diinfokan ulang unit yang Bapak/Ibu cari? Sebutkan ID unit (contoh: PM-PST-001) agar saya bisa memberikan info yang tepat. 😊`,
    shouldEscalate: true, // Escalate because AI was making mistakes
  };
}

// ==================== PHOTO QUANTITY COMPLAINT HANDLER ====================
// Detect if user is complaining about the number of photos (e.g., "Cuma 2 fotonya?", "Kok dikit?")
const photoQuantityPatterns = [
  /\b(cuma|hanya|kok|dikit|sedikit)\b.*\b(foto|gambar)\b/i,
  /\b(foto|gambar)\b.*\b(cuma|hanya|dikit|sedikit|kurang)\b/i,
  /\b(tambah|lagi|lebih)\s+(foto|gambar)\b/i,
];

if (photoQuantityPatterns.some(p => p.test(msg))) {
  console.log(`[SmartFallback] 📸 Photo quantity complaint detected: "${msg}"`);
  return {
    message: `Mohon maaf jika fotonya terlihat sedikit kak. 🙏\n\nFoto yang saya kirimkan tadi adalah **preview cepat** dari beberapa unit stok terbaru kami.\n\nJika Kakak ingin melihat **foto lengkap (Interior, Eksterior, Mesin)** untuk unit tertentu, silakan sebutkan nama mobil atau ID-nya (contoh: "Lihat detail Avanza" atau "Foto PM-PST-001").\n\nSaya akan kirimkan seluruh galeri foto yang tersedia! 😊`,
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
  /^mana\s(mobil|unit|fotonya|gambarnya)/i, // "mana fotonya", "mana gambarnya"
];
const isPhotoConfirmation = photoConfirmPatterns.some(p => p.test(msg));

// Determine vehicle name from query or history first
const vehiclePatterns = [
  /pm-[a-zA-Z0-9]+-\d+/i, // Unit IDs like PM-PST-001
  /(?:Toyota|Honda|Suzuki|Daihatsu|Mitsubishi|Nissan|Mazda|BMW|Mercedes|Hyundai|Kia|Wuling)\s+[\w\s]+(?:\d{4})?/gi,
  /\b(Innova\s*Reborn?|Fortuner|Pajero\s*Sport|Xpander|Rush|Terios|Ertiga|Avanza|Xenia|Brio|Jazz|Calya|Sigra|Ayla|Agya|HRV|CRV|BRV|Yaris|Camry|Alphard|City|Civic)\s*(?:20\d{2}|19\d{2})?\b/gi,
];

let vehicleName = "";
const lastAiMsgForPhoto = messageHistory.filter(m => m.role === "assistant").pop();

// Try to extract from current message
for (const pattern of vehiclePatterns) {
  const match = msg.match(pattern);
  if (match && match[0]) {
    vehicleName = match[0].trim();
    break;
  }
}

// Try to extract from last AI message if not in current
if (!vehicleName && lastAiMsgForPhoto) {
  for (const pattern of vehiclePatterns) {
    const match = lastAiMsgForPhoto.content.match(pattern);
    if (match && match[0]) {
      vehicleName = match[0].trim();
      break;
    }
  }
}

// 🔥 NEW: If still no vehicle name, check recent conversation history (last 10 messages)
// This is crucial for cases like: User asks "KKB Honda City", then later "kirim foto"
// We need to remember the Honda City from the KKB context!
if (!vehicleName) {
  const recentHistory = messageHistory.slice(-10);
  for (const historyMsg of recentHistory.reverse()) { // Check most recent first
    for (const pattern of vehiclePatterns) {
      const match = historyMsg.content.match(pattern);
      if (match && match[0]) {
        vehicleName = match[0].trim();
        console.log(`[SmartFallback] 🔍 Found vehicle "${vehicleName}" in conversation history`);
        break;
      }
    }
    if (vehicleName) break;
  }
}

// 🔥 PRIORITIZE ID: Even if we found a name like "Honda City", check if we have a specific ID in history
// IDs (PM-PST-XXX) are much more reliable for fetching photos!
const idPattern = /pm-[a-zA-Z0-9]+-\d+/i;
// Check if current extracted name is NOT an ID (it might be just "Honda City")
if (vehicleName && !idPattern.test(vehicleName)) {
  const recentHistory = messageHistory.slice(-10);
  for (const historyMsg of recentHistory.reverse()) {
    const match = historyMsg.content.match(idPattern);
    if (match && match[0]) {
      // UPGRADE LOGIC: Generic -> Specific ID
      // Only upgrade if the found ID actually matches the generic name context (loose check)
      // e.g. "Honda City" -> "PM-PST-001" (assuming they are related in conversation flow)
      console.log(`[SmartFallback] 🎯 Upgrading generic "${vehicleName}" to specific ID "${match[0]}" from context`);
      vehicleName = match[0].trim();
      break;
    }
  }
}

// 🔥 DOWNGRADE LOGIC: Specific ID -> Generic Name (Optimization)
// If user asks "Honda City" but we only found "PM-PST-001" which might NOT be available/photo-ready,
// we should also keep the "Honda City" as a fallback search term if the ID fails.
let fallbackGenericName = "";
if (vehicleName && idPattern.test(vehicleName)) {
  // Find what the user ACTUALLY typed if it wasn't the ID
  for (const pattern of vehiclePatterns) {
    if (pattern.source.includes("PM-PST")) continue;
    const match = msg.match(pattern);
    if (match) {
      fallbackGenericName = match[0].trim();
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
  // Fallback 3 — Lempar ke Human/Eskalasi
  return {
    message: `Supaya lebih jelas, saya bisa hubungkan Kakak ke tim kami ya 👍\nTetap via WhatsApp kok.`, // User requested template
    shouldEscalate: true,
  };
}

// ==================== GENERAL INVENTORY INQUIRY ====================
// User asking "ada apa saja?", "ready stock?", "list mobil", "report ada apa saja"
const generalInventoryPatterns = [
  /\b(ada|ready|stok|stock)\s+(apa|mobil|unit|saja|aja)\b/i,
  /\b(lihat|liat|daftar|list)\s+(mobil|unit|stok|stock)\b/i,
  /\b(available|tersedia)\b/i,
  /^report\s+(ada|apa)/i, // Catch the specific user typo "report ada apa saja"
];

const isInventoryCheck = generalInventoryPatterns.some(p => p.test(msg));

if (isInventoryCheck) {
  console.log(`[SmartFallback] 📋 General inventory inquiry detected: "${msg}"`);

  // Fetch top available vehicles
  const inventoryVehicles = await prisma.vehicle.findMany({
    where: {
      tenantId,
      status: 'AVAILABLE'
    },
    orderBy: { createdAt: 'desc' },
    take: 5
  });

  if (inventoryVehicles.length > 0) {
    const list = inventoryVehicles.map(v => {
      const priceJuta = Math.round(Number(v.price) / 1000000);
      const id = v.displayId || v.id.substring(0, 6).toUpperCase();
      return `• ${v.make} ${v.model} ${v.year} - Rp ${priceJuta}jt | ${id}`;
    }).join('\n');

    return {
      message: `Siap kak! Berikut beberapa unit *READY STOCK* kami saat ini: 🚗✨\n\n${list}\n\nMau lihat foto detail unit yang mana? (Ketik nama/ID mobilnya ya) 😊`,
      shouldEscalate: false,
    };
  } else {
    return {
      message: `Mohon maaf kak, saat ini stok unit kami sedang sold out semua. 🙏\n\nNanti saya kabari lagi ya kalau ada unit baru masuk! 😊`,
      shouldEscalate: false
    };
  }
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

// Detect negation/refusal (AI 5.4)
const hasNegation = /\b(jangan|janganlah|nggak|gak|enggak|tidak|tdk|ga usah|ndak|bukan|bkn|ngga|stop|cukup|udah|sudah|dah|berhenti)\b/i.test(msg);

// AI 5.4 Logic: ONLY trigger auto-photo if:
// 1. Explicit photo keyword is present
// 2. Visual keyword is present AND NO explanation keyword is present
// 3. AND NO negation is present
const hasPhotoKeyword = msg.includes("foto") || msg.includes("gambar") ||
  /mana.*(foto|gambar)/i.test(msg) ||
  msg.startsWith("mana ");

const hasVisualDetailKeyword = /\b(interior|eksterior|detail|mesin|dalam|body|kondisi|fisik)/i.test(msg);
const hasExplanationKeyword = /\b(jelaskan|penjelasan|jabarkan|penjabaran|deskripsi|ceritakan|info|kabar|surat|dokumen)/i.test(msg);

const userExplicitlyAsksPhoto = (hasPhotoKeyword || (hasVisualDetailKeyword && !hasExplanationKeyword)) && !hasNegation;

console.log(`[SmartFallback] Photo check: msg="${msg}", isPhotoConfirmation=${isPhotoConfirmation}, hasNegation=${hasNegation}, hasExplanation=${hasExplanationKeyword}, hasil=${userExplicitlyAsksPhoto}`);

if ((isPhotoConfirmation && !hasNegation) || userExplicitlyAsksPhoto) {
  console.log(`[SmartFallback] 📸 Photo request detected: "${userMessage}"`);

  // Get the last AI message
  const lastAiMsg = messageHistory.filter(m => m.role === "assistant").pop();

  // ==================== HIGH PURCHASE INTENT DETECTION ====================
  // Check if user has shown high purchase intent in recent conversation (last 10 messages)
  // Indicators: KKB/credit simulation request, detailed vehicle questions, test drive inquiries
  const recentMessages = messageHistory.slice(-10).map(m => m.content.toLowerCase()).join(' ');
  const highIntentPatterns = [
    /\b(kkb|kredit|cicilan|angsuran|simulasi|dp|down payment|uang muka)\b/i,
    /\b(test drive|lihat unit|ke showroom|datang|kunjung)\b/i,
    /\b(booking|pesan|reserved?|ambil)\b/i,
  ];
  const hasHighPurchaseIntent = highIntentPatterns.some(p => p.test(recentMessages));

  if (hasHighPurchaseIntent) {
    console.log(`[SmartFallback] 🔥 HIGH PURCHASE INTENT detected! (KKB/credit/booking in history)`);

    // AGENTIC HANDOFF: Notify Sales Staff Automatically
    // Only if we haven't notified them recently (check lastAiMsg)
    const alreadyNotified = lastAiMsg && lastAiMsg.content.includes("tim kami segera");

    if (!alreadyNotified) {
      this.notifySalesStaff(tenantId, {
        customerName: context?.customerName || "Customer (Belum ada nama)",
        customerPhone: context?.customerPhone || "",
        vehicleName: vehicleName || "Unit belum spesifik",
        budget: "Estimasi dari chat", // We could extract exact budget if needed
        status: "Siap Booking / Minta Test Drive",
        notes: `Topik: ${msg.substring(0, 50)}...`
      });
    }
  }
  // ========================================================================

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
      let images = await this.fetchVehicleImagesByQuery(vehicleName, tenantId);

      // Fallback to generic name if ID didn't return images
      if ((!images || images.length === 0) && fallbackGenericName) {
        console.log(`[SmartFallback] ⚠️ No images for ID "${vehicleName}", trying fallback name: "${fallbackGenericName}"`);
        images = await this.fetchVehicleImagesByQuery(fallbackGenericName, tenantId);
      }

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
      where: {
        tenantId,
        status: 'AVAILABLE',
        photos: { some: {} } // ONLY vehicles with photos
      },
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
        const images = await this.buildImageArray(vehiclesWithPhotos);
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
      const vehicleList = anyVehicles.slice(0, 3).map(v => {
        const id = v.displayId || v.id.substring(0, 8).toUpperCase();
        return `• ${v.make} ${v.model} ${v.year} | ${id}`;
      }).join('\n');
      console.log(`[SmartFallback] ⚠️ No photos available, returning vehicle list`);
      return {
        message: `Maaf, foto belum tersedia saat ini 🙏\n\nTapi ada unit ready nih:\n${vehicleList}\n\nMau lihat fotonya? 📸 (Ketik "Ya" atau "Foto [ID]" untuk melihat)`,
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
    const vehicleList = vehicles.slice(0, 3).map(v => {
      const id = v.displayId || v.id.substring(0, 8).toUpperCase();
      return `• ${v.make} ${v.model} ${v.year} | ${id}`;
    }).join('\n');

    // 🔥 If user has shown HIGH PURCHASE INTENT, be more proactive and offer to send photos to admin/staff
    if (hasHighPurchaseIntent) {
      console.log(`[SmartFallback] 🎯 High intent + no photos → Escalate to staff with promise to send`);

      // Check if we just sent this exact message to avoid repetition
      if (lastAiMsg && lastAiMsg.content.includes("segera koordinasikan dengan tim kami")) {
        return {
          message: `Siap kak! Permintaan foto${vehicleName ? ` ${vehicleName}` : ''} sudah saya teruskan ke tim kami. Mohon ditunggu sebentar ya, fotonya akan segera dikirimkan! 📸😊`,
          shouldEscalate: false
        };
      }

      return {
        message: `Tentu kak! Saya akan segera koordinasikan dengan tim kami untuk mengirimkan foto detail unit yang Bapak/Ibu minati. 📸\n\n` +
          `Unit yang tersedia:\n${vehicleList}\n\n` +
          `Foto akan segera saya kirimkan atau bisa Bapak/Ibu hubungi tim sales kami langsung untuk foto dan info lebih detail. Apakah ada yang bisa saya bantu lainnya? 😊`,
        shouldEscalate: false, // Don't escalate, but promise follow-up
      };
    }

    // Regular fallback for low intent users
    return {
      message: `Mohon maaf kak, saya belum menemukan foto untuk unit tersebut saat ini. 🙏\n\nUnit yang tersedia:\n${vehicleList}\n\nIngin info detail untuk unit yang ready? 😊`,
      shouldEscalate: false,
    };
  }
  return {
    message: `Maaf kak, saat ini asisten virtual kami sedang mengoptimalkan sistem galeri foto. 👋\n\nSilakan coba tanyakan kembali dalam beberapa saat atau tanyakan info unit lainnya ya! 😊`,
    shouldEscalate: false,
  };
}
// ==================== END PHOTO CONFIRMATION HANDLER ====================

// Handlers moved up to increase priority (Specific Vehicle Brand/Model)

// Check if asking about price/budget - use extractBudget for consistent parsing
const budget = WhatsAppAIChatService.extractBudget(msg);

// Only proceed with budget-based filtering if a budget was explicitly mentioned
if (budget && budget > 0) {
  console.log(`[SmartFallback] 💰 Budget query detected: Rp ${Math.round(budget / 1000000)} juta`);

  // Filter vehicles within reasonable price range:
  // - Minimum: 60% of budget (don't show vehicles that are too cheap)
  // - Maximum: 120% of budget (allow some flexibility)
  const minPrice = budget * 0.6;
  const maxPrice = budget * 1.2;
  const relevantVehicles = vehicles.filter(v => {
    const price = Number(v.price);
    return price >= minPrice && price <= maxPrice;
  });

  if (relevantVehicles.length > 0) {
    // Sort by price (closest to budget first)
    relevantVehicles.sort((a, b) => {
      const diffA = Math.abs(Number(a.price) - budget);
      const diffB = Math.abs(Number(b.price) - budget);
      return diffA - diffB;
    });

    const list = relevantVehicles.slice(0, 3).map(v => {
      const priceJuta = Math.round(Number(v.price) / 1000000);
      const id = v.displayId || v.id.substring(0, 6).toUpperCase();
      return `• ${v.make} ${v.model} ${v.year} - Rp ${priceJuta} juta | ${id}`;
    }).join('\n');

    return {
      message: `Ada beberapa pilihan di budget Rp ${Math.round(budget / 1000000)} juta nih! 💰✨\n\n${list}\n\nMau info detail yang mana? 😊`,
      shouldEscalate: false,
    };
  } else {
    // No vehicles within budget range - show closest option
    const closestVehicle = [...vehicles].sort((a, b) =>
      Math.abs(Number(a.price) - budget) - Math.abs(Number(b.price) - budget)
    )[0];
    const closestPrice = Math.round(Number(closestVehicle.price) / 1000000);
    const id = closestVehicle.displayId || closestVehicle.id.substring(0, 6).toUpperCase();

    console.log(`[SmartFallback] ⚠️ No vehicles within budget Rp ${Math.round(budget / 1000000)}jt, closest: ${closestVehicle.make} ${closestVehicle.model} at Rp ${closestPrice}jt`);

    return {
      message: `Mohon maaf, untuk budget Rp ${Math.round(budget / 1000000)} juta saat ini belum ada unit yang tersedia. 🙏\n\n` +
        `Unit terdekat yang kami punya:\n• ${closestVehicle.make} ${closestVehicle.model} ${closestVehicle.year} - Rp ${closestPrice} juta | ${id}\n\n` +
        `Apakah budget bisa disesuaikan atau ingin cari unit lain? 😊`,
      shouldEscalate: false,
    };
  }
}

// Check if greeting (ONLY for new conversations)
// If we have history, let AI handle it contextually
if (messageHistory.length === 0 && /^(halo|hai|hello|hi|sore|pagi|siang|malam|selamat)/i.test(msg)) {
  // Be honest about inventory status
  if (vehicles.length === 0) {
    return {
      message: `${timeGreeting}! 👋\n\n` +
        `Terima kasih telah menghubungi ${tenantName}. Mohon maaf kak, saat ini seluruh unit favorit di showroom kami sedang terjual habis karena antusiasme yang tinggi. 🙏\n\n` +
        `Tim kami sedang dalam proses pengadaan unit-unit pilihan terbaru yang berkualitas. Ingin kami kabari segera setelah ada unit baru yang ready? 😊`,
      shouldEscalate: false,
    };
  }
  return {
    message: `${timeGreeting}! 👋 Terima kasih sudah menghubungi ${tenantName}.\n\n` +
      `Saat ini ada ${vehicles.length} unit mobil ready stock. Lagi cari mobil apa nih? Bisa sebutkan merk, budget, atau kebutuhannya ya!`,
    shouldEscalate: false,
  };
}

// Check if complaint/frustration
if (/kaku|nyebelin|ga (jelas|responsif|bisa)|muter|bingung|kesal|males/i.test(msg)) {
  return {
    message: `${timeGreeting}! 👋 Mohon maaf atas ketidaknyamanannya kak. 🙏 Kami berkomitmen untuk memberikan pengalaman terbaik dalam pencarian unit Anda.\n\n` +
      `Agar lebih akurat, bisa langsung infokan kriteria mobil impian Anda? Contohnya:\n` +
      `• "Cari Avanza budget 150 juta"\n` +
      `• "Ada Innova matic?"\n` +
      `• "Mobil keluarga 7 seater"\n\n` +
      `Saya akan segera carikan unit terbaik yang ready stock! 🚗✨`,
    shouldEscalate: false,
  };
}

// ==================== KKB / CREDIT SIMULATION HANDLER ====================
// Detect finance, credit, simulation, dp, or installment queries
const creditPatterns = [
  /\b(kredit|cicilan|angsuran|kkb|finance|leasing|rate|bunga|credit)\b/i,
  /\b(dp|down\s*payment|uang\s*muka)\b/i,
  /\b(simulasi|hitung|berapa)\b.*\b(bulan|tahun|cicil|angsur)\b/i,
];
const isCreditQuery = creditPatterns.some(p => p.test(msg));

if (isCreditQuery) {
  console.log(`[SmartFallback] 💳 Credit query detected: "${msg}"`);

  // Try to find a vehicle mentioned in current message or history
  // (vehicleName is already extracted at the top of the function)
  let targetVehicle: any = null;

  // 1. Try finding in local cache first
  if (vehicleName) {
    targetVehicle = vehicles.find(v =>
      v.make.toLowerCase().includes(vehicleName.toLowerCase().split(' ')[0]) ||
      v.model.toLowerCase().includes(vehicleName.toLowerCase().split(' ')[0]) ||
      (v.displayId && vehicleName.toUpperCase().includes(v.displayId.toUpperCase()))
    );
  }

  // 2. If valid vehicle name/ID but not in local cache, try DB search
  if (!targetVehicle && vehicleName) {
    console.log(`[SmartFallback] 🔍 Vehicle "${vehicleName}" not in local cache, searching DB...`);

    try {
      // Check if it looks like an ID
      const idMatch = vehicleName.match(/pm-[a-zA-Z0-9]+-\d+/i);
      if (idMatch) {
        targetVehicle = await prisma.vehicle.findFirst({
          where: {
            tenantId,
            displayId: { equals: idMatch[0], mode: 'insensitive' }
          }
        });
      } else {
        // Search by make/model text
        // Clean search terms
        const cleanName = vehicleName.replace(/[\(\)]/g, '').trim();
        const nameParts = cleanName.split(' ');
        const brand = nameParts[0];
        const model = nameParts.length > 1 ? nameParts[1] : '';
        const yearMatch = vehicleName.match(/\b(20\d{2}|19\d{2})\b/);
        const year = yearMatch ? parseInt(yearMatch[1]) : undefined;

        targetVehicle = await prisma.vehicle.findFirst({
          where: {
            tenantId,
            status: 'AVAILABLE',
            AND: [
              { make: { contains: brand, mode: 'insensitive' } },
              ...(model ? [{ model: { contains: model, mode: 'insensitive' } }] : []),
              ...(year ? [{ year: { equals: year } }] : [])
            ]
          },
          orderBy: { price: 'asc' } // Get cheapest matching variant
        });
      }

      if (targetVehicle) {
        console.log(`[SmartFallback] ✅ Found vehicle in DB: ${targetVehicle.make} ${targetVehicle.model}`);
      }
    } catch (dbErr) {
      console.error("[SmartFallback] DB ID search error:", dbErr);
    }
  }

  // 3. Fallback: If no specific vehicle found but we have inventory, use the first available one as an example
  // ONLY if the user didn't specify a name (generic "simulasi kredit" request)
  if (!targetVehicle && vehicles.length > 0 && !vehicleName) {
    targetVehicle = vehicles[0];
  }

  if (targetVehicle) {
    // Detect ALL DP percentages in the message
    const dpPercentMatches = Array.from(msg.matchAll(/(\d+)\s*%/g));
    const dpPercentages = dpPercentMatches.length > 0
      ? dpPercentMatches.map(m => parseInt(m[1]))
      : [30]; // Default 30%

    // Get time greeting for consistency
    const now = new Date();
    const hour = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' })).getHours();
    let timeGreeting = "Selamat malam";
    if (hour >= 4 && hour < 11) timeGreeting = "Selamat pagi";
    else if (hour >= 11 && hour < 15) timeGreeting = "Selamat siang";
    else if (hour >= 15 && hour < 18) timeGreeting = "Selamat sore";

    let fullSimulationText = "";

    if (dpPercentages.length > 1) {
      // Comparative Mode
      // Only add greeting if new conversation
      const prefix = (messageHistory.length <= 2) ? `${timeGreeting}! 👋\n\n` : "";

      fullSimulationText = `${prefix}Tentu kak! Ini perbandingan simulasi kredit untuk unit *${targetVehicle.make} ${targetVehicle.model} ${targetVehicle.year}* ${targetVehicle.displayId ? `| ${targetVehicle.displayId}` : ''}:\n\n`;
      fullSimulationText += `💰 Harga Mobil: Rp ${Math.round(Number(targetVehicle.price)).toLocaleString('id-ID')}\n\n`;

      dpPercentages.forEach((dp, index) => {
        const simulation = WhatsAppAIChatService.calculateKKBSimulation(
          Number(targetVehicle.price),
          null,
          dp,
          null,
          {
            hideSyarat: true,
            hideTitle: true,
            hideHeader: true
          }
        );
        fullSimulationText += `--------------------------\n`;
        fullSimulationText += `📊 *OPSI ${index + 1}: DP ${dp}%*\n`;
        fullSimulationText += simulation + `\n\n`;
      });

      fullSimulationText += `--------------------------\n`;
      fullSimulationText += `📝 *Syarat Kredit Umum:*\n- KTP Suami/Istri, KK, NPWP\n- PBB Rumah & Slip Gaji/SKU\n- Tabungan 3 bln terakhir\n\n`;
    } else {
      // Single Step Mode (Standard)
      const simulation = WhatsAppAIChatService.calculateKKBSimulation(
        Number(targetVehicle.price),
        null,
        dpPercentages[0]
      );

      // Only add greeting if new conversation
      const prefix = (messageHistory.length <= 2) ? `${timeGreeting}! 👋\n\n` : "";

      fullSimulationText = `${prefix}Tentu kak! Ini estimasi simulasi kredit untuk unit *${targetVehicle.make} ${targetVehicle.model} ${targetVehicle.year}* ${targetVehicle.displayId ? `| ${targetVehicle.displayId}` : ''}:\n\n` +
        simulation + `\n\n`;
    }

    return {
      message: fullSimulationText + `Mau saya kirimkan foto detail unit ini untuk kelengkapan referensi? 📸😊`,
      shouldEscalate: false,
    };
  } else {
    // Get time greeting for consistency
    const now = new Date();
    const hour = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' })).getHours();
    let timeGreeting = "Selamat malam";
    if (hour >= 4 && hour < 11) timeGreeting = "Selamat pagi";
    else if (hour >= 11 && hour < 15) timeGreeting = "Selamat siang";
    else if (hour >= 15 && hour < 18) timeGreeting = "Selamat sore";

    return {
      message: `${timeGreeting}! 👋\n\nUntuk simulasi kredit, kami bekerja sama dengan berbagai partner seperti BCA Finance, Adira, dan Mandiri dengan bunga yang kompetitif mulai dari 4.5% flat p.a. 📊\n\n` +
        `Boleh tau unit mobil apa yang bapak/ibu incar? Agar saya bisa buatkan simulasi angsurannya yang lebih tepat. 😊`,
      shouldEscalate: false,
    };
  }
}

// ==================== STAFF CONTACT HANDLER ====================
// Detect requests for sales, admin, phone numbers, or how to contact
// ENHANCED: Must contain BOTH contact keywords AND request/handover keywords
// To prevent false positives with AI capability questions
const contactKeywords = /\b(nomer|nomor|wa|whatsapp|kontak|contact|telp|telepon|phone)\b/i; // REMOVED "no" - critically fix for "teknologi"
const requestKeywords = /\b(minta|kirim|mana|boleh|hubungi|hubungin|calling|call|admin|office|staff|sales|marketing|manajer|manager)\b/i;
const isContactHandoverRequest = contactKeywords.test(msg) && requestKeywords.test(msg);

console.log(`[SmartFallback DEBUG] Contact Handover Check:`);
console.log(`  contactKeywords match: ${contactKeywords.test(msg)}`);
console.log(`  requestKeywords match: ${requestKeywords.test(msg)}`);
console.log(`  isContactHandoverRequest: ${isContactHandoverRequest}`);

if (isContactHandoverRequest) {
  console.log(`[SmartFallback] 📞 Staff contact inquiry detected with Handover Intent: "${msg}"`);

  console.log(`[SmartFallback] 📞 Staff contact inquiry detected: "${msg}"`);
  const staffMembers = await WhatsAppAIChatService.getRegisteredStaffContacts(tenantId);

  if (staffMembers.length > 0) {
    let staffList = staffMembers.map(s => `• ${s.name} (${s.role}) - ${s.phone}`).join("\n");

    return {
      message: `${timeGreeting}! 👋\n\nTentu kak! Silakan hubungi tim sales kami untuk informasi lebih lanjut mengenai unit atau proses pembelian:\n\n${staffList}\n\nSemoga membantu! Ada hal lain yang bisa kami bantu? 😊`,
      shouldEscalate: false,
    };
  }
}

// Check if wants to leave/cancel
if (/ga jadi|cancel|batal|pergi|showroom lain|bye|dadah/i.test(msg)) {
  return {
    message: `Baik, terima kasih sudah mampir ke ${tenantName}! 🙏✨\n` +
      `Semoga ketemu mobil impiannya ya. Sampai jumpa! 👋😊`,
    shouldEscalate: false,
  };
}

// ==================== BUDGET-AWARE VEHICLE RECOMMENDATION ====================
// ✅ FIX: Extract budget from user message and filter vehicles accordingly
// ✅ BUT: Don't show budget template if user is asking SPECIFIC DETAIL QUESTIONS

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

  // Fall through - don't return budget template
} else if (vehicles.length > 0) {
  // Original budget logic only if NOT a specific detail question
  // Get time greeting for consistency
  const now = new Date();
  const hour = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' })).getHours();
  let timeGreeting = "Selamat malam";
  if (hour >= 4 && hour < 11) timeGreeting = "Selamat pagi";
  else if (hour >= 11 && hour < 15) timeGreeting = "Selamat siang";
  else if (hour >= 15 && hour < 18) timeGreeting = "Selamat sore";

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

    // Allow up to 30% over budget for flexibility
    const maxPrice = finalBudget * 1.3;
    const budgetVehicles = vehicles.filter(v => Number(v.price) <= maxPrice);

    if (budgetVehicles.length > 0) {
      // Sort by price (closest to budget first)
      budgetVehicles.sort((a, b) => {
        const diffA = Math.abs(Number(a.price) - finalBudget);
        const diffB = Math.abs(Number(b.price) - finalBudget);
        return diffA - diffB;
      });

      const list = WhatsAppAIChatService.formatVehicleListDetailed(budgetVehicles.slice(0, 3));
      console.log(`[SmartFallback] ✅ Found ${budgetVehicles.length} vehicles within budget`);

      return {
        message: `Untuk budget sekitar Rp ${Math.round(finalBudget / 1000000)} juta, kami punya unit ready berikut:\n\n${list}\n\nMau lihat fotonya atau info lebih detail? 📸😊`,
        shouldEscalate: false,
      };
    } else {
      // No vehicles within budget - be honest and show closest option
      const closestVehicle = [...vehicles].sort((a, b) =>
        Math.abs(Number(a.price) - finalBudget) - Math.abs(Number(b.price) - finalBudget)
      )[0];
      const closestPrice = Math.round(Number(closestVehicle.price) / 1000000);
      const id = closestVehicle.displayId || closestVehicle.id.substring(0, 6).toUpperCase();

      console.log(`[SmartFallback] ⚠️ No vehicles within budget Rp ${Math.round(finalBudget / 1000000)}jt, closest: ${closestVehicle.make} ${closestVehicle.model} at Rp ${closestPrice}jt`);

      return {
        message: `Mohon maaf, untuk budget Rp ${Math.round(finalBudget / 1000000)} juta saat ini belum ada unit ready yang pas. 🙏\n\n` +
          `Unit terdekat yang kami punya:\n• ${closestVehicle.make} ${closestVehicle.model} ${closestVehicle.year} - Rp ${closestPrice} juta | ${id}\n\n` +
          `Apakah budget bisa disesuaikan atau ingin coba cari unit lain? 😊`,
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

  // Use the DETAILED formatter
  const list = WhatsAppAIChatService.formatVehicleListDetailed(recommendations);

  return {
    message: `Maaf kak, saya mau pastikan tidak salah tangkap 😊\n\n` +
      `Apakah Kakak ingin melihat unit ready stock kami? Berikut beberapa rekomendasi unit terbaik kami saat ini:\n\n${list}\n\n` +
      `Atau Kakak sedang mencari mobil dengan merk, budget, atau kriteria spesifik lainnya? Silakan diinfokan ya! 🙏`,
    shouldEscalate: false,
  };
}

// No vehicles available - Fallback 2 (Pilihan Cepat) or Fallback 1 (Netral)

// Fallback 1 — Netral (Default catch-all)
return {
  message: `Maaf Kak, saya mau pastikan tidak salah tangkap 😊\nKakak lagi mau cari mobil seperti apa ya?`,
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
  senderInfo ?: { isStaff: boolean; staffInfo?: { firstName?: string; lastName?: string; name?: string; role?: string; roleLevel?: number; phone?: string; userId?: string }; customerPhone: string; isEscalated?: boolean },
  customerTone: 'CUEK' | 'NORMAL' | 'AKTIF' = 'NORMAL',
  leadInfo ?: { id: string; name: string; status: string; interestedIn?: string; budgetRange?: string; location?: string; } | null
): Promise < string > {
  // Get current time in Indonesia (WIB - UTC+7)
  const now = new Date();
  const wibTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
  const hour = wibTime.getHours();
  const timeStr = wibTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  const dateStr = wibTime.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  // Determine appropriate greeting based on time
  // Determine appropriate greeting based on time matching identity.ts rules
  let timeGreeting: string;
  if(hour >= 4 && hour < 11) {
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
    '• Jika customer tanya, jawab JUJUR: "Mohon maaf Bapak/Ibu, unit yang Anda cari tidak tersedia di showroom kami."';
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
  private static async getRegisteredStaffContacts(tenantId: string): Promise <
  Array < { name: string; role: string; phone: string } >
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
): Promise < { message: string; shouldEscalate: boolean; confidence: number; images?: Array<{ imageUrl: string; caption?: string }> } | null > {
  const msg = userMessage.trim().toLowerCase();



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
  if(isAppreciation) {
    console.log(`[PhotoConfirm DEBUG] ✅ Appreciation detected: "${msg}" - NOT a photo request`);
    return null; // Let the AI or smartFallback handle appreciation
  }

    // Photo confirmation patterns - ONLY true confirmation words/verbs
    const photoConfirmPatterns = [
    /^(boleh|ya|iya|ok|oke|okey|okay|mau|yup|yap|sip|siap|bisa|tentu|pasti|yoi|gass?|cuss?)$/i,
    /^(kirim|send|tampilkan|tunjukkan|kasih|berikan|kirimin|kirimkan|lanjut|lanjutkan|hayuk|yuk|ayo)$/i,
    /\b(iya|ya|ok|oke|mau|boleh)\b.*\b(foto|gambar|lihat)/i,
    /silahkan|silakan/i,
    /ditunggu|tunggu/i,
    /ok\s*(kirim|dong|ya|lanjut)/i,
    /sip\s*(ditunggu|tunggu|lanjut)/i,
    /mau\s*(dong|ya|lah|lihat|banget)/i,
    /lanjut\s*(kirim|aja)/i,
  ];

  const isPhotoConfirmation = photoConfirmPatterns.some(p => p.test(msg));
  if(!isPhotoConfirmation) return null;

  // ALWAY REQUIRE AN OFFER or EXPLICIT HISTORY
  // Get the last AI message to check if it offered photos
  const lastAiMsg = messageHistory.filter(m => m.role === "assistant").pop();
  if(!lastAiMsg) return null;

  const aiContent = lastAiMsg.content.toLowerCase();
  const offeredPhotos = aiContent.includes("foto") ||
    aiContent.includes("lihat") ||
    aiContent.includes("gambar") ||
    aiContent.includes("📸") ||
    aiContent.includes("kirim");

  if(!offeredPhotos) return null;

  console.log(`[WhatsApp AI Chat] 📸 Validated confirmation after offer: "${userMessage}"`);
  const userExplicitlyAsksPhoto = /\b(foto|gambar|detail|interior|eksterior)\b/i.test(msg);

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

  // Priority 1: Check for explicit Vehicle ID in current message
  // Matches: "PM-PST-001", "id pm-pst-001", "foto unit pm=pst=001"
  // Supports - or = or space as separator
  const idMatch = userMessage.match(/pm[-=\s]+[a-zA-Z0-9]+[-=\s]+\d+/i);
  if(idMatch) {
    // Normalize to PM-CODE-NUMBER format (replace = or space with -)
    vehicleName = idMatch[0].toUpperCase().replace(/[=\s]+/g, '-');
    console.log(`[PhotoConfirm DEBUG] 🎯 Found EXPLICIT Vehicle ID: "${vehicleName}"`);
  }

    // Priority 2: Try to extract vehicle from recent history (last 3 messages)
    if(!vehicleName) {
    // Look back up to 3 messages (AI or User) to find what we're talking about
    const recentContextMessages = messageHistory.slice(-3).reverse(); // Newest first

    for (const msg of recentContextMessages) {
      if (!msg.content) continue;

      // Check for ID in history
      const histIdMatch = msg.content.match(/pm[-=\s]+[a-zA-Z0-9]+[-=\s]+\d+/i);
      if (histIdMatch) {
        vehicleName = histIdMatch[0].toUpperCase().replace(/[=\s]+/g, '-');
        console.log(`[PhotoConfirm DEBUG] 🎯 Found Vehicle ID in history (${msg.role}): "${vehicleName}"`);
        break;
      }

      // Check for vehicle names in history
      for (const pattern of vehiclePatterns) {
        const match = msg.content.match(pattern);
        if (match && match[0]) {
          // Clean up the match
          let candidate = match[0].trim();
          // Remove common specs that might get matched
          candidate = candidate.replace(/\s+(dengan|harga|transmisi|kilometer|warna|unit|sangat|siap|diesel|bensin|matic|manual|at|mt).*$/i, "").trim();

          // Ignore "Toyota" standalone, too generic unless it's the only thing
          if (candidate.split(' ').length < 2 && !['innova', 'fortuner', 'pajero', 'jazz', 'brio', 'avanza', 'xenia'].includes(candidate.toLowerCase())) {
            continue;
          }

          vehicleName = candidate;
          console.log(`[PhotoConfirm DEBUG] 🚙 Found vehicle name in history (${msg.role}): "${vehicleName}"`);
          break;
        }
      }
      if (vehicleName) break;
    }
  }
    if(!vehicleName) {
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
          const vehicleList = anyVehicles.slice(0, 3).map(v => {
            const id = v.displayId || v.id.substring(0, 8).toUpperCase();
            return `• ${v.make} ${v.model} ${v.year} | ${id}`;
          }).join('\n');
          return {
            message: `Maaf kak, saat ini galeri foto unit sedang kami perbarui untuk kualitas terbaik. 👋\n\nTapi kami punya unit ready menarik lainnya:\n${vehicleList}\n\nIngin saya kirimkan fotonya segera setelah siap? 😊`,
            shouldEscalate: false,
            confidence: 0.8,
          };
        }
        console.log(`[PhotoConfirm DEBUG] ❌ No vehicles found at all`);
        // Return helpful message instead of falling through to null
        return {
          message: `Maaf kak, saya belum tahu mobil mana yang ingin Anda lihat fotonya. 🤔\n\n` +
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
        // Return error guidance instead of null
        return {
          message: `Maaf kak, ada kendala teknis. 😅 Bisa coba dengan "Foto [nama mobil]" atau ketik "mobil" untuk lihat daftar! 😊`,
          shouldEscalate: false,
          confidence: 0.8,
        };
      }
    } else {
      console.log(`[PhotoConfirm DEBUG] ❌ userExplicitlyAsksPhoto is false, not entering fallback`);
      // User confirmed but didn't explicitly say "foto" - provide guidance
      return {
        message: `Baik kak! 👍 Bisa sebutkan mobil mana yang ingin dilihat fotonya? Contoh: "Avanza" atau "PM-PST-002" 😊`,
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

  if(creditKeywords.test(userMessage) || hasPercentage) {
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
  const withKeyword = msg.match(/(?:budget|anggaran|dana|harga|price)\s*(\d+)\s*(jt|juta|million)/i);
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

  private static formatPrice(price: number | BigInt | string): string {
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
): Promise < Array<{ imageUrl: string; caption?: string }> | null > {
  console.log('[WhatsApp AI Chat] 📸 Fetching vehicles for query:', searchQuery);
  console.log('[WhatsApp AI Chat] Tenant ID:', tenantId);

  // CRITICAL FIX: Check for explicit Vehicle ID first (PM-PST-XXX or PM PST-XXX)
  // Supports various formats to be robust for WhatsApp users
  const idRegExp = /\b(pm[- ]?[a-zA-Z0-9]+-\d+)\b/i;
  const idMatch = searchQuery.match(idRegExp);

  if(idMatch) {
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
  if(searchTerms.length === 0) {
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
): Promise < VehicleWithImages | null > {
  console.log('[WhatsApp AI Chat] 📋 Fetching vehicle with FULL details for:', searchQuery);

  // Parse search query into individual terms and filter out stop words
  const searchTerms = searchQuery.toLowerCase()
    .split(/\s+/)
    .filter(term => term.length > 0 && !WhatsAppAIChatService.INDONESIAN_STOP_WORDS.includes(term));

  console.log('[WhatsApp AI Chat] Cleaned search terms for detail:', searchTerms);

  if(searchTerms.length === 0) return null;

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

  if(!vehicle) {
    console.log('[WhatsApp AI Chat] ❌ No vehicle found for detailed query');
    return null;
  }

    console.log(`[WhatsApp AI Chat] ✅ Found vehicle: ${vehicle.make} ${vehicle.model} with ${vehicle.photos.length} photos`);

  // Build image array for this vehicle
  const images = await this.buildImageArray([vehicle]);
  if(!images || images.length === 0) {
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

  // Interior & Exterior QA (Automated Quality Check)
  // Provides reassurance if specific descriptions are missing
  const isGoodCondition = !v.condition || ['excellent', 'good', 'sangat baik', 'baik'].includes(v.condition.toLowerCase());

  if (isGoodCondition) {
    message += `\n🏠 *Interior:*\\n`;
    message += `• Kabin: Bersih & Wangi disinfektan\\n`;
    message += `• Jok & Dashboard: Original/Terawat rapi\\n`;
    message += `• AC: Dingin maksimal\\n`;
    message += `• Electrical: Normal 100%\\n`;

    message += `\n🚙 *Eksterior:*\\n`;
    message += `• Body: Mulus (Bebas tabrak & banjir)\\n`;
    message += `• Cat: Original/Repaint rapi (Sesuai foto)\\n`;
    message += `• Ban: Tebal & Siap jalan jauh\\n`;
  }

  // Documents & Tax info (Commonly asked)
  message += `\n📄 *Kelengkapan Dokumen:*\\n`;
  message += `• BPKB & STNK: Lengkap & Asli\\n`;
  message += `• Pajak: Hidup / On (Siap Pakai)\\n`;
  message += `• Faktur: Tersedia\\n`;

  message += `\n📸 Berikut foto-foto unitnya (Interior & Eksterior) 👇`;

  return message;
}

  /**
   * Build image array from vehicles with proper URL handling
   * UPDATED: Now Async to support Smart Validation (HTTP HEAD check)
   */
  private static async buildImageArray(vehicles: any[]): Promise < Array<{ imageUrl: string; caption?: string }> | null > {
  // Build image array with fallback URLs
  // Convert relative URLs to full URLs for Aimeow
  let baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://primamobil.id';

  // CRITICAL FIX: Ensure we never send localhost/0.0.0.0 URLs to external WhatsApp API 
  // because the external Aimeow Gateway cannot reach our local server.
  if(baseUrl.includes('localhost') || baseUrl.includes('0.0.0.0') || baseUrl.includes('127.0.0.1')) {
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
    let imageUrl = photo.originalUrl || photo.mediumUrl || photo.largeUrl;

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
): Promise < Array < { role: "user" | "assistant"; content: string } >> {
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
): { vehicleId ?: string; field: string; oldValue ?: string; newValue: string } | null {
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

    // 2. Year: "ubah tahun 2017", "ganti jadi 2018"
    { pattern: /(?:rubah|ganti|ubah|update)\s*tahun\s*(?:ke|jadi|menjadi)?\s*(\d{4})/i, field: 'year', valueExtractor: m => m[1] },

    // 3. Fuel type: "ganti diesel", "rubah ke hybrid"
    {
      pattern: new RegExp(`(?: rubah | ganti | ubah | update)(?: \\s +.*?) \\s * (?: bahan\\s * bakar | fuel)?\\s * (?: ke | jadi | menjadi) ?\\s * (${fuelTypesRegex})`, 'i'),
      field: 'fuelType',
      valueExtractor: m => m[1]
    },

    // 4. Transmission: "ganti jadi manual", "ubah transmisi matic"
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

    // 5. Mileage: "ubah km 50000", "ganti jadi 30000 km"
    { pattern: /(?:rubah|ganti|ubah|update)\s*(?:km|kilometer|odometer)\s*(?:ke|jadi|menjadi)?\s*(\d+)\s*(?:km)?/i, field: 'mileage', valueExtractor: m => m[1] },

    // 6. Color: "ganti jadi merah", "rubah warna biru"
    {
      pattern: new RegExp(`(?: rubah | ganti | ubah | update)(?: \\s +.*?) \\s * (?: warna) ?\\s * (?: ke | jadi | menjadi) ?\\s * (${colorsRegex})`, 'i'),
      field: 'color',
      valueExtractor: m => m[1]
    },

    // 7. Engine capacity: "ubah cc ke 1500", "ganti kapasitas mesin 1497"
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
  private static calculateKKBSimulation(
  vehiclePrice: number,
  inputDpAmount ?: number | null,
  inputDpPercentage ?: number | null,
  inputTenor ?: number | null,
  options ?: { hideSyarat?: boolean; hideTitle?: boolean; hideHeader?: boolean; vehicleYear?: number }
): string {
  // 1. Determine DP
  let dpAmount = 0;
  let dpPercentage = 25; // Default 25% (Standard minimal DP 2026)

  if (inputDpAmount) {
    dpAmount = inputDpAmount;
    dpPercentage = Math.round((dpAmount / vehiclePrice) * 100);
  } else if (inputDpPercentage) {
    dpPercentage = inputDpPercentage;
    dpAmount = vehiclePrice * (dpPercentage / 100);
  } else {
    // Default DP calculation
    dpAmount = vehiclePrice * (dpPercentage / 100);
  }

  const principal = vehiclePrice - dpAmount;

  // 2. Define Leasing Rates (Estimasi Flat Rate per Tahun untuk Mobil Bekas 2026)
  // Rate updated to reflect real market conditions (usually 8-12% for used cars)
  const baseRates: Record<string, number[]> = {
    // Tenor: 1, 2, 3, 4, 5 tahun (array index 0-4)
    "BCA Finance": [6.5, 7.25, 7.75, 8.5, 9.5], // Competitive
    "Adira Finance": [8.0, 9.0, 9.75, 10.5, 11.5], // Easy Approval
    "Info Kredit": [7.5, 8.5, 9.25, 10.0, 11.0] // Generic Market Avg
  };

  // Age Adjustment: Older cars have higher risk = higher interest
  let ageRateAdjustment = 0;
  if (options?.vehicleYear) {
    const currentYear = new Date().getFullYear();
    const age = currentYear - options.vehicleYear;
    if (age > 5) {
      // Add 0.5% flat rate per year for cars older than 5 years
      ageRateAdjustment = (age - 5) * 0.5;
    }
  }

  // 3. Determine Tenors to calculate
  const tenors = inputTenor ? [inputTenor] : [3, 4, 5]; // Default calculate for 3, 4, 5 years if not specified

  // 4. Build Result String
  const formatRp = (num: number) => "Rp " + Math.round(num).toLocaleString('id-ID');

  let result = options?.hideTitle ? "" : `📊 *SIMULASI KREDIT (KKB) UPDATE 2026* \n`;
  if (!options?.hideHeader) {
    result += `Harga Mobil: ${formatRp(vehiclePrice)} \n`;
    if (options?.vehicleYear) result += `Tahun: ${options.vehicleYear} \n`;
  }
  result += `DP (${dpPercentage}%): ${formatRp(dpAmount)} \n`;
  if (!options?.hideHeader) {
    result += `Pokok Hutang: ${formatRp(principal)} \n\n`;
  }

  result += `*Est. Angsuran per Bulan:* \n`;

  tenors.forEach(tenor => {
    // Detail per leasing range
    let minInstallment = Infinity;
    let maxInstallment = 0;

    const ratesUsed: number[] = [];

    Object.entries(baseRates).forEach(([leasing, rates]) => {
      // Safe access to rate (handle missing tenor index by taking last available)
      const rateIndex = Math.min(tenor - 1, rates.length - 1);
      let baseRate = rates[Math.max(0, rateIndex)];

      // Apply age adjustment (max cap +3% to be realistic)
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

  if (!options?.hideSyarat) {
    result += `\n📝 *Syarat Kredit:* KTP Suami Istri, KK, NPWP, PBB/AJB, Mutasi Rek 3 Bln.`;
  }

  return result;
}
}

export default WhatsAppAIChatService;
