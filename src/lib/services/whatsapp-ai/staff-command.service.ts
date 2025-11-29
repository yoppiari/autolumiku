/**
 * Staff Command Service
 * Handles WhatsApp commands dari staff untuk:
 * - Upload vehicle (dengan foto)
 * - Update status mobil
 * - Check inventory
 * - Get statistics
 */

import { prisma } from "@/lib/prisma";
import { MessageIntent } from "./intent-classifier.service";

// ==================== TYPES ====================

export interface CommandParseResult {
  command: string;
  params: Record<string, any>;
  isValid: boolean;
  error?: string;
}

export interface CommandExecutionResult {
  success: boolean;
  message: string;
  data?: any;
  vehicleId?: string;
  leadId?: string;
}

// ==================== STAFF COMMAND SERVICE ====================

export class StaffCommandService {
  /**
   * Parse command dari message
   */
  static parseCommand(message: string, intent: MessageIntent): CommandParseResult {
    const trimmedMessage = message.trim();

    switch (intent) {
      case "staff_upload_vehicle":
        return this.parseUploadCommand(trimmedMessage);

      case "staff_update_status":
        return this.parseStatusUpdateCommand(trimmedMessage);

      case "staff_check_inventory":
        return this.parseInventoryCommand(trimmedMessage);

      case "staff_get_stats":
        return this.parseStatsCommand(trimmedMessage);

      default:
        return {
          command: "unknown",
          params: {},
          isValid: false,
          error: "Unknown command",
        };
    }
  }

  /**
   * Execute command
   */
  static async executeCommand(
    intent: MessageIntent,
    params: Record<string, any>,
    tenantId: string,
    staffPhone: string,
    conversationId: string,
    mediaUrl?: string
  ): Promise<CommandExecutionResult> {
    // Verify staff authorization
    const isAuthorized = await this.verifyStaffAuthorization(
      tenantId,
      staffPhone,
      intent
    );

    if (!isAuthorized) {
      return {
        success: false,
        message: "❌ Anda tidak memiliki akses untuk command ini. Hubungi admin untuk aktivasi akses staff.",
      };
    }

    try {
      let result: CommandExecutionResult;

      switch (intent) {
        case "staff_upload_vehicle":
          result = await this.handleUploadVehicle(
            params,
            tenantId,
            staffPhone,
            mediaUrl,
            conversationId
          );
          break;

        case "staff_update_status":
          result = await this.handleUpdateStatus(params, tenantId, staffPhone);
          break;

        case "staff_check_inventory":
          result = await this.handleCheckInventory(params, tenantId);
          break;

        case "staff_get_stats":
          result = await this.handleGetStats(params, tenantId);
          break;

        default:
          result = {
            success: false,
            message: "❌ Command tidak dikenali. Ketik /help untuk bantuan.",
          };
      }

      // Log command execution
      await this.logCommand(
        tenantId,
        staffPhone,
        intent,
        params,
        result.success,
        result.message,
        result.vehicleId,
        result.leadId
      );

      return result;
    } catch (error: any) {
      console.error("[Staff Command] Execution error:", error);

      // Log failed command
      await this.logCommand(
        tenantId,
        staffPhone,
        intent,
        params,
        false,
        error.message
      );

      return {
        success: false,
        message: `❌ Terjadi kesalahan: ${error.message}`,
      };
    }
  }

  // ==================== COMMAND PARSERS ====================

  /**
   * Parse /upload command
   * Format: /upload [make] [model] [year] [price] [mileage] [color] [transmission]
   * Example: /upload Toyota Avanza 2020 150000000 50000 Hitam Manual
   */
  private static parseUploadCommand(message: string): CommandParseResult {
    // Simple format: wait for multi-step conversation
    // Staff sends /upload, then we ask for details step by step
    if (message.toLowerCase().trim() === "/upload") {
      return {
        command: "upload_init",
        params: { step: "init" },
        isValid: true,
      };
    }

    // Parse full command format
    const parts = message.split(/\s+/).filter((p) => p);

    if (parts.length < 6) {
      return {
        command: "upload",
        params: {},
        isValid: false,
        error:
          "Format tidak lengkap. Gunakan: /upload [merk] [model] [tahun] [harga] [km] [warna] [transmisi]",
      };
    }

    const [cmd, make, model, year, price, mileage, color, ...transmissionParts] = parts;
    const transmission = transmissionParts.join(" ") || "Manual";

    return {
      command: "upload",
      params: {
        make,
        model,
        year: parseInt(year),
        price: parseInt(price),
        mileage: parseInt(mileage),
        color,
        transmission,
      },
      isValid: true,
    };
  }

  /**
   * Parse /status command
   * Format: /status [vehicle_id] [new_status]
   * Example: /status 12345 SOLD
   */
  private static parseStatusUpdateCommand(message: string): CommandParseResult {
    const parts = message.split(/\s+/).filter((p) => p);

    if (parts.length < 3) {
      return {
        command: "status",
        params: {},
        isValid: false,
        error: "Format: /status [vehicle_id] [AVAILABLE|RESERVED|SOLD]",
      };
    }

    const [cmd, vehicleId, status] = parts;

    const validStatuses = ["AVAILABLE", "RESERVED", "SOLD", "DELETED"];
    if (!validStatuses.includes(status.toUpperCase())) {
      return {
        command: "status",
        params: {},
        isValid: false,
        error: `Status tidak valid. Gunakan: ${validStatuses.join(", ")}`,
      };
    }

    return {
      command: "status",
      params: {
        vehicleId,
        status: status.toUpperCase(),
      },
      isValid: true,
    };
  }

  /**
   * Parse /inventory command
   * Format: /inventory [filter?]
   * Example: /inventory, /inventory AVAILABLE, /inventory Toyota
   */
  private static parseInventoryCommand(message: string): CommandParseResult {
    const parts = message.split(/\s+/).filter((p) => p);
    const filter = parts.length > 1 ? parts[1] : null;

    return {
      command: "inventory",
      params: { filter },
      isValid: true,
    };
  }

  /**
   * Parse /stats command
   * Format: /stats [period?]
   * Example: /stats, /stats today, /stats week, /stats month
   */
  private static parseStatsCommand(message: string): CommandParseResult {
    const parts = message.split(/\s+/).filter((p) => p);
    const period = parts.length > 1 ? parts[1].toLowerCase() : "today";

    return {
      command: "stats",
      params: { period },
      isValid: true,
    };
  }

  // ==================== COMMAND HANDLERS ====================

  /**
   * Handle vehicle upload
   */
  private static async handleUploadVehicle(
    params: Record<string, any>,
    tenantId: string,
    staffPhone: string,
    mediaUrl?: string,
    conversationId?: string
  ): Promise<CommandExecutionResult> {
    // Initialize upload flow (multi-step)
    if (params.step === "init") {
      // Update conversation state untuk multi-step flow
      if (conversationId) {
        await prisma.whatsAppConversation.update({
          where: { id: conversationId },
          data: {
            conversationState: "upload_vehicle",
            contextData: { step: "awaiting_photo" },
          },
        });
      }

      return {
        success: true,
        message:
          "📸 Untuk upload mobil baru:\n\n1. Kirim foto mobil (1-5 foto)\n2. Kemudian kirim detail dengan format:\n\n*Merk Model Tahun Harga KM Warna Transmisi*\n\nContoh:\nToyota Avanza 2020 150000000 50000 Hitam Manual",
      };
    }

    // Validate required fields
    const { make, model, year, price, mileage, color, transmission } = params;

    if (!make || !model || !year || !price) {
      return {
        success: false,
        message:
          "❌ Data tidak lengkap. Format: /upload [merk] [model] [tahun] [harga] [km] [warna] [transmisi]",
      };
    }

    // FIX: Add input validation for data integrity
    const currentYear = new Date().getFullYear();
    if (year < 1980 || year > currentYear + 1) {
      return {
        success: false,
        message: `❌ Tahun tidak valid. Harus antara 1980-${currentYear + 1}`,
      };
    }

    if (price <= 0 || price > 100000000000) {
      return {
        success: false,
        message: "❌ Harga tidak valid. Harus antara 0-100 miliar",
      };
    }

    if (mileage < 0 || mileage > 1000000) {
      return {
        success: false,
        message: "❌ Kilometer tidak valid. Harus antara 0-1,000,000 km",
      };
    }

    // TODO: Integrate dengan VehicleAIService untuk generate description
    // For now, create basic vehicle entry

    const vehicle = await prisma.vehicle.create({
      data: {
        tenantId,
        make,
        model,
        year,
        price,
        mileage: mileage || 0,
        transmissionType: transmission || "Manual",
        color: color || "Unknown",
        status: "AVAILABLE",
        condition: "Good",
        descriptionId: `${make} ${model} ${year} - Uploaded via WhatsApp by staff`,
        features: ["Standard Features"],
        // Note: Photos will be added in next message if mediaUrl provided
      },
    });

    // If mediaUrl provided, add photo
    if (mediaUrl) {
      await prisma.vehiclePhoto.create({
        data: {
          vehicleId: vehicle.id,
          url: mediaUrl,
          isPrimary: true,
        },
      });
    }

    return {
      success: true,
      message: `✅ Mobil berhasil ditambahkan!\n\n📋 Detail:\n- ID: ${vehicle.displayId || vehicle.id}\n- Mobil: ${make} ${model} ${year}\n- Harga: Rp ${this.formatPrice(price)}\n- KM: ${this.formatNumber(mileage || 0)} km\n- Status: AVAILABLE\n\n${!mediaUrl ? "⚠️ Jangan lupa upload foto di dashboard admin!" : ""}`,
      vehicleId: vehicle.id,
    };
  }

  /**
   * Handle status update
   */
  private static async handleUpdateStatus(
    params: Record<string, any>,
    tenantId: string,
    staffPhone: string
  ): Promise<CommandExecutionResult> {
    const { vehicleId, status } = params;

    // Find vehicle
    const vehicle = await prisma.vehicle.findFirst({
      where: {
        OR: [{ id: vehicleId }, { displayId: vehicleId }],
        tenantId,
      },
    });

    if (!vehicle) {
      return {
        success: false,
        message: `❌ Mobil dengan ID ${vehicleId} tidak ditemukan.`,
      };
    }

    // FIX: Validate status against allowed values before update
    const validStatuses = ["AVAILABLE", "RESERVED", "SOLD", "DELETED"];
    if (!validStatuses.includes(status)) {
      return {
        success: false,
        message: `❌ Status tidak valid: ${status}. Gunakan: ${validStatuses.join(", ")}`,
      };
    }

    // Update status with proper typing
    const updated = await prisma.vehicle.update({
      where: { id: vehicle.id },
      data: { status: status as "AVAILABLE" | "RESERVED" | "SOLD" | "DELETED" },
    });

    // Log history
    await prisma.vehicleHistory.create({
      data: {
        vehicleId: vehicle.id,
        tenantId,
        action: "STATUS_UPDATE",
        changes: { oldStatus: vehicle.status, newStatus: status },
        changedBy: staffPhone,
      },
    });

    return {
      success: true,
      message: `✅ Status mobil berhasil diupdate!\n\n📋 ${vehicle.make} ${vehicle.model} ${vehicle.year}\n- ID: ${vehicle.displayId || vehicle.id}\n- Status: ${vehicle.status} → ${status}`,
      vehicleId: vehicle.id,
    };
  }

  /**
   * Handle inventory check
   */
  private static async handleCheckInventory(
    params: Record<string, any>,
    tenantId: string
  ): Promise<CommandExecutionResult> {
    const { filter } = params;

    let whereClause: any = { tenantId };

    // Apply filter
    if (filter) {
      const upperFilter = filter.toUpperCase();
      if (["AVAILABLE", "RESERVED", "SOLD", "DELETED"].includes(upperFilter)) {
        whereClause.status = upperFilter;
      } else {
        // Filter by make
        whereClause.make = { contains: filter, mode: "insensitive" as const };
      }
    }

    const vehicles = await prisma.vehicle.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    if (vehicles.length === 0) {
      return {
        success: true,
        message: `📊 Tidak ada mobil ditemukan${filter ? ` untuk filter: ${filter}` : ""}.`,
      };
    }

    // Group by status
    const byStatus = vehicles.reduce(
      (acc, v) => {
        acc[v.status] = (acc[v.status] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    let message = `📊 *Inventory Summary*${filter ? ` (Filter: ${filter})` : ""}\n\n`;
    message += `Total: ${vehicles.length} unit\n\n`;

    // Status breakdown
    message += `*Status:*\n`;
    Object.entries(byStatus).forEach(([status, count]) => {
      message += `- ${status}: ${count} unit\n`;
    });

    // List vehicles (max 10)
    message += `\n*Daftar Mobil (${Math.min(vehicles.length, 10)} teratas):*\n`;
    vehicles.slice(0, 10).forEach((v, idx) => {
      message += `\n${idx + 1}. ${v.make} ${v.model} ${v.year}\n`;
      message += `   ID: ${v.displayId || v.id}\n`;
      message += `   Harga: Rp ${this.formatPrice(Number(v.price))}\n`;
      message += `   Status: ${v.status}\n`;
    });

    if (vehicles.length > 10) {
      message += `\n... dan ${vehicles.length - 10} mobil lainnya`;
    }

    return {
      success: true,
      message,
    };
  }

  /**
   * Handle statistics request
   */
  private static async handleGetStats(
    params: Record<string, any>,
    tenantId: string
  ): Promise<CommandExecutionResult> {
    const { period } = params;

    // Calculate date range
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case "today":
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case "week":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "month":
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    }

    // Get stats
    const [totalVehicles, newVehicles, totalLeads, newLeads] = await Promise.all([
      prisma.vehicle.count({ where: { tenantId } }),
      prisma.vehicle.count({
        where: {
          tenantId,
          createdAt: { gte: startDate },
        },
      }),
      prisma.lead.count({ where: { tenantId } }),
      prisma.lead.count({
        where: {
          tenantId,
          createdAt: { gte: startDate },
        },
      }),
    ]);

    // Get vehicle by status
    const vehiclesByStatus = await prisma.vehicle.groupBy({
      by: ["status"],
      where: { tenantId },
      _count: true,
    });

    let message = `📈 *Statistics (${period === "today" ? "Hari Ini" : period === "week" ? "7 Hari Terakhir" : "Bulan Ini"})*\n\n`;

    message += `*Vehicles:*\n`;
    message += `- Total: ${totalVehicles} unit\n`;
    message += `- Baru: ${newVehicles} unit\n\n`;

    message += `*Status Breakdown:*\n`;
    vehiclesByStatus.forEach((s) => {
      message += `- ${s.status}: ${s._count} unit\n`;
    });

    message += `\n*Leads:*\n`;
    message += `- Total: ${totalLeads}\n`;
    message += `- Baru: ${newLeads}\n`;

    return {
      success: true,
      message,
    };
  }

  // ==================== HELPER METHODS ====================

  /**
   * Verify staff authorization
   */
  private static async verifyStaffAuthorization(
    tenantId: string,
    staffPhone: string,
    intent: MessageIntent
  ): Promise<boolean> {
    const staff = await prisma.staffWhatsAppAuth.findFirst({
      where: {
        tenantId,
        phoneNumber: staffPhone,
        isActive: true,
      },
    });

    if (!staff) {
      return false;
    }

    // Check permissions based on intent
    switch (intent) {
      case "staff_upload_vehicle":
        return staff.canUploadVehicle;
      case "staff_update_status":
        return staff.canUpdateStatus;
      case "staff_check_inventory":
      case "staff_get_stats":
        return true; // All staff can view
      default:
        return false;
    }
  }

  /**
   * Log command execution
   */
  private static async logCommand(
    tenantId: string,
    staffPhone: string,
    intent: MessageIntent,
    params: Record<string, any>,
    success: boolean,
    resultMessage: string,
    vehicleId?: string,
    leadId?: string
  ) {
    try {
      await prisma.staffCommandLog.create({
        data: {
          tenantId,
          staffPhone,
          command: intent,
          commandType: intent.replace("staff_", ""),
          parameters: params,
          success,
          resultMessage,
          error: success ? null : resultMessage,
          vehicleId,
          leadId,
        },
      });
    } catch (error) {
      console.error("[Staff Command] Failed to log command:", error);
    }
  }

  /**
   * Format price
   */
  private static formatPrice(price: number): string {
    return new Intl.NumberFormat("id-ID").format(price);
  }

  /**
   * Format number
   */
  private static formatNumber(num: number): string {
    return new Intl.NumberFormat("id-ID").format(num);
  }
}

export default StaffCommandService;
