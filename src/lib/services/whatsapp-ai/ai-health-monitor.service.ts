/**
 * AI Health Monitor Service
 * Monitor AI health, track errors, and notify staff when AI has issues
 * Prima Mobil - Auto-notify on AI errors, auto-restore when fixed
 *
 * NOTE: This service uses new fields added to WhatsAppAIConfig schema.
 * After deployment, run `prisma db push` to apply schema changes.
 */

import { prisma } from "@/lib/prisma";
import { AimeowClientService } from "../aimeow/aimeow-client.service";

// Type alias for config with new fields (until Prisma client is regenerated)
interface AIConfigWithHealth {
  id: string;
  tenantId: string;
  accountId: string;
  autoReply: boolean;
  aiEnabled?: boolean;
  aiStatus?: string;
  aiErrorCount?: number;
  aiLastError?: string | null;
  aiLastErrorAt?: Date | null;
  aiDisabledAt?: Date | null;
  aiRestoredAt?: Date | null;
}

// ==================== CONSTANTS ====================

// Threshold for consecutive errors before marking AI as "degraded"
const ERROR_THRESHOLD_DEGRADED = 3;

// Threshold for consecutive errors before auto-disabling AI
const ERROR_THRESHOLD_DISABLED = 5;

// Threshold for consecutive successes to restore AI from error state
const SUCCESS_THRESHOLD_RESTORE = 3;

// Cooldown between notifications (5 minutes) to avoid spam
const NOTIFICATION_COOLDOWN_MS = 5 * 60 * 1000;

// ==================== TYPES ====================

export type AIStatus = "active" | "degraded" | "error" | "disabled";

export interface AIHealthState {
  enabled: boolean;
  status: AIStatus;
  errorCount: number;
  lastError?: string;
  lastErrorAt?: Date;
  disabledAt?: Date;
  restoredAt?: Date;
}

export interface HealthCheckResult {
  canProcess: boolean;
  status: AIStatus;
  reason?: string;
}

// Track last notification time per tenant to avoid spam
const lastNotificationTime: Map<string, number> = new Map();

// Track consecutive successes for recovery
const successCountMap: Map<string, number> = new Map();

// ==================== AI HEALTH MONITOR SERVICE ====================

export class AIHealthMonitorService {
  /**
   * Check if AI can process messages for a tenant
   * Returns false if AI is disabled or in error state
   */
  static async canProcessAI(tenantId: string): Promise<HealthCheckResult> {
    try {
      const rawConfig = await prisma.whatsAppAIConfig.findUnique({
        where: { tenantId },
      });

      // No config means AI not setup yet - default to enabled
      if (!rawConfig) {
        return { canProcess: true, status: "active" };
      }

      // Cast to our extended type (fields may not exist until migration)
      const config = rawConfig as unknown as AIConfigWithHealth;

      // Check if new fields exist (before migration they won't)
      const aiEnabled = config.aiEnabled ?? true;
      const aiStatus = config.aiStatus ?? "active";
      const aiErrorCount = config.aiErrorCount ?? 0;

      // Check manual disable
      if (!aiEnabled) {
        return {
          canProcess: false,
          status: "disabled",
          reason: "AI dinonaktifkan secara manual"
        };
      }

      // Check auto-disable due to errors
      if (aiStatus === "disabled" || aiStatus === "error") {
        return {
          canProcess: false,
          status: aiStatus as AIStatus,
          reason: `AI dalam status ${aiStatus} (${aiErrorCount} error berturut-turut)`
        };
      }

      // Check autoReply setting
      if (!rawConfig.autoReply) {
        return {
          canProcess: false,
          status: "disabled",
          reason: "Auto-reply dinonaktifkan"
        };
      }

      return {
        canProcess: true,
        status: (aiStatus as AIStatus) || "active"
      };
    } catch (error: any) {
      console.error("[AIHealthMonitor] Error checking AI status:", error);
      // On error checking, allow processing to avoid blocking
      return { canProcess: true, status: "active" };
    }
  }

  /**
   * Track a successful AI response
   * Resets error count and may restore AI if was in degraded state
   */
  static async trackSuccess(tenantId: string): Promise<void> {
    try {
      const rawConfig = await prisma.whatsAppAIConfig.findUnique({
        where: { tenantId },
      });

      if (!rawConfig) return;

      // Cast to our extended type
      const config = rawConfig as unknown as AIConfigWithHealth;
      const aiStatus = config.aiStatus ?? "active";
      const aiErrorCount = config.aiErrorCount ?? 0;

      // Track consecutive successes
      const currentSuccessCount = (successCountMap.get(tenantId) || 0) + 1;
      successCountMap.set(tenantId, currentSuccessCount);

      // If was in degraded/error state and had enough successes, restore
      if (
        (aiStatus === "degraded" || aiStatus === "error") &&
        currentSuccessCount >= SUCCESS_THRESHOLD_RESTORE
      ) {
        console.log(`[AIHealthMonitor] ${tenantId}: AI restored after ${currentSuccessCount} successes`);

        await prisma.$executeRaw`
          UPDATE whatsapp_ai_configs
          SET ai_status = 'active', ai_error_count = 0, ai_last_error = NULL, ai_restored_at = NOW()
          WHERE tenant_id = ${tenantId}
        `;

        // Clear success counter
        successCountMap.delete(tenantId);

        // Notify staff that AI is restored
        await this.notifyStaffAIRestored(tenantId, config.accountId);
      } else if (aiErrorCount > 0 && aiStatus === "active") {
        // Just reset error count if was active but had some errors
        await prisma.$executeRaw`
          UPDATE whatsapp_ai_configs SET ai_error_count = 0 WHERE tenant_id = ${tenantId}
        `;
        successCountMap.delete(tenantId);
      }
    } catch (error) {
      console.error("[AIHealthMonitor] Error tracking success:", error);
    }
  }

  /**
   * Track an AI error
   * Increments error count and may disable AI if threshold reached
   */
  static async trackError(tenantId: string, errorMessage: string): Promise<void> {
    try {
      console.log(`[AIHealthMonitor] ${tenantId}: Tracking error: ${errorMessage}`);

      // Reset success counter on error
      successCountMap.delete(tenantId);

      const rawConfig = await prisma.whatsAppAIConfig.findUnique({
        where: { tenantId },
      });

      if (!rawConfig) {
        console.log(`[AIHealthMonitor] ${tenantId}: No config found, skipping error tracking`);
        return;
      }

      // Cast to our extended type
      const config = rawConfig as unknown as AIConfigWithHealth;
      const currentErrorCount = config.aiErrorCount ?? 0;
      const currentStatus = config.aiStatus ?? "active";

      const newErrorCount = currentErrorCount + 1;
      let newStatus: AIStatus = currentStatus as AIStatus;
      let shouldNotify = false;

      // Determine new status based on error count
      if (newErrorCount >= ERROR_THRESHOLD_DISABLED) {
        newStatus = "disabled";
        shouldNotify = true;
        console.log(`[AIHealthMonitor] ${tenantId}: AI auto-disabled after ${newErrorCount} errors`);
      } else if (newErrorCount >= ERROR_THRESHOLD_DEGRADED) {
        newStatus = "degraded";
        if (currentStatus !== "degraded") {
          shouldNotify = true;
        }
        console.log(`[AIHealthMonitor] ${tenantId}: AI degraded after ${newErrorCount} errors`);
      }

      // Update database using raw SQL (until migration is applied)
      const truncatedError = errorMessage.substring(0, 1000);
      if (newStatus === "disabled") {
        await prisma.$executeRaw`
          UPDATE whatsapp_ai_configs
          SET ai_status = ${newStatus}, ai_error_count = ${newErrorCount},
              ai_last_error = ${truncatedError}, ai_last_error_at = NOW(), ai_disabled_at = NOW()
          WHERE tenant_id = ${tenantId}
        `;
      } else {
        await prisma.$executeRaw`
          UPDATE whatsapp_ai_configs
          SET ai_status = ${newStatus}, ai_error_count = ${newErrorCount},
              ai_last_error = ${truncatedError}, ai_last_error_at = NOW()
          WHERE tenant_id = ${tenantId}
        `;
      }

      // Notify staff if status changed significantly
      if (shouldNotify) {
        await this.notifyStaffAIError(tenantId, config.accountId, newStatus, newErrorCount, errorMessage);
      }
    } catch (error) {
      console.error("[AIHealthMonitor] Error tracking error:", error);
    }
  }

  /**
   * Manually enable/disable AI for a tenant
   */
  static async setAIEnabled(tenantId: string, enabled: boolean, reason?: string): Promise<boolean> {
    try {
      const rawConfig = await prisma.whatsAppAIConfig.findUnique({
        where: { tenantId },
      });

      if (!rawConfig) {
        console.log(`[AIHealthMonitor] ${tenantId}: No config found`);
        return false;
      }

      const config = rawConfig as unknown as AIConfigWithHealth;

      // Update status using raw SQL
      if (enabled) {
        await prisma.$executeRaw`
          UPDATE whatsapp_ai_configs
          SET ai_enabled = true, ai_status = 'active', ai_error_count = 0, ai_restored_at = NOW()
          WHERE tenant_id = ${tenantId}
        `;
      } else {
        const errorReason = reason || "Dinonaktifkan manual";
        await prisma.$executeRaw`
          UPDATE whatsapp_ai_configs
          SET ai_enabled = false, ai_status = 'disabled', ai_error_count = 0,
              ai_disabled_at = NOW(), ai_last_error = ${errorReason}
          WHERE tenant_id = ${tenantId}
        `;
      }

      // Notify staff of manual change
      if (enabled) {
        await this.notifyStaffAIRestored(tenantId, config.accountId, true);
      } else {
        await this.notifyStaffAIDisabled(tenantId, config.accountId, reason || "Manual disable");
      }

      return true;
    } catch (error) {
      console.error("[AIHealthMonitor] Error setting AI enabled:", error);
      return false;
    }
  }

  /**
   * Get current AI health state for a tenant
   */
  static async getHealthState(tenantId: string): Promise<AIHealthState | null> {
    try {
      const rawConfig = await prisma.whatsAppAIConfig.findUnique({
        where: { tenantId },
      });

      if (!rawConfig) return null;

      // Cast to our extended type
      const config = rawConfig as unknown as AIConfigWithHealth;

      return {
        enabled: config.aiEnabled ?? true,
        status: (config.aiStatus as AIStatus) ?? "active",
        errorCount: config.aiErrorCount ?? 0,
        lastError: config.aiLastError || undefined,
        lastErrorAt: config.aiLastErrorAt || undefined,
        disabledAt: config.aiDisabledAt || undefined,
        restoredAt: config.aiRestoredAt || undefined,
      };
    } catch (error) {
      console.error("[AIHealthMonitor] Error getting health state:", error);
      return null;
    }
  }

  // ==================== NOTIFICATION METHODS ====================

  /**
   * Notify all staff that AI has encountered errors
   */
  private static async notifyStaffAIError(
    tenantId: string,
    accountId: string,
    status: AIStatus,
    errorCount: number,
    lastError: string
  ): Promise<void> {
    // Check notification cooldown
    const lastNotif = lastNotificationTime.get(tenantId) || 0;
    if (Date.now() - lastNotif < NOTIFICATION_COOLDOWN_MS) {
      console.log(`[AIHealthMonitor] ${tenantId}: Notification on cooldown, skipping`);
      return;
    }

    try {
      const account = await prisma.aimeowAccount.findUnique({
        where: { id: accountId },
        include: { tenant: true },
      });

      if (!account || !account.isActive) {
        console.log(`[AIHealthMonitor] ${tenantId}: No active WhatsApp account`);
        return;
      }

      // Get all staff members
      const staffMembers = await prisma.user.findMany({
        where: {
          tenantId,
          phone: { not: null },
          role: { in: ["ADMIN", "MANAGER"] }, // Only notify admins and managers for AI issues
        },
        select: { phone: true, firstName: true },
      });

      if (staffMembers.length === 0) {
        console.log(`[AIHealthMonitor] ${tenantId}: No admin/manager with phone found`);
        return;
      }

      // Build notification message
      const timestamp = new Date().toLocaleString("id-ID", {
        timeZone: "Asia/Jakarta",
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });

      const statusEmoji = status === "disabled" ? "🔴" : "🟡";
      const statusText = status === "disabled" ? "NONAKTIF" : "TERGANGGU";

      const message =
        `${statusEmoji} *AI ${account.tenant.name.toUpperCase()} ${statusText}*\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `⚠️ AI mengalami ${errorCount} error berturut-turut\n\n` +
        `📋 *Detail Error:*\n` +
        `${lastError.substring(0, 200)}${lastError.length > 200 ? '...' : ''}\n\n` +
        `⏰ *Waktu:* ${timestamp}\n\n` +
        `💡 *Yang perlu dilakukan:*\n` +
        `• Chat customer akan dijawab MANUAL\n` +
        `• Cek dashboard WhatsApp AI\n` +
        `• Hubungi admin jika perlu bantuan\n\n` +
        `🔧 AI akan otomatis aktif kembali setelah 3 pesan berhasil diproses.`;

      // Send to all admins/managers
      for (const staff of staffMembers) {
        if (!staff.phone) continue;
        try {
          const normalizedPhone = this.normalizePhone(staff.phone);
          await AimeowClientService.sendMessage({
            clientId: account.clientId,
            to: normalizedPhone,
            message,
          });
          console.log(`[AIHealthMonitor] ✅ Notified ${staff.firstName} about AI error`);
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (sendError: any) {
          console.error(`[AIHealthMonitor] Failed to notify ${staff.firstName}:`, sendError.message);
        }
      }

      // Update notification time
      lastNotificationTime.set(tenantId, Date.now());
    } catch (error) {
      console.error("[AIHealthMonitor] Error sending AI error notification:", error);
    }
  }

  /**
   * Notify all staff that AI has been restored
   */
  private static async notifyStaffAIRestored(
    tenantId: string,
    accountId: string,
    isManual: boolean = false
  ): Promise<void> {
    try {
      const account = await prisma.aimeowAccount.findUnique({
        where: { id: accountId },
        include: { tenant: true },
      });

      if (!account || !account.isActive) return;

      // Get admin/manager staff members
      const staffMembers = await prisma.user.findMany({
        where: {
          tenantId,
          phone: { not: null },
          role: { in: ["ADMIN", "MANAGER"] },
        },
        select: { phone: true, firstName: true },
      });

      if (staffMembers.length === 0) return;

      const timestamp = new Date().toLocaleString("id-ID", {
        timeZone: "Asia/Jakarta",
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });

      const message =
        `🟢 *AI ${account.tenant.name.toUpperCase()} AKTIF KEMBALI*\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `✅ AI sudah kembali normal!\n\n` +
        `📋 *Detail:*\n` +
        `• Status: AKTIF\n` +
        `• Cara aktif: ${isManual ? 'Manual oleh admin' : 'Otomatis (error teratasi)'}\n` +
        `• Waktu: ${timestamp}\n\n` +
        `💬 Semua chat customer akan kembali dijawab oleh AI.`;

      for (const staff of staffMembers) {
        if (!staff.phone) continue;
        try {
          const normalizedPhone = this.normalizePhone(staff.phone);
          await AimeowClientService.sendMessage({
            clientId: account.clientId,
            to: normalizedPhone,
            message,
          });
          console.log(`[AIHealthMonitor] ✅ Notified ${staff.firstName} about AI restored`);
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (sendError: any) {
          console.error(`[AIHealthMonitor] Failed to notify ${staff.firstName}:`, sendError.message);
        }
      }

      // Clear notification cooldown on restore
      lastNotificationTime.delete(tenantId);
    } catch (error) {
      console.error("[AIHealthMonitor] Error sending AI restored notification:", error);
    }
  }

  /**
   * Notify staff that AI was manually disabled
   */
  private static async notifyStaffAIDisabled(
    tenantId: string,
    accountId: string,
    reason: string
  ): Promise<void> {
    try {
      const account = await prisma.aimeowAccount.findUnique({
        where: { id: accountId },
        include: { tenant: true },
      });

      if (!account || !account.isActive) return;

      const staffMembers = await prisma.user.findMany({
        where: {
          tenantId,
          phone: { not: null },
          role: { in: ["ADMIN", "MANAGER"] },
        },
        select: { phone: true, firstName: true },
      });

      if (staffMembers.length === 0) return;

      const timestamp = new Date().toLocaleString("id-ID", {
        timeZone: "Asia/Jakarta",
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });

      const message =
        `🔴 *AI ${account.tenant.name.toUpperCase()} DINONAKTIFKAN*\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `⚠️ AI dinonaktifkan secara manual\n\n` +
        `📋 *Alasan:*\n` +
        `${reason}\n\n` +
        `⏰ *Waktu:* ${timestamp}\n\n` +
        `💡 Chat customer perlu dijawab MANUAL sampai AI diaktifkan kembali.`;

      for (const staff of staffMembers) {
        if (!staff.phone) continue;
        try {
          const normalizedPhone = this.normalizePhone(staff.phone);
          await AimeowClientService.sendMessage({
            clientId: account.clientId,
            to: normalizedPhone,
            message,
          });
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (sendError: any) {
          console.error(`[AIHealthMonitor] Failed to notify ${staff.firstName}:`, sendError.message);
        }
      }
    } catch (error) {
      console.error("[AIHealthMonitor] Error sending AI disabled notification:", error);
    }
  }

  /**
   * Normalize phone number for sending
   */
  private static normalizePhone(phone: string): string {
    if (!phone) return "";
    let digits = phone.replace(/\D/g, "");
    if (digits.startsWith("0")) {
      digits = "62" + digits.substring(1);
    }
    return digits;
  }
}

export default AIHealthMonitorService;
