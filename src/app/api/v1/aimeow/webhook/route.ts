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
    // Sender identification - multiple possible fields
    from?: string;              // Could be LID or phone JID
    phoneNumber?: string;       // Actual phone number (if provided)
    participant?: string;       // Actual sender (especially in groups or linked devices)
    sender?: string;            // Alternative sender field
    remoteJid?: string;         // Remote JID of the chat
    pushName?: string;          // Contact display name

    // Message content
    to?: string;
    message?: string;
    text?: string;              // Alternative field
    body?: string;              // Another alternative for message body
    caption?: string;           // Media caption

    // Media - check multiple possible field names
    mediaUrl?: string;
    mediaType?: string;
    mimetype?: string;          // Alternative media type field
    media?: string;             // Alternative media URL field
    imageUrl?: string;          // Another alternative
    image?: string;             // Yet another alternative
    url?: string;               // Generic URL field
    file?: string;              // File URL
    fileUrl?: string;           // File URL alternative

    // Message metadata
    messageId?: string;
    id?: string;                // Alternative message ID field

    // Message type
    type?: string;              // Message type (text, image, video, etc.)
    messageType?: string;       // Alternative message type field

    // Status/connection events
    status?: string;
    qrCode?: string;
  };
}

export async function POST(request: NextRequest) {
  try {
    const payload: AimeowWebhookPayload = await request.json();

    // ========== MEGA DEBUG LOG ==========
    console.log("=".repeat(80));
    console.log("[WEBHOOK DEBUG] ======= INCOMING WEBHOOK =======");
    console.log("[WEBHOOK DEBUG] Time:", new Date().toISOString());
    console.log("[WEBHOOK DEBUG] Event:", payload.event);
    console.log("[WEBHOOK DEBUG] ClientId:", payload.clientId);
    console.log("[WEBHOOK DEBUG] Full payload:", JSON.stringify(payload, null, 2));
    console.log("=".repeat(80));
    // ========== END MEGA DEBUG LOG ==========

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
  const rawFrom = payload.data.from;

  // CRITICAL DEBUG: Log the FULL payload to see exactly what Aimeow sends
  console.log(`[Aimeow Webhook] 🔍 FULL PAYLOAD:`, JSON.stringify(payload, null, 2));

  // IMPORTANT: When photo is sent with caption, the text is in "caption" field, not "message"!
  const messageText = payload.data.message || payload.data.text || payload.data.body || payload.data.caption || "";

  // Check ALL possible media URL fields - Aimeow might use different field names
  // IMPORTANT: Handle both string and array formats for media
  let mediaUrl = payload.data.mediaUrl
    || payload.data.media
    || payload.data.imageUrl
    || payload.data.image
    || payload.data.url
    || payload.data.file
    || payload.data.fileUrl;

  // Handle case where media is an array (album/multiple photos)
  if (Array.isArray(mediaUrl)) {
    console.log(`[Aimeow Webhook] 📸 Media is array with ${mediaUrl.length} items`);
    mediaUrl = mediaUrl[0]; // Use first photo for now
  }

  // Check for nested media object structures
  const payloadAny = payload.data as any;
  if (!mediaUrl && payloadAny.mediaData?.url) {
    mediaUrl = payloadAny.mediaData.url;
    console.log(`[Aimeow Webhook] 📸 Found mediaUrl in mediaData.url`);
  }
  if (!mediaUrl && payloadAny.message?.imageMessage?.url) {
    mediaUrl = payloadAny.message.imageMessage.url;
    console.log(`[Aimeow Webhook] 📸 Found mediaUrl in message.imageMessage.url`);
  }
  if (!mediaUrl && payloadAny.downloadUrl) {
    mediaUrl = payloadAny.downloadUrl;
    console.log(`[Aimeow Webhook] 📸 Found mediaUrl in downloadUrl`);
  }

  // IMPORTANT: Aimeow might send file_id instead of direct URL
  // In that case, construct the download URL using the files endpoint
  const fileId = payloadAny.fileId || payloadAny.file_id || payloadAny.mediaId || payloadAny.media_id;
  if (!mediaUrl && fileId && payload.clientId) {
    // Construct download URL from file ID
    mediaUrl = `${AIMEOW_BASE_URL}/files/${payload.clientId}/${fileId}`;
    console.log(`[Aimeow Webhook] 📸 Constructed mediaUrl from fileId: ${mediaUrl}`);
  }

  // Check media type from multiple sources
  let mediaType = payload.data.mediaType
    || payload.data.mimetype
    || payload.data.type
    || payload.data.messageType;

  // Infer media type from URL if not explicitly provided
  if (!mediaType && mediaUrl) {
    if (typeof mediaUrl === 'string') {
      if (mediaUrl.includes('image') || /\.(jpg|jpeg|png|gif|webp)/i.test(mediaUrl)) {
        mediaType = 'image';
        console.log(`[Aimeow Webhook] 📸 Inferred mediaType as 'image' from URL`);
      }
    }
  }

  // Check for mediaKey (WhatsApp encryption key) which indicates there's media
  const mediaKey = payloadAny.mediaKey || payloadAny.message?.imageMessage?.mediaKey;
  if (!mediaUrl && mediaKey) {
    console.log(`[Aimeow Webhook] 📸 Found mediaKey but no URL - media exists but needs download`);
    // Mark as image type even without URL
    mediaType = mediaType || 'image';
  }

  // Debug log to see exactly what we're receiving
  console.log(`[Aimeow Webhook] 📝 Message fields:`, {
    message: payload.data.message,
    text: payload.data.text,
    body: payload.data.body,
    caption: payload.data.caption,
  });
  console.log(`[Aimeow Webhook] 📸 Media fields:`, {
    mediaUrl: payload.data.mediaUrl,
    media: payload.data.media,
    imageUrl: payload.data.imageUrl,
    image: payload.data.image,
    url: payload.data.url,
    file: payload.data.file,
    fileUrl: payload.data.fileUrl,
    mediaType: payload.data.mediaType,
    mimetype: payload.data.mimetype,
    type: payload.data.type,
    messageType: payload.data.messageType,
  });

  // Log additional fields that might contain media info
  console.log(`[Aimeow Webhook] 📸 Additional media fields:`, {
    hasMedia: payloadAny.hasMedia,
    isMedia: payloadAny.isMedia,
    mediaData: payloadAny.mediaData,
    downloadUrl: payloadAny.downloadUrl,
    directPath: payloadAny.directPath,
    fileId: payloadAny.fileId || payloadAny.file_id,
    mediaId: payloadAny.mediaId || payloadAny.media_id,
    mediaKey: payloadAny.mediaKey ? 'EXISTS' : undefined,
    imageMessage: payloadAny.message?.imageMessage ? 'EXISTS' : undefined,
    quotedMsg: payloadAny.quotedMsg ? 'EXISTS' : undefined,
  });

  // CRITICAL: Log ALL keys in payload.data to find the correct field
  console.log(`[Aimeow Webhook] 🔑 ALL payload.data keys:`, Object.keys(payload.data));

  console.log(`[Aimeow Webhook] ✅ Resolved: messageText="${messageText?.substring(0, 50)}", mediaUrl=${mediaUrl ? 'YES: ' + String(mediaUrl).substring(0, 50) : 'NO'}, mediaType=${mediaType}`);

  const messageId = payload.data.messageId || payload.data.id || `msg_${Date.now()}`;

  // IMPORTANT: AIMEOW might provide actual phone number in various fields
  // This handles WhatsApp Web/Desktop where the actual phone is separate from LID
  // Check multiple possible fields where phone number could be provided
  const providedPhoneNumber = payload.data.phoneNumber
    || payload.data.participant
    || payload.data.sender;

  // Log all sender-related fields for debugging
  console.log(`[Aimeow Webhook] 📋 Sender fields:`, {
    from: payload.data.from,
    phoneNumber: payload.data.phoneNumber,
    participant: payload.data.participant,
    sender: payload.data.sender,
    remoteJid: payload.data.remoteJid,
    pushName: payload.data.pushName,
  });

  // Normalize from field for LID format support (declared outside try for catch block access)
  // LID format: "10020343271578:17@lid" -> preserve as "10020343271578@lid"
  // Raw LID (no suffix): "10020343271578" -> add @lid suffix!
  // Phone JID: "6281235108908:17@s.whatsapp.net" -> extract "6281235108908"

  // Helper to check if a number looks like an LID (not a phone number)
  // LIDs are WhatsApp internal identifiers that don't contain actual phone numbers
  // Examples: 10020343271578, 74556840628233, 212270269395003, 353xxx, etc.
  const isLikelyLID = (num: string): boolean => {
    const cleanNum = num.split(":")[0].split("@")[0].replace(/\D/g, "");

    // If empty or too short, not a LID (but also not a valid phone)
    if (!cleanNum || cleanNum.length < 8) return false;

    // Pattern 1: Numbers starting with 100/101/102 (known LID prefixes) that are long
    if (cleanNum.length >= 14 &&
        (cleanNum.startsWith("100") || cleanNum.startsWith("101") || cleanNum.startsWith("102"))) {
      return true;
    }

    // Pattern 2: Numbers that are WAY too long to be phone numbers (16+ digits)
    // Max valid phone is ~15 digits (country code + 12 digit number)
    if (cleanNum.length >= 16) {
      return true;
    }

    // Pattern 3: Numbers 14-15 digits that don't start with valid country code
    // Valid phone patterns:
    // - Indonesia: 62xxx (11-14 digits total)
    // - Malaysia: 60xxx (11-13 digits total)
    // - Singapore: 65xxx (10-11 digits total)
    // - International: 1xxx (US), 44xxx (UK), 91xxx (India), etc.
    if (cleanNum.length >= 14) {
      // Known valid prefixes for long numbers (country codes)
      const validLongPrefixes = ["62", "60", "65", "1", "44", "91", "86", "81", "82", "84", "66", "63"];
      const startsWithValid = validLongPrefixes.some(p => cleanNum.startsWith(p));

      // If doesn't start with a valid country code and is long, likely a LID
      if (!startsWithValid) {
        return true;
      }

      // Special check: even with valid prefix, if too long it's a LID
      // Indonesia max: 62 + 12 digits = 14 digits
      // Most countries: 15 digits max
      if (cleanNum.startsWith("62") && cleanNum.length > 14) return true;
      if (cleanNum.startsWith("60") && cleanNum.length > 13) return true;
      if (cleanNum.startsWith("65") && cleanNum.length > 11) return true;
    }

    // Pattern 4: Specific LID patterns seen in logs
    // Numbers like 74xxx, 212xxx, 353xxx that are too long for those country codes
    const suspiciousLIDPatterns = [
      { prefix: "7", maxLen: 12 },   // Russia/Kazakhstan: max ~12 digits
      { prefix: "212", maxLen: 12 }, // Morocco: max ~12 digits
      { prefix: "353", maxLen: 12 }, // Ireland: max ~12 digits
      { prefix: "43", maxLen: 13 },  // Austria: max ~13 digits
      { prefix: "33", maxLen: 12 },  // France: max ~12 digits
      { prefix: "34", maxLen: 12 },  // Spain: max ~12 digits
    ];

    for (const pattern of suspiciousLIDPatterns) {
      if (cleanNum.startsWith(pattern.prefix) && cleanNum.length > pattern.maxLen) {
        return true;
      }
    }

    return false;
  };

  // Helper to normalize phone number
  const normalizePhone = (phone: string): string => {
    if (!phone) return "";
    let digits = phone.replace(/\D/g, "");
    if (digits.startsWith("0")) digits = "62" + digits.substring(1);
    return digits;
  };

  // IMPORTANT: Use providedPhoneNumber as fallback if rawFrom is empty
  // This handles cases where Aimeow sends phone in phoneNumber/sender field instead of from
  let from = rawFrom || providedPhoneNumber || "";
  let isFromLID = false;

  // Log the actual from value being used
  if (!rawFrom && providedPhoneNumber) {
    console.log(`[Aimeow Webhook] ⚠️ No 'from' field, using phoneNumber fallback: ${providedPhoneNumber}`);
    // Normalize the providedPhoneNumber
    from = normalizePhone(providedPhoneNumber);
    console.log(`[Aimeow Webhook] 📱 Normalized fallback phone: ${from}`);
  }

  if (rawFrom) {
    if (rawFrom.includes("@lid")) {
      isFromLID = true;
      const lidPart = rawFrom.split(":")[0];
      from = `${lidPart}@lid`;
      console.log(`[Aimeow Webhook] 🔗 LID with suffix: ${rawFrom} -> ${from}`);
    } else if (rawFrom.includes("@s.whatsapp.net")) {
      from = rawFrom.split("@")[0].split(":")[0];
      console.log(`[Aimeow Webhook] 📞 Phone JID: ${rawFrom} -> ${from}`);
    } else if (rawFrom.includes("@")) {
      const [userPart, domain] = rawFrom.split("@");
      from = `${userPart.split(":")[0]}@${domain}`;
      console.log(`[Aimeow Webhook] ❓ Unknown JID: ${rawFrom} -> ${from}`);
    } else {
      // No @ symbol - check if it looks like an LID and add @lid suffix
      const cleanNum = rawFrom.split(":")[0];
      if (isLikelyLID(cleanNum)) {
        isFromLID = true;
        from = `${cleanNum}@lid`;
        console.log(`[Aimeow Webhook] 🔗 LID detected (adding @lid): ${rawFrom} -> ${from}`);
      } else {
        from = cleanNum;
        console.log(`[Aimeow Webhook] 📱 Phone number: ${rawFrom} -> ${from}`);
      }
    }
  }

  // KEY FIX: If message is from LID but we have phoneNumber, use the phone number!
  // This handles WhatsApp Web/Desktop where AIMEOW provides both LID and actual phone
  if (isFromLID && providedPhoneNumber) {
    const normalizedPhone = normalizePhone(providedPhoneNumber);
    if (normalizedPhone && normalizedPhone.startsWith("62")) {
      console.log(`[Aimeow Webhook] 🎯 LID resolved to phone! LID: ${from} -> Phone: ${normalizedPhone}`);
      console.log(`[Aimeow Webhook] ✅ Using phone number for staff detection (WhatsApp Web/Desktop user)`);
      from = normalizedPhone;
      isFromLID = false; // Now we have the actual phone, not LID
    }
  }

  // Log if LID couldn't be resolved
  if (isFromLID) {
    console.log(`[Aimeow Webhook] ⚠️ LID without phone mapping: ${from}`);
    console.log(`[Aimeow Webhook] 💡 If this is staff, they can use /verify command`);
  }

  try {
    // Validate sender - from is required
    if (!from) {
      console.warn("[Aimeow Webhook] Missing 'from' field in message");
      return;
    }

    // Allow photo-only messages (for staff upload flow)
    // messageText can be empty if mediaUrl exists
    if (!messageText && !mediaUrl) {
      // Check if this might be an image/album without proper mediaUrl
      const mightBeMedia = payload.data.type === 'image'
        || payload.data.type === 'album'
        || payload.data.type === 'media'
        || payload.data.type === 'document'
        || payload.data.messageType === 'image'
        || payload.data.messageType === 'album'
        || payload.data.messageType === 'media'
        || payload.data.messageType === 'imageMessage'
        || mediaType?.includes('image')
        || payload.data.mimetype?.includes('image')
        || (payload.data as any).hasMedia === true
        || (payload.data as any).isMedia === true;

      if (mightBeMedia) {
        console.warn("[Aimeow Webhook] ⚠️ Media message detected but no mediaUrl!");
        console.warn("[Aimeow Webhook] Full payload.data:", JSON.stringify(payload.data, null, 2));

        // Instead of returning early, set mediaType and continue processing
        // The orchestrator will handle the "photo detected but not downloadable" case
        mediaType = 'image';
        console.log("[Aimeow Webhook] Setting mediaType='image' and continuing processing...");
      } else {
        console.warn("[Aimeow Webhook] Empty message (no text, no media)");
        console.warn("[Aimeow Webhook] payload.data.type:", payload.data.type);
        console.warn("[Aimeow Webhook] payload.data.messageType:", payload.data.messageType);
        return;
      }
    }

    console.log("[Aimeow Webhook] Processing message:", {
      from,
      messageText: messageText.substring(0, 50),
      hasMedia: !!mediaUrl,
      mediaType,
    });

    // IMPORTANT FIX: If media detected but no mediaUrl, try to download it via AIMEOW API
    // Instead of returning early, we should try to get the media URL and save the message
    const isMediaMessage = payload.data.type === 'image'
      || payload.data.type === 'album'
      || payload.data.type === 'media'
      || payload.data.messageType === 'image'
      || payload.data.messageType === 'album'
      || payload.data.messageType === 'imageMessage'
      || mediaType?.includes('image')
      || (payload.data as any).hasMedia === true;

    if (!mediaUrl && isMediaMessage) {
      console.log(`[Aimeow Webhook] ⚠️ Image detected but no mediaUrl! Attempting to download...`);
      console.log(`[Aimeow Webhook] Full data for debugging:`, JSON.stringify(payload.data, null, 2));

      // Try to download media using AIMEOW API
      const mediaId = (payload.data as any).mediaId || (payload.data as any).id || messageId;
      if (mediaId && account.clientId) {
        try {
          console.log(`[Aimeow Webhook] 🔄 Attempting to download media using mediaId: ${mediaId}`);
          const downloadResult = await AimeowClientService.downloadMedia(account.clientId, mediaId);
          if (downloadResult.success && downloadResult.mediaUrl) {
            mediaUrl = downloadResult.mediaUrl;
            mediaType = 'image';
            console.log(`[Aimeow Webhook] ✅ Got mediaUrl from download: ${mediaUrl}`);
          } else {
            console.error(`[Aimeow Webhook] ❌ Download failed: ${downloadResult.error}`);
          }
        } catch (downloadError: any) {
          console.error(`[Aimeow Webhook] ❌ Error downloading media:`, downloadError.message);
        }
      }

      // If still no mediaUrl after download attempt, continue anyway with mediaType set
      // The message will be saved to DB (important for tracking) even without downloadable URL
      if (!mediaUrl) {
        console.log(`[Aimeow Webhook] ⚠️ Could not get mediaUrl, but will save message with mediaType='image'`);
        mediaType = 'image'; // Mark as image so it can be identified later
      }
    }

    // Process message via MessageOrchestrator with timeout
    console.log("[Aimeow Webhook] 🚀 Starting orchestrator processing...");
    const startTime = Date.now();

    let result;
    try {
      // Add timeout wrapper (30 seconds max)
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Processing timeout after 30s')), 30000)
      );

      const processingPromise = MessageOrchestratorService.processIncomingMessage({
        accountId: account.id,
        tenantId: account.tenantId,
        from,
        message: messageText,
        mediaUrl,
        mediaType,
        messageId,
      });

      result = await Promise.race([processingPromise, timeoutPromise]) as any;
    } catch (timeoutError: any) {
      console.error(`[Aimeow Webhook] ⏰ Processing timed out:`, timeoutError.message);

      // Send timeout message to user
      await AimeowClientService.sendMessage({
        clientId: account.clientId,
        to: from,
        message: `Maaf kak, prosesnya lama banget nih 😅\n\nCoba lagi ya atau ketik "halo" untuk mulai ulang.`,
      });
      return;
    }

    const processingTime = Date.now() - startTime;
    console.log(`[Aimeow Webhook] ⏱️ Processing took ${processingTime}ms`);

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
