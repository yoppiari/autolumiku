import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import sharp from 'sharp';
import crypto from 'crypto';
import { createLogger } from 'winston';

const logger = createLogger({
  level: 'info',
  format: {
    combine: [
      require('winston').format.timestamp(),
      require('winston').format.errors({ stack: true }),
      require('winston').format.json(),
    ],
  },
  transports: [
    new require('winston').transports.Console({
      format: require('winston').format.combine(
        require('winston').format.colorize(),
        require('winston').format.simple()
      )
    })
  ]
});

export interface FileUploadResult {
  key: string;
  url: string;
  presignedUrl?: string;
  size: number;
  mimeType: string;
  metadata: FileMetadata;
}

export interface FileMetadata {
  originalName: string;
  uploadedAt: Date;
  checksum: string;
  width?: number;
  height?: number;
  optimized: boolean;
}

export interface ProcessingOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: 'jpeg' | 'png' | 'webp';
  generateFavicon?: boolean;
  generateThumbnail?: boolean;
}

/**
 * Complete file storage service with image processing and secure URL generation
 */
export class FileStorageCompleteService {
  private s3Client: S3Client;
  private bucketName: string;
  private region: string;

  constructor() {
    this.s3Client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });

    this.bucketName = process.env.S3_BUCKET_NAME!;
    this.region = process.env.AWS_REGION || 'us-east-1';
  }

  /**
   * Upload file with automatic image processing and optimization
   */
  async uploadFile(
    file: Buffer,
    originalName: string,
    mimeType: string,
    tenantId: string,
    options: ProcessingOptions = {}
  ): Promise<FileUploadResult> {
    try {
      logger.info(`Starting file upload: ${originalName} for tenant: ${tenantId}`);

      // Generate file key
      const fileExtension = this.getFileExtension(originalName, mimeType);
      const baseKey = `tenants/${tenantId}/branding/${Date.now()}-${this.sanitizeFileName(originalName)}`;

      let processedBuffer = file;
      let metadata: FileMetadata = {
        originalName,
        uploadedAt: new Date(),
        checksum: this.calculateChecksum(file),
        optimized: false
      };

      // Process image files
      if (this.isImageFile(mimeType)) {
        const processed = await this.processImage(file, options);
        processedBuffer = processed.buffer;
        metadata = {
          ...metadata,
          width: processed.width,
          height: processed.height,
          optimized: true
        };
      }

      // Upload to S3 with private ACL (more secure than public-read)
      const key = `${baseKey}.${fileExtension}`;
      await this.s3Client.send(new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: processedBuffer,
        ContentType: mimeType,
        ACL: 'private', // Changed from public-read for better security
        Metadata: {
          originalName,
          tenantId,
          uploadedAt: metadata.uploadedAt.toISOString(),
          checksum: metadata.checksum
        }
      }));

      // Generate secure presigned URL
      const presignedUrl = await this.generatePresignedUrl(key, 3600); // 1 hour expiry

      logger.info(`File uploaded successfully: ${key}`);

      return {
        key,
        url: `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${key}`,
        presignedUrl,
        size: processedBuffer.length,
        mimeType,
        metadata
      };

    } catch (error) {
      logger.error('File upload failed:', error);
      throw new Error(`File upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate secure presigned URL for file access
   */
  async generatePresignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const presignedUrl = await getSignedUrl(this.s3Client, command, { expiresIn });

      logger.debug(`Generated presigned URL for key: ${key}, expires in: ${expiresIn}s`);
      return presignedUrl;

    } catch (error) {
      logger.error('Failed to generate presigned URL:', error);
      throw new Error(`Failed to generate presigned URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Process and optimize image using Sharp
   */
  private async processImage(
    buffer: Buffer,
    options: ProcessingOptions
  ): Promise<{ buffer: Buffer; width: number; height: number }> {
    try {
      let sharpInstance = sharp(buffer);

      // Get original metadata
      const metadata = await sharpInstance.metadata();

      // Apply resizing if specified
      if (options.maxWidth || options.maxHeight) {
        sharpInstance = sharpInstance.resize(options.maxWidth, options.maxHeight, {
          fit: 'inside',
          withoutEnlargement: true
        });
      }

      // Apply format conversion and quality
      if (options.format || options.quality) {
        const format = options.format || (metadata.format as any) || 'jpeg';

        switch (format) {
          case 'jpeg':
            sharpInstance = sharpInstance.jpeg({
              quality: options.quality || 85,
              progressive: true
            });
            break;
          case 'png':
            sharpInstance = sharpInstance.png({
              quality: options.quality || 85,
              progressive: true
            });
            break;
          case 'webp':
            sharpInstance = sharpInstance.webp({
              quality: options.quality || 85
            });
            break;
        }
      } else {
        // Auto-optimize based on original format
        if (metadata.format === 'png') {
          sharpInstance = sharpInstance.png({ progressive: true });
        } else if (metadata.format === 'jpeg') {
          sharpInstance = sharpInstance.jpeg({ quality: 85, progressive: true });
        } else {
          sharpInstance = sharpInstance.jpeg({ quality: 85, progressive: true });
        }
      }

      const processedBuffer = await sharpInstance.toBuffer();
      const processedMetadata = await sharp(processedBuffer).metadata();

      logger.info(`Image processed: ${metadata.width}x${metadata.height} → ${processedMetadata.width}x${processedMetadata.height}, size: ${buffer.length} → ${processedBuffer.length}`);

      return {
        buffer: processedBuffer,
        width: processedMetadata.width || 0,
        height: processedMetadata.height || 0
      };

    } catch (error) {
      logger.error('Image processing failed:', error);
      throw new Error(`Image processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate favicon from uploaded image
   */
  async generateFavicon(
    sourceBuffer: Buffer,
    tenantId: string
  ): Promise<FileUploadResult> {
    try {
      logger.info(`Generating favicon for tenant: ${tenantId}`);

      // Process image to 32x32 ICO format
      const faviconBuffer = await sharp(sourceBuffer)
        .resize(32, 32, { fit: 'cover' })
        .png({ compressionLevel: 9 })
        .toBuffer();

      const key = `tenants/${tenantId}/branding/favicon-${Date.now()}.ico`;

      await this.s3Client.send(new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: faviconBuffer,
        ContentType: 'image/x-icon',
        ACL: 'private',
        Metadata: {
          tenantId,
          type: 'favicon',
          generatedAt: new Date().toISOString()
        }
      }));

      const presignedUrl = await this.generatePresignedUrl(key);

      return {
        key,
        url: `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${key}`,
        presignedUrl,
        size: faviconBuffer.length,
        mimeType: 'image/x-icon',
        metadata: {
          originalName: 'favicon.ico',
          uploadedAt: new Date(),
          checksum: this.calculateChecksum(faviconBuffer),
          width: 32,
          height: 32,
          optimized: true
        }
      };

    } catch (error) {
      logger.error('Favicon generation failed:', error);
      throw new Error(`Favicon generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate multiple sizes for responsive images
   */
  async generateResponsiveImages(
    sourceBuffer: Buffer,
    originalName: string,
    mimeType: string,
    tenantId: string
  ): Promise<FileUploadResult[]> {
    const sizes = [
      { name: 'small', width: 320, quality: 70 },
      { name: 'medium', width: 768, quality: 80 },
      { name: 'large', width: 1024, quality: 85 },
      { name: 'xl', width: 1920, quality: 90 }
    ];

    const results: FileUploadResult[] = [];

    for (const size of sizes) {
      try {
        const processed = await this.processImage(sourceBuffer, {
          maxWidth: size.width,
          quality: size.quality
        });

        const key = `tenants/${tenantId}/branding/${size.name}-${Date.now()}-${this.sanitizeFileName(originalName)}.jpg`;

        await this.s3Client.send(new PutObjectCommand({
          Bucket: this.bucketName,
          Key: key,
          Body: processed.buffer,
          ContentType: 'image/jpeg',
          ACL: 'private',
          Metadata: {
            originalName,
            tenantId,
            size: size.name,
            width: processed.width.toString(),
            height: processed.height.toString(),
            generatedAt: new Date().toISOString()
          }
        }));

        const presignedUrl = await this.generatePresignedUrl(key);

        results.push({
          key,
          url: `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${key}`,
          presignedUrl,
          size: processed.buffer.length,
          mimeType: 'image/jpeg',
          metadata: {
            originalName,
            uploadedAt: new Date(),
            checksum: this.calculateChecksum(processed.buffer),
            width: processed.width,
            height: processed.height,
            optimized: true
          }
        });

      } catch (error) {
        logger.error(`Failed to generate ${size.name} size:`, error);
      }
    }

    logger.info(`Generated ${results.length} responsive images for tenant: ${tenantId}`);
    return results;
  }

  /**
   * Delete file from storage
   */
  async deleteFile(key: string): Promise<void> {
    try {
      await this.s3Client.send(new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      }));

      logger.info(`File deleted successfully: ${key}`);

    } catch (error) {
      logger.error('File deletion failed:', error);
      throw new Error(`File deletion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Helper methods
   */
  private getFileExtension(originalName: string, mimeType: string): string {
    const nameParts = originalName.split('.');
    const existingExtension = nameParts[nameParts.length - 1];

    // Validate extension matches MIME type
    const mimeToExtension: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/png': 'png',
      'image/svg+xml': 'svg',
      'image/webp': 'webp',
      'image/x-icon': 'ico'
    };

    return mimeToExtension[mimeType] || existingExtension || 'jpg';
  }

  private sanitizeFileName(fileName: string): string {
    return fileName
      .toLowerCase()
      .replace(/[^a-z0-9.-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  private calculateChecksum(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  private isImageFile(mimeType: string): boolean {
    return mimeType.startsWith('image/') && !mimeType.includes('svg');
  }
}

export const fileStorageCompleteService = new FileStorageCompleteService();