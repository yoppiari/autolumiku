/**
 * Photo Quality Validation Service
 * Validates photo quality (sharpness, brightness, resolution, aspect ratio)
 */

import sharp from 'sharp';
import { PhotoQualityResult } from '../../types/photo.types';

export class PhotoQualityService {
  /**
   * Validate photo quality and return score
   */
  static async validatePhoto(buffer: Buffer): Promise<PhotoQualityResult> {
    const [sharpness, brightness, resolution, aspectRatio, metadata] = await Promise.all([
      this.checkSharpness(buffer),
      this.checkBrightness(buffer),
      this.checkResolution(buffer),
      this.checkAspectRatio(buffer),
      sharp(buffer).metadata(),
    ]);

    // Calculate overall score (weighted average)
    const score = Math.round(
      sharpness * 0.35 + // Sharpness is most important
      brightness * 0.25 + // Brightness affects visibility
      (resolution === 'PASS' ? 100 : 0) * 0.2 + // Resolution is binary
      (aspectRatio === 'PASS' ? 100 : 0) * 0.2 // Aspect ratio is binary
    );

    // Determine status (matching PhotoValidationStatus enum)
    let status: 'VALID' | 'LOW_QUALITY' | 'REJECTED';
    if (score >= 70) status = 'VALID';
    else if (score >= 50) status = 'LOW_QUALITY';
    else status = 'REJECTED';

    // Generate message
    const message = this.generateMessage(score, {
      sharpness,
      brightness,
      resolution,
      aspectRatio,
      metadata,
    });

    return {
      score,
      status,
      details: {
        sharpness: Math.round(sharpness),
        brightness: Math.round(brightness),
        resolution,
        aspectRatio,
      },
      message,
    };
  }

  /**
   * Check image sharpness (blur detection using Laplacian variance)
   */
  private static async checkSharpness(buffer: Buffer): Promise<number> {
    try {
      // Convert to grayscale and apply Laplacian kernel for edge detection
      const { data, info } = await sharp(buffer)
        .greyscale()
        .raw()
        .toBuffer({ resolveWithObject: true });

      // Calculate variance of pixel values (high variance = sharp, low = blurry)
      const pixels = Array.from(data);
      const mean = pixels.reduce((sum, val) => sum + val, 0) / pixels.length;
      const variance = pixels.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / pixels.length;

      // Normalize variance to 0-100 score
      // Typical sharp image variance: 500-3000+
      // Typical blurry image variance: 0-500
      const score = Math.min(100, (variance / 30));

      return score;
    } catch (error) {
      console.error('Sharpness check error:', error);
      return 50; // Default middle score if check fails
    }
  }

  /**
   * Check image brightness
   */
  private static async checkBrightness(buffer: Buffer): Promise<number> {
    try {
      const stats = await sharp(buffer).stats();

      // Calculate average brightness across all channels
      const avgBrightness =
        stats.channels.reduce((sum, channel) => sum + channel.mean, 0) /
        stats.channels.length;

      // Ideal brightness: 80-180 (out of 255)
      // Too dark: < 60
      // Too bright: > 200
      let score: number;
      if (avgBrightness < 60) {
        // Too dark
        score = (avgBrightness / 60) * 50;
      } else if (avgBrightness > 200) {
        // Too bright
        score = ((255 - avgBrightness) / 55) * 50;
      } else if (avgBrightness >= 80 && avgBrightness <= 180) {
        // Ideal range
        score = 100;
      } else if (avgBrightness >= 60 && avgBrightness < 80) {
        // Slightly dark but acceptable
        score = 50 + ((avgBrightness - 60) / 20) * 50;
      } else {
        // Slightly bright but acceptable
        score = 100 - ((avgBrightness - 180) / 20) * 50;
      }

      return Math.max(0, Math.min(100, score));
    } catch (error) {
      console.error('Brightness check error:', error);
      return 50; // Default middle score if check fails
    }
  }

  /**
   * Check minimum resolution
   */
  private static async checkResolution(
    buffer: Buffer
  ): Promise<'PASS' | 'FAIL'> {
    try {
      const metadata = await sharp(buffer).metadata();
      const width = metadata.width || 0;
      const height = metadata.height || 0;

      // Minimum resolution: 800x600
      const MIN_WIDTH = 800;
      const MIN_HEIGHT = 600;

      return width >= MIN_WIDTH && height >= MIN_HEIGHT ? 'PASS' : 'FAIL';
    } catch (error) {
      console.error('Resolution check error:', error);
      return 'FAIL';
    }
  }

  /**
   * Check aspect ratio (should be reasonable for vehicle photos)
   */
  private static async checkAspectRatio(
    buffer: Buffer
  ): Promise<'PASS' | 'FAIL'> {
    try {
      const metadata = await sharp(buffer).metadata();
      const width = metadata.width || 0;
      const height = metadata.height || 0;

      if (width === 0 || height === 0) return 'FAIL';

      const ratio = width / height;

      // Acceptable aspect ratios for vehicle photos: 4:3 to 16:9
      // 4:3 = 1.33, 16:9 = 1.78, 3:2 = 1.5
      const MIN_RATIO = 1.2; // Slightly narrower than 4:3
      const MAX_RATIO = 2.0; // Slightly wider than 16:9

      return ratio >= MIN_RATIO && ratio <= MAX_RATIO ? 'PASS' : 'FAIL';
    } catch (error) {
      console.error('Aspect ratio check error:', error);
      return 'FAIL';
    }
  }

  /**
   * Generate human-readable message based on validation results
   */
  private static generateMessage(
    score: number,
    details: {
      sharpness: number;
      brightness: number;
      resolution: 'PASS' | 'FAIL';
      aspectRatio: 'PASS' | 'FAIL';
      metadata: sharp.Metadata;
    }
  ): string {
    const issues: string[] = [];

    // Check sharpness
    if (details.sharpness < 50) {
      issues.push('Foto tampak blur atau tidak fokus');
    } else if (details.sharpness < 70) {
      issues.push('Ketajaman foto kurang optimal');
    }

    // Check brightness
    if (details.brightness < 40) {
      issues.push('Foto terlalu gelap, gunakan pencahayaan lebih baik');
    } else if (details.brightness > 90) {
      issues.push('Foto terlalu terang, kurangi pencahayaan');
    } else if (details.brightness < 60 || details.brightness > 80) {
      issues.push('Pencahayaan kurang ideal');
    }

    // Check resolution
    if (details.resolution === 'FAIL') {
      issues.push(
        `Resolusi terlalu rendah (${details.metadata.width}x${details.metadata.height}), minimum 800x600`
      );
    }

    // Check aspect ratio
    if (details.aspectRatio === 'FAIL') {
      issues.push('Aspect ratio tidak sesuai untuk foto kendaraan');
    }

    // Generate final message
    if (score >= 80) {
      return '✅ Kualitas foto sangat baik!';
    } else if (score >= 70) {
      return '✅ Kualitas foto baik' + (issues.length > 0 ? `, namun ${issues[0].toLowerCase()}` : '');
    } else if (score >= 50) {
      return `⚠️ Kualitas foto cukup: ${issues.join(', ')}`;
    } else {
      return `❌ Kualitas foto kurang baik: ${issues.join(', ')}`;
    }
  }
}
