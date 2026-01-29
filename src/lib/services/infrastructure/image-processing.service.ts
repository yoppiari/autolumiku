/**
 * Image Processing Service
 * Uses Sharp library for resize, optimize, and generate multiple sizes
 */

import sharp from 'sharp';
import {
  ProcessedPhoto,
  PhotoMetadata,
  PHOTO_SIZES,
  PhotoSize,
} from '../../../types/photo.types';

export class ImageProcessingService {
  /**
   * Process uploaded photo: generate multiple sizes and extract metadata
   */
  static async processPhoto(buffer: Buffer): Promise<ProcessedPhoto> {
    // Get original metadata
    const metadata = await this.getMetadata(buffer);

    // Generate all sizes in parallel
    const [thumbnail, medium, large, original] = await Promise.all([
      this.resizePhoto(buffer, 'thumbnail'),
      this.resizePhoto(buffer, 'medium'),
      this.resizePhoto(buffer, 'large'),
      this.optimizeOriginal(buffer),
    ]);

    return {
      thumbnail,
      medium,
      large,
      original,
      metadata,
    };
  }

  /**
   * Resize photo to specific size with WebP optimization
   */
  private static async resizePhoto(
    buffer: Buffer,
    size: PhotoSize
  ): Promise<Buffer> {
    const config = PHOTO_SIZES[size];

    return sharp(buffer)
      .resize(config.width, config.height, {
        fit: config.fit,
        withoutEnlargement: true, // Don't upscale small images
      })
      .webp({ quality: config.quality })
      .toBuffer();
  }

  /**
   * Optimize original photo (keep format but compress)
   */
  private static async optimizeOriginal(buffer: Buffer): Promise<Buffer> {
    const metadata = await sharp(buffer).metadata();

    // If original is already WebP, just optimize
    if (metadata.format === 'webp') {
      return sharp(buffer)
        .webp({ quality: PHOTO_SIZES.original.quality })
        .toBuffer();
    }

    // For JPEG/PNG, keep format but compress
    if (metadata.format === 'jpeg' || metadata.format === 'jpg') {
      return sharp(buffer).jpeg({ quality: 90 }).toBuffer();
    }

    if (metadata.format === 'png') {
      return sharp(buffer).png({ compressionLevel: 9 }).toBuffer();
    }

    // Fallback: convert to WebP
    return sharp(buffer)
      .webp({ quality: PHOTO_SIZES.original.quality })
      .toBuffer();
  }

  /**
   * Extract photo metadata
   */
  static async getMetadata(buffer: Buffer): Promise<PhotoMetadata> {
    const metadata = await sharp(buffer).metadata();

    return {
      width: metadata.width || 0,
      height: metadata.height || 0,
      format: metadata.format || 'unknown',
      size: buffer.length,
      mimeType: this.formatToMimeType(metadata.format || 'jpeg'),
    };
  }

  /**
   * Convert base64 to buffer
   */
  static base64ToBuffer(base64: string): Buffer {
    // Remove data:image/xxx;base64, prefix if present
    const base64Data = base64.replace(/^data:image\/\w+;base64,/, '');
    return Buffer.from(base64Data, 'base64');
  }

  /**
   * Convert buffer to base64 (for backward compatibility)
   */
  static bufferToBase64(buffer: Buffer, mimeType: string = 'image/webp'): string {
    return `data:${mimeType};base64,${buffer.toString('base64')}`;
  }

  /**
   * Format to MIME type mapping
   */
  private static formatToMimeType(format: string): string {
    const mapping: Record<string, string> = {
      jpeg: 'image/jpeg',
      jpg: 'image/jpeg',
      png: 'image/png',
      webp: 'image/webp',
      gif: 'image/gif',
      tiff: 'image/tiff',
      bmp: 'image/bmp',
    };

    return mapping[format.toLowerCase()] || 'image/jpeg';
  }

  /**
   * Get file extension from MIME type
   */
  static mimeTypeToExtension(mimeType: string): string {
    const mapping: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/gif': 'gif',
      'image/tiff': 'tiff',
      'image/bmp': 'bmp',
    };

    return mapping[mimeType] || 'jpg';
  }

  /**
   * Generate filename for processed photo
   */
  static generateFilename(
    vehicleId: string,
    make: string,
    model: string,
    index: number,
    size: PhotoSize
  ): string {
    const timestamp = Date.now();
    const sanitizedMake = make.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const sanitizedModel = model.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const extension = size === 'original' ? 'jpg' : 'webp';

    return `${sanitizedMake}-${sanitizedModel}-${timestamp}-${index + 1}-${size}.${extension}`;
  }
}
