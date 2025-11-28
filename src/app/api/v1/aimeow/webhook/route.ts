/**
 * Aimeow Webhook Handler
 * Receives incoming WhatsApp messages and events dari Aimeow
 * POST /api/v1/aimeow/webhook
 */

import { NextRequest, NextResponse } from "next/server";
import { MessageOrchestratorService } from "@/lib/services/whatsapp-ai/message-orchestrator.service";
import { AimeowClientService } from "@/lib/services/aimeow/aimeow-client.service";
import { prisma } from "@/lib/prisma";

// Webhook event types dari Aimeow
interface AimeowWebhookPayload {
  clientId: string;
  event: "message" | "status" | "qr" | "connected" | "disconnected";
  timestamp: string;
  data: {
    from?: string;
    to?: string;
    message?: string;
    text?: string; // Alternative field
    mediaUrl?: string;
    mediaType?: string;
    messageId?: string;
    status?: string;
    qrCode?: string;
    phoneNumber?: string;
  };
}

export async function POST(request: NextRequest) {
  try {
    const payload: AimeowWebhookPayload = await request.json();

    console.log("[Aimeow Webhook] Received event:", {
      event: payload.event,
      clientId: payload.clientId,
      timestamp: payload.timestamp,
    });

    // Verify webhook signature (if configured)
    const webhookSecret = process.env.AIMEOW_WEBHOOK_SECRET;
    if (webhookSecret) {
      const signature = request.headers.get("x-aimeow-signature");
      if (!signature || signature !== webhookSecret) {
        console.warn("[Aimeow Webhook] Invalid signature");
        return NextResponse.json(
          { success: false, error: "Invalid signature" },
          { status: 401 }
        );
      }
    }

    // Get account from database
    const account = await AimeowClientService.getAccountByClientId(payload.clientId);
    if (!account) {
      console.warn(`[Aimeow Webhook] Unknown client: ${payload.clientId}`);
      return NextResponse.json(
        { success: false, error: "Unknown client" },
        { status: 404 }
      );
    }

    // Handle different event types
    switch (payload.event) {
      case "message":
        await handleIncomingMessage(payload, account);
        break;

      case "connected":
        await handleConnected(payload, account);
        break;

      case "disconnected":
        await handleDisconnected(payload, account);
        break;

      case "qr":
        await handleQRUpdate(payload, account);
        break;

      case "status":
        await handleStatusUpdate(payload, account);
        break;

      default:
        console.warn(`[Aimeow Webhook] Unknown event type: ${payload.event}`);
    }

    return NextResponse.json({ success: true, received: true });
  } catch (error: any) {
    console.error("[Aimeow Webhook] Error processing webhook:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
        details: error.message,
      },
      { status: 500 }
    );
  }
}

/**
 * Handle incoming message dari customer atau staff
 */
async function handleIncomingMessage(
  payload: AimeowWebhookPayload,
  account: any
) {
  try {
    const messageText = payload.data.message || payload.data.text || "";
    const from = payload.data.from;
    const messageId = payload.data.messageId || `msg_${Date.now()}`;

    if (!from || !messageText) {
      console.warn("[Aimeow Webhook] Missing required message data");
      return;
    }

    // Process message via MessageOrchestrator
    const result = await MessageOrchestratorService.processIncomingMessage({
      accountId: account.id,
      tenantId: account.tenantId,
      from,
      message: messageText,
      mediaUrl: payload.data.mediaUrl,
      mediaType: payload.data.mediaType,
      messageId,
    });

    console.log("[Aimeow Webhook] Message processed:", {
      conversationId: result.conversationId,
      intent: result.intent,
      escalated: result.escalated,
    });
  } catch (error) {
    console.error("[Aimeow Webhook] Error processing message:", error);
  }
}

/**
 * Handle WhatsApp connection established
 */
async function handleConnected(
  payload: AimeowWebhookPayload,
  account: any
) {
  try {
    await prisma.aimeowAccount.update({
      where: { id: account.id },
      data: {
        connectionStatus: "connected",
        isActive: true,
        phoneNumber: payload.data.phoneNumber || account.phoneNumber,
        lastConnectedAt: new Date(),
      },
    });

    console.log("[Aimeow Webhook] Client connected:", {
      clientId: payload.clientId,
      phoneNumber: payload.data.phoneNumber,
    });

    // TODO: Send notification to admin about successful connection
  } catch (error) {
    console.error("[Aimeow Webhook] Error handling connected event:", error);
  }
}

/**
 * Handle WhatsApp disconnection
 */
async function handleDisconnected(
  payload: AimeowWebhookPayload,
  account: any
) {
  try {
    await prisma.aimeowAccount.update({
      where: { id: account.id },
      data: {
        connectionStatus: "disconnected",
        isActive: false,
      },
    });

    console.log("[Aimeow Webhook] Client disconnected:", payload.clientId);

    // TODO: Send notification to admin about disconnection
  } catch (error) {
    console.error("[Aimeow Webhook] Error handling disconnected event:", error);
  }
}

/**
 * Handle QR code update
 */
async function handleQRUpdate(
  payload: AimeowWebhookPayload,
  account: any
) {
  try {
    if (!payload.data.qrCode) return;

    await prisma.aimeowAccount.update({
      where: { id: account.id },
      data: {
        qrCode: payload.data.qrCode,
        qrCodeExpiresAt: new Date(Date.now() + 120000), // 2 minutes
        connectionStatus: "qr_ready",
      },
    });

    console.log("[Aimeow Webhook] QR code updated:", payload.clientId);
  } catch (error) {
    console.error("[Aimeow Webhook] Error handling QR update:", error);
  }
}

/**
 * Handle general status updates
 */
async function handleStatusUpdate(
  payload: AimeowWebhookPayload,
  account: any
) {
  try {
    const status = payload.data.status;
    if (!status) return;

    await prisma.aimeowAccount.update({
      where: { id: account.id },
      data: {
        connectionStatus: status,
      },
    });

    console.log("[Aimeow Webhook] Status updated:", {
      clientId: payload.clientId,
      status,
    });
  } catch (error) {
    console.error("[Aimeow Webhook] Error handling status update:", error);
  }
}

// Allow only POST method
export async function GET() {
  return NextResponse.json(
    { error: "Method not allowed. Use POST for webhook." },
    { status: 405 }
  );
}
