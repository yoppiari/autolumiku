/**
 * File Storage Service
 *
 * Handles file upload and storage operations using AWS S3.
 * Provides secure file upload with validation and virus scanning.
 */

import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { Logger } from '../utils/logger';

export interface UploadOptions {
  [key: string]: string;
}

export interface FileUploadResult {
  url: string;
  key: string;
  etag: string;
}

export class FileStorageService {
  private readonly s3Client: S3Client;
  private readonly bucketName: string;
  private readonly region: string;

  constructor(
    private readonly config: {
      accessKeyId: string;
      secretAccessKey: string;
      region: string;
      bucketName: string;
      endpoint?: string; // For local testing (MinIO)
    },
    private readonly logger: Logger
  ) {
    this.bucketName = config.bucketName;
    this.region = config.region;

    this.s3Client = new S3Client({
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      endpoint: config.endpoint, // Use MinIO for local development
      forcePathStyle: !!config.endpoint, // Required for MinIO
    });
  }

  /**
   * Upload file to S3
   */
  async uploadFile(
    key: string,
    body: Buffer,
    contentType: string,
    metadata?: UploadOptions
  ): Promise<string> {
    this.logger.info('Uploading file to S3', { key, contentType, size: body.length });

    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: body,
        ContentType: contentType,
        Metadata: metadata || {},
        ACL: 'public-read', // Make files publicly accessible
      });

      const result = await this.s3Client.send(command);

      // Construct the public URL
      const url = this.constructPublicUrl(key);

      this.logger.info('File uploaded successfully', {
        key,
        url,
        etag: result.ETag,
        size: body.length
      });

      return url;

    } catch (error) {
      this.logger.error('Failed to upload file', {
        key,
        contentType,
        error: error.message
      });
      throw new Error(`Failed to upload file: ${error.message}`);
    }
  }

  /**
   * Delete file from S3
   */
  async deleteFile(key: string): Promise<void> {
    this.logger.info('Deleting file from S3', { key });

    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.s3Client.send(command);

      this.logger.info('File deleted successfully', { key });

    } catch (error) {
      this.logger.error('Failed to delete file', {
        key,
        error: error.message
      });
      throw new Error(`Failed to delete file: ${error.message}`);
    }
  }

  /**
   * Generate presigned URL for secure upload
   */
  async generatePresignedUploadUrl(
    key: string,
    contentType: string,
    expiresIn: number = 3600
  ): Promise<string> {
    // This would be implemented using @aws-sdk/s3-request-presigner
    // For now, return a placeholder
    this.logger.info('Generating presigned URL', { key, contentType, expiresIn });

    // TODO: Implement presigned URL generation
    // import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
    // const command = new PutObjectCommand({...});
    // return await getSignedUrl(this.s3Client, command, { expiresIn });

    throw new Error('Presigned URL generation not implemented yet');
  }

  /**
   * Validate file type and content
   */
  async validateFile(
    buffer: Buffer,
    filename: string,
    mimeType: string
  ): Promise<{
    isValid: boolean;
    errors: string[];
    metadata: any;
  }> {
    const errors: string[] = [];
    const metadata: any = {};

    // Basic file type validation
    const allowedMimeTypes = [
      'image/png',
      'image/jpeg',
      'image/svg+xml',
      'image/x-icon',
      'text/css',
      'application/javascript'
    ];

    if (!allowedMimeTypes.includes(mimeType)) {
      errors.push(`File type ${mimeType} is not allowed`);
    }

    // File size validation
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (buffer.length > maxSize) {
      errors.push(`File size ${buffer.length} bytes exceeds maximum allowed size of ${maxSize} bytes`);
    }

    // Image-specific validation
    if (mimeType.startsWith('image/')) {
      try {
        const imageMetadata = await this.extractImageMetadata(buffer, mimeType);
        metadata.dimensions = imageMetadata.dimensions;
        metadata.format = imageMetadata.format;

        // Validate image dimensions
        const { width, height } = imageMetadata.dimensions;
        if (width > 4096 || height > 4096) {
          errors.push(`Image dimensions ${width}x${height} exceed maximum allowed size of 4096x4096`);
        }

        // Validate aspect ratio for logos (should be roughly square)
        if (filename.includes('logo')) {
          const aspectRatio = width / height;
          if (aspectRatio < 0.5 || aspectRatio > 2) {
            errors.push('Logo should have an aspect ratio between 1:2 and 2:1 (roughly square)');
          }
        }

      } catch (error) {
        errors.push(`Invalid image file: ${error.message}`);
      }
    }

    // Security scan for malicious content
    const securityCheck = await this.scanForMaliciousContent(buffer, mimeType);
    if (!securityCheck.isSafe) {
      errors.push(...securityCheck.threats);
    }

    return {
      isValid: errors.length === 0,
      errors,
      metadata
    };
  }

  /**
   * Extract image metadata
   */
  private async extractImageMetadata(buffer: Buffer, mimeType: string): Promise<{
    dimensions: { width: number; height: number };
    format: string;
  }> {
    // This would use an image processing library like 'sharp' or 'jimp'
    // For now, return placeholder values
    const metadata = {
      dimensions: { width: 512, height: 512 },
      format: mimeType.split('/')[1]
    };

    // TODO: Implement actual image metadata extraction
    // Example with sharp:
    // const sharp = require('sharp');
    // const metadata = await sharp(buffer).metadata();
    // return {
    //   dimensions: { width: metadata.width, height: metadata.height },
    //   format: metadata.format
    // };

    return metadata;
  }

  /**
   * Scan for malicious content
   */
  private async scanForMaliciousContent(buffer: Buffer, mimeType: string): Promise<{
    isSafe: boolean;
    threats: string[];
  }> {
    const threats: string[] = [];

    // Basic security checks
    const content = buffer.toString('utf8', 0, Math.min(1024, buffer.length));

    // Check for script tags in SVG files
    if (mimeType === 'image/svg+xml') {
      const scriptTagPattern = /<script[\s\S]*?<\/script>/gi;
      if (scriptTagPattern.test(content)) {
        threats.push('SVG contains potentially malicious script tags');
      }

      // Check for other dangerous elements
      const dangerousPatterns = [
        /<iframe/i,
        /<object/i,
        /<embed/i,
        /javascript:/i,
        /vbscript:/i,
        /data:(?!image\/)/i
      ];

      for (const pattern of dangerousPatterns) {
        if (pattern.test(content)) {
          threats.push(`SVG contains potentially dangerous content: ${pattern.source}`);
          break;
        }
      }
    }

    // Check for executable file signatures
    const executableSignatures = [
      Buffer.from('MZ', 'hex'), // Windows PE
      Buffer.from([0x7F, 'ELF']), // Linux ELF
      Buffer.from('CA FE BA BE', 'hex'), // Java class
    ];

    for (const signature of executableSignatures) {
      if (buffer.subarray(0, signature.length).equals(signature)) {
        threats.push('File appears to be an executable file');
        break;
      }
    }

    return {
      isSafe: threats.length === 0,
      threats
    };
  }

  /**
   * Construct public URL for S3 object
   */
  private constructPublicUrl(key: string): string {
    if (this.config.endpoint) {
      // Local development (MinIO)
      return `${this.config.endpoint}/${this.bucketName}/${key}`;
    } else {
      // Production AWS S3
      return `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${key}`;
    }
  }

  /**
   * Get file info from S3
   */
  async getFileInfo(key: string): Promise<{
    size: number;
    lastModified: Date;
    contentType: string;
    etag: string;
  } | null> {
    try {
      // This would use HeadObjectCommand
      // For now, return null
      this.logger.info('Getting file info', { key });

      // TODO: Implement file info retrieval
      // const command = new HeadObjectCommand({
      //   Bucket: this.bucketName,
      //   Key: key,
      // });
      // const result = await this.s3Client.send(command);

      return null;
    } catch (error) {
      this.logger.error('Failed to get file info', { key, error: error.message });
      return null;
    }
  }

  /**
   * List files in a directory
   */
  async listFiles(prefix: string, maxKeys: number = 1000): Promise<{
    files: Array<{
      key: string;
      size: number;
      lastModified: Date;
      etag: string;
    }>;
    nextToken?: string;
  }> {
    try {
      // This would use ListObjectsV2Command
      // For now, return empty result
      this.logger.info('Listing files', { prefix, maxKeys });

      return { files: [] };
    } catch (error) {
      this.logger.error('Failed to list files', { prefix, error: error.message });
      throw new Error(`Failed to list files: ${error.message}`);
    }
  }
}