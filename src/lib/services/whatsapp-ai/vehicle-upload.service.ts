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
import { PlateDetectionService } from "@/lib/services/plate-detection.service";

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
   * Check for duplicate vehicle (same make/model/year uploaded within last 5 minutes)
   * Prevents race condition where staff accidentally uploads same vehicle twice
   */
  private static async checkDuplicateVehicle(
    tenantId: string,
    make: string,
    model: string,
    year: number
  ): Promise<{ isDuplicate: boolean; existingVehicle?: { id: string; displayId: string } }> {
    const DUPLICATE_WINDOW_MINUTES = 5;
    const cutoffTime = new Date(Date.now() - DUPLICATE_WINDOW_MINUTES * 60 * 1000);

    console.log(`[WhatsApp Vehicle Upload] Checking for duplicates: ${make} ${model} ${year}`);
    console.log(`[WhatsApp Vehicle Upload] Cutoff time: ${cutoffTime.toISOString()}`);

    const existingVehicle = await prisma.vehicle.findFirst({
      where: {
        tenantId,
        make: { equals: make, mode: 'insensitive' },
        model: { contains: model.split(' ')[0], mode: 'insensitive' }, // Match base model
        year,
        createdAt: { gte: cutoffTime },
      },
      select: { id: true, displayId: true, make: true, model: true, year: true },
      orderBy: { createdAt: 'desc' },
    });

    if (existingVehicle) {
      console.log(`[WhatsApp Vehicle Upload] ⚠️ Found duplicate: ${existingVehicle.displayId}`);
      return {
        isDuplicate: true,
        existingVehicle: {
          id: existingVehicle.id,
          displayId: existingVehicle.displayId || existingVehicle.id,
        },
      };
    }

    console.log(`[WhatsApp Vehicle Upload] ✅ No duplicate found`);
    return { isDuplicate: false };
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
      // 0. Check for duplicate vehicle (same make/model/year within last 5 minutes)
      const duplicateCheck = await this.checkDuplicateVehicle(
        tenantId,
        vehicleData.make,
        vehicleData.model,
        vehicleData.year
      );

      if (duplicateCheck.isDuplicate) {
        console.warn('[WhatsApp Vehicle Upload] ⚠️ Duplicate vehicle detected!');
        console.warn('[WhatsApp Vehicle Upload] Existing vehicle:', duplicateCheck.existingVehicle);
        return {
          success: false,
          message:
            `⚠️ Mobil ini sepertinya baru aja diupload!\n\n` +
            `${vehicleData.make} ${vehicleData.model} ${vehicleData.year}\n` +
            `ID: ${duplicateCheck.existingVehicle?.displayId}\n\n` +
            `Cek dulu di dashboard ya kak, mungkin sudah ada.`,
          error: 'Duplicate vehicle detected',
        };
      }
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

      // 4.1 Fetch tenant details for plate cover branding
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { name: true, logoUrl: true },
      });
      console.log('[WhatsApp Vehicle Upload] Tenant for branding:', tenant?.name);

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

      // 5.5. Auto-assign vehicle to the uploader (sales person)
      // This tracks who is responsible for selling this vehicle
      try {
        const staffName = `${staff.firstName} ${staff.lastName}`.trim();
        await prisma.$executeRaw`
          UPDATE vehicles
          SET "assignedSalesId" = ${staff.id},
              "assignedSalesName" = ${staffName},
              "assignedAt" = NOW()
          WHERE id = ${vehicle.id}
        `;
        console.log(`[WhatsApp Vehicle Upload] ✅ Auto-assigned to: ${staffName}`);
      } catch (assignErr) {
        // Assignment columns might not exist yet - this is OK
        console.log('[WhatsApp Vehicle Upload] ⚠️ Auto-assign skipped (columns may not exist)');
      }

      // 6. Download, process, and save photos from WhatsApp media URLs
      let processedPhotoCount = 0;
      const failedProcessing: number[] = [];
      let failedDownloads: { index: number; url: string }[] = [];

      // Handle case where no photos were provided (create vehicle without photos)
      if (photoUrls.length === 0) {
        console.log(`[WhatsApp Vehicle Upload] ⚠️ No photos provided - creating vehicle without photos`);
        console.log(`[WhatsApp Vehicle Upload] 💡 Photos can be added later via dashboard`);
      } else {
        // Step 6.1: Download all photos in parallel for better performance
        console.log(`[WhatsApp Vehicle Upload] 📥 Downloading ${photoUrls.length} photos in parallel...`);
        const downloadStartTime = Date.now();

        const downloadPromises = photoUrls.map((url, i) =>
          this.downloadPhoto(url).then(buffer => ({
            index: i,
            url,
            buffer,
            success: buffer !== null,
          }))
        );

        const downloadResults = await Promise.all(downloadPromises);
        const downloadTime = Date.now() - downloadStartTime;

        const successfulDownloads = downloadResults.filter(r => r.success);
        failedDownloads = downloadResults.filter(r => !r.success);

        console.log(`[WhatsApp Vehicle Upload] 📥 Downloads completed in ${downloadTime}ms`);
        console.log(`[WhatsApp Vehicle Upload] ✅ Successful: ${successfulDownloads.length}, ❌ Failed: ${failedDownloads.length}`);

        if (failedDownloads.length > 0) {
          console.warn(`[WhatsApp Vehicle Upload] Failed URLs:`, failedDownloads.map(f => f.url));
        }

        // If no photos could be downloaded, continue without photos (don't delete vehicle)
        if (successfulDownloads.length === 0) {
          console.warn(`[WhatsApp Vehicle Upload] ⚠️ All photo downloads failed - continuing without photos`);
          console.log(`[WhatsApp Vehicle Upload] 💡 Photos can be added later via dashboard`);
        } else {
          // Step 6.2: Process each successfully downloaded photo
          console.log(`[WhatsApp Vehicle Upload] 🔄 Processing ${successfulDownloads.length} photos...`);

          for (const download of successfulDownloads) {
            const i = download.index;
            const photoBuffer = download.buffer!;

            try {
              console.log(`[WhatsApp Vehicle Upload] Processing photo ${i + 1}/${photoUrls.length}: ${photoBuffer.length} bytes`);

              // 6.2.1 Detect and cover license plates with AI
              let processedBuffer = photoBuffer;
              let platesDetected = 0;

              try {
                const plateResult = await PlateDetectionService.processImage(photoBuffer, {
                  tenantName: tenant?.name || 'PRIMA MOBIL',
                  tenantLogoUrl: tenant?.logoUrl || undefined,
                });
                processedBuffer = plateResult.covered;
                platesDetected = plateResult.platesDetected;
                if (platesDetected > 0) {
                  console.log(`[WhatsApp Vehicle Upload] Photo ${i + 1}: ${platesDetected} plate(s) covered`);
                }
              } catch (plateError: any) {
                console.error(`[WhatsApp Vehicle Upload] Plate detection failed for photo ${i + 1}:`, plateError.message);
                // Continue with original photo if plate detection fails
              }

              // Process photo (generate multiple sizes) - using covered version
              const processed = await ImageProcessingService.processPhoto(processedBuffer);

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
                  isMainPhoto: processedPhotoCount === 0,  // First successfully processed photo is main
                  displayOrder: processedPhotoCount,
                },
              });

              processedPhotoCount++;
            } catch (photoError: any) {
              console.error(`[WhatsApp Vehicle Upload] Error processing photo ${i + 1}:`, photoError.message);
              failedProcessing.push(i + 1);
              // Continue with next photo
            }
          }

          console.log('[WhatsApp Vehicle Upload] ✅ Processed', processedPhotoCount, 'of', photoUrls.length, 'photos');
        }
      }

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

      // Show photo upload status with details
      if (processedPhotoCount === 0) {
        message += `📷 Belum ada foto - tambah via dashboard ya!\n\n`;
      } else if (failedDownloads.length > 0 || failedProcessing.length > 0) {
        const totalFailed = failedDownloads.length + failedProcessing.length;
        message += `📷 ${processedPhotoCount}/${photoUrls.length} foto (${totalFailed} gagal)\n\n`;
      } else {
        message += `📷 ${processedPhotoCount} foto ✅\n\n`;
      }

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
   * Download photo from WhatsApp media URL with retry logic
   * @param url - Media URL to download
   * @param maxRetries - Maximum number of retry attempts (default: 3)
   * @param timeoutMs - Timeout per attempt in milliseconds (default: 15000ms)
   */
  private static async downloadPhoto(
    url: string,
    maxRetries: number = 3,
    timeoutMs: number = 15000
  ): Promise<Buffer | null> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[WhatsApp Vehicle Upload] Downloading (attempt ${attempt}/${maxRetries}): ${url}`);

        // Create abort controller for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        try {
          const response = await fetch(url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            },
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            console.error(`[WhatsApp Vehicle Upload] Download failed: ${response.status} ${response.statusText}`);
            if (attempt < maxRetries) {
              console.log(`[WhatsApp Vehicle Upload] Retrying in 1s...`);
              await new Promise(resolve => setTimeout(resolve, 1000));
              continue;
            }
            return null;
          }

          const arrayBuffer = await response.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);

          // Validate buffer is not empty and is a valid image
          if (buffer.length < 1000) {
            console.error(`[WhatsApp Vehicle Upload] Downloaded file too small: ${buffer.length} bytes`);
            if (attempt < maxRetries) {
              await new Promise(resolve => setTimeout(resolve, 1000));
              continue;
            }
            return null;
          }

          console.log(`[WhatsApp Vehicle Upload] ✅ Download success: ${buffer.length} bytes`);
          return buffer;
        } finally {
          clearTimeout(timeoutId);
        }
      } catch (error: any) {
        if (error.name === 'AbortError') {
          console.error(`[WhatsApp Vehicle Upload] Download timeout (${timeoutMs}ms)`);
        } else {
          console.error(`[WhatsApp Vehicle Upload] Download error:`, error.message);
        }

        if (attempt < maxRetries) {
          console.log(`[WhatsApp Vehicle Upload] Retrying in 1s...`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }

    console.error(`[WhatsApp Vehicle Upload] ❌ All ${maxRetries} download attempts failed for: ${url}`);
    return null;
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
