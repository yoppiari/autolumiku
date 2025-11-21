/**
 * Cloudflare R2 Storage Client
 * S3-compatible object storage with zero egress fees
 *
 * Epic 2: AI-Powered Vehicle Upload
 * Story 2.1, 2.7, 2.8
 */

import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createLogger, format, transports } from 'winston';

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
    new transports.File({ filename: 'logs/r2-storage.log' })
  ]
});

export interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  publicUrl?: string;
}

export interface UploadOptions {
  key: string;
  body: Buffer;
  contentType: string;
  metadata?: Record<string, string>;
}

export interface SignedUrlOptions {
  key: string;
  contentType: string;
  expiresIn?: number; // seconds, default 3600 (1 hour)
}

export class R2Client {
  private readonly client: S3Client;
  private readonly config: R2Config;

  constructor() {
    this.config = {
      accountId: process.env.R2_ACCOUNT_ID || '',
      accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
      bucketName: process.env.R2_BUCKET_NAME || 'autolumiku-vehicle-photos',
      publicUrl: process.env.R2_PUBLIC_URL
    };

    if (!this.config.accountId || !this.config.accessKeyId || !this.config.secretAccessKey) {
      logger.warn('R2 credentials not configured. Using fallback local storage.');
    }

    // Initialize S3 client for R2
    this.client = new S3Client({
      region: 'auto', // R2 uses auto region
      endpoint: `https://${this.config.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: this.config.accessKeyId,
        secretAccessKey: this.config.secretAccessKey
      }
    });

    logger.info('R2 Client initialized', {
      bucket: this.config.bucketName,
      hasPublicUrl: !!this.config.publicUrl
    });
  }

  /**
   * Upload file to R2
   */
  async upload(options: UploadOptions): Promise<{ key: string; url: string }> {
    try {
      const command = new PutObjectCommand({
        Bucket: this.config.bucketName,
        Key: options.key,
        Body: options.body,
        ContentType: options.contentType,
        Metadata: options.metadata
      });

      await this.client.send(command);

      const url = this.getPublicUrl(options.key);

      logger.info('File uploaded to R2', {
        key: options.key,
        size: options.body.length,
        contentType: options.contentType
      });

      return { key: options.key, url };
    } catch (error) {
      logger.error('R2 upload error:', error);
      throw new Error(`Failed to upload to R2: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate signed URL for direct upload from client
   */
  async getSignedUploadUrl(key: string, contentType: string, expiresIn: number = 3600): Promise<string> {
    try {
      const command = new PutObjectCommand({
        Bucket: this.config.bucketName,
        Key: key,
        ContentType: contentType
      });

      const signedUrl = await getSignedUrl(this.client, command, { expiresIn });

      logger.info('Generated signed upload URL', {
        key,
        expiresIn,
        contentType
      });

      return signedUrl;
    } catch (error) {
      logger.error('Error generating signed URL:', error);
      throw new Error(`Failed to generate signed URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate signed URL for downloading private files
   */
  async getSignedDownloadUrl(key: string, expiresIn: number = 3600): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.config.bucketName,
        Key: key
      });

      const signedUrl = await getSignedUrl(this.client, command, { expiresIn });

      logger.info('Generated signed download URL', {
        key,
        expiresIn
      });

      return signedUrl;
    } catch (error) {
      logger.error('Error generating download URL:', error);
      throw new Error(`Failed to generate download URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete file from R2
   */
  async delete(key: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.config.bucketName,
        Key: key
      });

      await this.client.send(command);

      logger.info('File deleted from R2', { key });
    } catch (error) {
      logger.error('R2 delete error:', error);
      throw new Error(`Failed to delete from R2: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if file exists
   */
  async exists(key: string): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.config.bucketName,
        Key: key
      });

      await this.client.send(command);
      return true;
    } catch (error: any) {
      if (error.name === 'NotFound') {
        return false;
      }
      logger.error('R2 exists check error:', error);
      throw error;
    }
  }

  /**
   * Get public URL for a file
   * If publicUrl is configured, use CDN URL, otherwise use R2 direct URL
   */
  getPublicUrl(key: string): string {
    if (this.config.publicUrl) {
      // Use custom domain/CDN URL
      return `${this.config.publicUrl}/${key}`;
    }

    // Use R2 public URL
    return `https://pub-${this.config.accountId}.r2.dev/${key}`;
  }

  /**
   * Get storage statistics
   */
  async getStats(): Promise<{ totalFiles: number; totalSize: number }> {
    // Note: R2 doesn't provide easy bucket-level stats via S3 API
    // This would require listing all objects which is expensive
    // For now, return placeholder - implement with database tracking instead
    logger.warn('R2 stats not implemented - use database for tracking');
    return { totalFiles: 0, totalSize: 0 };
  }

  /**
   * Check if R2 is configured and ready
   */
  isConfigured(): boolean {
    return !!(
      this.config.accountId &&
      this.config.accessKeyId &&
      this.config.secretAccessKey &&
      this.config.bucketName
    );
  }
}

// Singleton instance
export const r2Client = new R2Client();
