/**
 * WhatsApp AI Vehicle Upload Service
 *
 * Handles vehicle upload from WhatsApp with AI-powered SEO description generation
 * Integrates with /api/v1/vehicles/ai-identify and /api/v1/vehicles
 */

import { prisma } from "@/lib/prisma";
import { vehicleAIService } from "@/lib/ai/vehicle-ai-service";

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

      // 3. Get user ID from phone number
      const staff = await prisma.user.findFirst({
        where: {
          tenantId,
          phone: staffPhone,
        },
      });

      if (!staff) {
        return {
          success: false,
          message: '❌ Staff tidak ditemukan. Hubungi admin untuk mendaftarkan nomor WhatsApp Anda.',
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

          // Pricing (convert to BigInt for database)
          price: BigInt(vehicleData.price * 100000000),  // Convert to cents
          aiSuggestedPrice: BigInt(aiResult.aiSuggestedPrice),
          priceConfidence: aiResult.priceConfidence,
          priceAnalysis: aiResult.priceAnalysis,

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

      // 6. Create photos from WhatsApp media URLs
      console.log('[WhatsApp Vehicle Upload] Creating vehicle photos...');
      for (let i = 0; i < photoUrls.length; i++) {
        await prisma.vehiclePhoto.create({
          data: {
            vehicleId: vehicle.id,
            tenantId,
            storageKey: `whatsapp-upload/${vehicle.id}/${Date.now()}-${i}`,
            originalUrl: photoUrls[i],      // WhatsApp media URL
            thumbnailUrl: photoUrls[i],     // Use same URL for now
            mediumUrl: photoUrls[i],
            largeUrl: photoUrls[i],
            filename: `whatsapp-upload-${i + 1}.jpg`,
            fileSize: 0,  // Unknown from WhatsApp
            mimeType: 'image/jpeg',
            width: 0,     // Unknown from WhatsApp
            height: 0,
            isMainPhoto: i === 0,  // First photo is main
            displayOrder: i,
          },
        });
      }

      console.log('[WhatsApp Vehicle Upload] ✅ Created', photoUrls.length, 'photos');

      // 7. Format success message
      const priceInJuta = Math.round(vehicleData.price / 1000000);
      const aiPriceInJuta = Math.round(aiResult.aiSuggestedPrice / 100000000 / 1000000);

      let message = `✅ *Mobil berhasil diupload!*\n\n`;
      message += `📋 *Detail:*\n`;
      message += `• ID: ${displayId}\n`;
      message += `• Mobil: ${vehicle.make} ${vehicle.model} ${vehicle.year}\n`;
      message += `• Varian: ${aiResult.variant || '-'}\n`;
      message += `• Harga: Rp ${priceInJuta} juta\n`;
      message += `• Foto: ${photoUrls.length} foto\n\n`;

      // Add price analysis if AI suggests different price
      const priceDiff = Math.abs(vehicleData.price - (aiResult.aiSuggestedPrice / 100000000));
      const priceDiffPercent = (priceDiff / vehicleData.price) * 100;

      if (priceDiffPercent > 10) {
        message += `💰 *Analisis Harga AI:*\n`;
        message += `• Rekomendasi AI: Rp ${aiPriceInJuta} juta\n`;
        message += `• ${aiResult.priceAnalysis.recommendation}\n\n`;
      }

      message += `🤖 *AI Confidence:* ${aiResult.aiConfidence}%\n`;
      message += `📝 *Deskripsi SEO:* Otomatis di-generate (${aiResult.descriptionId.length} karakter)\n\n`;
      message += `Lihat di dashboard: /dashboard/vehicles/${vehicle.id}`;

      return {
        success: true,
        vehicleId: vehicle.id,
        displayId,
        message,
      };

    } catch (error: any) {
      console.error('[WhatsApp Vehicle Upload] ❌ Error:', error);
      return {
        success: false,
        message: `❌ Gagal upload kendaraan: ${error.message}`,
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
