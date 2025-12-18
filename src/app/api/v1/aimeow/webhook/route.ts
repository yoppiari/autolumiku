/**
 * Aimeow Webhook Handler
 * Receives incoming WhatsApp messages and events dari Aimeow
 * POST /api/v1/aimeow/webhook
 */

import { NextRequest, NextResponse } from "next/server";
import { MessageOrchestratorService } from "@/lib/services/whatsapp-ai/message-orchestrator.service";
import { AimeowClientService } from "@/lib/services/aimeow/aimeow-client.service";
import { prisma } from "@/lib/prisma";

const AIMEOW_BASE_URL = process.env.AIMEOW_BASE_URL || "https://meow.lumiku.com";

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

    // Get account from database with auto-fix for clientId mismatch
    let account = await AimeowClientService.getAccountByClientId(payload.clientId);

    // If not found by clientId, try to auto-fix by syncing with Aimeow API
    if (!account) {
      console.warn(`[Aimeow Webhook] ⚠️ Account not found for clientId: ${payload.clientId}`);
      console.log(`[Aimeow Webhook] Attempting auto-fix by syncing with Aimeow API...`);

      account = await autoFixClientIdMismatch(payload.clientId);

      if (!account) {
        console.error(`[Aimeow Webhook] ❌ Auto-fix failed. Unknown client: ${payload.clientId}`);
        return NextResponse.json(
          { success: false, error: "Unknown client - auto-fix failed" },
          { status: 404 }
        );
      }

      console.log(`[Aimeow Webhook] ✅ Auto-fix successful! Account found: ${account.id}`);
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
  const from = payload.data.from;
  const messageText = payload.data.message || payload.data.text || "";
  const mediaUrl = payload.data.mediaUrl;
  const mediaType = payload.data.mediaType;
  const messageId = payload.data.messageId || `msg_${Date.now()}`;

  try {
    // Validate sender - from is required
    if (!from) {
      console.warn("[Aimeow Webhook] Missing 'from' field in message");
      return;
    }

    // Allow photo-only messages (for staff upload flow)
    // messageText can be empty if mediaUrl exists
    if (!messageText && !mediaUrl) {
      console.warn("[Aimeow Webhook] Empty message (no text, no media)");
      return;
    }

    console.log("[Aimeow Webhook] Processing message:", {
      from,
      messageText: messageText.substring(0, 50),
      hasMedia: !!mediaUrl,
      mediaType,
    });

    // Process message via MessageOrchestrator
    const result = await MessageOrchestratorService.processIncomingMessage({
      accountId: account.id,
      tenantId: account.tenantId,
      from,
      message: messageText,
      mediaUrl,
      mediaType,
      messageId,
    });

    console.log("[Aimeow Webhook] Message processed:", {
      success: result.success,
      conversationId: result.conversationId,
      intent: result.intent,
      escalated: result.escalated,
    });

    // If processing failed, send error response to user
    if (!result.success) {
      console.error("[Aimeow Webhook] ❌ Processing failed:", result.error);

      // Send helpful error message to user
      await AimeowClientService.sendMessage({
        clientId: account.clientId,
        to: from,
        message:
          "Maaf, terjadi gangguan sementara. 🙏\n\n" +
          "Silakan coba lagi dalam beberapa saat atau ketik:\n" +
          "• \"halo\" untuk memulai chat\n" +
          "• \"mobil\" untuk lihat daftar mobil\n\n" +
          "Terima kasih atas kesabarannya! 😊",
      });
    }
  } catch (error: any) {
    console.error("[Aimeow Webhook] ❌ Error processing message:", error.message);

    // Try to send error response to user (only if we have sender info)
    if (from) {
      try {
        await AimeowClientService.sendMessage({
          clientId: account.clientId,
          to: from,
          message:
            "Maaf, sistem sedang mengalami kendala. 🙏\n\n" +
            "Staff kami akan segera membantu Anda.\n" +
            "Silakan coba lagi nanti atau hubungi kami langsung.\n\n" +
            "Terima kasih! 😊",
        });
      } catch (sendError) {
        console.error("[Aimeow Webhook] Failed to send error message:", sendError);
      }
    }
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

/**
 * Auto-fix clientId mismatch by syncing with Aimeow API
 * This handles cases where:
 * 1. Webhook sends JID format (6281xxx:17@s.whatsapp.net) but DB has UUID
 * 2. ClientId in DB is outdated/wrong
 */
async function autoFixClientIdMismatch(webhookClientId: string) {
  try {
    console.log(`[Aimeow AutoFix] Starting auto-fix for clientId: ${webhookClientId}`);

    // Strategy 1: Extract phone number from JID format and find account
    if (webhookClientId.includes("@s.whatsapp.net")) {
      const phoneNumber = webhookClientId.split(":")[0];
      console.log(`[Aimeow AutoFix] Extracted phone: ${phoneNumber}`);

      // Find account by phone number
      const accountByPhone = await prisma.aimeowAccount.findFirst({
        where: {
          OR: [
            { phoneNumber: phoneNumber },
            { phoneNumber: `+${phoneNumber}` },
          ],
        },
        include: { aiConfig: true, tenant: true },
      });

      if (accountByPhone) {
        console.log(`[Aimeow AutoFix] ✅ Found account by phone: ${accountByPhone.id}`);
        return accountByPhone;
      }
    }

    // Strategy 2: If only ONE account exists in DB, use that (single-tenant mode)
    const allAccounts = await prisma.aimeowAccount.findMany({
      include: { aiConfig: true, tenant: true },
    });

    if (allAccounts.length === 1) {
      const singleAccount = allAccounts[0];
      console.log(`[Aimeow AutoFix] Single account mode - using: ${singleAccount.id}`);

      // Fetch correct clientId from Aimeow API and update DB
      try {
        const clientsResponse = await fetch(`${AIMEOW_BASE_URL}/api/v1/clients`, {
          headers: { 'Accept': 'application/json' },
          cache: 'no-store',
        });

        if (clientsResponse.ok) {
          const clients = await clientsResponse.json();
          const connectedClient = clients.find((c: any) => c.isConnected === true);

          if (connectedClient && connectedClient.id !== singleAccount.clientId) {
            console.log(`[Aimeow AutoFix] 🔄 Updating clientId: ${singleAccount.clientId} → ${connectedClient.id}`);

            await prisma.aimeowAccount.update({
              where: { id: singleAccount.id },
              data: {
                clientId: connectedClient.id,
                phoneNumber: connectedClient.phone || singleAccount.phoneNumber,
                connectionStatus: "connected",
                isActive: true,
              },
            });

            // Return updated account
            return await prisma.aimeowAccount.findUnique({
              where: { id: singleAccount.id },
              include: { aiConfig: true, tenant: true },
            });
          }
        }
      } catch (apiError) {
        console.error(`[Aimeow AutoFix] API sync failed:`, apiError);
      }

      // Return the single account even without API sync
      return singleAccount;
    }

    // Strategy 3: Multiple accounts - try to match by fetching all clients from Aimeow
    if (allAccounts.length > 1) {
      console.log(`[Aimeow AutoFix] Multiple accounts (${allAccounts.length}), trying API match...`);

      try {
        const clientsResponse = await fetch(`${AIMEOW_BASE_URL}/api/v1/clients`, {
          headers: { 'Accept': 'application/json' },
          cache: 'no-store',
        });

        if (clientsResponse.ok) {
          const clients = await clientsResponse.json();

          // Find the client that matches webhookClientId
          const matchingClient = clients.find((c: any) =>
            c.id === webhookClientId ||
            (c.phone && webhookClientId.includes(c.phone))
          );

          if (matchingClient) {
            // Find account that should be updated
            const accountToUpdate = allAccounts.find(
              (a) => a.phoneNumber === matchingClient.phone ||
                     a.clientId.includes(matchingClient.phone?.substring(0, 6) || 'xxx')
            );

            if (accountToUpdate) {
              console.log(`[Aimeow AutoFix] 🔄 Updating account ${accountToUpdate.id} with clientId: ${matchingClient.id}`);

              await prisma.aimeowAccount.update({
                where: { id: accountToUpdate.id },
                data: {
                  clientId: matchingClient.id,
                  phoneNumber: matchingClient.phone || accountToUpdate.phoneNumber,
                  connectionStatus: matchingClient.isConnected ? "connected" : "disconnected",
                  isActive: matchingClient.isConnected,
                },
              });

              return await prisma.aimeowAccount.findUnique({
                where: { id: accountToUpdate.id },
                include: { aiConfig: true, tenant: true },
              });
            }
          }
        }
      } catch (apiError) {
        console.error(`[Aimeow AutoFix] Multi-account API match failed:`, apiError);
      }
    }

    console.log(`[Aimeow AutoFix] ❌ All strategies failed`);
    return null;
  } catch (error) {
    console.error(`[Aimeow AutoFix] Error:`, error);
    return null;
  }
}
