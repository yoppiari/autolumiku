/**
 * License Plate Detection Service
 * Uses AI Vision to detect and cover license plates in vehicle photos
 */

import sharp from 'sharp';
import { createZAIClient } from '@/lib/ai/zai-client';
import { ImageProcessingService } from './image-processing.service';

export interface PlateLocation {
  x: number;      // X coordinate (percentage from left, 0-100)
  y: number;      // Y coordinate (percentage from top, 0-100)
  width: number;  // Width (percentage, 0-100)
  height: number; // Height (percentage, 0-100)
  confidence: number;
}

export interface PlateDetectionResult {
  detected: boolean;
  plates: PlateLocation[];
  error?: string;
}

export class PlateDetectionService {
  /**
   * Detect license plate locations in an image using AI Vision
   */
  static async detectPlates(imageBuffer: Buffer): Promise<PlateDetectionResult> {
    try {
      const zaiClient = createZAIClient();

      if (!zaiClient) {
        console.log('[Plate Detection] ZAI client not available, skipping detection');
        return { detected: false, plates: [], error: 'AI service not configured' };
      }

      // Convert buffer to base64 for AI vision
      const base64Image = ImageProcessingService.bufferToBase64(imageBuffer, 'image/jpeg');

      console.log('[Plate Detection] Sending image to AI Vision for plate detection...');

      const result = await zaiClient.generateVision({
        systemPrompt: `You are a license plate detection system. Analyze vehicle photos and identify the location of license plates.

IMPORTANT: Return ONLY valid JSON, no markdown, no explanations.

For each license plate found, provide its bounding box as percentage coordinates (0-100):
- x: distance from left edge (percentage)
- y: distance from top edge (percentage)
- width: width of plate area (percentage)
- height: height of plate area (percentage)

Consider all possible plate positions:
- Front bumper (front view, 3/4 front view)
- Rear bumper (rear view, 3/4 rear view)
- Side plates if visible

Return JSON format:
{
  "detected": true/false,
  "plates": [
    { "x": 45, "y": 75, "width": 10, "height": 5, "confidence": 0.95 }
  ]
}

If no plates visible or uncertain, return: { "detected": false, "plates": [] }`,
        userPrompt: 'Detect all license plates in this vehicle photo. Return the bounding box coordinates as percentages.',
        images: [base64Image],
        temperature: 0.1,
        maxTokens: 500,
      });

      console.log('[Plate Detection] AI Response:', result.content);

      // Parse AI response
      const parsed = zaiClient.parseJSON<PlateDetectionResult>(result.content);

      console.log('[Plate Detection] Detected plates:', parsed.plates?.length || 0);

      return {
        detected: parsed.detected && parsed.plates && parsed.plates.length > 0,
        plates: parsed.plates || [],
      };

    } catch (error: any) {
      console.error('[Plate Detection] Error:', error.message);
      return {
        detected: false,
        plates: [],
        error: error.message
      };
    }
  }

  private static readonly IS_ENABLED = false; // Globally disable for now to save latency/costs

  /**
   * Cover detected license plates with a logo or solid rectangle
   */
  static async coverPlates(
    imageBuffer: Buffer,
    plates: PlateLocation[],
    options: {
      logoBuffer?: Buffer;
      logoUrl?: string;
      tenantName?: string;
      coverColor?: string;
    } = {}
  ): Promise<Buffer> {
    if (!this.IS_ENABLED) {
      return imageBuffer;
    }

    if (plates.length === 0) {
      console.log('[Plate Detection] No plates to cover');
      return imageBuffer;
    }

    try {
      const metadata = await sharp(imageBuffer).metadata();
      const imgWidth = metadata.width || 1920;
      const imgHeight = metadata.height || 1080;

      console.log(`[Plate Detection] Image size: ${imgWidth}x${imgHeight}`);

      // Create composite operations for each plate
      const composites: sharp.OverlayOptions[] = [];

      for (const plate of plates) {
        // Convert percentage to pixels
        const plateX = Math.round((plate.x / 100) * imgWidth);
        const plateY = Math.round((plate.y / 100) * imgHeight);
        const plateWidth = Math.round((plate.width / 100) * imgWidth);
        const plateHeight = Math.round((plate.height / 100) * imgHeight);

        console.log(`[Plate Detection] Covering plate at: x=${plateX}, y=${plateY}, w=${plateWidth}, h=${plateHeight}`);

        // Create cover overlay
        let overlay: Buffer;

        if (options.logoBuffer) {
          // Use provided logo
          overlay = await sharp(options.logoBuffer)
            .resize(plateWidth, plateHeight, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 1 } })
            .toBuffer();
        } else {
          // Create text-based cover with tenant branding
          const tenantName = options.tenantName || 'PRIMA MOBIL';
          overlay = await this.createBrandingOverlay(plateWidth, plateHeight, tenantName);
        }

        composites.push({
          input: overlay,
          left: plateX,
          top: plateY,
        });
      }

      // Apply all overlays
      const result = await sharp(imageBuffer)
        .composite(composites)
        .toBuffer();

      console.log('[Plate Detection] Successfully covered', plates.length, 'plate(s)');
      return result;

    } catch (error: any) {
      console.error('[Plate Detection] Error covering plates:', error.message);
      return imageBuffer; // Return original if covering fails
    }
  }

  /**
   * Create branding overlay for license plate cover
   * Clean design without text - just solid color with subtle stripe
   */
  private static async createBrandingOverlay(
    width: number,
    height: number,
    tenantName: string
  ): Promise<Buffer> {
    // Ensure minimum dimensions
    const overlayWidth = Math.max(width, 100);
    const overlayHeight = Math.max(height, 30);

    // Create clean SVG overlay WITHOUT text - just solid color
    const svg = `
      <svg width="${overlayWidth}" height="${overlayHeight}">
        <defs>
          <linearGradient id="stripe" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="50%" style="stop-color:#dc2626"/>
            <stop offset="50%" style="stop-color:#eab308"/>
          </linearGradient>
        </defs>
        <rect width="100%" height="100%" fill="#000000"/>
        <rect y="${overlayHeight - 4}" width="100%" height="4" fill="url(#stripe)"/>
      </svg>
    `;

    return sharp(Buffer.from(svg))
      .png()
      .toBuffer();
  }

  /**
   * Process image: detect plates and cover them
   * Returns both original and covered versions
   */
  static async processImage(
    imageBuffer: Buffer,
    options: {
      tenantName?: string;
      tenantLogoUrl?: string;
    } = {}
  ): Promise<{
    original: Buffer;
    covered: Buffer;
    platesDetected: number;
  }> {
    // 1. Check if enabled
    if (!this.IS_ENABLED) {
      return {
        original: imageBuffer,
        covered: imageBuffer,
        platesDetected: 0,
      };
    }

    // 2. Detect plates
    const detection = await this.detectPlates(imageBuffer);

    if (!detection.detected || detection.plates.length === 0) {
      console.log('[Plate Detection] No plates detected, returning original');
      return {
        original: imageBuffer,
        covered: imageBuffer,
        platesDetected: 0,
      };
    }

    // 2. Download tenant logo if URL provided
    let logoBuffer: Buffer | undefined;
    if (options.tenantLogoUrl) {
      try {
        const response = await fetch(options.tenantLogoUrl);
        if (response.ok) {
          logoBuffer = Buffer.from(await response.arrayBuffer());
        }
      } catch (e) {
        console.log('[Plate Detection] Could not download logo, using text overlay');
      }
    }

    // 3. Cover plates
    const covered = await this.coverPlates(imageBuffer, detection.plates, {
      logoBuffer,
      tenantName: options.tenantName,
    });

    return {
      original: imageBuffer,
      covered,
      platesDetected: detection.plates.length,
    };
  }
}

export default PlateDetectionService;
