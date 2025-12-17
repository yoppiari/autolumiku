/**
 * WhatsApp Upload Notification Service
 * Mengirim notifikasi upload kendaraan ke semua admin, staff, dan user
 * Prima Mobil - Auto-notify on vehicle upload success/failure
 */

import { prisma } from "@/lib/prisma";
import { AimeowClientService } from "../aimeow/aimeow-client.service";

// ==================== TYPES ====================

export interface UploadNotification {
  type: "success" | "failed";
  tenantId: string;
  uploaderPhone: string;
  uploaderName?: string;
  vehicleData?: {
    make: string;
    model: string;
    year: number;
    price: number;
    mileage?: number;
    color?: string;
    photoCount?: number;
    vehicleId?: string;
    displayId?: string;
  };
  error?: string;
  timestamp: Date;
}

// ==================== NOTIFICATION SERVICE ====================

export class UploadNotificationService {
  /**
   * Notify semua staff/admin/user tentang hasil upload
   */
  static async notifyAllStaff(notification: UploadNotification): Promise<void> {
    console.log(`[Upload Notification] Starting notification broadcast...`);

    try {
      // 1. Get Aimeow account untuk tenant ini
      const aimeowAccount = await prisma.aimeowAccount.findUnique({
        where: { tenantId: notification.tenantId },
        include: { tenant: true },
      });

      if (!aimeowAccount || !aimeowAccount.isConnected) {
        console.log(`[Upload Notification] WhatsApp not connected for tenant`);
        return;
      }

      // 2. Get semua staff/admin/user di tenant ini
      const staffMembers = await prisma.user.findMany({
        where: {
          tenantId: notification.tenantId,
          phone: { not: null },
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          role: true,
        },
      });

      if (staffMembers.length === 0) {
        console.log(`[Upload Notification] No staff members with phone found`);
        return;
      }

      console.log(`[Upload Notification] Found ${staffMembers.length} staff members to notify`);

      // 3. Build notification message
      const message = this.buildNotificationMessage(notification, aimeowAccount.tenant.name);

      // 4. Send to all staff (except uploader to avoid duplicate)
      const uploaderPhoneNormalized = this.normalizePhone(notification.uploaderPhone);

      for (const staff of staffMembers) {
        if (!staff.phone) continue;

        const staffPhoneNormalized = this.normalizePhone(staff.phone);

        // Skip sending to the uploader (they already got direct feedback)
        if (staffPhoneNormalized === uploaderPhoneNormalized) {
          console.log(`[Upload Notification] Skipping uploader: ${staff.firstName}`);
          continue;
        }

        try {
          console.log(`[Upload Notification] Sending to ${staff.firstName} (${staff.phone})`);

          await AimeowClientService.sendMessage({
            clientId: aimeowAccount.clientId,
            to: staffPhoneNormalized,
            message,
          });

          console.log(`[Upload Notification] ✅ Sent to ${staff.firstName}`);

          // Small delay to avoid rate limiting
          await new Promise((resolve) => setTimeout(resolve, 500));
        } catch (sendError: any) {
          console.error(`[Upload Notification] Failed to notify ${staff.firstName}:`, sendError.message);
        }
      }

      console.log(`[Upload Notification] Broadcast completed`);
    } catch (error: any) {
      console.error(`[Upload Notification] Error:`, error.message);
    }
  }

  /**
   * Build notification message based on result
   */
  private static buildNotificationMessage(
    notification: UploadNotification,
    tenantName: string
  ): string {
    const timestamp = new Date().toLocaleString("id-ID", {
      timeZone: "Asia/Jakarta",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    if (notification.type === "success" && notification.vehicleData) {
      const v = notification.vehicleData;
      const priceInJuta = Math.round(v.price / 1000000);

      return (
        `🔔 *NOTIFIKASI UPLOAD MOBIL*\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `✅ *Upload Berhasil!*\n\n` +
        `📋 *Data Kendaraan:*\n` +
        `• Mobil: ${v.make} ${v.model} ${v.year}\n` +
        `• Harga: Rp ${priceInJuta} Juta\n` +
        `• KM: ${v.mileage?.toLocaleString("id-ID") || "-"}\n` +
        `• Warna: ${v.color || "-"}\n` +
        `• Foto: ${v.photoCount || 0} foto\n` +
        `• ID: ${v.displayId || v.vehicleId}\n\n` +
        `👤 *Diupload oleh:*\n` +
        `${notification.uploaderName || notification.uploaderPhone}\n\n` +
        `🕐 *Waktu:* ${timestamp}\n\n` +
        `🌐 *Lihat di Website:*\n` +
        `https://primamobil.id/vehicles/${v.vehicleId}`
      );
    } else {
      return (
        `🔔 *NOTIFIKASI UPLOAD MOBIL*\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `❌ *Upload Gagal!*\n\n` +
        `📋 *Detail:*\n` +
        `• Error: ${notification.error || "Unknown error"}\n\n` +
        `👤 *Diupload oleh:*\n` +
        `${notification.uploaderName || notification.uploaderPhone}\n\n` +
        `🕐 *Waktu:* ${timestamp}\n\n` +
        `💡 *Solusi:*\n` +
        `Silakan coba upload ulang atau hubungi admin.`
      );
    }
  }

  /**
   * Normalize phone number
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
   * Notify with success result
   */
  static async notifyUploadSuccess(
    tenantId: string,
    uploaderPhone: string,
    vehicleData: UploadNotification["vehicleData"],
    uploaderName?: string
  ): Promise<void> {
    await this.notifyAllStaff({
      type: "success",
      tenantId,
      uploaderPhone,
      uploaderName,
      vehicleData,
      timestamp: new Date(),
    });
  }

  /**
   * Notify with failure result
   */
  static async notifyUploadFailed(
    tenantId: string,
    uploaderPhone: string,
    error: string,
    uploaderName?: string
  ): Promise<void> {
    await this.notifyAllStaff({
      type: "failed",
      tenantId,
      uploaderPhone,
      uploaderName,
      error,
      timestamp: new Date(),
    });
  }
}

export default UploadNotificationService;
