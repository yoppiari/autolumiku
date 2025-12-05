/**
 * Aimeow Webhook Endpoint
 * Receives webhooks from Aimeow WhatsApp Business API
 * Events: message, status, qr, connected, disconnected
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AimeowClientService } from "@/lib/services/aimeow/aimeow-client.service";
import { MessageOrchestratorService } from "@/lib/services/whatsapp-ai/message-orchestrator.service";

// ==================== WEBHOOK HANDLER ====================

export async function POST(request: NextRequest) {
  const timestamp = new Date().toISOString();
  const headers = {
    origin: request.headers.get("origin") || "none",
    referer: request.headers.get("referer") || "none",
    userAgent: request.headers.get("user-agent") || "none",
    host: request.headers.get("host") || "none",
    contentType: request.headers.get("content-type") || "none",
  };

  console.log("=".repeat(80));
  console.log(`[Aimeow Webhook] ${timestamp} - INCOMING REQUEST`);
  console.log("[Aimeow Webhook] Headers:", JSON.stringify(headers, null, 2));

  try {
    const payload = await request.json();

    console.log("[Aimeow Webhook] Payload:", JSON.stringify(payload, null, 2));
    console.log("[Aimeow Webhook] Payload keys:", Object.keys(payload));

    const { clientId, message, event, data } = payload;

    if (!clientId) {
      return NextResponse.json(
        { error: "Missing required field: clientId" },
        { status: 400 }
      );
    }

    // Get account from clientId
    const account = await AimeowClientService.getAccountByClientId(clientId);

    if (!account) {
      console.error(`[Aimeow Webhook] Account not found for clientId: ${clientId}`);
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    // Aimeow sends messages with { clientId, message, timestamp } structure
    // Handle incoming message if message field exists
    if (message) {
      // Skip non-text message types
      if (message.type !== "text") {
        console.log(`[Aimeow Webhook] Skipping non-text message type: ${message.type}`);
        return NextResponse.json({ success: true });
      }

      await handleIncomingMessage(account, {
        from: message.from,
        message: message.text,
        mediaUrl: message.mediaUrl,
        mediaType: message.mediaType,
        messageId: message.id,
      });
      return NextResponse.json({ success: true });
    }

    // Legacy event-based format (kept for backwards compatibility)
    if (event) {
      switch (event) {
        case "message":
          await handleIncomingMessage(account, data);
          break;

        case "status":
          await handleMessageStatus(account, data);
          break;

        case "qr":
          await handleQRCode(account, data);
          break;

        case "connected":
          await handleConnected(account, data);
          break;

        case "disconnected":
          await handleDisconnected(account);
          break;

        default:
          console.warn(`[Aimeow Webhook] Unknown event type: ${event}`);
      }
      return NextResponse.json({ success: true });
    }

    console.warn("[Aimeow Webhook] No message or event field in payload");
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[Aimeow Webhook] Error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}

// ==================== EVENT HANDLERS ====================

/**
 * Handle incoming WhatsApp message
 * UPDATED: Now uses MessageOrchestratorService for full AI processing
 */
async function handleIncomingMessage(account: any, data: any) {
  const { from, message, mediaUrl, mediaType, messageId } = data;

  try {
    console.log(`[Webhook] Processing message - From: ${from}, MessageId: ${messageId}, Message: ${message}`);

    if (!from || !message || !messageId) {
      console.error(`[Webhook] Missing required fields - from: ${from}, message: ${message}, messageId: ${messageId}`);
      return;
    }

    // Check if message already exists (prevent duplicates)
    const existing = await prisma.whatsAppMessage.findUnique({
      where: { aimeowMessageId: messageId },
    });

    if (existing) {
      console.log(`[Webhook] Duplicate message skipped: ${messageId}`);
      return;
    }

    // Process message dengan MessageOrchestrator
    // This handles: intent classification, AI response, staff commands, database save, dan auto-reply
    const result = await MessageOrchestratorService.processIncomingMessage({
      accountId: account.id,
      tenantId: account.tenantId,
      from,
      message,
      mediaUrl,
      mediaType,
      messageId,
    });

    if (result.success) {
      console.log(
        `[Webhook] Message processed successfully - Intent: ${result.intent}, Escalated: ${result.escalated}`
      );
    } else {
      console.error(`[Webhook] Failed to process message:`, result.error);
    }
  } catch (error) {
    console.error("[Webhook] Failed to handle incoming message:", error);
  }
}

/**
 * Handle message delivery status update
 */
async function handleMessageStatus(account: any, data: any) {
  const { messageId, status } = data;

  try {
    await prisma.whatsAppMessage.updateMany({
      where: {
        aimeowMessageId: messageId,
        tenantId: account.tenantId,
      },
      data: {
        aimeowStatus: status,
        ...(status === "delivered" && { deliveredAt: new Date() }),
        ...(status === "read" && { readAt: new Date() }),
      },
    });

    console.log(`[Webhook] Message status updated: ${messageId} -> ${status}`);
  } catch (error) {
    console.error("[Webhook] Failed to update message status:", error);
  }
}

/**
 * Handle QR code update
 */
async function handleQRCode(account: any, data: any) {
  const { qrCode } = data;

  try {
    await prisma.aimeowAccount.update({
      where: { id: account.id },
      data: {
        qrCode,
        qrCodeExpiresAt: new Date(Date.now() + 60000), // 60 seconds
        connectionStatus: "waiting_qr",
      },
    });

    console.log(`[Webhook] QR code updated for account: ${account.id}`);
  } catch (error) {
    console.error("[Webhook] Failed to update QR code:", error);
  }
}

/**
 * Handle WhatsApp connection established
 */
async function handleConnected(account: any, data: any) {
  const { phoneNumber } = data;

  try {
    await prisma.aimeowAccount.update({
      where: { id: account.id },
      data: {
        phoneNumber: phoneNumber || account.phoneNumber,
        isActive: true,
        connectionStatus: "connected",
        lastConnectedAt: new Date(),
        qrCode: null, // Clear QR code after connection
      },
    });

    console.log(`[Webhook] WhatsApp connected: ${phoneNumber}`);

    // Send welcome notification to tenant admin
    // TODO: Implement notification system
  } catch (error) {
    console.error("[Webhook] Failed to handle connection:", error);
  }
}

/**
 * Handle WhatsApp disconnection
 */
async function handleDisconnected(account: any) {
  try {
    await prisma.aimeowAccount.update({
      where: { id: account.id },
      data: {
        isActive: false,
        connectionStatus: "disconnected",
      },
    });

    console.log(`[Webhook] WhatsApp disconnected for account: ${account.id}`);

    // Send alert notification to tenant admin
    // TODO: Implement notification system
  } catch (error) {
    console.error("[Webhook] Failed to handle disconnection:", error);
  }
}

// ==================== VERIFICATION (Optional) ====================

/**
 * GET endpoint for webhook verification (jika Aimeow memerlukan)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  // Verify token (set di environment variable)
  const VERIFY_TOKEN = process.env.AIMEOW_WEBHOOK_VERIFY_TOKEN || "autolumiku_webhook_2024";

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("[Webhook] Verification successful");
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({ error: "Verification failed" }, { status: 403 });
}
