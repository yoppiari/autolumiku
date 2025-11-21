/**
 * Vehicle Service
 * Orchestrates vehicle upload workflow with AI processing
 *
 * Epic 2: AI-Powered Vehicle Upload
 * Integrates: R2 Storage, Image Optimizer, AI Identification, Description Generator, Pricing Intelligence
 */

import { prisma } from '@/lib/prisma';
import { r2Client } from '@/services/storage-service/r2-client';
import { imageOptimizer } from '@/services/storage-service/image-optimizer';
import { vehicleIdentificationService } from '@/services/ai-services/vehicle-identification';
import { descriptionGeneratorService } from '@/services/ai-services/description-generator';
import { pricingIntelligenceService } from '@/services/ai-services/pricing-intelligence';
import { createLogger, format, transports } from 'winston';
import { VehicleStatus, PhotoValidationStatus } from '@prisma/client';

const logger = createLogger({
  format: format.combine(
    format.timestamp(),
    format.errors({ stack: true }),
    format.json()
  ),
  transports: [
    new transports.Console({
      format: format.combine(format.colorize(), format.simple())
    }),
    new transports.File({ filename: 'logs/vehicle-service.log' })
  ]
});

export interface UploadPhotoRequest {
  tenantId: string;
  userId: string;
  filename: string;
  contentType: string;
  fileSize: number;
}

export interface UploadPhotoResult {
  uploadUrl: string;
  photoId: string;
  key: string;
}

export interface ProcessPhotoRequest {
  photoId: string;
  imageBuffer: Buffer;
  tenantId: string;
}

export interface ValidatePhotosRequest {
  photoIds: string[];
  tenantId: string;
}

export interface IdentifyVehicleRequest {
  photoIds: string[];
  tenantId: string;
}

export interface GenerateDescriptionRequest {
  vehicleId: string;
  tenantId: string;
  tone?: 'professional' | 'casual' | 'promotional';
  emphasis?: 'features' | 'performance' | 'family' | 'luxury' | 'value';
}

export interface SuggestPricingRequest {
  vehicleId: string;
  tenantId: string;
  mileage?: number;
  condition?: 'excellent' | 'good' | 'fair' | 'poor';
  desiredPositioning?: 'budget' | 'competitive' | 'premium';
}

export interface CreateVehicleRequest {
  tenantId: string;
  userId: string;
  photoIds: string[];
  make: string;
  model: string;
  year: number;
  variant?: string;
  mileage?: number;
  transmissionType?: string;
  fuelType?: string;
  color?: string;
  licensePlate?: string;
  condition?: string;
  price?: number;
}

export interface UpdateVehicleRequest {
  vehicleId: string;
  tenantId: string;
  userId: string;
  data: {
    make?: string;
    model?: string;
    year?: number;
    variant?: string;
    descriptionId?: string;
    descriptionEn?: string;
    features?: any;
    specifications?: any;
    price?: number;
    mileage?: number;
    transmissionType?: string;
    fuelType?: string;
    color?: string;
    licensePlate?: string;
    engineCapacity?: string;
    condition?: string;
    tags?: string[];
    categories?: string[];
    isFeatured?: boolean;
  };
}

export class VehicleService {
  /**
   * Generate signed upload URL for photo
   * Story 2.1: Photo Upload
   */
  async generatePhotoUploadUrl(request: UploadPhotoRequest): Promise<UploadPhotoResult> {
    try {
      logger.info('Generating photo upload URL', {
        tenantId: request.tenantId,
        filename: request.filename
      });

      // Validate file
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
      if (!allowedTypes.includes(request.contentType)) {
        throw new Error('Tipe file tidak didukung. Gunakan JPG, PNG, atau WEBP.');
      }

      const maxSizeMB = parseInt(process.env.MAX_PHOTO_SIZE_MB || '10');
      if (request.fileSize > maxSizeMB * 1024 * 1024) {
        throw new Error(`Ukuran file terlalu besar. Maksimal ${maxSizeMB}MB.`);
      }

      // Generate unique key
      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substring(7);
      const key = `vehicles/${request.tenantId}/${timestamp}-${randomId}/${request.filename}`;

      // Generate signed upload URL
      const uploadUrl = await r2Client.getSignedUploadUrl(key, request.contentType);

      // Create photo record in database (pending upload)
      const photo = await prisma.vehiclePhoto.create({
        data: {
          tenantId: request.tenantId,
          vehicleId: '', // Will be set when vehicle is created
          storageKey: key,
          filename: request.filename,
          fileSize: request.fileSize,
          mimeType: request.contentType,
          width: 0, // Will be updated after processing
          height: 0,
          originalUrl: '', // Will be updated after processing
          thumbnailUrl: '',
          mediumUrl: '',
          largeUrl: '',
          validationStatus: PhotoValidationStatus.PENDING,
          uploadedBy: request.userId
        }
      });

      logger.info('Photo upload URL generated', {
        photoId: photo.id,
        key
      });

      return {
        uploadUrl,
        photoId: photo.id,
        key
      };
    } catch (error) {
      logger.error('Error generating upload URL:', error);
      throw error;
    }
  }

  /**
   * Process uploaded photo (optimize, validate)
   * Story 2.2: Photo Validation
   * Story 2.8: CDN Optimization
   */
  async processUploadedPhoto(request: ProcessPhotoRequest): Promise<void> {
    try {
      logger.info('Processing uploaded photo', {
        photoId: request.photoId
      });

      // Validate photo quality
      const qualityAnalysis = await imageOptimizer.analyzeQuality(request.imageBuffer);
      const validation = await imageOptimizer.validate(request.imageBuffer);

      if (!validation.valid) {
        await prisma.vehiclePhoto.update({
          where: { id: request.photoId },
          data: {
            validationStatus: PhotoValidationStatus.REJECTED,
            validationMessage: validation.message
          }
        });
        throw new Error(validation.message || 'Validasi foto gagal');
      }

      // Get photo record
      const photo = await prisma.vehiclePhoto.findUnique({
        where: { id: request.photoId }
      });

      if (!photo) {
        throw new Error('Photo not found');
      }

      // Process and upload optimized variants
      const optimized = await imageOptimizer.processAndUpload(
        request.imageBuffer,
        photo.storageKey.replace(/\.[^/.]+$/, ''), // Remove extension
        request.tenantId
      );

      // Generate blur hash for lazy loading
      const blurHash = await imageOptimizer.generateBlurHash(request.imageBuffer);

      // Update photo record with processed data
      await prisma.vehiclePhoto.update({
        where: { id: request.photoId },
        data: {
          originalUrl: optimized.original.url,
          thumbnailUrl: optimized.thumbnail.url,
          mediumUrl: optimized.medium.url,
          largeUrl: optimized.large.url,
          width: optimized.original.width,
          height: optimized.original.height,
          qualityScore: qualityAnalysis.score,
          validationStatus: qualityAnalysis.score >= 50
            ? PhotoValidationStatus.VALID
            : PhotoValidationStatus.LOW_QUALITY,
          validationMessage: qualityAnalysis.recommendations.join('; '),
          validationDetails: qualityAnalysis as any,
          blurHash,
          cdnUrl: optimized.medium.url // Use medium as default CDN URL
        }
      });

      logger.info('Photo processed successfully', {
        photoId: request.photoId,
        qualityScore: qualityAnalysis.score,
        status: qualityAnalysis.score >= 50 ? 'VALID' : 'LOW_QUALITY'
      });
    } catch (error) {
      logger.error('Error processing photo:', error);
      throw error;
    }
  }

  /**
   * Validate multiple photos
   * Story 2.2: Photo Validation
   */
  async validatePhotos(request: ValidatePhotosRequest): Promise<{
    valid: boolean;
    photos: Array<{
      photoId: string;
      status: PhotoValidationStatus;
      qualityScore: number;
      message: string;
    }>;
  }> {
    try {
      logger.info('Validating photos', {
        photoCount: request.photoIds.length,
        tenantId: request.tenantId
      });

      const photos = await prisma.vehiclePhoto.findMany({
        where: {
          id: { in: request.photoIds },
          tenantId: request.tenantId
        }
      });

      const results = photos.map(photo => ({
        photoId: photo.id,
        status: photo.validationStatus,
        qualityScore: photo.qualityScore || 0,
        message: photo.validationMessage || 'Validasi belum dilakukan'
      }));

      const allValid = results.every(r => r.status === PhotoValidationStatus.VALID);

      return {
        valid: allValid,
        photos: results
      };
    } catch (error) {
      logger.error('Error validating photos:', error);
      throw error;
    }
  }

  /**
   * Identify vehicle from photos using AI
   * Story 2.3: AI Vehicle Identification
   */
  async identifyVehicle(request: IdentifyVehicleRequest) {
    try {
      logger.info('Identifying vehicle from photos', {
        photoCount: request.photoIds.length,
        tenantId: request.tenantId
      });

      // Get photo URLs
      const photos = await prisma.vehiclePhoto.findMany({
        where: {
          id: { in: request.photoIds },
          tenantId: request.tenantId,
          validationStatus: PhotoValidationStatus.VALID
        },
        select: {
          mediumUrl: true // Use medium resolution for AI analysis
        }
      });

      if (photos.length === 0) {
        throw new Error('No valid photos found for identification');
      }

      const photoUrls = photos.map(p => p.mediumUrl);

      // Call AI identification service
      const identification = await vehicleIdentificationService.identifyWithRetry(photoUrls);

      logger.info('Vehicle identified', {
        make: identification.make,
        model: identification.model,
        year: identification.year,
        confidence: identification.confidence
      });

      return identification;
    } catch (error) {
      logger.error('Error identifying vehicle:', error);
      throw error;
    }
  }

  /**
   * Generate AI description for vehicle
   * Story 2.4: AI Description Generation
   */
  async generateDescription(request: GenerateDescriptionRequest) {
    try {
      logger.info('Generating vehicle description', {
        vehicleId: request.vehicleId,
        tenantId: request.tenantId
      });

      // Get vehicle and photos
      const vehicle = await prisma.vehicle.findFirst({
        where: {
          id: request.vehicleId,
          tenantId: request.tenantId
        },
        include: {
          photos: {
            where: { validationStatus: PhotoValidationStatus.VALID },
            orderBy: { displayOrder: 'asc' }
          }
        }
      });

      if (!vehicle) {
        throw new Error('Vehicle not found');
      }

      const photoUrls = vehicle.photos.map(p => p.mediumUrl);

      // Prepare vehicle identification data
      const vehicleData = {
        make: vehicle.make,
        model: vehicle.model,
        year: vehicle.year,
        variant: vehicle.variant || undefined,
        transmissionType: vehicle.transmissionType as any,
        fuelType: vehicle.fuelType as any,
        color: vehicle.color || undefined,
        condition: vehicle.condition as any,
        visibleFeatures: [],
        bodyType: undefined,
        confidence: vehicle.aiConfidence || 50,
        reasoning: vehicle.aiReasoning || ''
      };

      // Generate description
      const description = await descriptionGeneratorService.generateDescription({
        vehicle: vehicleData,
        photoUrls,
        tone: request.tone || 'professional',
        emphasis: request.emphasis || 'features',
        includeEnglish: true
      });

      // Update vehicle with generated description
      await prisma.vehicle.update({
        where: { id: request.vehicleId },
        data: {
          descriptionId: description.descriptionId,
          descriptionEn: description.descriptionEn,
          features: description.featuresId,
          specifications: description.specifications,
          updatedBy: request.tenantId
        }
      });

      logger.info('Description generated successfully', {
        vehicleId: request.vehicleId,
        wordCount: description.wordCount,
        featuresCount: description.featuresId.length
      });

      return description;
    } catch (error) {
      logger.error('Error generating description:', error);
      throw error;
    }
  }

  /**
   * Suggest pricing for vehicle
   * Story 2.5: Pricing Intelligence
   */
  async suggestPricing(request: SuggestPricingRequest) {
    try {
      logger.info('Analyzing vehicle pricing', {
        vehicleId: request.vehicleId,
        tenantId: request.tenantId
      });

      // Get vehicle data
      const vehicle = await prisma.vehicle.findFirst({
        where: {
          id: request.vehicleId,
          tenantId: request.tenantId
        }
      });

      if (!vehicle) {
        throw new Error('Vehicle not found');
      }

      // Prepare vehicle data for pricing
      const vehicleData = {
        make: vehicle.make,
        model: vehicle.model,
        year: vehicle.year,
        variant: vehicle.variant || undefined,
        transmissionType: vehicle.transmissionType as any,
        fuelType: vehicle.fuelType as any,
        color: vehicle.color || undefined,
        condition: vehicle.condition as any,
        visibleFeatures: [],
        bodyType: undefined,
        confidence: vehicle.aiConfidence || 50,
        reasoning: vehicle.aiReasoning || ''
      };

      // Analyze pricing
      const pricingAnalysis = await pricingIntelligenceService.analyzePricing({
        vehicle: vehicleData,
        mileage: request.mileage || vehicle.mileage || undefined,
        condition: request.condition || (vehicle.condition as any),
        desiredPositioning: request.desiredPositioning || 'competitive'
      });

      // Update vehicle with pricing suggestions
      await prisma.vehicle.update({
        where: { id: request.vehicleId },
        data: {
          aiSuggestedPrice: pricingAnalysis.priceRange.recommended,
          priceConfidence: pricingAnalysis.confidence,
          priceAnalysis: pricingAnalysis as any,
          updatedBy: request.tenantId
        }
      });

      logger.info('Pricing analysis complete', {
        vehicleId: request.vehicleId,
        recommended: pricingAnalysis.priceRange.recommended,
        confidence: pricingAnalysis.confidence
      });

      return pricingAnalysis;
    } catch (error) {
      logger.error('Error analyzing pricing:', error);
      throw error;
    }
  }

  /**
   * Create vehicle with AI-processed data
   * Story 2.6: Vehicle Creation
   */
  async createVehicle(request: CreateVehicleRequest) {
    try {
      logger.info('Creating vehicle', {
        tenantId: request.tenantId,
        make: request.make,
        model: request.model
      });

      // Create vehicle
      const vehicle = await prisma.vehicle.create({
        data: {
          tenantId: request.tenantId,
          make: request.make,
          model: request.model,
          year: request.year,
          variant: request.variant,
          mileage: request.mileage,
          transmissionType: request.transmissionType,
          fuelType: request.fuelType,
          color: request.color,
          licensePlate: request.licensePlate,
          condition: request.condition,
          price: request.price || 0,
          status: VehicleStatus.DRAFT,
          createdBy: request.userId,
          updatedBy: request.userId
        }
      });

      // Associate photos with vehicle
      if (request.photoIds.length > 0) {
        await prisma.vehiclePhoto.updateMany({
          where: {
            id: { in: request.photoIds },
            tenantId: request.tenantId
          },
          data: {
            vehicleId: vehicle.id
          }
        });

        // Set first valid photo as main photo
        const firstValidPhoto = await prisma.vehiclePhoto.findFirst({
          where: {
            vehicleId: vehicle.id,
            validationStatus: PhotoValidationStatus.VALID
          },
          orderBy: { createdAt: 'asc' }
        });

        if (firstValidPhoto) {
          await prisma.vehiclePhoto.update({
            where: { id: firstValidPhoto.id },
            data: { isMainPhoto: true, displayOrder: 0 }
          });
        }
      }

      logger.info('Vehicle created successfully', {
        vehicleId: vehicle.id
      });

      return vehicle;
    } catch (error) {
      logger.error('Error creating vehicle:', error);
      throw error;
    }
  }

  /**
   * Update vehicle
   */
  async updateVehicle(request: UpdateVehicleRequest) {
    try {
      logger.info('Updating vehicle', {
        vehicleId: request.vehicleId,
        tenantId: request.tenantId
      });

      const vehicle = await prisma.vehicle.update({
        where: {
          id: request.vehicleId,
          tenantId: request.tenantId
        },
        data: {
          ...request.data,
          manuallyEdited: true, // Mark as manually edited
          updatedBy: request.userId
        }
      });

      logger.info('Vehicle updated successfully', {
        vehicleId: vehicle.id
      });

      return vehicle;
    } catch (error) {
      logger.error('Error updating vehicle:', error);
      throw error;
    }
  }

  /**
   * Publish vehicle to website
   * Story 2.6: Publishing
   */
  async publishVehicle(vehicleId: string, tenantId: string, userId: string) {
    try {
      logger.info('Publishing vehicle', {
        vehicleId,
        tenantId
      });

      // Validate vehicle is ready for publishing
      const vehicle = await prisma.vehicle.findFirst({
        where: {
          id: vehicleId,
          tenantId
        },
        include: {
          photos: {
            where: { validationStatus: PhotoValidationStatus.VALID }
          }
        }
      });

      if (!vehicle) {
        throw new Error('Vehicle not found');
      }

      if (vehicle.photos.length === 0) {
        throw new Error('Vehicle must have at least one valid photo');
      }

      if (!vehicle.price || vehicle.price === 0) {
        throw new Error('Vehicle must have a price set');
      }

      // Publish vehicle
      const published = await prisma.vehicle.update({
        where: { id: vehicleId },
        data: {
          status: VehicleStatus.AVAILABLE,
          publishedAt: new Date(),
          updatedBy: userId
        }
      });

      logger.info('Vehicle published successfully', {
        vehicleId: published.id,
        publishedAt: published.publishedAt
      });

      return published;
    } catch (error) {
      logger.error('Error publishing vehicle:', error);
      throw error;
    }
  }

  /**
   * Get vehicle by ID
   */
  async getVehicle(vehicleId: string, tenantId: string) {
    try {
      const vehicle = await prisma.vehicle.findFirst({
        where: {
          id: vehicleId,
          tenantId
        },
        include: {
          photos: {
            orderBy: { displayOrder: 'asc' }
          },
          tenant: {
            select: {
              id: true,
              name: true,
              slug: true
            }
          }
        }
      });

      return vehicle;
    } catch (error) {
      logger.error('Error getting vehicle:', error);
      throw error;
    }
  }

  /**
   * List vehicles for tenant
   */
  async listVehicles(
    tenantId: string,
    options: {
      status?: VehicleStatus;
      limit?: number;
      offset?: number;
    } = {}
  ) {
    try {
      const { status, limit = 20, offset = 0 } = options;

      const vehicles = await prisma.vehicle.findMany({
        where: {
          tenantId,
          ...(status && { status })
        },
        include: {
          photos: {
            where: { isMainPhoto: true },
            take: 1
          }
        },
        orderBy: [
          { isFeatured: 'desc' },
          { publishedAt: 'desc' },
          { createdAt: 'desc' }
        ],
        take: limit,
        skip: offset
      });

      const total = await prisma.vehicle.count({
        where: {
          tenantId,
          ...(status && { status })
        }
      });

      return {
        vehicles,
        total,
        limit,
        offset
      };
    } catch (error) {
      logger.error('Error listing vehicles:', error);
      throw error;
    }
  }

  /**
   * Delete vehicle
   */
  async deleteVehicle(vehicleId: string, tenantId: string) {
    try {
      logger.info('Deleting vehicle', {
        vehicleId,
        tenantId
      });

      // Get vehicle photos to delete from R2
      const vehicle = await prisma.vehicle.findFirst({
        where: {
          id: vehicleId,
          tenantId
        },
        include: {
          photos: true
        }
      });

      if (!vehicle) {
        throw new Error('Vehicle not found');
      }

      // Delete photos from R2
      for (const photo of vehicle.photos) {
        try {
          await r2Client.delete(photo.storageKey);
        } catch (error) {
          logger.warn('Failed to delete photo from R2', {
            photoId: photo.id,
            error
          });
        }
      }

      // Delete vehicle (photos will be cascade deleted)
      await prisma.vehicle.delete({
        where: { id: vehicleId }
      });

      logger.info('Vehicle deleted successfully', {
        vehicleId
      });
    } catch (error) {
      logger.error('Error deleting vehicle:', error);
      throw error;
    }
  }
}

// Singleton instance
export const vehicleService = new VehicleService();
