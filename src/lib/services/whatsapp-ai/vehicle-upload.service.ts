/**
 * WhatsApp AI Vehicle Upload Service
 *
 * Handles vehicle upload from WhatsApp with AI-powered SEO description generation
 * Downloads photos from WhatsApp URLs, processes them, and saves to local storage
 * Integrates with /api/v1/vehicles/ai-identify and /api/v1/vehicles
 */

import { prisma } from "@/lib/prisma";
import { vehicleAIService } from "@/lib/ai/vehicle-ai-service";
import { ImageProcessingService } from "@/lib/services/image-processing.service";
import { StorageService } from "@/lib/services/storage.service";
import { UploadNotificationService } from "./upload-notification.service";

// ==================== TYPES ====================

export interface WhatsAppVehicleData {
  make: string;
  model: string;
  year: number;
  price: number;          // in IDR (full amount, e.g. 120000000)
  mileage?: number;
  color?: string;
  transmission?: string;  // Manual, Automatic, CVT
}

export interface WhatsAppVehicleUploadResult {
  success: boolean;
  vehicleId?: string;
  displayId?: string;
  message: string;
  error?: string;
}

// ==================== SERVICE ====================

export class WhatsAppVehicleUploadService {
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
   * Find staff by phone number with normalized comparison
   */
  private static async findStaffByPhone(tenantId: string, staffPhone: string) {
    const normalizedInput = this.normalizePhone(staffPhone);
    console.log(`[WhatsApp Vehicle Upload] Finding staff - input: ${staffPhone}, normalized: ${normalizedInput}`);

    const users = await prisma.user.findMany({
      where: { tenantId },
      select: { id: true, phone: true, firstName: true, lastName: true },
    });

    for (const user of users) {
      if (!user.phone) continue;
      const normalizedUserPhone = this.normalizePhone(user.phone);
      if (normalizedInput === normalizedUserPhone) {
        console.log(`[WhatsApp Vehicle Upload] ✅ Staff found: ${user.firstName}`);
        return user;
      }
    }

    console.log(`[WhatsApp Vehicle Upload] ❌ No staff found for phone: ${staffPhone}`);
    return null;
  }

  /**
   * Create vehicle from WhatsApp with AI-powered SEO description
   *
   * @param vehicleData - Extracted vehicle data from natural language
   * @param photoUrls - WhatsApp media URLs
   * @param tenantId - Tenant ID
   * @param staffPhone - Staff phone number for audit trail
   * @returns Upload result with vehicle ID and message
   */
  static async createVehicle(
    vehicleData: WhatsAppVehicleData,
    photoUrls: string[],
    tenantId: string,
    staffPhone: string
  ): Promise<WhatsAppVehicleUploadResult> {
    console.log('[WhatsApp Vehicle Upload] Starting vehicle creation...');
    console.log('[WhatsApp Vehicle Upload] Data:', vehicleData);
    console.log('[WhatsApp Vehicle Upload] Photos:', photoUrls.length);
    console.log('[WhatsApp Vehicle Upload] Tenant:', tenantId);

    try {
      // 1. Format vehicle data into natural language description for AI
      const userDescription = this.formatVehicleDescription(vehicleData);
      console.log('[WhatsApp Vehicle Upload] Formatted description:', userDescription);

      // 2. Call AI service to get SEO-optimized description and analysis
      console.log('[WhatsApp Vehicle Upload] Calling AI for SEO description generation...');
      const aiResult = await vehicleAIService.identifyFromText({
        userDescription,
      });

      console.log('[WhatsApp Vehicle Upload] AI result received:');
      console.log('[WhatsApp Vehicle Upload] - AI Confidence:', aiResult.aiConfidence);
      console.log('[WhatsApp Vehicle Upload] - Description length:', aiResult.descriptionId.length);
      console.log('[WhatsApp Vehicle Upload] - Features count:', aiResult.features.length);
      console.log('[WhatsApp Vehicle Upload] - Price analysis:', aiResult.priceAnalysis.recommendation);

      // 3. Get user ID from phone number (using normalized comparison)
      const staff = await this.findStaffByPhone(tenantId, staffPhone);

      if (!staff) {
        return {
          success: false,
          message: 'Maaf kak, nomor WA kamu belum terdaftar 🙏\n\nMinta admin tambahin di: primamobil.id/dashboard/users',
          error: 'Staff not found in tenant',
        };
      }

      // 4. Generate display ID
      const displayId = await this.generateDisplayId();
      console.log('[WhatsApp Vehicle Upload] Generated displayId:', displayId);

      // 5. Create vehicle with AI-generated data
      console.log('[WhatsApp Vehicle Upload] Creating vehicle in database...');
      const vehicle = await prisma.vehicle.create({
        data: {
          displayId,
          tenantId,
          createdBy: staff.id,

          // Basic Information (from WhatsApp + AI)
          make: aiResult.make,
          model: aiResult.model,
          year: aiResult.year,
          variant: aiResult.variant,

          // AI-Generated SEO Content
          descriptionId: aiResult.descriptionId,  // ← SEO-optimized Indonesian description
          features: aiResult.features,
          specifications: aiResult.specifications,

          // AI Metadata
          aiConfidence: aiResult.aiConfidence,
          aiReasoning: aiResult.aiReasoning,

          // Pricing (convert to BigInt for database - store in cents)
          // vehicleData.price is in full IDR (e.g., 120000000 for 120 juta)
          // Database stores in cents: 120000000 * 100 = 12000000000
          price: BigInt(vehicleData.price * 100),
          aiSuggestedPrice: BigInt(aiResult.aiSuggestedPrice || vehicleData.price * 100),
          priceConfidence: aiResult.priceConfidence || 0.8,
          priceAnalysis: aiResult.priceAnalysis || { recommendation: 'Harga sesuai pasar' },

          // Vehicle Details
          mileage: vehicleData.mileage || 0,
          transmissionType: vehicleData.transmission?.toLowerCase() || 'manual',
          fuelType: aiResult.fuelType || 'bensin',
          color: vehicleData.color || 'Unknown',

          // Status
          status: 'AVAILABLE',  // Auto-publish from WhatsApp
        },
      });

      console.log('[WhatsApp Vehicle Upload] ✅ Vehicle created:', vehicle.id);

      // 6. Download, process, and save photos from WhatsApp media URLs
      console.log('[WhatsApp Vehicle Upload] Processing vehicle photos...');
      let processedPhotoCount = 0;

      for (let i = 0; i < photoUrls.length; i++) {
        try {
          console.log(`[WhatsApp Vehicle Upload] Downloading photo ${i + 1}/${photoUrls.length}: ${photoUrls[i]}`);

          // Download photo from WhatsApp URL
          const photoBuffer = await this.downloadPhoto(photoUrls[i]);

          if (!photoBuffer) {
            console.error(`[WhatsApp Vehicle Upload] Failed to download photo ${i + 1}`);
            continue;
          }

          console.log(`[WhatsApp Vehicle Upload] Photo ${i + 1} downloaded: ${photoBuffer.length} bytes`);

          // Process photo (generate multiple sizes)
          const processed = await ImageProcessingService.processPhoto(photoBuffer);

          // Generate filename
          const timestamp = Date.now();
          const baseFilename = `${vehicle.make.toLowerCase()}-${vehicle.model.toLowerCase()}-${timestamp}-${i + 1}`;

          // Upload all sizes to storage
          const uploadResult = await StorageService.uploadMultipleSize(
            {
              original: processed.original,
              large: processed.large,
              medium: processed.medium,
              thumbnail: processed.thumbnail,
            },
            vehicle.id,
            baseFilename
          );

          console.log(`[WhatsApp Vehicle Upload] Photo ${i + 1} saved:`, uploadResult);

          // Create photo record in database
          await prisma.vehiclePhoto.create({
            data: {
              vehicleId: vehicle.id,
              tenantId,
              storageKey: uploadResult.storageKey,
              originalUrl: uploadResult.originalUrl,
              thumbnailUrl: uploadResult.thumbnailUrl,
              mediumUrl: uploadResult.mediumUrl,
              largeUrl: uploadResult.largeUrl,
              filename: `${baseFilename}-original.jpg`,
              fileSize: photoBuffer.length,
              mimeType: processed.metadata.mimeType,
              width: processed.metadata.width,
              height: processed.metadata.height,
              isMainPhoto: i === 0,  // First photo is main
              displayOrder: i,
            },
          });

          processedPhotoCount++;
        } catch (photoError: any) {
          console.error(`[WhatsApp Vehicle Upload] Error processing photo ${i + 1}:`, photoError.message);
          // Continue with next photo
        }
      }

      console.log('[WhatsApp Vehicle Upload] ✅ Processed', processedPhotoCount, 'of', photoUrls.length, 'photos');

      // 7. Format success message
      const priceInJuta = Math.round(vehicleData.price / 1000000);
      // aiSuggestedPrice is in cents, convert to juta: /100 (to IDR) then /1000000 (to juta)
      const aiPriceInJuta = aiResult.aiSuggestedPrice
        ? Math.round(aiResult.aiSuggestedPrice / 100 / 1000000)
        : priceInJuta;

      let message = `Mantap kak, uploadnya berhasil! 🎉\n\n`;
      message += `🚗 *${vehicle.make} ${vehicle.model} ${vehicle.year}*\n`;
      message += `💰 Rp ${priceInJuta} Juta\n`;
      message += `📍 ${vehicleData.mileage?.toLocaleString('id-ID') || '0'} km | ${vehicleData.transmission || '-'}\n`;
      message += `🎨 ${vehicleData.color || '-'}\n`;
      message += `📷 ${processedPhotoCount} foto\n\n`;

      message += `🤖 AI udah bikin deskripsi SEO (${aiResult.descriptionId.length} karakter) ✨\n\n`;

      // Add price analysis if AI suggests different price
      const aiPriceInIDR = aiResult.aiSuggestedPrice ? aiResult.aiSuggestedPrice / 100 : vehicleData.price;
      const priceDiff = Math.abs(vehicleData.price - aiPriceInIDR);
      const priceDiffPercent = (priceDiff / vehicleData.price) * 100;

      if (priceDiffPercent > 10) {
        message += `💡 *Saran harga:* Rp ${aiPriceInJuta} Jt\n`;
        message += `${aiResult.priceAnalysis.recommendation}\n\n`;
      }

      message += `🔗 Cek di website:\nprimamobil.id/vehicles/${vehicle.id}`;

      // 🔔 NOTIFY ALL STAFF - Upload Berhasil
      UploadNotificationService.notifyUploadSuccess(tenantId, staffPhone, {
        make: vehicle.make,
        model: vehicle.model,
        year: vehicle.year,
        price: vehicleData.price,
        mileage: vehicleData.mileage,
        color: vehicleData.color,
        photoCount: processedPhotoCount,
        vehicleId: vehicle.id,
        displayId,
      }).catch(err => console.error('[Upload Notification] Error:', err.message));

      return {
        success: true,
        vehicleId: vehicle.id,
        displayId,
        message,
      };

    } catch (error: any) {
      console.error('[WhatsApp Vehicle Upload] ❌ Error:', error);

      // Provide helpful error messages with solutions - casual style
      let errorMessage = `Waduh gagal nih kak 😅\n\n`;
      errorMessage += `Masalah: ${error.message}\n\n`;

      if (error.message.includes('timeout') || error.message.includes('Timeout')) {
        errorMessage += `Server lagi sibuk, coba lagi 1-2 menit ya~\n`;
      } else if (error.message.includes('photo') || error.message.includes('download')) {
        errorMessage += `Fotonya mungkin kegedean, coba resize dulu ya (maks 5MB)\n`;
      } else if (error.message.includes('Staff') || error.message.includes('staff')) {
        errorMessage += `Nomor WA belum terdaftar nih kak\n`;
        errorMessage += `Minta admin tambahin di: primamobil.id/dashboard/users\n`;
      } else {
        errorMessage += `Coba kirim ulang ya kak!\n`;
        errorMessage += `Format: "Brio 2020 120jt hitam matic km 30rb"\n`;
      }

      errorMessage += `\nKalau masih error, kabarin admin ya! 🙏`;

      // 🔔 NOTIFY ALL STAFF - Upload Gagal
      UploadNotificationService.notifyUploadFailed(
        tenantId,
        staffPhone,
        error.message
      ).catch(err => console.error('[Upload Notification] Error:', err.message));

      return {
        success: false,
        message: errorMessage,
        error: error.message,
      };
    }
  }

  /**
   * Format vehicle data into natural language description for AI
   */
  private static formatVehicleDescription(data: WhatsAppVehicleData): string {
    let description = `${data.make} ${data.model} ${data.year}`;

    if (data.transmission) {
      description += ` ${data.transmission}`;
    }

    if (data.mileage) {
      description += `, KM ${data.mileage.toLocaleString('id-ID')}`;
    }

    if (data.color) {
      description += `, ${data.color}`;
    }

    const priceInJuta = Math.round(data.price / 1000000);
    description += `, Rp ${priceInJuta} juta`;

    return description;
  }

  /**
   * Download photo from WhatsApp media URL
   */
  private static async downloadPhoto(url: string): Promise<Buffer | null> {
    try {
      console.log(`[WhatsApp Vehicle Upload] Downloading from: ${url}`);

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });

      if (!response.ok) {
        console.error(`[WhatsApp Vehicle Upload] Download failed: ${response.status} ${response.statusText}`);
        return null;
      }

      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (error: any) {
      console.error(`[WhatsApp Vehicle Upload] Download error:`, error.message);
      return null;
    }
  }

  /**
   * Generate next display ID (VH-001, VH-002, etc)
   */
  private static async generateDisplayId(): Promise<string> {
    const lastVehicle = await prisma.vehicle.findFirst({
      where: {
        displayId: {
          startsWith: 'VH-',
        },
      },
      orderBy: {
        displayId: 'desc',
      },
      select: {
        displayId: true,
      },
    });

    let nextNumber = 1;
    if (lastVehicle && lastVehicle.displayId) {
      const match = lastVehicle.displayId.match(/VH-(\d+)/);
      if (match) {
        nextNumber = parseInt(match[1], 10) + 1;
      }
    }

    return `VH-${String(nextNumber).padStart(3, '0')}`;
  }
}

export default WhatsAppVehicleUploadService;
