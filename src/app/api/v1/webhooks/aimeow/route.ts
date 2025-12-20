/**
 * Aimeow Webhook Endpoint
 * Receives webhooks from Aimeow WhatsApp Business API
 * Events: message, status, qr, connected, disconnected
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AimeowClientService } from "@/lib/services/aimeow/aimeow-client.service";
import { MessageOrchestratorService } from "@/lib/services/whatsapp-ai/message-orchestrator.service";

const AIMEOW_BASE_URL = process.env.AIMEOW_BASE_URL || "https://meow.lumiku.com";

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

    // EXTRA DEBUG: Log message.from field specifically
    if (payload.message && payload.message.from) {
      console.log("[Aimeow Webhook] RAW message.from:", payload.message.from);
      console.log("[Aimeow Webhook] message.from type:", typeof payload.message.from);
    }

    const { clientId, message, event, data } = payload;

    if (!clientId) {
      return NextResponse.json(
        { error: "Missing required field: clientId" },
        { status: 400 }
      );
    }

    // Get account from clientId with auto-fix for mismatch
    let account = await AimeowClientService.getAccountByClientId(clientId);

    // If not found, try auto-fix by syncing with Aimeow API
    if (!account) {
      console.warn(`[Aimeow Webhook] ⚠️ Account not found for clientId: ${clientId}`);
      console.log(`[Aimeow Webhook] Attempting auto-fix...`);

      account = await autoFixClientIdMismatch(clientId);

      if (!account) {
        console.error(`[Aimeow Webhook] ❌ Auto-fix failed. Unknown client: ${clientId}`);
        return NextResponse.json({ error: "Account not found" }, { status: 404 });
      }

      console.log(`[Aimeow Webhook] ✅ Auto-fix successful! Account: ${account.id}`);
    }

    // Aimeow sends messages with { clientId, message, timestamp } structure
    // Handle incoming message if message field exists
    if (message) {
      // DEBUG: Log ALL fields in message object to find correct phone field
      console.log("[Aimeow Webhook] 🔍 FULL MESSAGE OBJECT:");
      console.log(JSON.stringify(message, null, 2));
      console.log("[Aimeow Webhook] Message keys:", Object.keys(message));
      console.log("[Aimeow Webhook] Message type:", message.type);

      // Check all possible phone number fields
      const possiblePhoneFields = [
        message.from,
        message.sender,
        message.participant,
        message.remoteJid,
        message.key?.remoteJid,
        message.key?.participant,
      ];
      console.log("[Aimeow Webhook] 🔍 ALL POSSIBLE PHONE FIELDS:", possiblePhoneFields);

      // IMPORTANT FIX: Use first available phone field as fallback
      // Aimeow may send phone in different fields depending on message type/source
      const rawFrom = message.from
        || message.sender
        || message.participant
        || message.remoteJid
        || message.key?.remoteJid
        || message.key?.participant;

      if (!rawFrom) {
        console.error("[Aimeow Webhook] ❌ No phone/from field found in any possible location!");
        console.error("[Aimeow Webhook] Full message object:", JSON.stringify(message, null, 2));
        return NextResponse.json({ success: false, error: "No sender phone found" }, { status: 400 });
      }

      console.log("[Aimeow Webhook] 📱 Using from field:", rawFrom);

      // IMPORTANT: Normalize phone/JID for reply
      // Aimeow sends different formats:
      // 1. Phone JID: "6281235108908:17@s.whatsapp.net" -> extract "6281235108908"
      // 2. LID JID: "10020343271578:17@lid" -> preserve as "10020343271578@lid"
      // 3. Raw LID (no suffix): "10020343271578" -> add @lid suffix!
      //
      // LIDs (Linked IDs) are internal WhatsApp IDs for business accounts/linked devices
      // They MUST have @lid suffix for replies to work!
      let normalizedFrom = rawFrom;

      // Log for debugging
      console.log("[Aimeow Webhook] 📱 RAW FROM FIELD:", rawFrom);

      // Helper to check if a number looks like an LID (not a phone number)
      // LIDs typically start with "100", "101", etc. and are longer than phone numbers
      // Indonesian phones: 62xxx (12-13 digits starting with 62)
      // LIDs: typically 14+ digits starting with 100/101
      const isLikelyLID = (num: string): boolean => {
        const cleanNum = num.split(":")[0].split("@")[0];
        return (
          cleanNum.length >= 14 &&
          (cleanNum.startsWith("100") || cleanNum.startsWith("101") || cleanNum.startsWith("102")) &&
          !cleanNum.startsWith("62")
        );
      };

      // Check if this is an LID format (contains @lid)
      if (rawFrom.includes("@lid")) {
        // LID format with suffix: preserve it, just remove device part
        // "10020343271578:17@lid" -> "10020343271578@lid"
        const lidPart = rawFrom.split(":")[0];
        normalizedFrom = `${lidPart}@lid`;
        console.log(`[Aimeow Webhook] 🔗 LID with suffix: ${rawFrom} -> ${normalizedFrom}`);
      } else if (rawFrom.includes("@s.whatsapp.net")) {
        // Phone JID format: extract just the phone number
        // "6281235108908:17@s.whatsapp.net" -> "6281235108908"
        normalizedFrom = rawFrom.split("@")[0].split(":")[0];
        console.log(`[Aimeow Webhook] 📞 Phone JID: ${rawFrom} -> ${normalizedFrom}`);
      } else if (rawFrom.includes("@")) {
        // Unknown JID format - try to preserve domain
        const [userPart, domain] = rawFrom.split("@");
        const cleanUser = userPart.split(":")[0];
        normalizedFrom = `${cleanUser}@${domain}`;
        console.log(`[Aimeow Webhook] ❓ Unknown JID: ${rawFrom} -> ${normalizedFrom}`);
      } else {
        // No @ symbol - check if it looks like an LID and add @lid suffix
        const cleanNum = rawFrom.split(":")[0];
        if (isLikelyLID(cleanNum)) {
          // This looks like an LID without suffix - ADD @lid!
          normalizedFrom = `${cleanNum}@lid`;
          console.log(`[Aimeow Webhook] 🔗 LID detected (adding @lid): ${rawFrom} -> ${normalizedFrom}`);
        } else {
          // Regular phone number
          normalizedFrom = cleanNum;
          console.log(`[Aimeow Webhook] 📱 Phone number: ${rawFrom} -> ${normalizedFrom}`);
        }
      }

      // Extract message text and media based on message type
      let messageText = "";
      let mediaUrl = undefined;
      let mediaType = undefined;

      // DEBUG: Log all possible media URL fields for troubleshooting
      console.log("[Aimeow Webhook] 🖼️ MEDIA URL DETECTION:");
      console.log("  - message.mediaUrl:", message.mediaUrl);
      console.log("  - message.url:", message.url);
      console.log("  - message.imageUrl:", message.imageUrl);
      console.log("  - message.image:", message.image);
      console.log("  - message.media:", message.media);
      console.log("  - message.image?.url:", message.image?.url);
      console.log("  - message.media?.url:", message.media?.url);
      console.log("  - message.imageMessage:", message.imageMessage);
      console.log("  - message.imageMessage?.url:", message.imageMessage?.url);
      console.log("  - message.downloadUrl:", message.downloadUrl);
      console.log("  - message.file:", message.file);
      console.log("  - message.fileUrl:", message.fileUrl);
      console.log("[Aimeow Webhook] 🔑 ALL message keys:", Object.keys(message));

      if (message.type === "text") {
        messageText = message.text || "";
      } else if (message.type === "image") {
        // Image message - extract caption as text and media URL
        messageText = message.caption || message.text || "";

        // COMPREHENSIVE: Try ALL possible field names for media URL
        // Some WhatsApp libraries use different field names
        mediaUrl = message.mediaUrl
          || message.url
          || message.imageUrl
          || message.downloadUrl
          || message.fileUrl
          || message.file
          || message.image?.url
          || message.media?.url
          || message.imageMessage?.url
          || message.imageMessage?.directPath
          || message.directPath
          || message.image
          || message.media;

        // Handle array format (album photos)
        if (Array.isArray(mediaUrl)) {
          console.log(`[Aimeow Webhook] 📸 Media is array with ${mediaUrl.length} items`);
          mediaUrl = mediaUrl[0];
        }

        // If mediaUrl is an object, try to extract url from it
        if (mediaUrl && typeof mediaUrl === 'object') {
          mediaUrl = mediaUrl.url || mediaUrl.link || mediaUrl.src || mediaUrl.directPath || undefined;
        }

        // Check nested structures
        if (!mediaUrl && message.message?.imageMessage?.url) {
          mediaUrl = message.message.imageMessage.url;
          console.log(`[Aimeow Webhook] 📸 Found in message.message.imageMessage.url`);
        }
        if (!mediaUrl && message.mediaData?.url) {
          mediaUrl = message.mediaData.url;
          console.log(`[Aimeow Webhook] 📸 Found in message.mediaData.url`);
        }

        mediaType = "image";
        console.log(`[Aimeow Webhook] ✅ Image message detected:`);
        console.log(`  - mediaUrl: ${mediaUrl}`);
        console.log(`  - Caption: "${messageText}"`);
        console.log(`  - mediaUrl type: ${typeof mediaUrl}`);

        if (!mediaUrl) {
          console.error(`[Aimeow Webhook] ⚠️ WARNING: Image message has no mediaUrl!`);
          console.error(`[Aimeow Webhook] Full message object:`, JSON.stringify(message, null, 2));
          // Still continue processing - the message will be saved and photo can be linked later
        }
      } else if (message.type === "video") {
        messageText = message.caption || message.text || "";
        mediaUrl = message.mediaUrl || message.url || message.videoUrl || message.video?.url || message.media?.url;
        mediaType = "video";
        console.log(`[Aimeow Webhook] Video message - URL: ${mediaUrl}, Caption: ${messageText}`);
      } else if (message.type === "document") {
        messageText = message.caption || message.text || message.filename || "";
        mediaUrl = message.mediaUrl || message.url || message.documentUrl || message.document?.url || message.media?.url;
        mediaType = "document";
        console.log(`[Aimeow Webhook] Document message - URL: ${mediaUrl}, Caption: ${messageText}`);
      } else {
        // Unknown type - log but continue processing (might still have useful content)
        console.log(`[Aimeow Webhook] ⚠️ Unsupported message type: ${message.type}`);
        messageText = message.text || message.caption || message.body || "";

        // Still try to extract any media
        mediaUrl = message.mediaUrl || message.url || message.media?.url;
        if (mediaUrl) {
          mediaType = "unknown";
          console.log(`[Aimeow Webhook] Found media in unsupported type: ${mediaUrl}`);
        }

        // If still no content, skip
        if (!messageText && !mediaUrl) {
          console.log(`[Aimeow Webhook] No content found, skipping`);
          return NextResponse.json({ success: true });
        }
      }

      try {
        await handleIncomingMessage(account, {
          from: normalizedFrom,
          message: messageText,
          mediaUrl: mediaUrl,
          mediaType: mediaType,
          messageId: message.id,
        });
      } catch (handleError: any) {
        console.error("[Aimeow Webhook] ❌ Error in handleIncomingMessage:", handleError.message);

        // IMPORTANT: Always send feedback to user when error occurs
        try {
          const { AimeowClientService } = await import("@/lib/services/aimeow/aimeow-client.service");
          await AimeowClientService.sendMessage({
            clientId: account.clientId,
            to: normalizedFrom,
            message: `Maaf kak, ada gangguan sementara 🙏\n\nError: ${handleError.message}\n\nCoba lagi beberapa saat ya!`,
          });
        } catch (sendError) {
          console.error("[Aimeow Webhook] Failed to send error feedback:", sendError);
        }
      }
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
    console.log("=".repeat(60));
    console.log(`[Webhook] 📨 PROCESSING INCOMING MESSAGE`);
    console.log(`[Webhook] From: ${from}`);
    console.log(`[Webhook] MessageId: ${messageId}`);
    console.log(`[Webhook] Message text: "${message || '(empty)'}"`);
    console.log(`[Webhook] MediaUrl: ${mediaUrl || '(none)'}`);
    console.log(`[Webhook] MediaType: ${mediaType || '(none)'}`);
    console.log("=".repeat(60));

    // Allow empty message for media (photos with no caption)
    if (!from || !messageId) {
      console.error(`[Webhook] ❌ Missing required fields - from: ${from}, messageId: ${messageId}`);
      return;
    }

    // If no message text and no media, skip
    if (!message && !mediaUrl) {
      console.error(`[Webhook] ❌ No message content AND no media - skipping`);
      console.error(`[Webhook] This might indicate mediaUrl extraction failed!`);
      return;
    }

    // Log if photo-only message (no caption)
    if (!message && mediaUrl) {
      console.log(`[Webhook] 📷 Photo-only message detected (no caption)`);
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

// ==================== AUTO-FIX CLIENT ID MISMATCH ====================

/**
 * Auto-fix clientId mismatch by syncing with Aimeow API
 * Handles cases where webhook sends different clientId format than what's in DB
 */
async function autoFixClientIdMismatch(webhookClientId: string) {
  try {
    console.log(`[Aimeow AutoFix] Starting for clientId: ${webhookClientId}`);

    // Strategy 1: Extract phone from JID format
    if (webhookClientId.includes("@s.whatsapp.net")) {
      const phoneNumber = webhookClientId.split(":")[0];
      console.log(`[Aimeow AutoFix] Extracted phone: ${phoneNumber}`);

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
        console.log(`[Aimeow AutoFix] ✅ Found by phone: ${accountByPhone.id}`);
        return accountByPhone;
      }
    }

    // Strategy 2: Single account mode - use the only account and sync clientId
    const allAccounts = await prisma.aimeowAccount.findMany({
      include: { aiConfig: true, tenant: true },
    });

    if (allAccounts.length === 1) {
      const singleAccount = allAccounts[0];
      console.log(`[Aimeow AutoFix] Single account mode: ${singleAccount.id}`);

      // Sync correct clientId from Aimeow API
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

            return await prisma.aimeowAccount.findUnique({
              where: { id: singleAccount.id },
              include: { aiConfig: true, tenant: true },
            });
          }
        }
      } catch (apiError) {
        console.error(`[Aimeow AutoFix] API sync failed:`, apiError);
      }

      return singleAccount;
    }

    // Strategy 3: Multiple accounts - match by Aimeow API
    if (allAccounts.length > 1) {
      console.log(`[Aimeow AutoFix] Multiple accounts (${allAccounts.length}), trying API match...`);

      try {
        const clientsResponse = await fetch(`${AIMEOW_BASE_URL}/api/v1/clients`, {
          headers: { 'Accept': 'application/json' },
          cache: 'no-store',
        });

        if (clientsResponse.ok) {
          const clients = await clientsResponse.json();
          const matchingClient = clients.find((c: any) =>
            c.id === webhookClientId || (c.phone && webhookClientId.includes(c.phone))
          );

          if (matchingClient) {
            const accountToUpdate = allAccounts.find(
              (a) => a.phoneNumber === matchingClient.phone ||
                     a.clientId.includes(matchingClient.phone?.substring(0, 6) || 'xxx')
            );

            if (accountToUpdate) {
              console.log(`[Aimeow AutoFix] 🔄 Updating account ${accountToUpdate.id}`);

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
        console.error(`[Aimeow AutoFix] Multi-account match failed:`, apiError);
      }
    }

    console.log(`[Aimeow AutoFix] ❌ All strategies failed`);
    return null;
  } catch (error) {
    console.error(`[Aimeow AutoFix] Error:`, error);
    return null;
  }
}
