/**
 * Image Optimization Service
 * Processes and optimizes vehicle photos for different use cases
 * Uses Sharp for high-performance image processing
 *
 * Epic 2: AI-Powered Vehicle Upload
 * Story 2.1, 2.2, 2.8
 */

import sharp from 'sharp';
import { createLogger, format, transports } from 'winston';
import { r2Client } from './r2-client';

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
    new transports.File({ filename: 'logs/image-optimizer.log' })
  ]
});

export interface ImageVariant {
  name: 'thumbnail' | 'medium' | 'large' | 'original';
  width: number;
  height?: number; // Optional, will maintain aspect ratio if not provided
  quality: number; // 1-100
  format: 'jpeg' | 'webp' | 'png';
}

export interface OptimizedImages {
  original: {
    url: string;
    key: string;
    width: number;
    height: number;
    fileSize: number;
  };
  thumbnail: {
    url: string;
    key: string;
    width: number;
    height: number;
    fileSize: number;
  };
  medium: {
    url: string;
    key: string;
    width: number;
    height: number;
    fileSize: number;
  };
  large: {
    url: string;
    key: string;
    width: number;
    height: number;
    fileSize: number;
  };
}

export interface ImageMetadata {
  width: number;
  height: number;
  format: string;
  size: number;
  hasAlpha: boolean;
}

export interface QualityAnalysis {
  score: number; // 0-100
  width: number;
  height: number;
  resolution: 'low' | 'medium' | 'high';
  sharpness: 'poor' | 'acceptable' | 'good' | 'excellent';
  recommendations: string[];
}

export class ImageOptimizer {
  // Image variants configuration for vehicle photos
  private readonly variants: ImageVariant[] = [
    {
      name: 'thumbnail',
      width: 300,
      height: 200,
      quality: 80,
      format: 'webp'
    },
    {
      name: 'medium',
      width: 800,
      height: 600,
      quality: 85,
      format: 'webp'
    },
    {
      name: 'large',
      width: 1920,
      height: 1080,
      quality: 90,
      format: 'webp'
    }
  ];

  /**
   * Process and upload all image variants
   */
  async processAndUpload(
    imageBuffer: Buffer,
    baseKey: string, // e.g., "vehicles/uuid/filename"
    tenantId: string
  ): Promise<OptimizedImages> {
    try {
      logger.info('Starting image processing', { baseKey, tenantId });

      // Get original image metadata
      const metadata = await this.getMetadata(imageBuffer);
      logger.info('Image metadata extracted', metadata);

      // Upload original (optimized but full resolution)
      const originalKey = `${baseKey}-original.jpg`;
      const originalBuffer = await this.optimizeOriginal(imageBuffer);
      const originalResult = await r2Client.upload({
        key: originalKey,
        body: originalBuffer,
        contentType: 'image/jpeg',
        metadata: {
          tenantId,
          variant: 'original',
          originalWidth: metadata.width.toString(),
          originalHeight: metadata.height.toString()
        }
      });

      // Process and upload all variants in parallel
      const variantResults = await Promise.all(
        this.variants.map(async (variant) => {
          const variantKey = `${baseKey}-${variant.name}.${variant.format}`;
          const variantBuffer = await this.createVariant(imageBuffer, variant);

          const result = await r2Client.upload({
            key: variantKey,
            body: variantBuffer,
            contentType: `image/${variant.format}`,
            metadata: {
              tenantId,
              variant: variant.name
            }
          });

          const variantMetadata = await sharp(variantBuffer).metadata();

          return {
            name: variant.name,
            url: result.url,
            key: result.key,
            width: variantMetadata.width || variant.width,
            height: variantMetadata.height || 0,
            fileSize: variantBuffer.length
          };
        })
      );

      const optimizedImages: OptimizedImages = {
        original: {
          url: originalResult.url,
          key: originalResult.key,
          width: metadata.width,
          height: metadata.height,
          fileSize: originalBuffer.length
        },
        thumbnail: variantResults.find(v => v.name === 'thumbnail')!,
        medium: variantResults.find(v => v.name === 'medium')!,
        large: variantResults.find(v => v.name === 'large')!
      };

      logger.info('Image processing complete', {
        baseKey,
        variants: Object.keys(optimizedImages)
      });

      return optimizedImages;
    } catch (error) {
      logger.error('Image processing error:', error);
      throw new Error(`Failed to process image: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Optimize original image (compress without resizing)
   */
  private async optimizeOriginal(imageBuffer: Buffer): Promise<Buffer> {
    return sharp(imageBuffer)
      .jpeg({ quality: 90, progressive: true })
      .toBuffer();
  }

  /**
   * Create optimized variant
   */
  private async createVariant(imageBuffer: Buffer, variant: ImageVariant): Promise<Buffer> {
    let pipeline = sharp(imageBuffer);

    // Resize
    if (variant.height) {
      pipeline = pipeline.resize(variant.width, variant.height, {
        fit: 'cover',
        position: 'center'
      });
    } else {
      pipeline = pipeline.resize(variant.width, null, {
        fit: 'inside',
        withoutEnlargement: true
      });
    }

    // Convert to target format
    switch (variant.format) {
      case 'webp':
        pipeline = pipeline.webp({ quality: variant.quality });
        break;
      case 'jpeg':
        pipeline = pipeline.jpeg({ quality: variant.quality, progressive: true });
        break;
      case 'png':
        pipeline = pipeline.png({ quality: variant.quality, compressionLevel: 9 });
        break;
    }

    return pipeline.toBuffer();
  }

  /**
   * Extract image metadata
   */
  async getMetadata(imageBuffer: Buffer): Promise<ImageMetadata> {
    try {
      const metadata = await sharp(imageBuffer).metadata();

      return {
        width: metadata.width || 0,
        height: metadata.height || 0,
        format: metadata.format || 'unknown',
        size: metadata.size || 0,
        hasAlpha: metadata.hasAlpha || false
      };
    } catch (error) {
      logger.error('Metadata extraction error:', error);
      throw new Error('Failed to extract image metadata');
    }
  }

  /**
   * Analyze image quality (Story 2.2)
   */
  async analyzeQuality(imageBuffer: Buffer): Promise<QualityAnalysis> {
    try {
      const metadata = await this.getMetadata(imageBuffer);
      const stats = await sharp(imageBuffer).stats();

      // Calculate resolution score
      const totalPixels = metadata.width * metadata.height;
      let resolutionScore = 0;
      let resolution: 'low' | 'medium' | 'high' = 'low';

      if (totalPixels >= 1920 * 1080) {
        // 2MP+
        resolutionScore = 100;
        resolution = 'high';
      } else if (totalPixels >= 1280 * 720) {
        // 1MP+
        resolutionScore = 75;
        resolution = 'medium';
      } else if (totalPixels >= 640 * 480) {
        // 0.3MP+
        resolutionScore = 50;
        resolution = 'low';
      } else {
        resolutionScore = 25;
        resolution = 'low';
      }

      // Analyze sharpness using standard deviation
      // Higher std dev generally means sharper images
      const channelStats = stats.channels;
      const avgStdDev = channelStats.reduce((sum, ch) => sum + ch.stdev, 0) / channelStats.length;

      let sharpnessScore = 0;
      let sharpness: 'poor' | 'acceptable' | 'good' | 'excellent' = 'poor';

      if (avgStdDev > 60) {
        sharpnessScore = 100;
        sharpness = 'excellent';
      } else if (avgStdDev > 40) {
        sharpnessScore = 75;
        sharpness = 'good';
      } else if (avgStdDev > 25) {
        sharpnessScore = 50;
        sharpness = 'acceptable';
      } else {
        sharpnessScore = 25;
        sharpness = 'poor';
      }

      // Overall quality score (weighted average)
      const qualityScore = Math.round((resolutionScore * 0.6) + (sharpnessScore * 0.4));

      // Generate recommendations
      const recommendations: string[] = [];

      if (metadata.width < 1280 || metadata.height < 720) {
        recommendations.push('Gunakan resolusi minimal 1280x720 untuk hasil terbaik');
      }

      if (sharpness === 'poor' || sharpness === 'acceptable') {
        recommendations.push('Foto terlihat kurang tajam, pastikan fokus kamera tepat pada kendaraan');
      }

      if (metadata.size > 10 * 1024 * 1024) {
        // > 10MB
        recommendations.push('Ukuran file besar, foto akan dioptimalkan otomatis');
      }

      if (recommendations.length === 0) {
        recommendations.push('Kualitas foto sudah baik!');
      }

      logger.info('Quality analysis complete', {
        score: qualityScore,
        resolution,
        sharpness,
        width: metadata.width,
        height: metadata.height
      });

      return {
        score: qualityScore,
        width: metadata.width,
        height: metadata.height,
        resolution,
        sharpness,
        recommendations
      };
    } catch (error) {
      logger.error('Quality analysis error:', error);
      throw new Error('Failed to analyze image quality');
    }
  }

  /**
   * Validate image meets minimum requirements
   */
  async validate(imageBuffer: Buffer): Promise<{ valid: boolean; message?: string }> {
    try {
      const metadata = await this.getMetadata(imageBuffer);

      // Check minimum dimensions
      if (metadata.width < 640 || metadata.height < 480) {
        return {
          valid: false,
          message: 'Resolusi foto terlalu kecil. Minimum 640x480 pixel.'
        };
      }

      // Check maximum dimensions (to prevent memory issues)
      if (metadata.width > 10000 || metadata.height > 10000) {
        return {
          valid: false,
          message: 'Resolusi foto terlalu besar. Maximum 10000x10000 pixel.'
        };
      }

      // Check file size
      if (metadata.size > 20 * 1024 * 1024) {
        // > 20MB
        return {
          valid: false,
          message: 'Ukuran file terlalu besar. Maximum 20MB.'
        };
      }

      return { valid: true };
    } catch (error) {
      logger.error('Validation error:', error);
      return {
        valid: false,
        message: 'File tidak dapat diproses. Pastikan format file benar (JPG, PNG, WEBP).'
      };
    }
  }

  /**
   * Generate blurhash for lazy loading placeholder
   */
  async generateBlurHash(imageBuffer: Buffer): Promise<string> {
    // Simple placeholder implementation
    // In production, use the 'blurhash' package
    // For now, return a simple base64 encoded tiny version
    const tinyBuffer = await sharp(imageBuffer)
      .resize(10, 10, { fit: 'cover' })
      .blur(2)
      .jpeg({ quality: 50 })
      .toBuffer();

    return `data:image/jpeg;base64,${tinyBuffer.toString('base64')}`;
  }
}

// Singleton instance
export const imageOptimizer = new ImageOptimizer();
