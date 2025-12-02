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
      const clientId = data.clientId || data.id;

      if (!clientId) {
        throw new Error("Failed to get client ID from Aimeow API");
      }

      // Fetch the actual QR code string (raw data)
      const clientStatusResponse = await fetch(`${AIMEOW_BASE_URL}/api/v1/clients/${clientId}`);
      let rawQrCode = "";

      if (clientStatusResponse.ok) {
        const clientData = await clientStatusResponse.json();
        rawQrCode = clientData.qrCode || "";
      } else {
        console.warn(`Failed to fetch client status for QR code: ${clientStatusResponse.statusText}`);
      }

      // Fallback to qrUrl if rawQrCode is empty (though unlikely to work for display if it's localhost)
      const qrCodeToSave = rawQrCode || data.qr || data.qrUrl;

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

      return {
        success: true,
        clientId,
        qrCode: qrCodeToSave,
      };
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
      const response = await fetch(`${AIMEOW_BASE_URL}/api/v1/clients/${clientId}`);

      if (!response.ok) {
        if (response.status === 404) {
          console.warn(`Client ${clientId} not found on Aimeow`);
          return null;
        }
        throw new Error(`Failed to get client status: ${response.statusText}`);
      }

      const data = await response.json();

      // Map Aimeow status to our status
      // API returns isConnected as boolean
      const isConnected = data.isConnected === true;
      const connectionStatus = isConnected ? "connected" : "qr_ready"; // "qr_ready", "connected", "disconnected"

      // Update database
      await prisma.aimeowAccount.update({
        where: { clientId },
        data: {
          connectionStatus,
          phoneNumber: data.phoneNumber || undefined,
          isActive: isConnected,
          lastConnectedAt: isConnected ? new Date() : undefined,
          qrCode: data.qrCode || undefined, // Update QR code if available
        },
      });

      return {
        clientId,
        phoneNumber: data.phoneNumber,
        isConnected,
        qrCode: data.qrCode,
        lastSeen: data.lastSeen ? new Date(data.lastSeen) : undefined,
      };
    } catch (error) {
      console.error("Failed to get client status:", error);
      return null;
    }
  }

  /**
   * Send WhatsApp message via Aimeow
   */
  static async sendMessage(params: AimeowSendMessageParams): Promise<AimeowMessageResponse> {
    try {
      const { clientId, to, message, mediaUrl } = params;

      // If clientId is in JID format (6281298329132:17@s.whatsapp.net), extract phone number
      // Aimeow API accepts phone number as clientId for send operations
      let apiClientId = clientId;
      if (clientId.includes("@s.whatsapp.net")) {
        apiClientId = clientId.split(":")[0];
        console.log(`[Aimeow] Converting JID ${clientId} to phone ${apiClientId} for API call`);
      }

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
        delete payload.message; // Images endpoint doesn't need message
      }

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to send message: ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();

      return {
        success: true,
        messageId: data.messageId || data.id || `msg_${Date.now()}`,
      };
    } catch (error: any) {
      console.error("Failed to send WhatsApp message:", error);
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
}

export default AimeowClientService;
