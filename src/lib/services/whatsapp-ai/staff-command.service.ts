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
        message: "Maaf kak, ini fitur khusus staff aja 🙏\n\nKalau mau jadi staff, hubungi admin ya!",
      };
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
        message: `Mohon maaf, terjadi kesalahan:\n\n${error.message}\n\nSilakan coba lagi.`,
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

    // 6. KM (WAJIB, bukan optional)
    if (!vehicleData?.mileage && vehicleData?.mileage !== 0) {
      missingFields.push("mileage");
      missingLabels.push("KM");
    }

    // Merk boleh kosong jika model sudah dikenali (auto-detect dari model)
    // contoh: "Brio" → Honda Brio

    // Data lengkap = semua 6 field terisi
    const hasMinimumData =
      vehicleData?.model &&
      vehicleData?.year &&
      vehicleData?.price &&
      vehicleData?.color && vehicleData?.color !== "Unknown" &&
      vehicleData?.transmission && vehicleData?.transmission !== "Unknown" &&
      (vehicleData?.mileage || vehicleData?.mileage === 0);

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
      if (missingFields.includes("mileage")) examples.push("km 30rb");
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

    if (params.step === "photo_only" && mediaUrl) {
      console.log(`[Upload Flow] Photo only received (no caption): ${mediaUrl}`);

      const photos = contextData.photos || [];

      // Check max photos limit
      if (photos.length >= MAX_PHOTOS) {
        return {
          success: false,
          message: `Udah cukup ${MAX_PHOTOS} foto kak 📷 Sekarang ketik aja info mobilnya~`,
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
        // Check if we have enough photos (minimum 6)
        if (photos.length < MIN_PHOTOS) {
          // Data complete but need more photos
          await prisma.whatsAppConversation.update({
            where: { id: conversationId },
            data: {
              conversationState: "upload_vehicle",
              contextData: {
                ...contextData,
                uploadStep: "has_data_awaiting_photo",
                vehicleData: mergedData,
                photos,
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
          mileage: mergedData.mileage || 0,
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
      mileage: mergedData.mileage || 0,
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

    return {
      success: true,
      message:
        `Oke data masuk! 👍\n\n` +
        `🚗 ${vehicleData.make} ${vehicleData.model} ${vehicleData.year}\n` +
        `💰 Rp ${this.formatPrice(vehicleData.price)}\n` +
        `🔧 ${vehicleData.transmission} | 🎨 ${vehicleData.color}\n` +
        `📍 ${this.formatNumber(vehicleData.mileage)} km\n\n` +
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
          },
        },
      });
    } else {
      // Clear conversation state after successful upload with photos
      await prisma.whatsAppConversation.update({
        where: { id: conversationId },
        data: {
          conversationState: null,
          contextData: Prisma.DbNull,
        },
      });
    }

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

    if (aimeowAccount?.aiConfig?.welcomeMessage) {
      // Use welcome message from config, replace placeholders
      greeting = aimeowAccount.aiConfig.welcomeMessage
        .replace(/\{name\}/gi, staffName)
        .replace(/\{tenant\}/gi, tenantName)
        .replace(/\{showroom\}/gi, tenantName);
    } else {
      // Default professional greeting
      greeting = `Selamat datang, ${staffName}!`;
    }

    // Build professional staff menu - user-friendly format without "/" prefix
    const message =
      `${greeting}\n\n` +
      `Saat ini terdapat *${availableCount} unit* kendaraan tersedia di ${tenantName}.\n\n` +
      `*Layanan yang tersedia:*\n\n` +
      `📸 *Upload Kendaraan Baru*\n` +
      `   Ketik: upload\n` +
      `   Lalu kirim foto + info mobil\n` +
      `   Contoh: "upload Brio 2020 120jt hitam matic km 30rb"\n\n` +
      `📋 *Cek Stok Kendaraan*\n` +
      `   Ketik: inventory atau stok\n` +
      `   Filter: inventory AVAILABLE\n\n` +
      `📊 *Lihat Statistik*\n` +
      `   Ketik: stats atau laporan\n` +
      `   Period: stats today / stats week / stats month\n\n` +
      `🔄 *Update Status Kendaraan*\n` +
      `   Ketik: status [ID] [STATUS]\n` +
      `   Contoh: status PM-PST-001 SOLD\n\n` +
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

    let message = `📊 *Stok Showroom*${filter ? ` (${filter})` : ""}\n\n`;
    message += `Total ada ${vehicles.length} unit 🚗\n\n`;

    // Status breakdown
    Object.entries(byStatus).forEach(([status, count]) => {
      const emoji = status === "AVAILABLE" ? "✅" : status === "BOOKED" ? "🔒" : status === "SOLD" ? "💰" : "🗑️";
      message += `${emoji} ${status}: ${count}\n`;
    });

    // List vehicles (max 10)
    message += `\n*${Math.min(vehicles.length, 10)} teratas:*\n`;
    vehicles.slice(0, 10).forEach((v, idx) => {
      const statusEmoji = v.status === "AVAILABLE" ? "✅" : v.status === "BOOKED" ? "🔒" : v.status === "SOLD" ? "💰" : "";
      message += `\n${idx + 1}. ${v.make} ${v.model} ${v.year} ${statusEmoji}\n`;
      message += `   Rp ${this.formatPrice(Number(v.price), true)} • ID: ${v.displayId || v.id.slice(-6)}\n`;
    });

    if (vehicles.length > 10) {
      message += `\n... +${vehicles.length - 10} lagi`;
    }

    // Offer to show photos
    message += `\n\n📸 Mau lihat fotonya? Ketik nama mobil (misal: "foto avanza")`;

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

    const periodLabel = period === "today" ? "Hari Ini" : period === "week" ? "Minggu Ini" : "Bulan Ini";
    let message = `📈 *Stats ${periodLabel}*\n\n`;

    message += `🚗 *Kendaraan*\n`;
    message += `Total: ${totalVehicles} unit\n`;
    message += `Baru masuk: ${newVehicles} unit\n\n`;

    message += `*Per Status:*\n`;
    vehiclesByStatus.forEach((s) => {
      const emoji = s.status === "AVAILABLE" ? "✅" : s.status === "BOOKED" ? "🔒" : s.status === "SOLD" ? "💰" : "🗑️";
      message += `${emoji} ${s.status}: ${s._count}\n`;
    });

    message += `\n👥 *Leads*\n`;
    message += `Total: ${totalLeads}\n`;
    message += `Baru: ${newLeads} 🔥`;

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
}

export default StaffCommandService;
