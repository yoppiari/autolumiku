/**
 * Staff Command Service
 * Handles WhatsApp commands dari staff untuk:
 * - Upload vehicle (dengan foto)
 * - Update status mobil
 * - Check inventory
 * - Get statistics
 */

import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { MessageIntent } from "./intent-classifier.service";
import { VehicleDataExtractorService } from "@/lib/ai/vehicle-data-extractor.service";
import { WhatsAppVehicleUploadService } from "./vehicle-upload.service";
import { UploadNotificationService } from "./upload-notification.service";
import { WhatsAppReportService } from "./report.service";
import { ROLE_LEVELS } from "@/lib/rbac";

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
  skipResponse?: boolean; // If true, don't send WhatsApp response (for silent photo saves)
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Get time-based greeting in Indonesian based on WIB (UTC+7) timezone
 * Exported for use in other services
 */
export function getTimeBasedGreeting(): string {
  const now = new Date();
  const wibTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
  const hour = wibTime.getHours();

  if (hour >= 4 && hour < 11) {
    return "Selamat pagi";
  } else if (hour >= 11 && hour < 15) {
    return "Selamat siang";
  } else if (hour >= 15 && hour < 18) {
    return "Selamat sore";
  } else {
    return "Selamat malam";
  }
}

// ==================== STAFF COMMAND SERVICE ====================

export class StaffCommandService {
  /**
   * Parse command dari message
   * NOW ASYNC: Supports AI-powered natural language extraction
   */
  static async parseCommand(message: string, intent: MessageIntent, hasMedia: boolean = false): Promise<CommandParseResult> {
    const trimmedMessage = (message || "").trim();
    console.log(`[Staff Command] Parsing command - intent: ${intent}, message: "${trimmedMessage}", hasMedia: ${hasMedia}`);

    switch (intent) {
      case "staff_greeting":
        return { command: "greeting", params: {}, isValid: true };

      case "staff_upload_vehicle":
        return await this.parseUploadCommand(trimmedMessage, hasMedia);

      case "staff_update_status":
        return this.parseStatusUpdateCommand(trimmedMessage);

      case "staff_check_inventory":
        return this.parseInventoryCommand(trimmedMessage);

      case "staff_get_stats":
        return this.parseStatsCommand(trimmedMessage);

      case "staff_get_report":
        return this.parseReportCommand(trimmedMessage);

      case "staff_edit_vehicle":
        return this.parseEditVehicleCommand(trimmedMessage);

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
   * @param skipAuthorization - If true, skip staff verification (use when conversation is already verified as staff)
   */
  static async executeCommand(
    intent: MessageIntent,
    params: Record<string, any>,
    tenantId: string,
    staffPhone: string,
    conversationId: string,
    mediaUrl?: string,
    skipAuthorization: boolean = false
  ): Promise<CommandExecutionResult> {
    // Verify staff authorization (skip if conversation is already verified as staff)
    if (!skipAuthorization) {
      const isAuthorized = await this.verifyStaffAuthorization(
        tenantId,
        staffPhone,
        intent
      );

      if (!isAuthorized) {
        console.log(`[Staff Command] ❌ Authorization failed for phone: ${staffPhone}`);
        return {
          success: false,
          message: "Maaf kak, ini fitur khusus staff aja 🙏\n\nKalau mau jadi staff, hubungi admin ya!",
        };
      }
    } else {
      console.log(`[Staff Command] ✅ Skipping authorization (conversation already verified as staff)`);
    }

    try {
      let result: CommandExecutionResult;

      switch (intent) {
        case "staff_greeting":
          result = await this.handleStaffGreeting(tenantId, staffPhone);
          break;

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

        case "staff_edit_vehicle":
          result = await this.handleEditVehicle(params, tenantId, staffPhone, conversationId);
          break;

        case "staff_get_report":
          result = await this.handleGetReport(params, tenantId, staffPhone);
          break;

        default:
          result = {
            success: false,
            message: "Hmm ga paham nih 😅 Coba ketik 'halo' buat liat menu ya!",
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
        message: `Waduh, ada kendala nih 😅\n\n${error.message}\n\nCoba lagi ya! 🙏`,
      };
    }
  }

  // ==================== COMMAND PARSERS ====================

  /**
   * Parse /upload command with AI-powered natural language extraction
   * UPDATED: Now handles multi-step flow with conversation context
   *
   * Supports natural language formats:
   * - "/upload Toyota Avanza tahun 2020 harga 150 juta km 50 ribu warna hitam transmisi manual"
   * - "/upload Avanza 2020 hitam matic 150jt km 50rb"
   * - "/upload Honda Brio 2021, 140 juta, kilometer 30000, silver, automatic"
   *
   * Legacy strict format still supported:
   * - "/upload Toyota Avanza 2020 150000000 50000 Hitam Manual"
   */
  private static async parseUploadCommand(
    message: string,
    hasMedia: boolean = false
  ): Promise<CommandParseResult> {
    console.log(`[Staff Command] parseUploadCommand - message: "${message}", hasMedia: ${hasMedia}`);

    // If photo sent without text, treat as photo for multi-step flow
    if (hasMedia && !message) {
      console.log(`[Staff Command] Photo without caption - returning photo step`);
      return {
        command: "upload_photo",
        params: { step: "photo_only" },
        isValid: true,
      };
    }

    // Simple format: Initialize multi-step upload flow
    // Staff sends /upload or "mau upload" etc., then we ask for photo first
    const initPatterns = [
      /^\/upload$/i,
      /^upload$/i,
      /^mau\s+upload\b/i,
      /^ingin\s+upload\b/i,
      /^mo\s+upload\b/i,
      /^pengen\s+upload\b/i,
    ];

    const trimmedLower = message.toLowerCase().trim();
    if (initPatterns.some(p => p.test(trimmedLower))) {
      console.log(`[Staff Command] Upload init detected: "${message}"`);
      return {
        command: "upload_init",
        params: { step: "init" },
        isValid: true,
      };
    }

    // Remove /upload prefix untuk extraction
    let textToExtract = message;
    if (message.toLowerCase().startsWith("/upload")) {
      textToExtract = message.substring(7).trim();
    } else if (message.toLowerCase().startsWith("upload")) {
      textToExtract = message.substring(6).trim();
    }

    if (!textToExtract) {
      return {
        command: "upload",
        params: {},
        isValid: false,
        error: "Data mobil tidak boleh kosong. Kirim /upload diikuti detail mobil.",
      };
    }

    console.log(`[Staff Command] Parsing upload command with AI: "${textToExtract}"`);

    // Try AI extraction first
    const aiResult = await VehicleDataExtractorService.extractFromNaturalLanguage(textToExtract);

    if (aiResult.success && aiResult.data) {
      console.log('[Staff Command] ✅ AI extraction successful:', aiResult.data);
      return {
        command: "upload",
        params: {
          ...aiResult.data,
        },
        isValid: true,
      };
    }

    // AI extraction failed, try regex fallback
    console.log('[Staff Command] ⚠️ AI extraction failed, trying regex fallback...');
    const regexResult = VehicleDataExtractorService.extractUsingRegex(textToExtract);

    if (regexResult.success && regexResult.data) {
      console.log('[Staff Command] ✅ Regex fallback successful:', regexResult.data);
      return {
        command: "upload",
        params: {
          ...regexResult.data,
        },
        isValid: true,
      };
    }

    // Both full extractions failed - try partial extraction
    // This is used when staff is completing missing fields (e.g., "hitam matic km 30rb")
    console.log('[Staff Command] ⚠️ Full extraction failed, trying partial extraction for completion...');
    const partialResult = VehicleDataExtractorService.extractPartialData(textToExtract);

    if (partialResult.success && partialResult.data) {
      console.log('[Staff Command] ✅ Partial extraction successful:', partialResult.data);
      // Return partial data - will be merged with existing context in handleUploadVehicle
      return {
        command: "upload",
        params: {
          ...partialResult.data,
        },
        isValid: true,
      };
    }

    // All extraction methods failed
    console.error('[Staff Command] ❌ All extraction methods failed');
    return {
      command: "upload",
      params: {},
      isValid: false,
      error:
        "❌ Gagal memproses data mobil.\n\n" +
        "Coba ketik ulang dengan lebih jelas.\n\n" +
        "*Contoh yang benar:*\n" +
        "• Brio 2020 120jt hitam matic km 30rb\n" +
        "• Avanza 2019 silver manual 140jt kilometer 50ribu\n\n" +
        "*Jika melengkapi data:*\n" +
        "• hitam matic km 30rb\n" +
        "• silver manual\n" +
        "• km 50000",
    };
  }

  /**
   * Parse status command (with or without "/" prefix)
   * Format: status [vehicle_id] [new_status]
   * Example: status PM-PST-001 SOLD, /status 12345 SOLD
   */
  private static parseStatusUpdateCommand(message: string): CommandParseResult {
    // Remove "/" prefix if present
    let cleanMessage = message;
    if (cleanMessage.startsWith('/')) {
      cleanMessage = cleanMessage.substring(1);
    }

    const parts = cleanMessage.split(/\s+/).filter((p) => p);

    if (parts.length < 3) {
      return {
        command: "status",
        params: {},
        isValid: false,
        error: "Formatnya: status [ID mobil] [status baru]\n\nContoh: status PM-PST-001 SOLD",
      };
    }

    const [cmd, vehicleId, status] = parts;

    const validStatuses = ["AVAILABLE", "BOOKED", "SOLD", "DELETED"];
    if (!validStatuses.includes(status.toUpperCase())) {
      return {
        command: "status",
        params: {},
        isValid: false,
        error: `Status "${status}" ga valid kak\n\nPilihan: AVAILABLE, BOOKED, SOLD, DELETED`,
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
   * Parse inventory command (with or without "/" prefix)
   * Format: inventory [filter?]
   * Example: inventory, inventory AVAILABLE, inventory Toyota
   */
  private static parseInventoryCommand(message: string): CommandParseResult {
    // Remove "/" prefix if present
    let cleanMessage = message;
    if (cleanMessage.startsWith('/')) {
      cleanMessage = cleanMessage.substring(1);
    }

    const parts = cleanMessage.split(/\s+/).filter((p) => p);
    const filter = parts.length > 1 ? parts[1] : null;

    return {
      command: "inventory",
      params: { filter },
      isValid: true,
    };
  }

  /**
   * Parse stats command (with or without "/" prefix)
   * Format: stats [period?]
   * Example: stats, stats today, stats week, stats month
   */
  private static parseStatsCommand(message: string): CommandParseResult {
    // Remove "/" prefix if present
    let cleanMessage = message;
    if (cleanMessage.startsWith('/')) {
      cleanMessage = cleanMessage.substring(1);
    }

    const parts = cleanMessage.split(/\s+/).filter((p) => p);
    const period = parts.length > 1 ? parts[1].toLowerCase() : "today";

    return {
      command: "stats",
      params: { period },
      isValid: true,
    };
  }

  /**
   * Parse report command
   */
  private static parseReportCommand(message: string): CommandParseResult {
    const msg = message.toLowerCase();

    // Mapping keywords to internal report types
    const reportMap: Record<string, string> = {
      // Sales & Revenue
      'sales report': 'sales_report',
      'laporan penjualan lengkap': 'sales_report',
      'total penjualan': 'total_sales',
      'total sales': 'total_sales',
      'total revenue': 'total_revenue',
      'pendapatan': 'total_revenue',
      'tren penjualan': 'sales_trends',
      'sales trends': 'sales_trends',
      'metrik penjualan': 'sales_metrics',
      'sales metrics': 'sales_metrics',
      'kpi': 'sales_metrics',
      'sales summary': 'sales_summary',
      'ringkasan cepat': 'sales_summary',

      // Inventory & Stock
      'total inventory': 'total_inventory',
      'laporan stok': 'total_inventory',
      'vehicle listing': 'vehicle_listing',
      'daftar kendaraan': 'vehicle_listing',
      'low stock alert': 'low_stock_alert',
      'stok tipis': 'low_stock_alert',
      'peringatan stok': 'low_stock_alert',
      'average price': 'average_price',
      'analisis harga': 'average_price',
      'rata rata harga': 'average_price',

      // Team & Performance
      'staff performance': 'staff_performance',
      'performa sales': 'staff_performance',
      'recent sales': 'recent_sales',
      'penjualan terkini': 'recent_sales',
      'penjualan 7 hari': 'recent_sales',

      // WhatsApp AI & Customer
      'whatsapp ai analytics': 'ai_analytics',
      'performa bot': 'ai_analytics',
      'customer metrics': 'customer_metrics',
      'analisis pelanggan': 'customer_metrics',
      'metrik operasional': 'operational_metrics',
      'efisiensi chat': 'operational_metrics',
    };

    for (const [key, value] of Object.entries(reportMap)) {
      if (msg.includes(key)) {
        return {
          command: "get_report",
          params: { type: value },
          isValid: true,
        };
      }
    }

    return {
      command: "get_report",
      params: {},
      isValid: false,
      error: "Report jenis apa kak? Cek menu report ya.",
    };
  }

  // ==================== COMMAND HANDLERS ====================

  /**
   * Check which required fields are missing from vehicle data
   * Returns array of missing field names and a user-friendly message
   *
   * DATA WAJIB untuk upload:
   * - Jenis/Model (Brio, Avanza, dll)
   * - Tahun
   * - Harga
   * - Warna
   * - Transmisi (manual/matic)
   * - KM
   */
  private static checkMissingFields(vehicleData: any): {
    missingFields: string[];
    askMessage: string;
    hasMinimumData: boolean;
  } {
    const missingFields: string[] = [];
    const missingLabels: string[] = [];

    // === SEMUA FIELD WAJIB UNTUK UPLOAD ===

    // 1. Jenis/Model
    if (!vehicleData?.model) {
      missingFields.push("model");
      missingLabels.push("Jenis/Model");
    }

    // 2. Tahun
    if (!vehicleData?.year) {
      missingFields.push("year");
      missingLabels.push("Tahun");
    }

    // 3. Harga
    if (!vehicleData?.price) {
      missingFields.push("price");
      missingLabels.push("Harga");
    }

    // 4. Warna (WAJIB, bukan optional)
    if (!vehicleData?.color || vehicleData?.color === "Unknown") {
      missingFields.push("color");
      missingLabels.push("Warna");
    }

    // 5. Transmisi (WAJIB, bukan optional)
    if (!vehicleData?.transmission || vehicleData?.transmission === "Unknown") {
      missingFields.push("transmission");
      missingLabels.push("Transmisi");
    }

    // 6. KM (OPTIONAL - bisa diisi nanti lewat edit command)
    // KM tidak diminta lagi, user bisa mengisi melalui "edit" command setelah kendaraan dibuat

    // Merk boleh kosong jika model sudah dikenali (auto-detect dari model)
    // contoh: "Brio" → Honda Brio

    // Data lengkap = 5 field wajib (tanpa KM)
    const hasMinimumData =
      vehicleData?.model &&
      vehicleData?.year &&
      vehicleData?.price &&
      vehicleData?.color && vehicleData?.color !== "Unknown" &&
      vehicleData?.transmission && vehicleData?.transmission !== "Unknown";

    let askMessage = "";
    if (missingLabels.length > 0) {
      // Build helpful message - casual style
      askMessage = `Eh masih kurang nih datanya 😊\n\n`;
      askMessage += `Yang belum: *${missingLabels.join(", ")}*\n\n`;

      // Show what we already have
      const received: string[] = [];
      if (vehicleData?.make) received.push(`✓ ${vehicleData.make}`);
      if (vehicleData?.model) received.push(`✓ ${vehicleData.model}`);
      if (vehicleData?.year) received.push(`✓ ${vehicleData.year}`);
      if (vehicleData?.price) received.push(`✓ Rp ${this.formatPrice(vehicleData.price)}`);
      if (vehicleData?.color && vehicleData?.color !== "Unknown") received.push(`✓ ${vehicleData.color}`);
      if (vehicleData?.transmission && vehicleData?.transmission !== "Unknown") received.push(`✓ ${vehicleData.transmission}`);
      if (vehicleData?.mileage || vehicleData?.mileage === 0) received.push(`✓ ${this.formatNumber(vehicleData.mileage)} km`);

      if (received.length > 0) {
        askMessage += `Udah dapet:\n${received.join("\n")}\n\n`;
      }

      // Give examples based on what's missing
      askMessage += `Tinggal tambahin:\n`;

      const examples: string[] = [];
      if (missingFields.includes("color")) examples.push("hitam");
      if (missingFields.includes("transmission")) examples.push("matic");
      if (missingFields.includes("year")) examples.push("2020");
      if (missingFields.includes("price")) examples.push("120jt");
      if (missingFields.includes("model")) examples.push("Brio");

      askMessage += `"${examples.join(" ")}"\n\n`;
      askMessage += `Bebas mau format gimana, yang penting lengkap ya! 👍`;
    }

    return { missingFields, askMessage, hasMinimumData };
  }

  /**
   * Merge partial vehicle data with new data
   */
  private static mergeVehicleData(existingData: any, newData: any): any {
    return {
      make: newData?.make || existingData?.make,
      model: newData?.model || existingData?.model,
      year: newData?.year || existingData?.year,
      price: newData?.price || existingData?.price,
      mileage: newData?.mileage ?? existingData?.mileage ?? undefined,
      color: (newData?.color && newData?.color !== "Unknown") ? newData.color :
        (existingData?.color && existingData?.color !== "Unknown") ? existingData.color : "Unknown",
      transmission: (newData?.transmission && newData?.transmission !== "Unknown") ? newData.transmission :
        (existingData?.transmission && existingData?.transmission !== "Unknown") ? existingData.transmission : "Manual",
    };
  }

  /**
   * Handle vehicle upload with REQUIRED photo and COMPLETE data
   * Multi-step flow:
   * 1. /upload → Ask for photo
   * 2. Photo sent → Store in context, ask for data
   * 3. Data sent → Check completeness, ask for missing fields if needed
   * 4. User completes data → Merge and check again
   * 5. All data complete + photo → Create vehicle
   */
  private static async handleUploadVehicle(
    params: Record<string, any>,
    tenantId: string,
    staffPhone: string,
    mediaUrl?: string,
    conversationId?: string
  ): Promise<CommandExecutionResult> {
    if (!conversationId) {
      return {
        success: false,
        message: "❌ Error: Conversation ID tidak ditemukan. Coba lagi dengan /upload",
      };
    }

    // Get current conversation context
    const conversation = await prisma.whatsAppConversation.findUnique({
      where: { id: conversationId },
    });

    const contextData = (conversation?.contextData as any) || {};

    // === Handle "awaiting_completion" state - user is completing missing data ===
    if (contextData.uploadStep === "awaiting_completion") {
      console.log(`[Upload Flow] User completing missing data...`);

      const existingData = contextData.vehicleData || {};
      const photos = contextData.photos || [];

      // If photo sent while completing data, add to photos
      if (mediaUrl) {
        photos.push(mediaUrl);
      }

      // Merge existing data with new params
      const mergedData = this.mergeVehicleData(existingData, params);
      console.log(`[Upload Flow] Merged data:`, mergedData);

      // Check if data is now complete
      const { missingFields, askMessage, hasMinimumData } = this.checkMissingFields(mergedData);

      if (!hasMinimumData) {
        // Still missing required fields - ask again
        await prisma.whatsAppConversation.update({
          where: { id: conversationId },
          data: {
            contextData: {
              ...contextData,
              uploadStep: "awaiting_completion",
              vehicleData: mergedData,
              photos,
            },
          },
        });

        return {
          success: true,
          message: askMessage,
        };
      }

      // Minimum data complete - check photos (need minimum 6)
      const MIN_PHOTOS_NEEDED = 1; // Reduced from 6 to prevent stuck loops
      if (photos.length < MIN_PHOTOS_NEEDED) {
        await prisma.whatsAppConversation.update({
          where: { id: conversationId },
          data: {
            contextData: {
              ...contextData,
              uploadStep: "has_data_awaiting_photo",
              vehicleData: mergedData,
              photos,
            },
          },
        });

        const photosRemaining = MIN_PHOTOS_NEEDED - photos.length;

        // Build message with data summary and photo requirements
        let message = `Mantap! Data udah oke nih 👍\n\n` +
          `🚗 ${mergedData.make} ${mergedData.model} ${mergedData.year}\n` +
          `💰 ${this.formatPrice(mergedData.price)}\n\n`;

        if (missingFields.length > 0) {
          message += `Opsional: ${missingFields.join(", ")}\n\n`;
        }

        if (photos.length > 0) {
          message += `📷 Foto: ${photos.length}/6 (kurang ${photosRemaining} lagi)\n\n`;
        }

        message += `Tinggal kirim ${photosRemaining} foto lagi ya!\n` +
          `• Depan, belakang, samping\n` +
          `• Dashboard, jok, bagasi`;

        return {
          success: true,
          message,
        };
      }

      // Data and photos complete! Create vehicle
      console.log(`[Upload Flow] ✅ All data + ${photos.length} photos complete! Creating vehicle...`);
      return await this.createVehicleWithPhotos(
        mergedData,
        photos,
        tenantId,
        staffPhone,
        conversationId
      );
    }

    // === STEP 1: Initialize upload flow ===
    if (params.step === "init") {
      // Check if there are recent photos in the conversation (last 10 minutes)
      // This handles the case where staff sends photos BEFORE saying "mau upload"
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

      // IMPROVED: Search for photos more broadly - check mediaUrl OR mediaType
      // Sometimes mediaType might not be set even when mediaUrl exists
      const recentPhotos = await prisma.whatsAppMessage.findMany({
        where: {
          conversationId,
          direction: "inbound",
          createdAt: { gte: tenMinutesAgo },
          OR: [
            { mediaType: "image" },
            { mediaType: { contains: "image" } },
            { mediaUrl: { not: null } },
            { mediaUrl: { not: "" } },
          ],
        },
        orderBy: { createdAt: "asc" },
        select: { mediaUrl: true, mediaType: true, content: true },
      });

      console.log(`[Upload Flow] Found ${recentPhotos.length} potential photo messages`);
      console.log(`[Upload Flow] Photo messages:`, recentPhotos.map(p => ({
        hasMediaUrl: !!p.mediaUrl,
        mediaType: p.mediaType,
        contentPreview: p.content?.substring(0, 30),
      })));

      const existingPhotos = recentPhotos
        .filter(m => m.mediaUrl && m.mediaUrl.startsWith('http'))
        .map(m => m.mediaUrl as string);

      console.log(`[Upload Flow] Found ${existingPhotos.length} valid photo URLs to include`);

      await prisma.whatsAppConversation.update({
        where: { id: conversationId },
        data: {
          conversationState: "upload_vehicle",
          contextData: {
            uploadStep: existingPhotos.length > 0 ? "has_photo_awaiting_data" : "awaiting_photo",
            photos: existingPhotos,
            vehicleData: null,
          },
        },
      });

      // Build response based on whether we already have photos
      if (existingPhotos.length > 0) {
        const MIN_PHOTOS = 1; // Reduced from 6 to prevent stuck loops
        const photosNeeded = Math.max(0, MIN_PHOTOS - existingPhotos.length);

        let message = `Oke siap upload! 📸\n\n`;
        message += `✅ Foto ${existingPhotos.length}/6 udah masuk!\n\n`;

        if (photosNeeded > 0) {
          message += `Kirim ${photosNeeded} foto lagi ya:\n`;
          message += `• Depan, belakang, samping\n`;
          message += `• Dashboard, jok, bagasi\n\n`;
        } else {
          message += `Foto udah cukup! ✅\n\n`;
        }

        message += `Sekarang ketik info mobilnya:\n`;
        message += `Contoh: "Brio 2020 120jt hitam matic km 30rb"`;

        return { success: true, message };
      }

      return {
        success: true,
        message:
          `Oke siap upload! 📸\n\n` +
          `Caranya gampang:\n\n` +
          `1️⃣ Kirim 6 foto\n` +
          `   • Depan, belakang, samping\n` +
          `   • Dashboard, jok, bagasi\n\n` +
          `2️⃣ Ketik info mobilnya\n` +
          `   Contoh: "Brio 2020 120jt hitam matic km 30rb"\n\n` +
          `Langsung kirim aja fotonya! 👇`,
      };
    }

    // === STEP 1b: Photo sent without caption ===
    const MIN_PHOTOS = 1;  // Reduced from 6 to prevent stuck loops - can add more via dashboard
    const MAX_PHOTOS = 15;

    // Handle case where photo was detected but not downloadable
    if (params.step === "photo_only" && !mediaUrl) {
      console.log(`[Upload Flow] ⚠️ Photo detected but no mediaUrl available`);
      return {
        success: true,
        message: `📸 Foto diterima tapi belum bisa diproses.\n\nCoba kirim ulang fotonya ya! 🙏`,
      };
    }

    if (params.step === "photo_only" && mediaUrl) {
      console.log(`[Upload Flow] Photo only received (no caption): ${mediaUrl}`);

      const photos = contextData.photos || [];
      const lastNotifiedPhotoCount = contextData.lastNotifiedPhotoCount || 0;

      // Check max photos limit
      if (photos.length >= MAX_PHOTOS) {
        return {
          success: false,
          message: `Udah cukup ${MAX_PHOTOS} foto kak 📷 Sekarang ketik aja info mobilnya~`,
        };
      }

      photos.push(mediaUrl);

      // === BATCHING LOGIC: Only notify at milestones ===
      // Notify: first photo (1), complete (>=6), or every 3 photos
      const shouldNotify =
        photos.length === 1 || // First photo
        photos.length >= MIN_PHOTOS || // Photos complete (6+)
        photos.length - lastNotifiedPhotoCount >= 3; // Every 3 photos

      if (!shouldNotify) {
        // Silently save photo without notification
        await prisma.whatsAppConversation.update({
          where: { id: conversationId },
          data: {
            conversationState: "upload_vehicle",
            contextData: {
              ...contextData,
              photos,
              // Keep existing lastNotifiedPhotoCount
            },
          },
        });
        console.log(`[Upload Flow] Photo ${photos.length} saved silently (no notification)`);
        return {
          success: true,
          message: "",
          skipResponse: true,
        };
      }

      // Update lastNotifiedPhotoCount for milestone notifications
      const updatedContextForNotify = {
        ...contextData,
        photos,
        lastNotifiedPhotoCount: photos.length,
      };

      // === FIX: Check if vehicleData already exists in context ===
      const existingVehicleData = contextData.vehicleData;
      if (existingVehicleData) {
        console.log(`[Upload Flow] Found existing vehicleData in context, checking if complete...`);
        const { hasMinimumData, askMessage } = this.checkMissingFields(existingVehicleData);

        if (hasMinimumData && photos.length >= MIN_PHOTOS) {
          // We have complete data + enough photos! Create vehicle now
          console.log(`[Upload Flow] ✅ Complete data + ${photos.length} photos! Creating vehicle...`);
          return await this.createVehicleWithPhotos(
            existingVehicleData,
            photos,
            tenantId,
            staffPhone,
            conversationId
          );
        }

        // Has data but need more photos or data incomplete
        const photoRemainingForData = MIN_PHOTOS - photos.length;
        if (hasMinimumData && photoRemainingForData > 0) {
          // Data complete, just need more photos
          await prisma.whatsAppConversation.update({
            where: { id: conversationId },
            data: {
              conversationState: "upload_vehicle",
              contextData: {
                ...updatedContextForNotify,
                uploadStep: "has_data_awaiting_photo",
                vehicleData: existingVehicleData,
              },
            },
          });

          return {
            success: true,
            message:
              `Oke foto ${photos.length}/6 masuk! 📸\n\n` +
              `Data ${existingVehicleData.make || ''} ${existingVehicleData.model || ''} ${existingVehicleData.year || ''} udah lengkap ✅\n\n` +
              `Kirim ${photoRemainingForData} foto lagi ya:\n` +
              `• Depan, belakang, samping\n` +
              `• Dashboard, jok, bagasi`,
          };
        }

        // Data exists but incomplete - update context and ask for missing data
        await prisma.whatsAppConversation.update({
          where: { id: conversationId },
          data: {
            conversationState: "upload_vehicle",
            contextData: {
              ...updatedContextForNotify,
              uploadStep: "awaiting_completion",
              vehicleData: existingVehicleData,
            },
          },
        });

        return {
          success: true,
          message: `Oke foto ${photos.length}/6 masuk! 📸\n\n${askMessage}`,
        };
      }
      // === END FIX ===

      await prisma.whatsAppConversation.update({
        where: { id: conversationId },
        data: {
          conversationState: "upload_vehicle",
          contextData: {
            ...updatedContextForNotify,
            uploadStep: "has_photo_awaiting_data",
          },
        },
      });

      // Build photo guidance message
      const photoRemaining = MIN_PHOTOS - photos.length;
      let photoGuide = "";
      if (photoRemaining > 0) {
        photoGuide = `\nKirim ${photoRemaining} foto lagi ya~\n` +
          `• Depan, belakang, samping\n` +
          `• Dashboard, jok, bagasi\n`;
      } else {
        photoGuide = "\nFoto udah cukup nih! ✅\n";
      }

      return {
        success: true,
        message:
          `Oke foto ${photos.length}/6 masuk! 📸` +
          photoGuide +
          `\nSekarang ketik info mobilnya:\n` +
          `Contoh: "Brio 2020 120jt hitam matic km 30rb"`,
      };
    }

    // === STEP 2: Handle incoming photo ===
    if (mediaUrl) {
      console.log(`[Upload Flow] Photo received: ${mediaUrl}`);

      const photos = contextData.photos || [];
      const lastNotifiedPhotoCount = contextData.lastNotifiedPhotoCount || 0;

      // Check max photos limit
      if (photos.length >= MAX_PHOTOS) {
        return {
          success: false,
          message: `❌ Maksimal ${MAX_PHOTOS} foto per kendaraan. Kirim detail mobil untuk melanjutkan upload.`,
        };
      }

      photos.push(mediaUrl);

      // Determine if we should send notification
      // Only notify at milestones: first photo (1), complete (>=6), or every 3 photos
      const shouldNotify =
        photos.length === 1 || // First photo
        photos.length >= MIN_PHOTOS || // Photos complete
        photos.length - lastNotifiedPhotoCount >= 3; // Every 3 photos

      if (!shouldNotify) {
        // Silently save photo without notification
        await prisma.whatsAppConversation.update({
          where: { id: conversationId },
          data: {
            conversationState: "upload_vehicle",
            contextData: {
              ...contextData,
              photos,
              // Don't update lastNotifiedPhotoCount - keep old value
            },
          },
        });
        console.log(`[Upload Flow] Photo ${photos.length} saved silently (no notification)`);
        return {
          success: true,
          message: "", // Empty message = no response sent
          skipResponse: true, // Flag to skip sending response
        };
      }

      // Update lastNotifiedPhotoCount for milestone notifications
      const updatedContext = {
        ...contextData,
        photos,
        lastNotifiedPhotoCount: photos.length,
      };

      // Check if we already have vehicle data from context OR from current params
      // This handles: /upload Brio 2015 KM 30.000 Rp 120JT + photo in same message
      const { make, model, year, price, mileage, color, transmission } = params;

      // Merge any incoming data with existing context data
      const existingData = updatedContext.vehicleData || {};
      const incomingData = { make, model, year, price, mileage, color, transmission };
      const mergedData = this.mergeVehicleData(existingData, incomingData);

      // Check if data is complete
      const { missingFields, askMessage, hasMinimumData } = this.checkMissingFields(mergedData);

      if (hasMinimumData) {
        // Check if we have enough photos (minimum 6)
        if (photos.length < MIN_PHOTOS) {
          // Data complete but need more photos
          await prisma.whatsAppConversation.update({
            where: { id: conversationId },
            data: {
              conversationState: "upload_vehicle",
              contextData: {
                ...updatedContext,
                uploadStep: "has_data_awaiting_photo",
                vehicleData: mergedData,
              },
            },
          });

          const photoRemaining = MIN_PHOTOS - photos.length;
          return {
            success: true,
            message:
              `Nice! Foto ${photos.length}/6 + data lengkap! 👍\n\n` +
              `Tinggal kirim ${photoRemaining} foto lagi:\n` +
              `• Depan, belakang, samping\n` +
              `• Dashboard, jok, bagasi`,
          };
        }

        // We have complete data + enough photos! Create vehicle now
        const vehicleData = {
          make: mergedData.make,
          model: mergedData.model,
          year: mergedData.year,
          price: mergedData.price,
          mileage: mergedData.mileage || undefined, // Keep undefined if not provided
          color: mergedData.color || "Unknown",
          transmission: mergedData.transmission || "Manual",
        };

        console.log(`[Upload Flow] ✅ Complete Data + ${photos.length} photos! Creating vehicle...`);
        console.log(`[Upload Flow] Vehicle data:`, vehicleData);
        return await this.createVehicleWithPhotos(
          vehicleData,
          photos,
          tenantId,
          staffPhone,
          conversationId
        );
      }

      // Has some data but not complete - store and ask for more
      if (mergedData.make || mergedData.model || mergedData.year || mergedData.price) {
        console.log(`[Upload Flow] Photo received with partial data. Asking for completion...`);

        await prisma.whatsAppConversation.update({
          where: { id: conversationId },
          data: {
            conversationState: "upload_vehicle",
            contextData: {
              ...contextData,
              uploadStep: "awaiting_completion",
              vehicleData: mergedData,
              photos,
            },
          },
        });

        // Build response showing what we received and what's missing
        const photoRemaining = MIN_PHOTOS - photos.length;
        let receivedInfo = `Oke foto ${photos.length}/6 masuk!`;
        if (photoRemaining > 0) {
          receivedInfo += ` (kurang ${photoRemaining})\n\n`;
        } else {
          receivedInfo += ` ✅\n\n`;
        }
        if (mergedData.make) receivedInfo += `✓ ${mergedData.make}\n`;
        if (mergedData.model) receivedInfo += `✓ ${mergedData.model}\n`;
        if (mergedData.year) receivedInfo += `✓ ${mergedData.year}\n`;
        if (mergedData.price) receivedInfo += `✓ ${this.formatPrice(mergedData.price)}\n`;

        return {
          success: true,
          message: receivedInfo + "\n" + askMessage,
        };
      }

      // We have photo but no data yet
      await prisma.whatsAppConversation.update({
        where: { id: conversationId },
        data: {
          conversationState: "upload_vehicle", // IMPORTANT: Keep state for multi-step flow
          contextData: {
            ...contextData,
            uploadStep: "has_photo_awaiting_data",
            photos,
          },
        },
      });

      // Build photo status message
      const photoRemaining = MIN_PHOTOS - photos.length;
      let photoStatus = `Oke foto ${photos.length}/6 masuk! 📸`;
      if (photoRemaining > 0) {
        photoStatus += `\nKirim ${photoRemaining} foto lagi ya~\n` +
          `• Depan, belakang, samping\n` +
          `• Dashboard, jok, bagasi\n`;
      } else {
        photoStatus += ` Foto cukup! ✅\n`;
      }

      return {
        success: true,
        message:
          photoStatus +
          `\nSekarang ketik info mobilnya:\n` +
          `Contoh: "Brio 2020 120jt hitam matic km 30rb"`,
      };
    }

    // === STEP 3: Handle incoming vehicle data ===
    const { make, model, year, price, mileage, color, transmission } = params;

    // Build partial vehicle data from params
    const partialData = {
      make,
      model,
      year,
      price,
      mileage: mileage ?? undefined,
      color: color || undefined,
      transmission: transmission || undefined,
    };

    // Merge with existing data from context (if any)
    const existingData = contextData.vehicleData || {};
    const mergedData = this.mergeVehicleData(existingData, partialData);

    console.log(`[Upload Flow] Step 3 - Merged vehicle data:`, mergedData);

    // IMPORTANT FIX: When receiving vehicle data, also check for recent photos in DB
    // This handles the case where photos were sent WITH caption but mediaUrl wasn't captured
    // Or photos came as separate webhook calls before the data message
    let photos = contextData.photos || [];

    if (photos.length === 0) {
      console.log(`[Upload Flow] No photos in context, checking DB for recent photos...`);
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
      const recentPhotoMessages = await prisma.whatsAppMessage.findMany({
        where: {
          conversationId,
          direction: "inbound",
          createdAt: { gte: tenMinutesAgo },
          OR: [
            { mediaType: "image" },
            { mediaType: { contains: "image" } },
            { mediaUrl: { not: null } },
          ],
        },
        orderBy: { createdAt: "asc" },
        select: { mediaUrl: true },
      });

      const foundPhotos = recentPhotoMessages
        .filter(m => m.mediaUrl && m.mediaUrl.startsWith('http'))
        .map(m => m.mediaUrl as string);

      if (foundPhotos.length > 0) {
        console.log(`[Upload Flow] ✅ Found ${foundPhotos.length} photos from DB!`);
        photos = foundPhotos;

        // Update context with found photos
        await prisma.whatsAppConversation.update({
          where: { id: conversationId },
          data: {
            contextData: {
              ...contextData,
              photos,
            },
          },
        });
      } else {
        console.log(`[Upload Flow] No photos found in DB either`);
      }
    }

    // Check what's missing
    const { missingFields, askMessage, hasMinimumData } = this.checkMissingFields(mergedData);

    // Photos already retrieved above (including DB fallback)
    console.log(`[Upload Flow] Current photos count: ${photos.length}`);

    // Validate data integrity for fields that exist
    if (mergedData.year) {
      const currentYear = new Date().getFullYear();
      if (mergedData.year < 1980 || mergedData.year > currentYear + 1) {
        return {
          success: false,
          message: `Mohon maaf, tahun kendaraan tidak valid.\nTahun harus antara 1980-${currentYear + 1}.`,
        };
      }
    }

    if (mergedData.price) {
      if (mergedData.price <= 0 || mergedData.price > 100000000000) {
        return {
          success: false,
          message: "Harganya kayaknya salah deh 🤔\nCek lagi ya, harus di range 0-100 miliar",
        };
      }
    }

    if (mergedData.mileage && (mergedData.mileage < 0 || mergedData.mileage > 1000000)) {
      return {
        success: false,
        message: "KM nya kayaknya salah deh 🤔\nHarus antara 0-1.000.000 km ya",
      };
    }

    // If minimum data not complete, ask user to complete it
    if (!hasMinimumData) {
      console.log(`[Upload Flow] Data incomplete. Missing: ${missingFields.join(", ")}`);

      await prisma.whatsAppConversation.update({
        where: { id: conversationId },
        data: {
          conversationState: "upload_vehicle",
          contextData: {
            ...contextData,
            uploadStep: "awaiting_completion",
            vehicleData: mergedData,
            photos,
          },
        },
      });

      // Build response showing what we received and what's missing
      let receivedInfo = "";
      if (mergedData.make) receivedInfo += `✓ Merk: ${mergedData.make}\n`;
      if (mergedData.model) receivedInfo += `✓ Model: ${mergedData.model}\n`;
      if (mergedData.year) receivedInfo += `✓ Tahun: ${mergedData.year}\n`;
      if (mergedData.price) receivedInfo += `✓ Harga: Rp ${this.formatPrice(mergedData.price)}\n`;
      if (mergedData.mileage) receivedInfo += `✓ KM: ${this.formatNumber(mergedData.mileage)}\n`;
      if (mergedData.color && mergedData.color !== "Unknown") receivedInfo += `✓ Warna: ${mergedData.color}\n`;
      if (mergedData.transmission && mergedData.transmission !== "Unknown") receivedInfo += `✓ Transmisi: ${mergedData.transmission}\n`;

      let message = "";
      if (receivedInfo) {
        message = `Oke dapet nih:\n${receivedInfo}\n`;
      }
      message += askMessage;

      return {
        success: true,
        message,
      };
    }

    // Minimum data is complete!
    const vehicleData = {
      make: mergedData.make,
      model: mergedData.model,
      year: mergedData.year,
      price: mergedData.price,
      mileage: mergedData.mileage || undefined, // Keep undefined if not provided
      color: mergedData.color || "Unknown",
      transmission: mergedData.transmission || "Manual",
    };

    // Check if we have enough photos (minimum 1)
    const MIN_PHOTOS_REQ = 1; // Reduced from 6 to prevent stuck loops

    // Track photo request attempts to prevent infinite loops
    const photoRequestAttempts = (contextData.photoRequestAttempts || 0) + 1;
    console.log(`[Upload Flow] Photo request attempt: ${photoRequestAttempts}, photos: ${photos.length}`);

    // FORCE CREATE if:
    // 1. At least 1 photo, OR
    // 2. Already asked for photos 2+ times (prevent stuck loop)
    if (photos.length >= MIN_PHOTOS_REQ || photoRequestAttempts >= 2) {
      if (photos.length === 0) {
        console.log(`[Upload Flow] ⚠️ No photos after ${photoRequestAttempts} attempts. Creating vehicle without photos - add via dashboard`);
      } else {
        console.log(`[Upload Flow] Complete data + ${photos.length} photos. Creating vehicle...`);
      }

      return await this.createVehicleWithPhotos(
        vehicleData,
        photos,
        tenantId,
        staffPhone,
        conversationId
      );
    }

    // We have complete data but need photos - first time asking
    await prisma.whatsAppConversation.update({
      where: { id: conversationId },
      data: {
        conversationState: "upload_vehicle",
        contextData: {
          ...contextData,
          uploadStep: "has_data_awaiting_photo",
          vehicleData,
          photos,
          photoRequestAttempts, // Track attempts to prevent loop
        },
      },
    });

    // Build summary of optional fields still missing
    let optionalMissing = "";
    if (missingFields.length > 0) {
      optionalMissing = `ℹ️ Opsional: ${missingFields.join(", ")}\n\n`;
    }

    // Calculate photos needed
    const photosNeeded = MIN_PHOTOS_REQ - photos.length;
    const photoStatus = photos.length > 0
      ? `📷 Foto: ${photos.length}/${MIN_PHOTOS_REQ} (perlu ${photosNeeded} lagi)\n\n`
      : "";

    // Only show KM if it's provided and > 0
    const kmInfo = vehicleData.mileage && vehicleData.mileage > 0
      ? `📍 ${this.formatNumber(vehicleData.mileage)} km\n`
      : "";

    return {
      success: true,
      message:
        `Oke data masuk! 👍\n\n` +
        `🚗 ${vehicleData.make} ${vehicleData.model} ${vehicleData.year}\n` +
        `💰 Rp ${this.formatPrice(vehicleData.price)}\n` +
        `🔧 ${vehicleData.transmission} | 🎨 ${vehicleData.color}\n` +
        kmInfo +
        `\n` +
        optionalMissing +
        photoStatus +
        `Tinggal kirim ${photosNeeded > 0 ? photosNeeded : MIN_PHOTOS_REQ} foto ya:\n` +
        `• Depan, belakang, samping\n` +
        `• Dashboard, jok, bagasi`,
    };
  }

  /**
   * Create vehicle with photos after both data and photos are collected
   * Uses AI-powered upload service to get SEO description
   */
  private static async createVehicleWithPhotos(
    vehicleData: any,
    photos: string[],
    tenantId: string,
    staffPhone: string,
    conversationId: string
  ): Promise<CommandExecutionResult> {
    const { make, model, year, price, mileage, color, transmission } = vehicleData;

    console.log(`[Upload Flow] Creating vehicle with ${photos.length} photos using AI service...`);

    // Use WhatsApp Vehicle Upload Service (AI-powered with SEO description)
    const uploadResult = await WhatsAppVehicleUploadService.createVehicle(
      {
        make,
        model,
        year,
        price,
        mileage,
        color,
        transmission,
      },
      photos,
      tenantId,
      staffPhone
    );

    if (!uploadResult.success) {
      return {
        success: false,
        message: uploadResult.message,
      };
    }

    console.log(`[Upload Flow] ✅ Vehicle created successfully: ${uploadResult.vehicleId}`);

    // Check if vehicle was created WITHOUT photos
    // If so, keep state for adding photos later
    if (photos.length === 0) {
      console.log(`[Upload Flow] 📷 Vehicle created without photos, setting state for photo addition`);
      await prisma.whatsAppConversation.update({
        where: { id: conversationId },
        data: {
          conversationState: "add_photo_to_vehicle",
          contextData: {
            vehicleId: uploadResult.vehicleId,
            vehicleName: `${vehicleData.make} ${vehicleData.model} ${vehicleData.year}`,
            photosAdded: 0,
            // Store lastUploadedVehicleId for edit feature
            lastUploadedVehicleId: uploadResult.vehicleId,
            lastUploadedAt: new Date().toISOString(),
          },
        },
      });
    } else {
      // Clear conversation state after successful upload with photos
      // Keep lastUploadedVehicleId for edit feature
      await prisma.whatsAppConversation.update({
        where: { id: conversationId },
        data: {
          conversationState: null,
          contextData: {
            lastUploadedVehicleId: uploadResult.vehicleId,
            lastUploadedAt: new Date().toISOString(),
          },
        },
      });
    }

    // Add link to dashboard in message
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://primamobil.id';
    const vehicleUrl = `${baseUrl}/dashboard/vehicles/${uploadResult.vehicleId}`;

    // Build final message
    let finalMessage = uploadResult.message + `\n\n🔗 *Link:*\n${vehicleUrl}`;

    // If no photos, add prompt to send photos now
    if (photos.length === 0) {
      finalMessage += `\n\n📸 *Kirim foto sekarang* untuk ditambahkan ke kendaraan ini.\nKetik "selesai" jika sudah cukup.`;
    }

    return {
      success: true,
      message: finalMessage,
      vehicleId: uploadResult.vehicleId,
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
        message: `Kendaraan tidak ditemukan.\nID: ${vehicleId}\n\nMohon periksa kembali ID kendaraan.`,
      };
    }

    // FIX: Validate status against allowed values before update
    const validStatuses = ["AVAILABLE", "BOOKED", "SOLD", "DELETED"];
    if (!validStatuses.includes(status)) {
      return {
        success: false,
        message: `Status "${status}" ga valid kak 🤔\n\nPilihan: AVAILABLE, BOOKED, SOLD, DELETED`,
      };
    }

    // Update status with proper typing
    const updated = await prisma.vehicle.update({
      where: { id: vehicle.id },
      data: { status: status as "AVAILABLE" | "BOOKED" | "SOLD" | "DELETED" },
    });

    // Log history
    await prisma.vehicleHistory.create({
      data: {
        vehicleId: vehicle.id,
        tenantId,
        version: 1, // Increment this in production
        action: "STATUS_UPDATE",
        snapshot: {}, // Full vehicle snapshot would go here
        changedFields: ["status"],
        previousValues: { status: vehicle.status },
        newValues: { status },
        changedBy: staffPhone,
      },
    });

    return {
      success: true,
      message: `Siap! Status ${vehicle.make} ${vehicle.model} udah diupdate ke ${status} ✅`,
      vehicleId: vehicle.id,
    };
  }

  /**
   * Handle staff greeting - show welcome menu with config-based welcome message
   */
  private static async handleStaffGreeting(
    tenantId: string,
    staffPhone: string
  ): Promise<CommandExecutionResult> {
    // Get staff name
    const normalizedPhone = this.normalizePhone(staffPhone);
    const staff = await prisma.user.findFirst({
      where: { tenantId },
      select: { firstName: true, phone: true },
    });

    let staffName = "Bapak/Ibu";
    if (staff) {
      // Find the matching staff by normalized phone
      const users = await prisma.user.findMany({
        where: { tenantId },
        select: { firstName: true, phone: true },
      });

      for (const user of users) {
        if (user.phone && this.normalizePhone(user.phone) === normalizedPhone) {
          staffName = user.firstName || "Bapak/Ibu";
          break;
        }
      }
    }

    // Get AI config for welcome message
    const aimeowAccount = await prisma.aimeowAccount.findUnique({
      where: { tenantId },
      include: {
        aiConfig: true,
        tenant: true,
      },
    });

    // Get quick stats
    const availableCount = await prisma.vehicle.count({
      where: { tenantId, status: "AVAILABLE" },
    });

    // Build greeting from config or use default professional greeting
    let greeting = "";
    const tenantName = aimeowAccount?.tenant?.name || "Showroom";

    // Get time-based greeting (Selamat pagi/siang/sore/malam)
    const timeGreeting = getTimeBasedGreeting();

    if (aimeowAccount?.aiConfig?.welcomeMessage) {
      // Use welcome message from config, replace placeholders
      // Supported placeholders: {greeting}, {name}, {tenant}, {showroom}
      greeting = aimeowAccount.aiConfig.welcomeMessage
        .replace(/\{greeting\}/gi, timeGreeting)
        .replace(/\{name\}/gi, staffName)
        .replace(/\{tenant\}/gi, tenantName)
        .replace(/\{showroom\}/gi, tenantName);
    } else {
      // Default professional greeting with time-based salam
      greeting = `${timeGreeting}, ${staffName}! Selamat datang di ${tenantName}!`;
    }

    // Build professional staff menu - following premium template
    const message =
      `${timeGreeting}, Halo!\n\n` +
      `Selamat datang di showroom kami\n` +
      `Saya adalah Asisten virtual yang siap membantu Anda menemukan mobil impian, dan mendapatkan informasi yang Anda butuhkan.\n\n` +
      `Ada yang bisa kami bantu?\n\n` +
      `Saat ini terdapat ${availableCount} unit kendaraan tersedia di ${tenantName}.\n\n` +
      `Layanan yang tersedia:\n\n` +
      `📸 Upload Kendaraan Baru\n` +
      `   Ketik: upload\n` +
      `   Lalu kirim foto + info mobil\n` +
      `   Contoh: "upload Brio 2020 120jt hitam matic km 30rb"\n\n` +
      `📋 Cek Stok Kendaraan\n` +
      `   Ketik: inventory atau stok\n` +
      `   Filter: inventory AVAILABLE\n\n` +
      `📊 Lihat Statistik\n` +
      `   Ketik: stats atau laporan\n` +
      `   Period: stats today / stats week / stats month\n\n` +
      `🔄 Update Status Kendaraan\n` +
      `   Ketik: status [ID] [STATUS]\n` +
      `   Contoh: status PM-PST-001 SOLD\n\n` +
      `🚙 Edit Kendaraan\n` +
      `   Ketik: Edit/ Ubah/ Rubah/ Ganti [ID] [Detail kendaraan/ informasi dasar/ harga]\n` +
      `   Contoh: Ganti PM-PST-001 Hybrid / Ubah PM-PST-001 AT / Edit PM-PST-001 85000 km\n\n` +
      `👮‍♂️ *MENU ADMIN & OWNER (REPORTS)*\n` +
      `Laporan Managemen real-time via WhatsApp (Info & Link):\n` +
      `✅ *Sales*: "Total Penjualan", "Total Revenue", "Tren Penjualan", "Metrik Penjualan"\n` +
      `✅ *Inventory*: "Total Inventory", "Daftar Kendaraan", "Peringatan Stok Tipis", "Rata-rata Harga"\n` +
      `✅ *Performance*: "Staff Performance", "Penjualan 7 Hari"\n` +
      `✅ *AI*: "Performa Bot", "Analisis Pelanggan", "Efisiensi Chat"\n\n` +
      `Silakan ketik perintah yang diinginkan. Kami siap membantu!`;

    return {
      success: true,
      message,
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
      if (["AVAILABLE", "BOOKED", "SOLD", "DELETED"].includes(upperFilter)) {
        whereClause.status = upperFilter;
      } else {
        // Filter by make - also exclude DELETED by default
        whereClause.make = { contains: filter, mode: "insensitive" as const };
        whereClause.status = { not: "DELETED" };
      }
    } else {
      // By default, exclude DELETED vehicles from inventory list
      whereClause.status = { not: "DELETED" };
    }

    const vehicles = await prisma.vehicle.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    if (vehicles.length === 0) {
      return {
        success: true,
        message: filter
          ? `Tidak ditemukan kendaraan untuk filter "${filter}".`
          : `Belum ada kendaraan dalam stok.`,
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

    let message = `📋 *DAFTAR STOK KENDARAAN*\n`;
    if (filter) message += `Filter: "${filter}"\n`;
    message += `Total: ${vehicles.length} unit\n\n`;

    vehicles.forEach((v, idx) => {
      const statusEmoji = v.status === "AVAILABLE" ? "✅" : v.status === "BOOKED" ? "🔒" : "💰";
      message += `${idx + 1}. *${v.make} ${v.model} ${v.year}*\n`;
      message += `   ID: \`${v.displayId || v.id.slice(-6)}\`\n`;
      message += `   Status: ${statusEmoji} ${v.status} | Rp ${this.formatPrice(Number(v.price), true)}\n\n`;
    });

    if (vehicles.length === 20) {
      message += `_Menampilkan 20 unit terbaru..._\n`;
    }

    message += `Ketik \`status [ID] SOLD\` untuk update status.\n`;
    message += `Apakah ada hal lain yang bisa kami bantu?`;

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
      prisma.vehicle.count({ where: { tenantId, status: { not: "DELETED" } } }),
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
      where: { tenantId, status: { not: "DELETED" } },
      _count: true,
    });

    const periodLabel = period === "today" ? "Hari Ini" : period === "week" ? "Minggu Ini" : "Bulan Ini";
    let message = `📈 *LAPORAN STATISTIK SHOWROOM*\n`;
    message += `Periode: ${periodLabel}\n\n`;

    message += `🚗 *UNIT KENDARAAN*\n`;
    message += `Total Stock: ${totalVehicles} unit\n`;
    message += `Unit Baru: +${newVehicles} unit\n\n`;

    message += `*Ringkasan Status:*\n`;
    vehiclesByStatus.forEach((s) => {
      const emoji = s.status === "AVAILABLE" ? "✅" : s.status === "BOOKED" ? "🔒" : s.status === "SOLD" ? "💰" : "🗑️";
      message += `${emoji} ${s.status}: ${s._count} unit\n`;
    });

    message += `\n👥 *LEADS & CUSTOMER*\n`;
    message += `Total Leads: ${totalLeads}\n`;
    message += `Leads Baru: +${newLeads} 🔥\n\n`;

    message += `Untuk laporan detail dalam format PDF, silakan ketik: "sales report pdf" atau "inventory report pdf".`;

    return {
      success: true,
      message,
    };
  }

  // ==================== HELPER METHODS ====================

  /**
   * Normalize phone number for comparison
   * Handles various formats: +62xxx, 62xxx, 0xxx, 08xxx
   */
  private static normalizePhone(phone: string): string {
    if (!phone) return "";
    // Remove all non-digit characters
    let digits = phone.replace(/\D/g, "");
    // Convert Indonesian formats to standard 62xxx
    if (digits.startsWith("0")) {
      digits = "62" + digits.substring(1);
    }
    return digits;
  }

  /**
   * Verify staff authorization
   * All users in the tenant can access WhatsApp AI commands
   * Uses normalized phone comparison for flexible matching
   */
  private static async verifyStaffAuthorization(
    tenantId: string,
    staffPhone: string,
    intent: MessageIntent
  ): Promise<boolean> {
    const normalizedInput = this.normalizePhone(staffPhone);
    console.log(`[Staff Command] Verifying authorization - input: ${staffPhone}, normalized: ${normalizedInput}`);

    // Get users by phone match (either in tenant OR platform/super admin)
    const users = await prisma.user.findMany({
      where: {
        AND: [
          { phone: { not: null } },
          {
            OR: [
              { tenantId },
              { tenantId: null } // Platform Admin / Super Admin
            ]
          }
        ]
      },
      select: { id: true, phone: true, firstName: true, role: true },
    });

    for (const user of users) {
      if (!user.phone) continue;
      const normalizedUserPhone = this.normalizePhone(user.phone);
      if (normalizedInput === normalizedUserPhone) {
        console.log(`[Staff Command] ✅ Authorization granted for: ${user.firstName}`);
        return true;
      }
    }

    console.log(`[Staff Command] ❌ No matching user found for phone: ${staffPhone}`);
    return false;
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
   * Format price in rupiah to Indonesian format
   * @param price - The price value
   * @param fromDatabase - If true, price is in cents (from DB). If false, price is in full IDR (from user input)
   *
   * Note: Database stores prices in IDR cents (Rp 250jt = 25000000000)
   * But during upload flow, price is still in full IDR (e.g., 135000000 for 135 juta)
   */
  private static formatPrice(price: number, fromDatabase: boolean = false): string {
    // Only divide by 100 if price is from database (stored in cents)
    const priceInRupiah = fromDatabase ? Math.round(price / 100) : price;
    return new Intl.NumberFormat("id-ID").format(priceInRupiah);
  }

  /**
   * Format number
   */
  private static formatNumber(num: number): string {
    return new Intl.NumberFormat("id-ID").format(num);
  }

  /**
   * Parse edit vehicle command
   * Examples:
   * - "rubah km 50000", "ganti bensin jadi diesel", "ubah tahun ke 2018 PM-PST-006"
   * - "ubah innova reborn 2019 jadi bensin" (vehicle name + implicit field)
   */
  private static parseEditVehicleCommand(message: string): CommandParseResult {
    console.log(`[Staff Command] Parsing edit vehicle command: "${message}"`);

    const msg = message.toLowerCase().trim();

    // Extract vehicle ID if mentioned (PM-PST-XXX format)
    const vehicleIdMatch = msg.match(/pm-\w+-\d+/i);
    const vehicleId = vehicleIdMatch ? vehicleIdMatch[0].toUpperCase() : undefined;

    // Known vehicle models for vehicle-name-based editing
    const vehicleModels = [
      'innova', 'avanza', 'xenia', 'fortuner', 'rush', 'calya', 'sigra', 'brio', 'jazz', 'civic', 'accord',
      'xpander', 'pajero', 'triton', 'ertiga', 'swift', 'baleno', 'livina', 'serena', 'terios', 'ayla',
      'hiace', 'alphard', 'vellfire', 'yaris', 'vios', 'camry', 'corolla', 'raize', 'rocky', 'wuling',
      'confero', 'cortez', 'almaz', 'hrv', 'crv', 'wrv', 'brv', 'city', 'freed', 'mobilio', 'odyssey',
      'agya', 'granmax', 'luxio', 'taruna', 'feroza', 'ranger', 'everest', 'ecosport', 'fiesta',
      'captiva', 'spin', 'trax', 'trailblazer', 'tiguan', 'polo', 'golf', 'cx3', 'cx5', 'mazda2', 'mazda3',
      'juke', 'xtrail', 'navara', 'terra', 'march', 'tucson', 'santa', 'stargazer', 'creta', 'kona',
      'sportage', 'seltos', 'sonet', 'sorento', 'carnival', 'outlander', 'delica', 'l300', 'reborn'
    ];

    // Fuel types for implicit field detection
    const fuelTypes = ['bensin', 'diesel', 'solar', 'hybrid', 'electric', 'listrik'];
    // Transmissions for implicit field detection
    const transmissions = ['matic', 'manual', 'automatic', 'cvt', 'at', 'mt'];

    // NEW PATTERN 1: "ubah [vehicle name] [year?] jadi [fuel/transmission]"
    // Example: "ubah innova reborn 2019 jadi bensin", "ubah avanza jadi matic"
    const vehicleNameEditPattern = /(?:rubah|ganti|ubah|update|edit)\s+(.+?)\s+(?:ke|jadi|menjadi)\s+(\w+)$/i;
    const vehicleNameMatch = msg.match(vehicleNameEditPattern);

    if (vehicleNameMatch) {
      const vehiclePart = vehicleNameMatch[1].toLowerCase();
      const newValue = vehicleNameMatch[2].toLowerCase();

      // Check if vehiclePart contains a known vehicle model
      const containsVehicle = vehicleModels.some(model => vehiclePart.includes(model));

      if (containsVehicle) {
        // Determine field from newValue
        let field: string | null = null;
        let normalizedValue = newValue;

        if (fuelTypes.includes(newValue)) {
          field = 'fuelType';
          normalizedValue = newValue === 'solar' ? 'diesel' : newValue;
        } else if (transmissions.includes(newValue)) {
          field = 'transmissionType';
          if (newValue === 'matic' || newValue === 'at' || newValue === 'automatic' || newValue === 'cvt') {
            normalizedValue = 'automatic';
          } else if (newValue === 'manual' || newValue === 'mt') {
            normalizedValue = 'manual';
          }
        }

        if (field) {
          // Extract year from vehiclePart if present
          const yearMatch = vehiclePart.match(/\b(20\d{2}|19\d{2})\b/);
          const year = yearMatch ? parseInt(yearMatch[1], 10) : undefined;

          // Extract vehicle name (remove year)
          const vehicleName = vehiclePart.replace(/\b(20\d{2}|19\d{2})\b/g, '').trim();

          console.log(`[Staff Command] ✏️ Vehicle-name edit parsed: vehicleName="${vehicleName}", year=${year}, field=${field}, newValue=${normalizedValue}`);
          return {
            command: "edit_vehicle",
            params: {
              vehicleId,
              vehicleName, // Pass vehicle name for search
              vehicleYear: year,
              field,
              newValue: normalizedValue
            },
            isValid: true,
          };
        }
      }
    }

    // Field detection patterns - more flexible, "ke/jadi" is optional
    // UPDATED: Added (?:.*?)? after command verbs to allow Vehicle ID insertion
    // Example: "rubah PM-PST-001 km 50000" -> Now matches because of non-greedy wildcard
    const patterns: Array<{ pattern: RegExp; field: string; valueExtractor: (m: RegExpMatchArray) => string }> = [
      // Mileage: "rubah km 50000", "ganti kilometer ke 30000", "rubah PM-PST-001 km 50000"
      { pattern: /(?:rubah|ganti|ubah|update|edit)(?:\s+pm-\w+-\d+)?\s*(?:km|kilometer|odometer)?\s*(?:ke|jadi|menjadi)?\s*(\d+)\s*(?:km)?/i, field: 'mileage', valueExtractor: m => m[1] },

      // Year: "rubah tahun 2017", "ganti tahun ke 2018", "ubah tahun jadi 2019"
      { pattern: /(?:rubah|ganti|ubah|update|edit)(?:.*?)?\s*tahun\s*(?:ke|jadi|menjadi)?\s*(\d{4})/i, field: 'year', valueExtractor: m => m[1] },

      // Fuel type: "Ganti PM-PST-001 diesel", "ganti ke diesel", "Edit PM-PST-001 hybrid"
      { pattern: /(?:rubah|ganti|ubah|update|edit)(?:\s+pm-\w+-\d+)?\s*(?:bahan\s*bakar|fuel)?\s*(?:ke|jadi|menjadi)?\s*(diesel|bensin|hybrid|electric|listrik|solar)/i, field: 'fuelType', valueExtractor: m => m[1] },
      { pattern: /(?:rubah|ganti|ubah)(?:\s+pm-\w+-\d+)?\s*(bensin|diesel|solar)\s*(?:ke|jadi|menjadi)\s*(diesel|bensin|hybrid|electric|listrik)/i, field: 'fuelType', valueExtractor: m => m[2] },

      // Price: "rubah harga 150jt", "update PM-PST-001 harga 200jt"
      {
        pattern: /(?:rubah|ganti|ubah|update|edit)(?:\s+pm-\w+-\d+)?\s*harga\s*(?:ke|jadi|menjadi)?\s*(\d+(?:jt|juta)?)/i, field: 'price', valueExtractor: m => {
          const val = m[1].toLowerCase();
          if (val.includes('jt') || val.includes('juta')) {
            return String(parseInt(val) * 1000000);
          }
          return val;
        }
      },

      // Transmission: "rubah transmisi matic", "ganti ke manual", "ubah jadi AT"
      {
        pattern: /(?:rubah|ganti|ubah|update|edit)(?:.*?)?\s*(?:transmisi)?\s*(?:ke|jadi|menjadi)?\s*(matic|manual|automatic|cvt|at|mt)/i, field: 'transmissionType', valueExtractor: m => {
          const val = m[1].toLowerCase();
          if (val === 'matic' || val === 'at' || val === 'automatic' || val === 'cvt') return 'automatic';
          if (val === 'manual' || val === 'mt') return 'manual';
          return val;
        }
      },

      // Color: "rubah warna biru", "ganti warna ke hitam", "ubah warna jadi putih metalik"
      // Note: Be careful with color as it grabs remaining text, verify captured group doesn't include "pm-"
      { pattern: /(?:rubah|ganti|ubah|update|edit)(?:.*?)?\s*warna\s*(?:ke|jadi|menjadi)?\s*(.+?)(?:\s+pm-|\s*$)/i, field: 'color', valueExtractor: m => m[1].trim() },

      // Engine capacity: "rubah cc 2500", "ganti kapasitas mesin 1500", "ubah engine 2000cc"
      { pattern: /(?:rubah|ganti|ubah|update|edit)(?:.*?)?\s*(?:cc|kapasitas\s*(?:mesin)?|engine|mesin)\s*(?:ke|jadi|menjadi)?\s*(\d+)\s*(?:cc)?/i, field: 'engineCapacity', valueExtractor: m => m[1] },

      // Condition: "rubah kondisi bekas", "ganti kondisi ke baru"
      {
        pattern: /(?:rubah|ganti|ubah|update|edit)(?:.*?)?\s*kondisi\s*(?:ke|jadi|menjadi)?\s*(baru|bekas|used|new)/i, field: 'condition', valueExtractor: m => {
          const val = m[1].toLowerCase();
          if (val === 'baru' || val === 'new') return 'new';
          return 'used';
        }
      },
    ];

    for (const { pattern, field, valueExtractor } of patterns) {
      const match = msg.match(pattern);
      if (match) {
        const newValue = valueExtractor(match);
        console.log(`[Staff Command] ✏️ Edit parsed: field=${field}, newValue=${newValue}, vehicleId=${vehicleId || 'from context'}`);
        return {
          command: "edit_vehicle",
          params: { vehicleId, field, newValue },
          isValid: true,
        };
      }
    }

    return {
      command: "edit_vehicle",
      params: {},
      isValid: false,
      error: "Format tidak dikenali. Contoh: 'rubah km 50000' atau 'ganti bensin jadi diesel'",
    };
  }

  /**
   * Handle edit vehicle command - calls VehicleEditService
   * Now supports vehicle name + year search (e.g., "ubah innova reborn 2019 jadi bensin")
   */
  private static async handleEditVehicle(
    params: Record<string, any>,
    tenantId: string,
    staffPhone: string,
    conversationId: string
  ): Promise<CommandExecutionResult> {
    try {
      // Import VehicleEditService
      const { VehicleEditService } = await import('./vehicle-edit.service');

      const editResult = await VehicleEditService.editVehicle({
        vehicleId: params.vehicleId,
        vehicleName: params.vehicleName, // For vehicle-name-based search
        vehicleYear: params.vehicleYear, // For filtering by year
        fields: [{
          field: params.field,
          newValue: params.newValue,
        }],
        staffPhone,
        tenantId,
        conversationId,
      });

      return {
        success: editResult.success,
        message: editResult.message,
        vehicleId: editResult.vehicleId,
      };
    } catch (error: any) {
      console.error("[Staff Command] Edit vehicle error:", error);
      return {
        success: false,
        message: `❌ Gagal edit: ${error.message}`,
      };
    }
  }

  /**
   * Handle report request
   */
  private static async handleGetReport(
    params: Record<string, any>,
    tenantId: string,
    staffPhone: string
  ): Promise<CommandExecutionResult> {
    const { type } = params;

    // 1. Role Authorization
    const authorizedRoles = ['ADMIN', 'OWNER', 'SUPER_ADMIN'];
    const user = await prisma.user.findFirst({
      where: {
        AND: [
          { phone: { not: null } },
          {
            OR: [
              { tenantId },
              { tenantId: null } // Super Admin
            ]
          }
        ]
      }
    });

    // Check if user exists and match phone with normalization
    // We need to loop or find specifically because of normalization
    let authorizedUser = null;
    if (user) {
      // Find all potential users for this phone across the allowed scopes
      const potentialUsers = await prisma.user.findMany({
        where: {
          OR: [
            { tenantId },
            { tenantId: null }
          ]
        }
      });

      for (const u of potentialUsers) {
        if (u.phone && this.normalizePhone(u.phone) === this.normalizePhone(staffPhone)) {
          authorizedUser = u;
          break;
        }
      }
    }

    if (!authorizedUser || !authorizedRoles.includes(authorizedUser.role.toUpperCase())) {
      return {
        success: false,
        message: "Maaf kak, fitur report ini khusus untuk Admin / Owner / Super Admin saja ya! 🙏",
      };
    }

    if (!type) {
      return {
        success: false,
        message: "Jenis report tidak valid. Silakan ketik perintah report yang dinginkan.",
      };
    }

    // 2. Fetch Report
    const reportText = await WhatsAppReportService.getReport(type, tenantId);

    return {
      success: true,
      message: reportText,
    };
  }
}

export default StaffCommandService;
