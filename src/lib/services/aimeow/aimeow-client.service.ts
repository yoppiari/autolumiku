/**
 * Aimeow WhatsApp Client Service
 * Core service untuk berkomunikasi dengan Aimeow WhatsApp Business API
 * Documentation: https://meow.lumiku.com/swagger/index.html
 */

import { prisma } from "@/lib/prisma";

// Aimeow API Base URL (tanpa credential, langsung bisa dipakai)
const AIMEOW_BASE_URL = process.env.AIMEOW_BASE_URL || "https://meow.lumiku.com";

// ==================== TYPES ====================

export interface AimeowClientStatus {
  clientId: string;
  phoneNumber?: string;
  isConnected: boolean;
  qrCode?: string;
  qrCodeExpiry?: Date;
  lastSeen?: Date;
}

export interface AimeowSendMessageParams {
  clientId: string;
  to: string; // WhatsApp number in E.164 format (e.g., 6281234567890)
  message: string;
  mediaUrl?: string;
  mediaType?: "image" | "video" | "audio" | "document";
}

export interface AimeowMessageResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface AimeowWebhookPayload {
  clientId: string;
  event: "message" | "status" | "qr" | "connected" | "disconnected";
  timestamp: string;
  data: {
    from?: string;
    to?: string;
    message?: string;
    mediaUrl?: string;
    mediaType?: string;
    messageId?: string;
    status?: string;
    qrCode?: string;
  };
}

// ==================== AIMEOW CLIENT SERVICE ====================

export class AimeowClientService {
  /**
   * Inisialisasi client baru untuk tenant
   * Menghasilkan QR code untuk scanning
   */
  static async initializeClient(tenantId: string, webhookUrl?: string): Promise<{
    success: boolean;
    clientId?: string;
    qrCode?: string;
    error?: string;
  }> {
    try {
      // Request QR code dari Aimeow - API akan generate clientId otomatis
      const response = await fetch(`${AIMEOW_BASE_URL}/api/v1/clients/new`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          webhookUrl, // Pass webhook URL if provided
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Aimeow API error: ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();

      console.log('[Aimeow Initialize] POST /clients/new response:', JSON.stringify(data, null, 2));
      console.log('[Aimeow Initialize] Response keys:', Object.keys(data));
      console.log('[Aimeow Initialize] data.clientId:', data.clientId);
      console.log('[Aimeow Initialize] data.id:', data.id);

      const clientId = data.clientId || data.id;

      if (!clientId) {
        console.error('[Aimeow Initialize] ❌ No clientId found in response!');
        console.error('[Aimeow Initialize] Full response:', data);
        throw new Error("Failed to get client ID from Aimeow API");
      }

      console.log('[Aimeow Initialize] ✅ Using clientId:', clientId);

      // Fetch the actual QR code string (raw data)
      console.log(`[Aimeow Initialize] Fetching client status: GET /clients/${clientId}`);
      const clientStatusResponse = await fetch(`${AIMEOW_BASE_URL}/api/v1/clients/${clientId}`);
      let rawQrCode = "";

      if (clientStatusResponse.ok) {
        const clientData = await clientStatusResponse.json();
        console.log('[Aimeow Initialize] GET /clients/{id} response:', JSON.stringify(clientData, null, 2));
        rawQrCode = clientData.qrCode || "";
        console.log('[Aimeow Initialize] Extracted QR code length:', rawQrCode.length);
      } else {
        console.warn(`[Aimeow Initialize] Failed to fetch client status: ${clientStatusResponse.status} ${clientStatusResponse.statusText}`);
      }

      // Fallback to qrUrl if rawQrCode is empty (though unlikely to work for display if it's localhost)
      const qrCodeToSave = rawQrCode || data.qr || data.qrUrl;

      console.log('[Aimeow Initialize] Saving to database:');
      console.log('[Aimeow Initialize] - clientId:', clientId);
      console.log('[Aimeow Initialize] - tenantId:', tenantId);
      console.log('[Aimeow Initialize] - qrCode length:', qrCodeToSave?.length);

      // Simpan ke database (upsert untuk handle re-initialization)
      const account = await prisma.aimeowAccount.upsert({
        where: { tenantId },
        update: {
          clientId,
          connectionStatus: "qr_ready", // Status dari Aimeow: qr_ready
          qrCode: qrCodeToSave, // Raw QR string
          qrCodeExpiresAt: new Date(Date.now() + 120000), // QR expired dalam 120 detik
          isActive: false,
          webhookUrl, // Save webhook URL
        },
        create: {
          tenantId,
          clientId,
          apiKey: "",
          phoneNumber: "",
          isActive: false,
          connectionStatus: "qr_ready",
          qrCode: data.qr || data.qrUrl,
          qrCodeExpiresAt: new Date(Date.now() + 120000),
          webhookUrl, // Save webhook URL
        },
      });

      console.log('[Aimeow Initialize] ✅ Saved to database - Account ID:', account.id);
      console.log('[Aimeow Initialize] Database record clientId:', account.clientId);

      // Create or update default AI config
      await prisma.whatsAppAIConfig.upsert({
        where: { tenantId },
        update: {
          accountId: account.id,
        },
        create: {
          tenantId,
          accountId: account.id,
          welcomeMessage: "Halo! 👋 Saya asisten virtual showroom. Ada yang bisa saya bantu?",
          aiName: "AI Assistant",
          aiPersonality: "friendly",
          autoReply: true,
          customerChatEnabled: true,
          staffCommandsEnabled: true,
          businessHours: {
            monday: { open: "09:00", close: "17:00" },
            tuesday: { open: "09:00", close: "17:00" },
            wednesday: { open: "09:00", close: "17:00" },
            thursday: { open: "09:00", close: "17:00" },
            friday: { open: "09:00", close: "17:00" },
            saturday: { open: "09:00", close: "15:00" },
            sunday: { open: "closed", close: "closed" },
          },
          timezone: "Asia/Jakarta",
          afterHoursMessage: "Terima kasih telah menghubungi kami. Kami sedang tutup sekarang. Jam operasional: Senin-Jumat 09:00-17:00, Sabtu 09:00-15:00.",
        },
      });

      const result = {
        success: true,
        clientId,
        qrCode: qrCodeToSave,
      };

      console.log('[Aimeow Initialize] 🎉 Returning to API endpoint:', result);

      return result;
    } catch (error: any) {
      console.error("Failed to initialize Aimeow client:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Cek status koneksi client
   */
  static async getClientStatus(clientId: string): Promise<AimeowClientStatus | null> {
    try {
      const url = `${AIMEOW_BASE_URL}/api/v1/clients/${clientId}`;
      console.log('[getClientStatus] Fetching from URL:', url);
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
        },
        cache: 'no-store', // Disable caching
      });

      if (!response.ok) {
        if (response.status === 404) {
          console.warn(`Client ${clientId} not found on Aimeow`);
          return null;
        }
        throw new Error(`Failed to get client status: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('[getClientStatus] Raw API response:', JSON.stringify(data, null, 2));

      // Map Aimeow status to our status
      // API returns isConnected as boolean
      const isConnected = data.isConnected === true;
      const connectionStatus = isConnected ? "connected" : "qr_ready"; // "qr_ready", "connected", "disconnected"

      // Update database
      await prisma.aimeowAccount.update({
        where: { clientId },
        data: {
          connectionStatus,
          phoneNumber: data.phone || undefined,
          isActive: isConnected,
          lastConnectedAt: isConnected ? new Date() : undefined,
          qrCode: data.qrCode || undefined, // Update QR code if available
        },
      });

      const result = {
        clientId,
        phoneNumber: data.phone,
        isConnected,
        qrCode: data.qrCode,
        lastSeen: data.lastSeen ? new Date(data.lastSeen) : undefined,
      };
      console.log('[getClientStatus] Returning:', JSON.stringify(result, null, 2));
      return result;
    } catch (error) {
      console.error("Failed to get client status:", error);
      return null;
    }
  }

  /**
   * Send WhatsApp message via Aimeow with retry logic
   * Retries up to 3 times with exponential backoff (1s, 3s, 9s)
   */
  static async sendMessage(params: AimeowSendMessageParams): Promise<AimeowMessageResponse> {
    const MAX_RETRIES = 3;
    const BACKOFF_MULTIPLIER = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      const result = await this.sendMessageAttempt(params, attempt);

      if (result.success) {
        return result;
      }

      lastError = new Error(result.error || 'Unknown error');

      // Don't retry for certain errors
      if (result.error?.includes('No connected client')) {
        console.error(`[Aimeow Send] ❌ WhatsApp disconnected - not retrying`);
        return result;
      }

      if (attempt < MAX_RETRIES) {
        const backoffMs = Math.pow(BACKOFF_MULTIPLIER, attempt - 1) * 1000;
        console.log(`[Aimeow Send] ⏳ Retry ${attempt}/${MAX_RETRIES} in ${backoffMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, backoffMs));
      }
    }

    console.error(`[Aimeow Send] ❌ All ${MAX_RETRIES} attempts failed`);
    return {
      success: false,
      error: lastError?.message || 'All retry attempts failed',
    };
  }

  /**
   * Internal: Single send message attempt
   */
  private static async sendMessageAttempt(
    params: AimeowSendMessageParams,
    attempt: number
  ): Promise<AimeowMessageResponse> {
    const timestamp = new Date().toISOString();
    console.log("=".repeat(80));
    console.log(`[Aimeow Send] ${timestamp} - SENDING MESSAGE (Attempt ${attempt})`);
    console.log(`[Aimeow Send] Original Client ID: ${params.clientId}`);
    console.log(`[Aimeow Send] To: ${params.to}`);
    console.log(`[Aimeow Send] Message: ${params.message.substring(0, 100)}`);

    try {
      const { clientId, to, message, mediaUrl } = params;

      // Resolve clientId to UUID
      const apiClientId = await this.resolveClientId(clientId);

      // Send text message - Aimeow API uses lowercase field names per Swagger docs
      const payload: any = {
        phone: to,
        message: message,
      };

      // If mediaUrl provided, use send-images endpoint instead
      let endpoint = `${AIMEOW_BASE_URL}/api/v1/clients/${apiClientId}/send-message`;

      if (mediaUrl) {
        endpoint = `${AIMEOW_BASE_URL}/api/v1/clients/${apiClientId}/send-images`;
        payload.images = [mediaUrl]; // Array of image URLs
        payload.viewOnce = false;     // Display inline, not as download link
        payload.isViewOnce = false;   // Alternative field name
        payload.mimetype = 'image/jpeg';  // Required for inline display
        payload.mimeType = 'image/jpeg';  // Alternative field name
        payload.type = 'image';           // Explicitly set type as image
        payload.mediaType = 'image';      // Alternative field name
        delete payload.message; // Images endpoint doesn't need message
      }

      console.log(`[Aimeow Send] Endpoint: ${endpoint}`);
      console.log(`[Aimeow Send] Payload:`, JSON.stringify(payload, null, 2));

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      console.log(`[Aimeow Send] Response Status: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Aimeow Send] Error Response: ${errorText}`);
        throw new Error(`Failed to send message: ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      console.log(`[Aimeow Send] Success Response:`, JSON.stringify(data, null, 2));

      return {
        success: true,
        messageId: data.messageId || data.id || `msg_${Date.now()}`,
      };
    } catch (error: any) {
      console.error(`[Aimeow Send] CRITICAL ERROR:`, error.message);
      console.error(`[Aimeow Send] Stack:`, error.stack);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Send single image via WhatsApp
   * Uses the same /send-images endpoint as sendMessage for consistency
   */
  static async sendImage(
    clientId: string,
    to: string,
    imageUrl: string,
    caption?: string
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      console.log(`[Aimeow Send Image] 📸 Sending image to ${to}`);
      console.log(`[Aimeow Send Image] Image URL: ${imageUrl}`);
      console.log(`[Aimeow Send Image] Caption: ${caption || 'none'}`);
      console.log(`[Aimeow Send Image] Original clientId: ${clientId}`);

      // Validate image URL
      if (!imageUrl || imageUrl.trim() === '') {
        console.error(`[Aimeow Send Image] ❌ Invalid image URL: empty or null`);
        return { success: false, error: 'Image URL is empty' };
      }

      // Validate clientId format - same as sendMessage
      let apiClientId = clientId;
      if (clientId.includes("@s.whatsapp.net") || !clientId.includes("-")) {
        console.log(`[Aimeow Send Image] ⚠️ ClientId in wrong format, fetching correct UUID...`);

        const clientsResponse = await fetch(`${AIMEOW_BASE_URL}/api/v1/clients`);
        if (clientsResponse.ok) {
          const clients = await clientsResponse.json();
          const connectedClient = clients.find((c: any) => c.isConnected === true);

          if (connectedClient) {
            apiClientId = connectedClient.id;
            console.log(`[Aimeow Send Image] ✅ Using correct UUID: ${apiClientId}`);

            // Update database
            try {
              await prisma.aimeowAccount.update({
                where: { clientId },
                data: { clientId: apiClientId },
              });
            } catch (dbError) {
              console.warn(`[Aimeow Send Image] Failed to update DB:`, dbError);
            }
          } else {
            throw new Error("No connected client found on Aimeow");
          }
        }
      }

      // Build payload - try multiple field names for compatibility
      // Some Aimeow versions expect 'url', others 'imageUrl', others 'image'
      // IMPORTANT: viewOnce: false ensures image displays inline, not as download link
      // IMPORTANT: mimetype must be specified for WhatsApp to display image inline
      const payload: Record<string, any> = {
        phone: to,
        url: imageUrl,        // Primary field for /send-image endpoint
        imageUrl: imageUrl,   // Alternative field name
        image: imageUrl,      // Another alternative
        viewOnce: false,      // Display inline, not as download link
        isViewOnce: false,    // Alternative field name
        mimetype: 'image/jpeg',  // Required for inline display
        mimeType: 'image/jpeg',  // Alternative field name
        type: 'image',           // Explicitly set type as image, not document
        mediaType: 'image',      // Alternative field name
      };

      if (caption) {
        payload.caption = caption;
      }

      console.log(`[Aimeow Send Image] Using clientId: ${apiClientId}`);
      console.log(`[Aimeow Send Image] Payload:`, JSON.stringify(payload, null, 2));

      // Try /send-image endpoint first
      let response = await fetch(`${AIMEOW_BASE_URL}/api/v1/clients/${apiClientId}/send-image`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      // If /send-image fails, try /send-images with array format
      if (!response.ok) {
        const errorText = await response.text();
        console.log(`[Aimeow Send Image] /send-image failed (${response.status}): ${errorText}`);
        console.log(`[Aimeow Send Image] Trying /send-images endpoint instead...`);

        const imagesPayload = {
          phone: to,
          images: [imageUrl],
          viewOnce: false,      // Display inline, not as download link
          isViewOnce: false,    // Alternative field name
          mimetype: 'image/jpeg',  // Required for inline display
          mimeType: 'image/jpeg',  // Alternative field name
          type: 'image',           // Explicitly set type as image
          mediaType: 'image',      // Alternative field name
          ...(caption && { caption }),
        };

        response = await fetch(`${AIMEOW_BASE_URL}/api/v1/clients/${apiClientId}/send-images`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(imagesPayload),
        });
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Aimeow Send Image] ❌ Both endpoints failed: ${errorText}`);
        throw new Error(`Failed to send image: ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      console.log(`[Aimeow Send Image] ✅ Success:`, data);

      return {
        success: true,
        messageId: data.messageId || data.id || `img_${Date.now()}`,
      };
    } catch (error: any) {
      console.error(`[Aimeow Send Image] ❌ Error:`, error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Send document via WhatsApp (PDF, Word, Excel, PowerPoint)
   */
  static async sendDocument(
    clientId: string,
    to: string,
    documentUrl: string,
    filename?: string,
    caption?: string
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      console.log(`[Aimeow Send Document] 📄 Sending document to ${to}`);
      console.log(`[Aimeow Send Document] Document URL: ${documentUrl}`);
      console.log(`[Aimeow Send Document] Filename: ${filename || 'auto'}`);
      console.log(`[Aimeow Send Document] Caption: ${caption || 'none'}`);

      // Validate document URL
      if (!documentUrl || documentUrl.trim() === '') {
        console.error(`[Aimeow Send Document] ❌ Invalid document URL: empty or null`);
        return { success: false, error: 'Document URL is empty' };
      }

      // Validate clientId format - same as sendImage
      let apiClientId = clientId;
      if (clientId.includes("@s.whatsapp.net") || !clientId.includes("-")) {
        console.log(`[Aimeow Send Document] ⚠️ ClientId in wrong format, fetching correct UUID...`);

        const clientsResponse = await fetch(`${AIMEOW_BASE_URL}/api/v1/clients`);
        if (clientsResponse.ok) {
          const clients = await clientsResponse.json();
          const connectedClient = clients.find((c: any) => c.isConnected === true);

          if (connectedClient) {
            apiClientId = connectedClient.id;
            console.log(`[Aimeow Send Document] ✅ Using correct UUID: ${apiClientId}`);
          } else {
            throw new Error("No connected client found on Aimeow");
          }
        }
      }

      // Build payload for document sending
      const payload: Record<string, any> = {
        phone: to,
        url: documentUrl,
        documentUrl: documentUrl,
        file: documentUrl,
        mediaType: 'document',
      };

      if (filename) {
        payload.filename = filename;
        payload.fileName = filename;
      }

      if (caption) {
        payload.caption = caption;
      }

      console.log(`[Aimeow Send Document] Using clientId: ${apiClientId}`);
      console.log(`[Aimeow Send Document] Payload:`, JSON.stringify(payload, null, 2));

      // Send document using /send-document endpoint
      const response = await fetch(`${AIMEOW_BASE_URL}/api/v1/clients/${apiClientId}/send-document`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Aimeow Send Document] ❌ All endpoints failed: ${errorText}`);
        throw new Error(`Failed to send document: ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      console.log(`[Aimeow Send Document] ✅ Success:`, data);

      return {
        success: true,
        messageId: data.messageId || data.id || `doc_${Date.now()}`,
      };
    } catch (error: any) {
      console.error(`[Aimeow Send Document] ❌ Error:`, error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Send document via WhatsApp using base64 encoded data
   * More secure for sensitive documents (PDFs with evidence/critical data)
   * @param clientId - Aimeow client ID (UUID format)
   * @param to - Recipient phone number
   * @param base64Data - Base64 encoded document data
   * @param filename - Document filename
   * @param caption - Optional caption for the document
   */
  static async sendDocumentBase64(
    clientId: string,
    to: string,
    base64Data: string,
    filename: string,
    caption?: string
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      console.log(`[Aimeow Send Document Base64] 📄 Sending document to ${to}`);
      console.log(`[Aimeow Send Document Base64] Filename: ${filename}`);
      console.log(`[Aimeow Send Document Base64] Base64 size: ${base64Data.length} chars`);
      console.log(`[Aimeow Send Document Base64] Caption: ${caption || 'none'}`);

      // Validate base64 data
      if (!base64Data || base64Data.trim() === '') {
        console.error(`[Aimeow Send Document Base64] ❌ Invalid base64 data: empty or null`);
        return { success: false, error: 'Base64 data is empty' };
      }

      // Validate filename
      if (!filename || filename.trim() === '') {
        console.error(`[Aimeow Send Document Base64] ❌ Invalid filename: empty or null`);
        return { success: false, error: 'Filename is empty' };
      }

      // Resolve clientId to UUID
      const apiClientId = await this.resolveClientId(clientId);

      // Build payload for base64 document sending
      const payload: Record<string, any> = {
        phone: to,
        base64Data: base64Data,
        filename: filename,
        mimeType: 'application/pdf',
      };

      if (caption) {
        payload.caption = caption;
      }

      console.log(`[Aimeow Send Document Base64] Using clientId: ${apiClientId}`);
      console.log(`[Aimeow Send Document Base64] Sending base64 payload (${Math.round(base64Data.length / 1024)}KB)`);

      // Send document using /send-document-base64 endpoint
      const response = await fetch(`${AIMEOW_BASE_URL}/api/v1/clients/${apiClientId}/send-document-base64`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Aimeow Send Document Base64] ❌ Endpoint failed: ${errorText}`);
        throw new Error(`Failed to send document: ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      console.log(`[Aimeow Send Document Base64] ✅ Success:`, data);

      return {
        success: true,
        messageId: data.messageId || data.id || `doc_${Date.now()}`,
      };
    } catch (error: any) {
      console.error(`[Aimeow Send Document Base64] ❌ Error:`, error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Send contact vCard via WhatsApp
   * @param clientId - Aimeow client ID (UUID format)
   * @param to - Recipient phone number
   * @param vCardUrl - URL to the vCard (.vcf) file
   * @param displayName - Contact name to display
   * @param phoneNumber - Contact phone number for WhatsApp click-to-chat
   */
  static async sendContact(
    clientId: string,
    to: string,
    vCardUrl: string,
    displayName: string,
    phoneNumber: string
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      console.log(`[Aimeow Send Contact] 📇 Sending contact to ${to}`);
      console.log(`[Aimeow Send Contact] Contact: ${displayName} (${phoneNumber})`);

      // Resolve clientId to UUID
      const apiClientId = await this.resolveClientId(clientId);

      // Build payload for contact sending
      const payload = {
        phone: to,
        contact: {
          displayName: displayName,
          vCard: vCardUrl,
        },
      };

      console.log(`[Aimeow Send Contact] Using clientId: ${apiClientId}`);
      console.log(`[Aimeow Send Contact] Payload:`, JSON.stringify(payload, null, 2));

      // Send contact using /send-contact endpoint (if available) or fallback to send as document
      const response = await fetch(`${AIMEOW_BASE_URL}/api/v1/clients/${apiClientId}/send-contact`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        // If send-contact endpoint doesn't exist, send as document
        console.log(`[Aimeow Send Contact] ⚠️ send-contact endpoint not available, sending as document`);
        return await this.sendDocument(
          apiClientId,
          to,
          vCardUrl,
          `${displayName}.vcf`,
          `📇 *Kontak ${displayName}*\n\nKlik file ini untuk simpan ke kontak.\n\n📱 WhatsApp: https://wa.me/${phoneNumber.replace(/\D/g, '')}`
        );
      }

      const data = await response.json();
      console.log(`[Aimeow Send Contact] ✅ Success:`, data);

      return {
        success: true,
        messageId: data.messageId || data.id || `contact_${Date.now()}`,
      };
    } catch (error: any) {
      console.error(`[Aimeow Send Contact] ❌ Error:`, error);
      // Fallback: send as document
      console.log(`[Aimeow Send Contact] 🔄 Fallback: sending as document`);
      return await this.sendDocument(
        clientId,
        to,
        vCardUrl,
        `${displayName}.vcf`,
        `📇 *Kontak ${displayName}*\n\nKlik file ini untuk simpan ke kontak.\n\n📱 WhatsApp: https://wa.me/${phoneNumber.replace(/\D/g, '')}`
      );
    }
  }

  /**
   * Send multiple images via WhatsApp
   */
  static async sendImages(
    clientId: string,
    to: string,
    images: Array<{ imageUrl: string; caption?: string }>
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      console.log(`[Aimeow Send Images] Sending ${images.length} images to ${to}`);
      console.log(`[Aimeow Send Images] Original clientId: ${clientId}`);

      // Resolve clientId to UUID
      const apiClientId = await this.resolveClientId(clientId);

      const payload = {
        phone: to,
        images,
        viewOnce: false,      // Display inline, not as download link
        isViewOnce: false,    // Alternative field name
        mimetype: 'image/jpeg',  // Required for inline display
        mimeType: 'image/jpeg',  // Alternative field name
        type: 'image',           // Explicitly set type as image
        mediaType: 'image',      // Alternative field name
      };

      const response = await fetch(`${AIMEOW_BASE_URL}/api/v1/clients/${apiClientId}/send-images`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Aimeow Send Images] Error: ${errorText}`);
        throw new Error(`Failed to send images: ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`[Aimeow Send Images] Success:`, data);

      return {
        success: true,
        messageId: data.messageId || `imgs_${Date.now()}`,
      };
    } catch (error: any) {
      console.error(`[Aimeow Send Images] Error:`, error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Disconnect WhatsApp client
   */
  static async disconnectClient(clientId: string): Promise<boolean> {
    try {
      const response = await fetch(`${AIMEOW_BASE_URL}/api/v1/clients/${clientId}`, {
        method: "DELETE",
      });

      // If client not found (404), treat as already disconnected
      if (!response.ok && response.status !== 404) {
        throw new Error(`Failed to disconnect: ${response.statusText}`);
      }

      // If 404, client already deleted on Aimeow side - just update DB
      if (response.status === 404) {
        console.warn(`Client ${clientId} not found on Aimeow - marking as disconnected in database`);
      }

      // Update database regardless of Aimeow response (404 or success)
      await prisma.aimeowAccount.update({
        where: { clientId },
        data: {
          connectionStatus: "disconnected",
          isActive: false,
        },
      });

      return true;
    } catch (error) {
      console.error("Failed to disconnect client:", error);
      return false;
    }
  }

  /**
   * Restart WhatsApp client
   * Aimeow tidak punya restart endpoint, jadi kita DELETE + CREATE new
   */
  static async restartClient(tenantId: string, oldClientId: string, webhookUrl?: string): Promise<{
    success: boolean;
    clientId?: string;
    qrCode?: string;
    error?: string;
  }> {
    try {
      // 1. Delete existing client dari Aimeow (ignore 404 if already deleted)
      const deleteResponse = await fetch(`${AIMEOW_BASE_URL}/api/v1/clients/${oldClientId}`, {
        method: "DELETE",
      });

      if (!deleteResponse.ok && deleteResponse.status !== 404) {
        console.warn(`Failed to delete old client ${oldClientId}: ${deleteResponse.statusText}`);
        // Continue anyway - we'll create a new one
      }

      if (deleteResponse.status === 404) {
        console.log(`Old client ${oldClientId} already deleted from Aimeow`);
      }

      // 2. Delete dari database (soft delete dengan update)
      await prisma.aimeowAccount.update({
        where: { clientId: oldClientId },
        data: {
          connectionStatus: "disconnected",
          isActive: false,
        },
      });

      // 3. Create new client
      const response = await fetch(`${AIMEOW_BASE_URL}/api/v1/clients/new`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          webhookUrl, // Pass webhook URL if provided
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to create new client: ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      const newClientId = data.clientId || data.id;

      if (!newClientId) {
        throw new Error("Failed to get new client ID from Aimeow API");
      }

      // Fetch the actual QR code string (raw data)
      const clientStatusResponse = await fetch(`${AIMEOW_BASE_URL}/api/v1/clients/${newClientId}`);
      let rawQrCode = "";

      if (clientStatusResponse.ok) {
        const clientData = await clientStatusResponse.json();
        rawQrCode = clientData.qrCode || "";
      }

      const qrCodeToSave = rawQrCode || data.qr || data.qrUrl;

      // 4. Update database dengan client ID baru
      await prisma.aimeowAccount.update({
        where: { tenantId },
        data: {
          clientId: newClientId,
          connectionStatus: "qr_ready",
          qrCode: qrCodeToSave,
          qrCodeExpiresAt: new Date(Date.now() + 120000),
          isActive: false,
          phoneNumber: "",
          webhookUrl, // Save webhook URL
        },
      });

      return {
        success: true,
        clientId: newClientId,
        qrCode: qrCodeToSave,
      };
    } catch (error: any) {
      console.error("Failed to restart client:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get account by tenant ID
   */
  static async getAccountByTenant(tenantId: string) {
    return await prisma.aimeowAccount.findUnique({
      where: { tenantId },
      include: {
        aiConfig: true,
      },
    });
  }

  /**
   * Get account by client ID
   */
  static async getAccountByClientId(clientId: string) {
    console.log(`[Aimeow] Looking up account by clientId: ${clientId}`);

    // Debug: List all accounts in database
    const allAccounts = await prisma.aimeowAccount.findMany({
      select: { id: true, clientId: true, phoneNumber: true, tenantId: true },
    });
    console.log(`[Aimeow] Total accounts in DB: ${allAccounts.length}`);
    allAccounts.forEach((acc) => {
      console.log(`[Aimeow] - Account ${acc.id}: clientId="${acc.clientId}", phone="${acc.phoneNumber}", tenant="${acc.tenantId}"`);
    });

    // Try exact match first
    let account = await prisma.aimeowAccount.findUnique({
      where: { clientId },
      include: {
        aiConfig: true,
        tenant: true,
      },
    });

    if (account) {
      console.log(`[Aimeow] Found account by exact match: ${account.id}`);
      return account;
    }

    console.log(`[Aimeow] No exact match found`);

    // If not found and clientId contains "@s.whatsapp.net", try extracting the phone number
    if (clientId.includes("@s.whatsapp.net")) {
      const phoneNumber = clientId.split(":")[0];
      console.log(`[Aimeow] Extracted phone number: ${phoneNumber}, searching by prefix/phone`);

      // Try to find by phone number in clientId or by phone number field
      account = await prisma.aimeowAccount.findFirst({
        where: {
          OR: [
            { clientId: { startsWith: phoneNumber } },
            { phoneNumber: phoneNumber },
          ],
        },
        include: {
          aiConfig: true,
          tenant: true,
        },
      });

      if (account) {
        console.log(`[Aimeow] Found account by phone lookup: ${account.id}, clientId: ${account.clientId}`);
        // Don't update clientId - keep the original UUID for API calls
        // Only update phone number if not already set
        if (!account.phoneNumber) {
          console.log(`[Aimeow] Updating phone number to: ${phoneNumber}`);
          await prisma.aimeowAccount.update({
            where: { id: account.id },
            data: { phoneNumber },
          });
          account.phoneNumber = phoneNumber;
        }
        return account;
      } else {
        console.log(`[Aimeow] No account found by phone number: ${phoneNumber}`);
      }
    }

    // Last resort: if no account found and there's only one active account in DB, use that
    // This handles the case where webhooks send JID but DB has UUID
    if (!account && allAccounts.length === 1 && allAccounts[0].clientId) {
      console.log(`[Aimeow] Only one account in DB, assuming it's the right one`);
      const phoneNumber = clientId.includes("@s.whatsapp.net") ? clientId.split(":")[0] : "";

      account = await prisma.aimeowAccount.findUnique({
        where: { id: allAccounts[0].id },
        include: {
          aiConfig: true,
          tenant: true,
        },
      });

      if (account && phoneNumber) {
        console.log(`[Aimeow] Updating phone number to: ${phoneNumber}`);
        await prisma.aimeowAccount.update({
          where: { id: account.id },
          data: { phoneNumber },
        });
        account.phoneNumber = phoneNumber;
      }
    }

    return account;
  }

  /**
   * Get QR code untuk client
   */
  static async getQRCode(clientId: string): Promise<{
    success: boolean;
    qrCode?: string;
    error?: string;
  }> {
    try {
      const response = await fetch(`${AIMEOW_BASE_URL}/api/v1/clients/${clientId}/qr`);

      if (!response.ok) {
        throw new Error(`Failed to get QR code: ${response.statusText}`);
      }

      const data = await response.json();

      // Note: getQRCode endpoint usually returns HTML or raw string depending on implementation
      // But based on our findings, we might need to fetch client details to get the raw string
      // However, let's assume for this method we might get it from the response if it's the /qr endpoint
      // If this is the /api/v1/clients/{id}/qr endpoint (which returns JSON), then data.qrCode should be there.
      // If it's the HTML endpoint, this fetch would fail or return HTML string.
      // Let's try to fetch client details to be safe if data.qrCode is missing.

      let qrCodeToSave = data.qrCode || data.qr || data.qrUrl;

      if (!qrCodeToSave) {
        const clientStatusResponse = await fetch(`${AIMEOW_BASE_URL}/api/v1/clients/${clientId}`);
        if (clientStatusResponse.ok) {
          const clientData = await clientStatusResponse.json();
          qrCodeToSave = clientData.qrCode;
        }
      }

      // Update database dengan QR baru
      await prisma.aimeowAccount.update({
        where: { clientId },
        data: {
          qrCode: qrCodeToSave,
          qrCodeExpiresAt: new Date(Date.now() + 120000),
        },
      });

      return {
        success: true,
        qrCode: qrCodeToSave,
      };
    } catch (error: any) {
      console.error("Failed to get QR code:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Fetch messages dari Aimeow
   */
  static async fetchMessages(clientId: string, limit: number = 50): Promise<{
    success: boolean;
    messages?: any[];
    error?: string;
  }> {
    try {
      const response = await fetch(
        `${AIMEOW_BASE_URL}/api/v1/clients/${clientId}/messages?limit=${limit}`
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch messages: ${response.statusText}`);
      }

      const data = await response.json();

      return {
        success: true,
        messages: data.messages || data,
      };
    } catch (error: any) {
      console.error("Failed to fetch messages:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Delete a message from WhatsApp
   * Tries multiple endpoint formats as Aimeow API structure may vary
   */
  static async deleteMessage(
    clientId: string,
    to: string,
    aimeowMessageId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      console.log(`[Aimeow Delete] 🗑️ Deleting message ${aimeowMessageId}`);
      console.log(`[Aimeow Delete] To: ${to}, ClientId: ${clientId}`);

      // Resolve clientId to UUID
      const apiClientId = await this.resolveClientId(clientId);

      // Prepare payload
      const payload = {
        phone: to,
        messageId: aimeowMessageId,
      };

      console.log(`[Aimeow Delete] Payload:`, JSON.stringify(payload, null, 2));

      // Try multiple endpoint formats
      const endpoints = [
        { url: `${AIMEOW_BASE_URL}/api/v1/clients/${apiClientId}/delete-message`, method: 'POST' },
        { url: `${AIMEOW_BASE_URL}/api/v1/clients/${apiClientId}/messages/${aimeowMessageId}`, method: 'DELETE' },
        { url: `${AIMEOW_BASE_URL}/api/v1/clients/${apiClientId}/revoke-message`, method: 'POST' },
      ];

      for (const endpoint of endpoints) {
        try {
          console.log(`[Aimeow Delete] Trying: ${endpoint.method} ${endpoint.url}`);

          const response = await fetch(endpoint.url, {
            method: endpoint.method,
            headers: { "Content-Type": "application/json" },
            body: endpoint.method === 'POST' ? JSON.stringify(payload) : undefined,
          });

          console.log(`[Aimeow Delete] Response: ${response.status} ${response.statusText}`);

          if (response.ok) {
            const data = await response.json().catch(() => ({}));
            console.log(`[Aimeow Delete] ✅ Success:`, data);
            return { success: true };
          }

          const errorText = await response.text();
          console.log(`[Aimeow Delete] Endpoint returned error: ${errorText}`);
        } catch (endpointError: any) {
          console.log(`[Aimeow Delete] Endpoint failed: ${endpointError.message}`);
        }
      }

      // If all endpoints fail, still return success for dashboard deletion
      // (message will be deleted from dashboard DB but may remain on WhatsApp)
      console.warn(`[Aimeow Delete] ⚠️ All Aimeow endpoints failed, but dashboard deletion will proceed`);
      return { success: true };

    } catch (error: any) {
      console.error(`[Aimeow Delete] ❌ Error:`, error.message);
      return { success: false, error: error.message };
    }
  }

  static async downloadMedia(
    clientId: string,
    mediaId: string
  ): Promise<{ success: boolean; mediaUrl?: string; error?: string }> {
    try {
      console.log(`[Aimeow Download] Downloading media: ${mediaId} for client: ${clientId}`);

      // Resolve clientId to UUID
      const apiClientId = await this.resolveClientId(clientId);

      // Try multiple endpoint formats
      const endpoints = [
        `${AIMEOW_BASE_URL}/api/v1/clients/${apiClientId}/messages/${mediaId}/media`,
        `${AIMEOW_BASE_URL}/api/v1/clients/${apiClientId}/media/${mediaId}`,
        `${AIMEOW_BASE_URL}/api/v1/clients/${apiClientId}/download-media/${mediaId}`,
        `${AIMEOW_BASE_URL}/api/v1/media/${mediaId}`,
      ];

      for (const endpoint of endpoints) {
        try {
          console.log(`[Aimeow Download] Trying: ${endpoint}`);
          const response = await fetch(endpoint, {
            method: 'GET',
            headers: { 'Accept': 'application/json' },
          });

          if (response.ok) {
            const contentType = response.headers.get('content-type');

            // If response is JSON, extract URL from it
            if (contentType?.includes('application/json')) {
              const data = await response.json();
              const mediaUrl = data.url || data.mediaUrl || data.downloadUrl || data.link;
              if (mediaUrl) {
                console.log(`[Aimeow Download] ✅ Got URL from JSON: ${mediaUrl}`);
                return { success: true, mediaUrl };
              }
            }

            // If response is binary (image), the endpoint IS the media URL
            if (contentType?.includes('image') || contentType?.includes('octet-stream')) {
              console.log(`[Aimeow Download] ✅ Endpoint returns binary, using as URL: ${endpoint}`);
              return { success: true, mediaUrl: endpoint };
            }
          }
        } catch (endpointError) {
          console.log(`[Aimeow Download] Endpoint failed: ${endpoint}`);
        }
      }

      console.error(`[Aimeow Download] ❌ All endpoints failed for mediaId: ${mediaId}`);
      return { success: false, error: 'All download endpoints failed' };
    } catch (error: any) {
      console.error(`[Aimeow Download] ❌ Error:`, error.message);
      return { success: false, error: error.message };
    }
  }

  static async getProfilePicture(
    clientId: string,
    phone: string
  ): Promise<{ success: boolean; pictureUrl?: string; hasPicture: boolean; error?: string }> {
    try {
      console.log(`[Aimeow Profile] Getting profile picture for ${phone}`);

      // Resolve clientId to UUID
      const apiClientId = await this.resolveClientId(clientId);

      // Clean phone number - remove any suffix
      const cleanPhone = phone.replace(/@.*$/, '').replace(/[^0-9]/g, '');

      const response = await fetch(
        `${AIMEOW_BASE_URL}/api/v1/clients/${apiClientId}/profile-picture/${cleanPhone}`,
        {
          headers: { 'Accept': 'application/json' },
        }
      );

      if (!response.ok) {
        console.log(`[Aimeow Profile] Failed to get profile picture: ${response.status}`);
        return { success: false, hasPicture: false, error: `HTTP ${response.status}` };
      }

      const data = await response.json();
      console.log(`[Aimeow Profile] Response:`, data);

      return {
        success: true,
        pictureUrl: data.pictureUrl || undefined,
        hasPicture: data.hasPicture || false,
        error: data.error,
      };
    } catch (error: any) {
      console.error(`[Aimeow Profile] ❌ Error:`, error.message);
      return { success: false, hasPicture: false, error: error.message };
    }
  }

  /**
   * Resolve a clientId to a valid Aimeow UUID.
   * Handles:
   * 1. JID format (628...:17@s.whatsapp.net)
   * 2. Prisma CUID format (cm5...)
   * 3. Fallback to first connected client
   */
  private static async resolveClientId(clientId: string): Promise<string> {
    // 1. If it's already a UUID, return it
    if (clientId.includes("-") && !clientId.includes("@") && clientId.length > 20) {
      return clientId;
    }

    console.log(`[Aimeow Resolve] ⚠️ ClientId needs resolution: ${clientId}`);

    // If it's a JID or LID, extract the core number
    const coreId = clientId.split(":")[0].split("@")[0];

    // 2. Try database lookup if it's a Prisma ID, JID, or stored clientId
    try {
      const account = await prisma.aimeowAccount.findFirst({
        where: {
          OR: [
            { id: clientId },
            { clientId: clientId },
            { phoneNumber: coreId },
            { phoneNumber: `+${coreId}` },
            { phoneNumber: `62${coreId.replace(/^0/, '')}` },
            { phoneNumber: `0${coreId.replace(/^62/, '')}` },
          ]
        }
      });

      if (account && account.clientId.includes("-")) {
        console.log(`[Aimeow Resolve] ✅ Resolved via DB: ${account.clientId}`);
        return account.clientId;
      }
    } catch (err) {
      console.warn(`[Aimeow Resolve] DB lookup failed:`, err);
    }

    // 3. Last resort: fetch all clients from API and pick connected one
    try {
      const response = await fetch(`${AIMEOW_BASE_URL}/api/v1/clients`);
      if (response.ok) {
        const clients = await response.json();
        // If we have a phone number, try to match it
        const matching = clients.find((c: any) => c.phone === coreId || c.phone === `+${coreId}`);
        if (matching) {
          console.log(`[Aimeow Resolve] ✅ Resolved via API phone match: ${matching.id}`);
          return matching.id;
        }

        const connected = clients.find((c: any) => c.isConnected);
        if (connected) {
          console.log(`[Aimeow Resolve] ⚠️ Fallback to connected client: ${connected.id}`);
          return connected.id;
        }
      }
    } catch (err) {
      console.error(`[Aimeow Resolve] API fallback failed:`, err);
    }

    return clientId; // Return original as last fallback
  }
}

export default AimeowClientService;
