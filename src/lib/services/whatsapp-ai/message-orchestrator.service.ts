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

      // 3. Classify intent
      console.log(`[Orchestrator] Classifying intent for message: ${incoming.message}`);
      const classification = await IntentClassifierService.classify(
        incoming.message,
        incoming.from,
        incoming.tenantId
      );
      console.log(`[Orchestrator] Intent classified: ${classification.intent}, isStaff: ${classification.isStaff}, isCustomer: ${classification.isCustomer}`);

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

      // Update conversation type
      if (classification.isStaff) {
        await prisma.whatsAppConversation.update({
          where: { id: conversation.id },
          data: {
            isStaff: true,
            conversationType: "staff",
          },
        });
      }

      // 4. Route based on intent
      let responseMessage: string | undefined;
      let escalated = false;

      if (classification.isStaff) {
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
        console.log(`[Orchestrator] AI response generated: ${responseMessage?.substring(0, 50)}...`);
      }

      // 5. Send response if generated
      if (responseMessage) {
        console.log(`[Orchestrator] Sending response to ${incoming.from}`);
        await this.sendResponse(
          incoming.accountId,
          incoming.from,
          responseMessage,
          conversation.id,
          classification.intent
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
      // Parse command
      const parseResult = StaffCommandService.parseCommand(message, intent);

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
        message: `❌ Terjadi kesalahan saat menjalankan command: ${error.message}`,
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
  ): Promise<{ message: string; escalated: boolean }> {
    try {
      // Get conversation history
      const messageHistory = await WhatsAppAIChatService.getConversationHistory(
        conversation.id,
        10
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
      };
    } catch (error: any) {
      console.error("[Message Orchestrator] AI response error:", error);
      return {
        message:
          "Maaf, terjadi gangguan sistem. Staff kami akan segera membantu Anda.",
        escalated: true,
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
    intent: MessageIntent
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

      // Send via Aimeow
      console.log(`[Orchestrator sendResponse] Calling AimeowClientService.sendMessage...`);
      const result = await AimeowClientService.sendMessage({
        clientId: account.clientId,
        to,
        message,
      });

      console.log(`[Orchestrator sendResponse] Send result:`, JSON.stringify(result, null, 2));

      if (!result.success) {
        console.error(`[Orchestrator sendResponse] ❌ Send FAILED: ${result.error}`);
        throw new Error(result.error || "Failed to send message");
      }

      console.log(`[Orchestrator sendResponse] ✅ Send SUCCESS!`);

      // Save outbound message
      const conversation = await prisma.whatsAppConversation.findUnique({
        where: { id: conversationId },
      });

      if (conversation) {
        console.log(`[Orchestrator sendResponse] Saving outbound message to database...`);
        const savedMsg = await prisma.whatsAppMessage.create({
          data: {
            conversationId,
            tenantId: conversation.tenantId,
            direction: "outbound",
            sender: account.phoneNumber || "AI",
            senderType: "ai",
            content: message,
            intent,
            aiResponse: true,
            aimeowMessageId: result.messageId,
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
}

export default MessageOrchestratorService;
