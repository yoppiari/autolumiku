/**
 * Message Orchestrator Service
 * Central coordinator untuk WhatsApp message processing
 * - Intent classification
 * - Route ke AI atau Staff Command handler
 * - Save messages
 * - Send responses via Aimeow
 */

import { prisma } from "@/lib/prisma";
import { AimeowClientService } from "../aimeow/aimeow-client.service";
import { IntentClassifierService, MessageIntent } from "./intent-classifier.service";
import { WhatsAppAIChatService } from "./chat.service";
import { StaffCommandService } from "./staff-command.service";

// ==================== TYPES ====================

export interface IncomingMessage {
  accountId: string;
  tenantId: string;
  from: string;
  message: string;
  mediaUrl?: string;
  mediaType?: string;
  messageId: string;
}

export interface ProcessingResult {
  success: boolean;
  conversationId: string;
  intent: MessageIntent;
  responseMessage?: string;
  escalated: boolean;
  error?: string;
}

// ==================== MESSAGE ORCHESTRATOR ====================

export class MessageOrchestratorService {
  /**
   * Process incoming WhatsApp message
   * Main entry point untuk semua message processing
   */
  static async processIncomingMessage(
    incoming: IncomingMessage
  ): Promise<ProcessingResult> {
    console.log(`[Orchestrator] === Processing incoming message ===`);
    console.log(`[Orchestrator] Account: ${incoming.accountId}, Tenant: ${incoming.tenantId}`);
    console.log(`[Orchestrator] From: ${incoming.from}, Message: ${incoming.message}`);

    try {
      // 1. Get or create conversation
      const conversation = await this.getOrCreateConversation(
        incoming.accountId,
        incoming.tenantId,
        incoming.from
      );

      // 2. Save incoming message
      const incomingMsg = await this.saveIncomingMessage(
        conversation.id,
        incoming
      );

      // 3. Check conversation state for multi-step flows
      let classification;
      if (conversation.conversationState === "upload_vehicle") {
        // Staff is in middle of vehicle upload flow
        console.log(`[Orchestrator] Conversation in upload_vehicle state, treating message as vehicle data`);
        classification = {
          intent: "staff_upload_vehicle" as MessageIntent,
          confidence: 1.0,
          isStaff: true,
          isCustomer: false,
        };
      } else {
        // Normal intent classification
        // Pass hasMedia flag to help detect vehicle uploads with photos
        const hasMedia = !!(incoming.mediaUrl && incoming.mediaType === 'image');
        console.log(`[Orchestrator] Classifying intent for message: ${incoming.message}, hasMedia: ${hasMedia}`);
        classification = await IntentClassifierService.classify(
          incoming.message,
          incoming.from,
          incoming.tenantId,
          hasMedia
        );
        console.log(`[Orchestrator] Intent classified: ${classification.intent}, isStaff: ${classification.isStaff}, isCustomer: ${classification.isCustomer}`);
      }

      // Update message with intent
      await prisma.whatsAppMessage.update({
        where: { id: incomingMsg.id },
        data: {
          intent: classification.intent,
          confidence: classification.confidence,
          senderType: classification.isStaff ? "staff" : "customer",
        },
      });
      console.log(`[Orchestrator] Message updated with intent: ${classification.intent}`);

      // Update conversation type and store verified staff phone for LID mapping
      if (classification.isStaff) {
        // Get current contextData to preserve existing data
        const currentContext = (conversation.contextData as Record<string, any>) || {};

        await prisma.whatsAppConversation.update({
          where: { id: conversation.id },
          data: {
            isStaff: true,
            conversationType: "staff",
            // Store the verified staff phone for LID-to-phone mapping
            contextData: {
              ...currentContext,
              verifiedStaffPhone: incoming.from,
              verifiedAt: new Date().toISOString(),
            },
          },
        });
        console.log(`[Orchestrator] Stored verified staff phone: ${incoming.from}`);
      }

      // 4. Route based on intent
      let responseMessage: string | undefined;
      let escalated = false;
      let responseImages: Array<{ imageUrl: string; caption?: string }> | undefined;

      // Handle /verify command specially - allows LID users to verify themselves
      if (classification.intent === "staff_verify_identity") {
        console.log(`[Orchestrator] Routing to staff verify handler`);
        const result = await this.handleStaffVerify(
          conversation,
          incoming.message,
          incoming.from,
          incoming.tenantId
        );
        responseMessage = result.message;
        escalated = result.escalated;

        // If verification successful, update conversation to staff
        if (result.verified) {
          await prisma.whatsAppConversation.update({
            where: { id: conversation.id },
            data: {
              isStaff: true,
              conversationType: "staff",
              contextData: {
                ...((conversation.contextData as Record<string, any>) || {}),
                verifiedStaffPhone: result.verifiedPhone,
                verifiedAt: new Date().toISOString(),
                verifiedVia: "verify_command",
              },
            },
          });
        }
        console.log(`[Orchestrator] Verify result: ${responseMessage?.substring(0, 50)}...`);
      } else if (classification.isStaff) {
        // Handle staff command
        console.log(`[Orchestrator] Routing to staff command handler`);
        const result = await this.handleStaffCommand(
          conversation,
          classification.intent,
          incoming.message,
          incoming.from,
          incoming.tenantId,
          incoming.mediaUrl
        );
        responseMessage = result.message;
        escalated = result.escalated;
        console.log(`[Orchestrator] Staff command result: ${responseMessage?.substring(0, 50)}...`);
      } else {
        // Handle customer inquiry dengan AI
        console.log(`[Orchestrator] Routing to AI customer inquiry handler`);
        const result = await this.handleCustomerInquiry(
          conversation,
          classification.intent,
          incoming.message
        );
        responseMessage = result.message;
        escalated = result.escalated;
        responseImages = result.images;
        console.log(`[Orchestrator] AI response generated: ${responseMessage?.substring(0, 50)}...`);
        if (responseImages) {
          console.log(`[Orchestrator] AI also generated ${responseImages.length} images to send`);
        }

        // Check if AI detected an upload request
        if (result.uploadRequest) {
          console.log(`[Orchestrator] 🚗 AI detected upload request:`, result.uploadRequest);

          // Verify this is from staff
          const isStaff = await this.isStaffMember(incoming.from, incoming.tenantId);

          if (isStaff) {
            console.log(`[Orchestrator] User is staff, initiating upload flow...`);

            // Store vehicle data in conversation context
            await prisma.whatsAppConversation.update({
              where: { id: conversation.id },
              data: {
                conversationState: "upload_vehicle",
                isStaff: true,
                conversationType: "staff",
                contextData: {
                  uploadStep: incoming.mediaUrl ? "has_photo_and_data" : "has_data_awaiting_photo",
                  vehicleData: result.uploadRequest,
                  photos: incoming.mediaUrl ? [incoming.mediaUrl] : [],
                },
              },
            });

            // Ask for photo (vehicle will be created when photo is sent)
            responseMessage = `Oke data masuk! 👍\n\n` +
              `🚗 ${result.uploadRequest.make} ${result.uploadRequest.model} ${result.uploadRequest.year}\n` +
              `💰 Rp ${this.formatPrice(result.uploadRequest.price)}\n` +
              `🎨 ${result.uploadRequest.color || '-'} | ⚙️ ${result.uploadRequest.transmission || 'Manual'}\n` +
              `📍 ${result.uploadRequest.mileage || 0} km\n\n` +
              `Tinggal kirim 6 foto ya kak:\n` +
              `• Depan, belakang, samping\n` +
              `• Dashboard, jok, bagasi`;

            // If photo provided with message, add it to context
            if (incoming.mediaUrl) {
              await prisma.whatsAppConversation.update({
                where: { id: conversation.id },
                data: {
                  contextData: {
                    uploadStep: "has_photo_and_data",
                    vehicleData: result.uploadRequest,
                    photos: [incoming.mediaUrl],
                  },
                },
              });

              responseMessage = `Nice! Data + 1 foto masuk! 👍\n\n` +
                `🚗 ${result.uploadRequest.make} ${result.uploadRequest.model} ${result.uploadRequest.year}\n` +
                `💰 Rp ${this.formatPrice(result.uploadRequest.price)}\n` +
                `🎨 ${result.uploadRequest.color || '-'} | ⚙️ ${result.uploadRequest.transmission || 'Manual'}\n` +
                `📷 Foto: 1/6\n\n` +
                `Kirim 5 foto lagi ya~`;
            }
          } else {
            console.log(`[Orchestrator] User is NOT staff, ignoring upload request`);
            responseMessage = `Maaf kak, upload cuma buat staff aja 😊\n\nAda yang bisa aku bantu?`;
          }
        }
      }

      // 5. Send response if generated
      if (responseMessage || responseImages) {
        console.log(`[Orchestrator] Sending response to ${incoming.from}`);
        await this.sendResponse(
          incoming.accountId,
          incoming.from,
          responseMessage,
          conversation.id,
          classification.intent,
          responseImages
        );
        console.log(`[Orchestrator] Response sent successfully`);
      } else {
        console.log(`[Orchestrator] No response message generated`);
      }

      // 6. Update conversation status
      await prisma.whatsAppConversation.update({
        where: { id: conversation.id },
        data: {
          lastMessageAt: new Date(),
          lastIntent: classification.intent,
          ...(escalated && {
            escalatedTo: "human", // In production, assign to specific staff
            escalatedAt: new Date(),
          }),
        },
      });

      return {
        success: true,
        conversationId: conversation.id,
        intent: classification.intent,
        responseMessage,
        escalated,
      };
    } catch (error: any) {
      console.error("[Message Orchestrator] Error processing message:", error);
      return {
        success: false,
        conversationId: "",
        intent: "unknown",
        escalated: true,
        error: error.message,
      };
    }
  }

  /**
   * Get or create conversation
   */
  private static async getOrCreateConversation(
    accountId: string,
    tenantId: string,
    customerPhone: string
  ) {
    console.log(`[Orchestrator] Getting/creating conversation - accountId: ${accountId}, tenantId: ${tenantId}, phone: ${customerPhone}`);

    // Try to find active conversation
    let conversation = await prisma.whatsAppConversation.findFirst({
      where: {
        accountId,
        customerPhone,
        status: "active",
      },
      orderBy: { lastMessageAt: "desc" },
    });

    // Create new conversation if not found
    if (!conversation) {
      console.log(`[Orchestrator] Creating new conversation for ${customerPhone}`);
      conversation = await prisma.whatsAppConversation.create({
        data: {
          accountId,
          tenantId,
          customerPhone,
          isStaff: false,
          conversationType: "customer",
          status: "active",
        },
      });
      console.log(`[Orchestrator] Created conversation: ${conversation.id}`);
    } else {
      console.log(`[Orchestrator] Found existing conversation: ${conversation.id}`);
    }

    return conversation;
  }

  /**
   * Save incoming message to database
   */
  private static async saveIncomingMessage(
    conversationId: string,
    incoming: IncomingMessage
  ) {
    console.log(`[Orchestrator] Saving incoming message - conversationId: ${conversationId}, messageId: ${incoming.messageId}`);

    const conversation = await prisma.whatsAppConversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new Error("Conversation not found");
    }

    const message = await prisma.whatsAppMessage.create({
      data: {
        conversationId,
        tenantId: conversation.tenantId,
        direction: "inbound",
        sender: incoming.from,
        senderType: "customer", // Will be updated after classification
        content: incoming.message,
        mediaUrl: incoming.mediaUrl,
        mediaType: incoming.mediaType,
        aimeowMessageId: incoming.messageId,
        aimeowStatus: "delivered",
      },
    });

    console.log(`[Orchestrator] Saved message: ${message.id}`);
    return message;
  }

  /**
   * Handle staff command
   * UPDATED: Now uses StaffCommandService for full command processing
   */
  private static async handleStaffCommand(
    conversation: any,
    intent: MessageIntent,
    message: string,
    staffPhone: string,
    tenantId: string,
    mediaUrl?: string
  ): Promise<{ message: string; escalated: boolean }> {
    try {
      // Determine if there's media
      const hasMedia = !!mediaUrl;
      console.log(`[Orchestrator] handleStaffCommand - message: "${message}", hasMedia: ${hasMedia}, mediaUrl: ${mediaUrl}`);

      // Parse command (now async - supports AI-powered natural language extraction)
      const parseResult = await StaffCommandService.parseCommand(message, intent, hasMedia);

      if (!parseResult.isValid) {
        return {
          message: parseResult.error || "❌ Format command tidak valid.",
          escalated: false,
        };
      }

      // Execute command
      const executionResult = await StaffCommandService.executeCommand(
        intent,
        parseResult.params,
        tenantId,
        staffPhone,
        conversation.id,
        mediaUrl
      );

      return {
        message: executionResult.message,
        escalated: !executionResult.success,
      };
    } catch (error: any) {
      console.error("[Message Orchestrator] Staff command error:", error);
      return {
        message: `Waduh ada error nih 😅\n\n${error.message}\n\nCoba lagi ya kak!`,
        escalated: true,
      };
    }
  }

  /**
   * Handle customer inquiry dengan AI
   */
  private static async handleCustomerInquiry(
    conversation: any,
    intent: MessageIntent,
    message: string
  ): Promise<{
    message: string;
    escalated: boolean;
    images?: Array<{ imageUrl: string; caption?: string }>;
    uploadRequest?: any;
  }> {
    try {
      // Get conversation history (limit to 5 for faster response)
      const messageHistory = await WhatsAppAIChatService.getConversationHistory(
        conversation.id,
        5
      );

      // Generate AI response
      const aiResponse = await WhatsAppAIChatService.generateResponse(
        {
          tenantId: conversation.tenantId,
          conversationId: conversation.id,
          customerPhone: conversation.customerPhone,
          customerName: conversation.customerName,
          intent,
          messageHistory,
        },
        message
      );

      return {
        message: aiResponse.message,
        escalated: aiResponse.shouldEscalate,
        ...(aiResponse.images && { images: aiResponse.images }),
        ...(aiResponse.uploadRequest && { uploadRequest: aiResponse.uploadRequest }),
      };
    } catch (error: any) {
      console.error("[Message Orchestrator] AI response error:", error);
      return {
        message:
          "Maaf kak, lagi ada gangguan nih 🙏\n\nStaff kami bakal bantu sebentar lagi ya!",
        escalated: true,
      };
    }
  }

  /**
   * Handle staff verify command
   * Allows LID users to verify their staff identity using their phone number
   * Format: /verify 081234567890
   */
  private static async handleStaffVerify(
    conversation: any,
    message: string,
    senderPhone: string,
    tenantId: string
  ): Promise<{ message: string; escalated: boolean; verified: boolean; verifiedPhone?: string }> {
    try {
      console.log(`[Orchestrator] handleStaffVerify - message: "${message}", sender: ${senderPhone}`);

      // Extract phone number from message
      const phoneMatch = message.match(/(?:\/verify|verify|verifikasi)\s+(\+?[\d\s-]+)/i);
      if (!phoneMatch) {
        return {
          message: "❌ Format salah!\n\nCara pakai:\n/verify 081234567890\n\nGanti dengan nomor HP staff kamu ya 📱",
          escalated: false,
          verified: false,
        };
      }

      const claimedPhone = phoneMatch[1].replace(/[\s-]/g, "");
      console.log(`[Orchestrator] Claimed phone: ${claimedPhone}`);

      // Normalize the claimed phone
      const normalizedClaimed = this.normalizePhone(claimedPhone);

      // Check if this phone belongs to a staff member
      const staffUsers = await prisma.user.findMany({
        where: {
          tenantId,
          role: { in: ["ADMIN", "MANAGER", "SALES", "STAFF"] },
        },
        select: { id: true, phone: true, firstName: true, role: true },
      });

      let matchedStaff = null;
      for (const user of staffUsers) {
        if (!user.phone) continue;
        const normalizedUserPhone = this.normalizePhone(user.phone);
        if (normalizedClaimed === normalizedUserPhone) {
          matchedStaff = user;
          break;
        }
      }

      if (!matchedStaff) {
        console.log(`[Orchestrator] ❌ Phone ${claimedPhone} not found in staff list`);
        return {
          message: "❌ Nomor tidak terdaftar sebagai staff.\n\nPastikan nomor HP benar atau hubungi admin untuk menambahkan nomor kamu 📱",
          escalated: false,
          verified: false,
        };
      }

      console.log(`[Orchestrator] ✅ Verified as staff: ${matchedStaff.firstName} (${matchedStaff.role})`);

      return {
        message: `✅ Verifikasi berhasil!\n\nHalo ${matchedStaff.firstName} 👋\nKamu sudah terverifikasi sebagai ${matchedStaff.role}.\n\nSekarang kamu bisa pakai semua fitur staff!\nKetik 'halo' untuk melihat menu.`,
        escalated: false,
        verified: true,
        verifiedPhone: claimedPhone,
      };
    } catch (error: any) {
      console.error("[Orchestrator] Staff verify error:", error);
      return {
        message: "❌ Terjadi kesalahan saat verifikasi.\n\nCoba lagi ya kak!",
        escalated: true,
        verified: false,
      };
    }
  }

  /**
   * Send response via Aimeow
   */
  private static async sendResponse(
    accountId: string,
    to: string,
    message: string,
    conversationId: string,
    intent: MessageIntent,
    images?: Array<{ imageUrl: string; caption?: string }>
  ) {
    console.log("=".repeat(80));
    console.log(`[Orchestrator sendResponse] Starting send...`);
    console.log(`[Orchestrator sendResponse] Account ID: ${accountId}`);
    console.log(`[Orchestrator sendResponse] To: ${to}`);
    console.log(`[Orchestrator sendResponse] Message: ${message.substring(0, 100)}`);
    console.log(`[Orchestrator sendResponse] Conversation ID: ${conversationId}`);

    try {
      // Get account - fresh from DB to get updated clientId
      const account = await prisma.aimeowAccount.findUnique({
        where: { id: accountId },
      });

      if (!account) {
        console.error(`[Orchestrator sendResponse] ❌ Account not found: ${accountId}`);
        throw new Error("Account not found");
      }

      console.log(`[Orchestrator sendResponse] ✅ Account found`);
      console.log(`[Orchestrator sendResponse] Client ID: ${account.clientId}`);
      console.log(`[Orchestrator sendResponse] Phone: ${account.phoneNumber}`);
      console.log(`[Orchestrator sendResponse] Status: ${account.connectionStatus}`);
      console.log(`[Orchestrator sendResponse] Active: ${account.isActive}`);

      // Send text message via Aimeow
      let result: any = { success: true, messageId: null };
      if (message) {
        console.log(`[Orchestrator sendResponse] Calling AimeowClientService.sendMessage...`);
        result = await AimeowClientService.sendMessage({
          clientId: account.clientId,
          to,
          message,
        });

        console.log(`[Orchestrator sendResponse] Send result:`, JSON.stringify(result, null, 2));

        if (!result.success) {
          console.error(`[Orchestrator sendResponse] ❌ Send FAILED: ${result.error}`);
          throw new Error(result.error || "Failed to send message");
        }

        console.log(`[Orchestrator sendResponse] ✅ Text message sent SUCCESS!`);
      } else {
        console.log(`[Orchestrator sendResponse] No text message to send`);
      }

      // Send images if provided
      let imagesSent = false;
      if (images && images.length > 0) {
        console.log(`[Orchestrator sendResponse] 📸 Sending ${images.length} images...`);
        console.log(`[Orchestrator sendResponse] Image URLs:`, images.map(i => i.imageUrl));

        if (images.length === 1) {
          // Send single image
          console.log(`[Orchestrator sendResponse] Sending single image: ${images[0].imageUrl}`);
          const imageResult = await AimeowClientService.sendImage(
            account.clientId,
            to,
            images[0].imageUrl,
            images[0].caption
          );

          if (!imageResult.success) {
            console.error(`[Orchestrator sendResponse] ❌ Image send FAILED: ${imageResult.error}`);
          } else {
            console.log(`[Orchestrator sendResponse] ✅ Image sent SUCCESS!`);
            imagesSent = true;
            if (!result.messageId) result.messageId = imageResult.messageId;
          }
        } else {
          // Send multiple images one by one for better reliability
          console.log(`[Orchestrator sendResponse] Sending ${images.length} images one by one...`);
          for (let i = 0; i < images.length; i++) {
            const img = images[i];
            console.log(`[Orchestrator sendResponse] Sending image ${i + 1}/${images.length}: ${img.imageUrl}`);

            const imageResult = await AimeowClientService.sendImage(
              account.clientId,
              to,
              img.imageUrl,
              img.caption
            );

            if (!imageResult.success) {
              console.error(`[Orchestrator sendResponse] ❌ Image ${i + 1} send FAILED: ${imageResult.error}`);
            } else {
              console.log(`[Orchestrator sendResponse] ✅ Image ${i + 1} sent SUCCESS!`);
              imagesSent = true;
              if (!result.messageId) result.messageId = imageResult.messageId;
            }

            // Small delay between images to avoid rate limiting
            if (i < images.length - 1) {
              await new Promise(resolve => setTimeout(resolve, 500));
            }
          }
        }

        if (imagesSent) {
          console.log(`[Orchestrator sendResponse] ✅ All images sent successfully!`);
        }
      }

      // Save outbound message
      const conversation = await prisma.whatsAppConversation.findUnique({
        where: { id: conversationId },
      });

      if (conversation) {
        console.log(`[Orchestrator sendResponse] Saving outbound message to database...`);
        const contentToSave = message || (imagesSent ? `[${images?.length || 0} foto dikirim]` : '');
        const savedMsg = await prisma.whatsAppMessage.create({
          data: {
            conversationId,
            tenantId: conversation.tenantId,
            direction: "outbound",
            sender: account.phoneNumber || "AI",
            senderType: "ai",
            content: contentToSave,
            intent,
            aiResponse: true,
            aimeowMessageId: result?.messageId || `msg_${Date.now()}`,
            aimeowStatus: "sent",
          },
        });
        console.log(`[Orchestrator sendResponse] ✅ Outbound message saved: ${savedMsg.id}`);
      } else {
        console.error(`[Orchestrator sendResponse] ❌ Conversation not found: ${conversationId}`);
      }

      console.log(`[Orchestrator sendResponse] ✅✅✅ SEND COMPLETE SUCCESS ✅✅✅`);
    } catch (error: any) {
      console.error("=".repeat(80));
      console.error(`[Orchestrator sendResponse] ❌❌❌ CRITICAL ERROR ❌❌❌`);
      console.error(`[Orchestrator sendResponse] Error message: ${error.message}`);
      console.error(`[Orchestrator sendResponse] Error stack:`, error.stack);
      console.error("=".repeat(80));

      // Save failed message to database for tracking
      try {
        const conversation = await prisma.whatsAppConversation.findUnique({
          where: { id: conversationId },
        });

        if (conversation) {
          await prisma.whatsAppMessage.create({
            data: {
              conversationId,
              tenantId: conversation.tenantId,
              direction: "outbound",
              sender: "AI",
              senderType: "ai",
              content: message,
              intent,
              aiResponse: true,
              aimeowMessageId: null,
              aimeowStatus: "failed",
            },
          });
          console.log(`[Orchestrator sendResponse] Saved FAILED message to database for tracking`);
        }
      } catch (dbError) {
        console.error(`[Orchestrator sendResponse] Failed to save error to DB:`, dbError);
      }

      // Don't throw - message saved but not sent, can retry later
    }
  }

  /**
   * Check if phone number belongs to staff
   * Uses normalized phone comparison for flexible matching
   * Includes: ADMIN, MANAGER, SALES, STAFF roles
   */
  private static async isStaffMember(phone: string, tenantId: string): Promise<boolean> {
    const normalizedInput = this.normalizePhone(phone);
    console.log(`[Orchestrator] Checking staff - input: ${phone}, normalized: ${normalizedInput}`);

    // Get all users in tenant with staff roles and check phone match with normalization
    const users = await prisma.user.findMany({
      where: {
        tenantId,
        role: { in: ["ADMIN", "MANAGER", "SALES", "STAFF"] },
      },
      select: { id: true, phone: true, firstName: true, role: true },
    });

    for (const user of users) {
      if (!user.phone) continue;
      const normalizedUserPhone = this.normalizePhone(user.phone);
      if (normalizedInput === normalizedUserPhone) {
        console.log(`[Orchestrator] ✅ Staff match found: ${user.firstName} (${user.role})`);
        return true;
      }
    }

    console.log(`[Orchestrator] ❌ No staff match found for phone: ${phone}`);
    return false;
  }

  /**
   * Normalize phone number for comparison
   * Handles various formats: +62xxx, 62xxx, 0xxx, 08xxx
   */
  private static normalizePhone(phone: string): string {
    if (!phone) return "";
    let digits = phone.replace(/\D/g, "");
    if (digits.startsWith("0")) {
      digits = "62" + digits.substring(1);
    }
    return digits;
  }

  /**
   * Format price to Indonesian format
   */
  private static formatPrice(price: number): string {
    return new Intl.NumberFormat("id-ID").format(price);
  }
}

export default MessageOrchestratorService;
