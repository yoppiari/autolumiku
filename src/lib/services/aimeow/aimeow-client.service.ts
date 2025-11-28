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
  static async initializeClient(tenantId: string): Promise<{
    success: boolean;
    clientId?: string;
    qrCode?: string;
    error?: string;
  }> {
    try {
      // Generate unique client ID untuk tenant
      const clientId = `tenant_${tenantId}_${Date.now()}`;

      // Request QR code dari Aimeow
      const response = await fetch(`${AIMEOW_BASE_URL}/api/client/init`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          clientId,
        }),
      });

      if (!response.ok) {
        throw new Error(`Aimeow API error: ${response.statusText}`);
      }

      const data = await response.json();

      // Simpan ke database
      await prisma.aimeowAccount.create({
        data: {
          tenantId,
          clientId,
          apiKey: "", // Tidak perlu API key berdasarkan user input
          phoneNumber: "",
          isActive: false,
          connectionStatus: "waiting_qr",
          qrCode: data.qrCode,
          qrCodeExpiresAt: new Date(Date.now() + 60000), // QR expired dalam 60 detik
        },
      });

      // Create default AI config
      await prisma.whatsAppAIConfig.create({
        data: {
          tenantId,
          accountId: "", // Will be updated after account creation
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

      // Update accountId in config
      const account = await prisma.aimeowAccount.findUnique({
        where: { clientId },
      });

      if (account) {
        await prisma.whatsAppAIConfig.updateMany({
          where: { tenantId },
          data: { accountId: account.id },
        });
      }

      return {
        success: true,
        clientId,
        qrCode: data.qrCode,
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
      const response = await fetch(`${AIMEOW_BASE_URL}/api/client/${clientId}/status`);

      if (!response.ok) {
        throw new Error(`Failed to get client status: ${response.statusText}`);
      }

      const data = await response.json();

      // Update database
      await prisma.aimeowAccount.update({
        where: { clientId },
        data: {
          connectionStatus: data.isConnected ? "connected" : "disconnected",
          phoneNumber: data.phoneNumber || undefined,
          isActive: data.isConnected,
          lastConnectedAt: data.isConnected ? new Date() : undefined,
        },
      });

      return {
        clientId,
        phoneNumber: data.phoneNumber,
        isConnected: data.isConnected,
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
      const { clientId, to, message, mediaUrl, mediaType } = params;

      const payload: any = {
        to,
        message,
      };

      // Add media if provided
      if (mediaUrl && mediaType) {
        payload.media = {
          url: mediaUrl,
          type: mediaType,
        };
      }

      const response = await fetch(`${AIMEOW_BASE_URL}/api/client/${clientId}/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Failed to send message: ${response.statusText}`);
      }

      const data = await response.json();

      return {
        success: true,
        messageId: data.messageId,
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
      const response = await fetch(`${AIMEOW_BASE_URL}/api/client/${clientId}/disconnect`, {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error(`Failed to disconnect: ${response.statusText}`);
      }

      // Update database
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
   */
  static async restartClient(clientId: string): Promise<{
    success: boolean;
    qrCode?: string;
    error?: string;
  }> {
    try {
      // Disconnect first
      await this.disconnectClient(clientId);

      // Re-initialize
      const response = await fetch(`${AIMEOW_BASE_URL}/api/client/${clientId}/restart`, {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error(`Failed to restart: ${response.statusText}`);
      }

      const data = await response.json();

      // Update database with new QR
      await prisma.aimeowAccount.update({
        where: { clientId },
        data: {
          connectionStatus: "waiting_qr",
          qrCode: data.qrCode,
          qrCodeExpiresAt: new Date(Date.now() + 60000),
        },
      });

      return {
        success: true,
        qrCode: data.qrCode,
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
    return await prisma.aimeowAccount.findUnique({
      where: { clientId },
      include: {
        aiConfig: true,
        tenant: true,
      },
    });
  }
}

export default AimeowClientService;
