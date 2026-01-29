/**
 * WhatsApp Upload Notification Service
 * Mengirim notifikasi upload kendaraan ke semua admin, staff, dan user
 * Prima Mobil - Auto-notify on vehicle upload success/failure
 */

import { prisma } from "@/lib/prisma";
import { AimeowClientService } from "../../aimeow/aimeow-client.service";
import { generateVehicleUrl, generateVehicleDashboardUrl } from "@/lib/utils/vehicle-slug";

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

      if (!aimeowAccount || !aimeowAccount.isActive) {
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

      // Build optional fields - only show if value exists and > 0
      const kmLine = v.mileage && v.mileage > 0
        ? `• KM: ${v.mileage.toLocaleString("id-ID")}\n`
        : "";
      const colorLine = v.color ? `• Warna: ${v.color}\n` : "";

      const vehicleUrl = generateVehicleUrl({
        make: v.make,
        model: v.model,
        year: v.year,
        displayId: v.displayId || v.vehicleId?.substring(0, 8) || 'unknown',
      });

      const dashboardUrl = generateVehicleDashboardUrl({
        make: v.make,
        model: v.model,
        year: v.year,
        displayId: v.displayId || v.vehicleId?.substring(0, 8) || 'unknown',
      });

      return (
        `🔔 *NOTIFIKASI UPLOAD MOBIL*\n` +
        `━━━━━━━━━━━━━\n\n` +
        `✅ *Upload Berhasil!*\n\n` +
        `📋 *Data Kendaraan:*\n` +
        `• Mobil: ${v.make} ${v.model} ${v.year}\n` +
        `• Harga: Rp ${priceInJuta} Juta\n` +
        kmLine +
        colorLine +
        `• Foto: ${v.photoCount || 0} foto\n` +
        `• ID: ${v.displayId || v.vehicleId}\n\n` +
        `👤 *Diupload oleh:*\n` +
        `${notification.uploaderName || notification.uploaderPhone}\n\n` +
        `🕐 *Waktu:* ${timestamp}\n\n` +
        `🌐 *Lihat di Website:*\n` +
        `${vehicleUrl}\n\n` +
        `📊 *Dashboard:*\n` +
        `${dashboardUrl}`
      );
    } else {
      return (
        `🔔 *NOTIFIKASI UPLOAD MOBIL*\n` +
        `━━━━━━━━━━━━━\n\n` +
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

  /**
   * Notify all staff about vehicle edit/revision
   */
  static async notifyEditSuccess(
    tenantId: string,
    editorPhone: string,
    editData: {
      vehicleId: string;
      displayId?: string;
      vehicleName: string;
      changes: Array<{ fieldLabel: string; oldValue: string; newValue: string }>;
      // Add vehicle details for URL generation
      make?: string;
      model?: string;
      year?: number;
    },
    editorName?: string
  ): Promise<void> {
    console.log(`[Edit Notification] Starting edit notification broadcast...`);

    try {
      // 1. Get Aimeow account untuk tenant ini
      const aimeowAccount = await prisma.aimeowAccount.findUnique({
        where: { tenantId },
        include: { tenant: true },
      });

      if (!aimeowAccount || !aimeowAccount.isActive) {
        console.log(`[Edit Notification] WhatsApp not connected for tenant`);
        return;
      }

      // 2. Get all staff members
      const staffMembers = await prisma.user.findMany({
        where: {
          tenantId,
          role: { in: ["ADMIN", "SUPER_ADMIN", "MANAGER", "SALES", "STAFF"] },
          phone: { not: null },
        },
        select: { phone: true, firstName: true },
      });

      if (staffMembers.length === 0) {
        console.log(`[Edit Notification] No staff members found`);
        return;
      }

      // 3. Build notification message
      const now = new Date();
      const timeStr = now.toLocaleString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });

      const changeLines = editData.changes.map(c =>
        `• ${c.fieldLabel}: ${c.oldValue} → ${c.newValue}`
      ).join("\n");

      // Format editor phone for display
      const displayPhone = editorPhone.replace(/^62/, '0').replace(/@.*$/, '');

      // Generate SEO-friendly URLs
      let vehicleUrl: string;
      let dashboardUrl: string;
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://primamobil.id';

      if (editData.make && editData.model && editData.year) {
        // Use generator if details available
        vehicleUrl = generateVehicleUrl({
          make: editData.make,
          model: editData.model,
          year: editData.year,
          displayId: editData.displayId || editData.vehicleId.substring(0, 8),
        });

        dashboardUrl = generateVehicleDashboardUrl({
          make: editData.make,
          model: editData.model,
          year: editData.year,
          displayId: editData.displayId || editData.vehicleId.substring(0, 8),
        });
      } else {
        // Fallback: Fetch vehicle details from DB to ensure we NEVER use UUID URLs
        const vehicle = await prisma.vehicle.findUnique({
          where: { id: editData.vehicleId },
          select: { make: true, model: true, year: true, displayId: true },
        });

        if (vehicle) {
          vehicleUrl = generateVehicleUrl({
            make: vehicle.make,
            model: vehicle.model,
            year: vehicle.year,
            displayId: vehicle.displayId || editData.vehicleId.substring(0, 8),
          });

          dashboardUrl = generateVehicleDashboardUrl({
            make: vehicle.make,
            model: vehicle.model,
            year: vehicle.year,
            displayId: vehicle.displayId || editData.vehicleId.substring(0, 8),
          });
        } else {
          // Final fallback (should never happen): use displayId if available
          const fallbackId = editData.displayId || editData.vehicleId.substring(0, 8);
          vehicleUrl = `${baseUrl}/vehicles/unknown-vehicle-${fallbackId}`;
          dashboardUrl = `${baseUrl}/dashboard/vehicles/unknown-vehicle-${fallbackId}/edit`;
        }
      }

      const message =
        `🔔 NOTIFIKASI REVISI DATA\n` +
        `━━━━━━━━━━━━━\n\n` +
        `✏️ Data Diperbarui!\n\n` +
        `📋 Kendaraan:\n` +
        `${editData.vehicleName}\n` +
        `ID: ${editData.displayId || editData.vehicleId}\n\n` +
        `📝 Perubahan:\n${changeLines}\n\n` +
        `👤 Diubah oleh:\n` +
        `${editorName || 'Staff'} (${displayPhone})\n\n` +
        `🕐 Waktu: ${timeStr}\n\n` +
        `🌐 Website:\n${vehicleUrl}\n\n` +
        `📊 Dashboard:\n${dashboardUrl}`;

      // 4. Send to all staff (except the editor)
      const normalizedEditorPhone = this.normalizePhone(editorPhone);
      let sentCount = 0;

      for (const staff of staffMembers) {
        if (!staff.phone) continue;

        const normalizedStaffPhone = this.normalizePhone(staff.phone);

        // Skip the editor - they already got the response
        if (normalizedStaffPhone === normalizedEditorPhone) {
          console.log(`[Edit Notification] Skipping editor: ${staff.phone}`);
          continue;
        }

        try {
          await AimeowClientService.sendMessage({
            clientId: aimeowAccount.clientId,
            to: normalizedStaffPhone,
            message,
          });
          sentCount++;
          console.log(`[Edit Notification] ✅ Sent to ${staff.firstName || staff.phone}`);

          // Small delay to avoid rate limiting
          await new Promise((resolve) => setTimeout(resolve, 500));
        } catch (error: any) {
          console.error(`[Edit Notification] ❌ Failed to send to ${staff.phone}:`, error.message);
        }
      }

      console.log(`[Edit Notification] Broadcast complete. Sent to ${sentCount} staff members.`);
    } catch (error: any) {
      console.error(`[Edit Notification] Error:`, error.message);
    }
  }
}

export default UploadNotificationService;
