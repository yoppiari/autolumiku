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
   * NOW ASYNC: Supports AI-powered natural language extraction
   */
  static async parseCommand(message: string, intent: MessageIntent, hasMedia: boolean = false): Promise<CommandParseResult> {
    const trimmedMessage = (message || "").trim();
    console.log(`[Staff Command] Parsing command - intent: ${intent}, message: "${trimmedMessage}", hasMedia: ${hasMedia}`);

    switch (intent) {
      case "staff_upload_vehicle":
        return await this.parseUploadCommand(trimmedMessage, hasMedia);

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
    // Staff sends /upload, then we ask for photo first
    if (message.toLowerCase().trim() === "/upload") {
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

    // Both failed, return error
    console.error('[Staff Command] ❌ Both AI and regex extraction failed');
    return {
      command: "upload",
      params: {},
      isValid: false,
      error:
        aiResult.error || regexResult.error ||
        "❌ Gagal memproses data mobil.\n\n" +
        "Coba ketik ulang dengan lebih jelas.\n\n" +
        "*Contoh yang benar:*\n" +
        "• Brio 2020 120jt hitam\n" +
        "• Avanza 2019 km 50rb 140jt matic\n" +
        "• Jazz RS 2017 165jt merah\n\n" +
        "Minimal tulis: nama mobil, tahun, harga\n" +
        "Contoh: Brio 2020 120jt",
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
        error: "Format: /status [vehicle_id] [AVAILABLE|BOOKED|SOLD]",
      };
    }

    const [cmd, vehicleId, status] = parts;

    const validStatuses = ["AVAILABLE", "BOOKED", "SOLD", "DELETED"];
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
   * Check which required fields are missing from vehicle data
   * Returns array of missing field names and a user-friendly message
   */
  private static checkMissingFields(vehicleData: any): {
    missingFields: string[];
    askMessage: string;
    hasMinimumData: boolean;
  } {
    const missingFields: string[] = [];
    const questions: string[] = [];

    // Required fields - WAJIB untuk upload
    if (!vehicleData?.make) {
      missingFields.push("make");
      questions.push("• Merk mobil apa? (Toyota, Honda, dll)");
    }
    if (!vehicleData?.model) {
      missingFields.push("model");
      questions.push("• Model/tipe apa? (Avanza, Brio, dll)");
    }
    if (!vehicleData?.year) {
      missingFields.push("year");
      questions.push("• Tahun berapa?");
    }
    if (!vehicleData?.price) {
      missingFields.push("price");
      questions.push("• Harga berapa? (contoh: 120jt)");
    }

    // Optional but recommended fields
    if (!vehicleData?.mileage && vehicleData?.mileage !== 0) {
      missingFields.push("mileage");
      questions.push("• KM berapa? (contoh: 50rb)");
    }
    if (!vehicleData?.color || vehicleData?.color === "Unknown") {
      missingFields.push("color");
      questions.push("• Warna apa?");
    }
    if (!vehicleData?.transmission || vehicleData?.transmission === "Unknown") {
      missingFields.push("transmission");
      questions.push("• Transmisi manual atau matic?");
    }

    // Minimum data = make, model, year, price
    const hasMinimumData = vehicleData?.make && vehicleData?.model && vehicleData?.year && vehicleData?.price;

    let askMessage = "";
    if (questions.length > 0) {
      askMessage = "📝 *Data belum lengkap*\n\nMohon lengkapi data berikut:\n" + questions.join("\n");
      askMessage += "\n\nBalas dengan info yang kurang, contoh:\n";
      askMessage += "\"hitam matic km 30rb\"\n";
      askMessage += "atau \"warna putih, transmisi manual\"";
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
      mileage: newData?.mileage ?? existingData?.mileage ?? 0,
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

      // Minimum data complete - check photos
      if (photos.length === 0) {
        await prisma.whatsAppConversation.update({
          where: { id: conversationId },
          data: {
            contextData: {
              ...contextData,
              uploadStep: "has_data_awaiting_photo",
              vehicleData: mergedData,
            },
          },
        });

        // Still ask for optional fields if missing
        let message = `✅ Data dasar sudah lengkap!\n\n` +
          `📋 ${mergedData.make} ${mergedData.model} ${mergedData.year}\n` +
          `💰 Rp ${this.formatPrice(mergedData.price)}\n\n`;

        if (missingFields.length > 0) {
          message += `ℹ️ Data opsional yang belum ada: ${missingFields.join(", ")}\n\n`;
        }

        message += `📸 *Sekarang kirim foto mobil (WAJIB)*`;

        return {
          success: true,
          message,
        };
      }

      // Data and photos complete! Create vehicle
      console.log(`[Upload Flow] ✅ All data complete! Creating vehicle...`);
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
      await prisma.whatsAppConversation.update({
        where: { id: conversationId },
        data: {
          conversationState: "upload_vehicle",
          contextData: {
            uploadStep: "awaiting_photo",
            photos: [],
            vehicleData: null,
          },
        },
      });

      return {
        success: true,
        message:
          "📸 *Upload Mobil*\n\n" +
          "Cara upload sangat mudah! Cukup kirim:\n" +
          "1️⃣ Foto mobil\n" +
          "2️⃣ Ketik info mobil\n\n" +
          "*Contoh ketik:*\n" +
          "• Brio 2020 120jt hitam\n" +
          "• Avanza 2019 km 50rb 140jt silver matic\n" +
          "• Xenia 2018 putih 95jt manual\n\n" +
          "Tidak perlu format khusus, ketik saja seperti biasa! 😊",
      };
    }

    // === STEP 1b: Photo sent without caption ===
    const MAX_PHOTOS = 15;

    if (params.step === "photo_only" && mediaUrl) {
      console.log(`[Upload Flow] Photo only received (no caption): ${mediaUrl}`);

      const photos = contextData.photos || [];

      // Check max photos limit
      if (photos.length >= MAX_PHOTOS) {
        return {
          success: false,
          message: `❌ Maksimal ${MAX_PHOTOS} foto per kendaraan. Kirim detail mobil untuk melanjutkan upload.`,
        };
      }

      photos.push(mediaUrl);

      await prisma.whatsAppConversation.update({
        where: { id: conversationId },
        data: {
          conversationState: "upload_vehicle",
          contextData: {
            ...contextData,
            uploadStep: "has_photo_awaiting_data",
            photos,
          },
        },
      });

      return {
        success: true,
        message:
          `✅ Foto ${photos.length}/${MAX_PHOTOS} diterima!\n\n` +
          "📝 Sekarang ketik info mobilnya:\n\n" +
          "*Contoh:*\n" +
          "• Brio 2020 120jt hitam\n" +
          "• Avanza 2019 km 50rb 140jt matic\n\n" +
          "Ketik saja seperti chat biasa! 👍",
      };
    }

    // === STEP 2: Handle incoming photo ===
    if (mediaUrl) {
      console.log(`[Upload Flow] Photo received: ${mediaUrl}`);

      const photos = contextData.photos || [];

      // Check max photos limit
      if (photos.length >= MAX_PHOTOS) {
        return {
          success: false,
          message: `❌ Maksimal ${MAX_PHOTOS} foto per kendaraan. Kirim detail mobil untuk melanjutkan upload.`,
        };
      }

      photos.push(mediaUrl);

      // Check if we already have vehicle data from context OR from current params
      // This handles: /upload Brio 2015 KM 30.000 Rp 120JT + photo in same message
      const { make, model, year, price, mileage, color, transmission } = params;

      // Merge any incoming data with existing context data
      const existingData = contextData.vehicleData || {};
      const incomingData = { make, model, year, price, mileage, color, transmission };
      const mergedData = this.mergeVehicleData(existingData, incomingData);

      // Check if data is complete
      const { missingFields, askMessage, hasMinimumData } = this.checkMissingFields(mergedData);

      if (hasMinimumData) {
        // We have complete data + photo! Create vehicle now
        const vehicleData = {
          make: mergedData.make,
          model: mergedData.model,
          year: mergedData.year,
          price: mergedData.price,
          mileage: mergedData.mileage || 0,
          color: mergedData.color || "Unknown",
          transmission: mergedData.transmission || "Manual",
        };

        console.log(`[Upload Flow] ✅ Photo + Complete Data! Creating vehicle...`);
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
        let receivedInfo = `✅ Foto ${photos.length}/${MAX_PHOTOS} diterima!\n\n`;
        if (mergedData.make) receivedInfo += `✓ Merk: ${mergedData.make}\n`;
        if (mergedData.model) receivedInfo += `✓ Model: ${mergedData.model}\n`;
        if (mergedData.year) receivedInfo += `✓ Tahun: ${mergedData.year}\n`;
        if (mergedData.price) receivedInfo += `✓ Harga: Rp ${this.formatPrice(mergedData.price)}\n`;

        return {
          success: true,
          message: receivedInfo + "\n" + askMessage,
        };
      }

      // We have photo but no data yet
      await prisma.whatsAppConversation.update({
        where: { id: conversationId },
        data: {
          contextData: {
            ...contextData,
            uploadStep: "has_photo_awaiting_data",
            photos,
          },
        },
      });

      return {
        success: true,
        message:
          `✅ Foto ${photos.length}/${MAX_PHOTOS} diterima!\n\n` +
          "📝 *Langkah Terakhir*\n\n" +
          "Ketik info mobilnya:\n\n" +
          "*Contoh:*\n" +
          "• Brio 2020 120jt hitam\n" +
          "• Avanza 2019 km 50rb 140jt matic\n\n" +
          "Atau kirim foto lagi (maks ${MAX_PHOTOS}). 📷",
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

    // Check what's missing
    const { missingFields, askMessage, hasMinimumData } = this.checkMissingFields(mergedData);

    // Get photos from context
    const photos = contextData.photos || [];

    // Validate data integrity for fields that exist
    if (mergedData.year) {
      const currentYear = new Date().getFullYear();
      if (mergedData.year < 1980 || mergedData.year > currentYear + 1) {
        return {
          success: false,
          message: `❌ Tahun tidak valid. Harus antara 1980-${currentYear + 1}`,
        };
      }
    }

    if (mergedData.price) {
      if (mergedData.price <= 0 || mergedData.price > 100000000000) {
        return {
          success: false,
          message: "❌ Harga tidak valid. Harus antara 0-100 miliar",
        };
      }
    }

    if (mergedData.mileage && (mergedData.mileage < 0 || mergedData.mileage > 1000000)) {
      return {
        success: false,
        message: "❌ Kilometer tidak valid. Harus antara 0-1,000,000 km",
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
        message = `📋 *Data yang sudah diterima:*\n${receivedInfo}\n`;
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
      mileage: mergedData.mileage || 0,
      color: mergedData.color || "Unknown",
      transmission: mergedData.transmission || "Manual",
    };

    if (photos.length > 0) {
      // We have both complete data and photos! Create vehicle now
      console.log(`[Upload Flow] Both complete data and photo available. Creating vehicle...`);
      return await this.createVehicleWithPhotos(
        vehicleData,
        photos,
        tenantId,
        staffPhone,
        conversationId
      );
    }

    // We have complete data but no photo yet
    await prisma.whatsAppConversation.update({
      where: { id: conversationId },
      data: {
        conversationState: "upload_vehicle",
        contextData: {
          ...contextData,
          uploadStep: "has_data_awaiting_photo",
          vehicleData,
        },
      },
    });

    // Build summary of optional fields still missing
    let optionalMissing = "";
    if (missingFields.length > 0) {
      optionalMissing = `\nℹ️ Opsional yang belum ada: ${missingFields.join(", ")}\n`;
    }

    return {
      success: true,
      message:
        `✅ Data mobil diterima!\n\n` +
        `📋 ${vehicleData.make} ${vehicleData.model} ${vehicleData.year}\n` +
        `💰 Harga: Rp ${this.formatPrice(vehicleData.price)}\n` +
        `🔧 Transmisi: ${vehicleData.transmission}\n` +
        `🎨 Warna: ${vehicleData.color}\n` +
        `📍 KM: ${this.formatNumber(vehicleData.mileage)}` +
        optionalMissing +
        `\n\n📸 *Sekarang kirim foto mobil (WAJIB)*\n\n` +
        `Kirim 1-15 foto mobil untuk melanjutkan upload.`,
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

    // Clear conversation state after successful upload
    await prisma.whatsAppConversation.update({
      where: { id: conversationId },
      data: {
        conversationState: null,
        contextData: Prisma.DbNull,
      },
    });

    console.log(`[Upload Flow] ✅ Vehicle created successfully: ${uploadResult.vehicleId}`);

    // Add link to dashboard in message
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://primamobil.id';
    const vehicleUrl = `${baseUrl}/dashboard/vehicles/${uploadResult.vehicleId}`;

    return {
      success: true,
      message:
        uploadResult.message +
        `\n\n🔗 *Link:*\n${vehicleUrl}`,
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
        message: `❌ Mobil dengan ID ${vehicleId} tidak ditemukan.`,
      };
    }

    // FIX: Validate status against allowed values before update
    const validStatuses = ["AVAILABLE", "BOOKED", "SOLD", "DELETED"];
    if (!validStatuses.includes(status)) {
      return {
        success: false,
        message: `❌ Status tidak valid: ${status}. Gunakan: ${validStatuses.join(", ")}`,
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
      if (["AVAILABLE", "BOOKED", "SOLD", "DELETED"].includes(upperFilter)) {
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

    // Get all users in tenant and check phone match with normalization
    const users = await prisma.user.findMany({
      where: { tenantId },
      select: { id: true, phone: true, firstName: true },
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
