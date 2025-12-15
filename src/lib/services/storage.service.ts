/**
 * Storage Service
 * Handles photo storage to local Docker volume
 * Supports both local filesystem (Docker volume) and future cloud storage (S3/R2)
 */

import fs from 'fs/promises';
import path from 'path';
import { StorageUploadResult } from '../types/photo.types';

export class StorageService {
  private static uploadDir = process.env.UPLOAD_DIR || '/app/uploads';

  /**
   * Upload photo to storage (Docker volume)
   * Returns a relative URL that works with any domain (multi-tenant support)
   */
  static async uploadPhoto(
    buffer: Buffer,
    storageKey: string,
    mimeType: string = 'image/webp'
  ): Promise<string> {
    // Ensure directory exists
    const dirPath = path.dirname(path.join(this.uploadDir, storageKey));
    console.log(`📁 Creating directory: ${dirPath}`);
    await fs.mkdir(dirPath, { recursive: true });

    // Write file
    const filePath = path.join(this.uploadDir, storageKey);
    console.log(`💾 Writing file: ${filePath} (${buffer.length} bytes)`);
    await fs.writeFile(filePath, buffer);

    // Return relative URL (nginx serves /uploads from volume)
    // This works with any custom domain in multi-tenant setup
    const url = `/uploads/${storageKey}`;
    console.log(`✅ File saved, URL: ${url}`);
    return url;
  }

  /**
   * Upload multiple sizes of a photo
   */
  static async uploadMultipleSize(
    photos: {
      original: Buffer;
      large: Buffer;
      medium: Buffer;
      thumbnail: Buffer;
    },
    vehicleId: string,
    filename: string
  ): Promise<StorageUploadResult> {
    const baseKey = `vehicles/${vehicleId}`;

    // Generate storage keys for each size
    const keys = {
      original: `${baseKey}/${filename}-original.jpg`,
      large: `${baseKey}/${filename}-large.webp`,
      medium: `${baseKey}/${filename}-medium.webp`,
      thumbnail: `${baseKey}/${filename}-thumbnail.webp`,
    };

    // Upload all sizes in parallel
    const [originalUrl, largeUrl, mediumUrl, thumbnailUrl] = await Promise.all([
      this.uploadPhoto(photos.original, keys.original, 'image/jpeg'),
      this.uploadPhoto(photos.large, keys.large, 'image/webp'),
      this.uploadPhoto(photos.medium, keys.medium, 'image/webp'),
      this.uploadPhoto(photos.thumbnail, keys.thumbnail, 'image/webp'),
    ]);

    return {
      storageKey: keys.original,
      originalUrl,
      largeUrl,
      mediumUrl,
      thumbnailUrl,
    };
  }

  /**
   * Delete photo from storage
   */
  static async deletePhoto(storageKey: string): Promise<void> {
    try {
      const filePath = path.join(this.uploadDir, storageKey);
      await fs.unlink(filePath);
    } catch (error) {
      // File doesn't exist, silently ignore
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  /**
   * Delete multiple sizes of a photo
   */
  static async deleteMultipleSizes(baseStorageKey: string): Promise<void> {
    // Extract base path (remove -original.jpg)
    const basePath = baseStorageKey.replace(/-original\.[^.]+$/, '');

    const keys = [
      `${basePath}-original.jpg`,
      `${basePath}-large.webp`,
      `${basePath}-medium.webp`,
      `${basePath}-thumbnail.webp`,
    ];

    // Delete all sizes (ignore errors)
    await Promise.allSettled(keys.map((key) => this.deletePhoto(key)));
  }

  /**
   * Check if file exists
   */
  static async fileExists(storageKey: string): Promise<boolean> {
    try {
      const filePath = path.join(this.uploadDir, storageKey);
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get file size
   */
  static async getFileSize(storageKey: string): Promise<number> {
    const filePath = path.join(this.uploadDir, storageKey);
    const stats = await fs.stat(filePath);
    return stats.size;
  }

  /**
   * Ensure upload directory exists
   */
  static async ensureUploadDir(): Promise<void> {
    await fs.mkdir(this.uploadDir, { recursive: true });
  }

  /**
   * Clean up orphaned photos (photos not referenced in database)
   * @param vehicleId - Vehicle ID to clean
   * @param activeStorageKeys - Storage keys currently in use
   */
  static async cleanupOrphanedPhotos(
    vehicleId: string,
    activeStorageKeys: string[]
  ): Promise<number> {
    const vehicleDir = path.join(this.uploadDir, 'vehicles', vehicleId);

    try {
      const files = await fs.readdir(vehicleDir);
      let deletedCount = 0;

      for (const file of files) {
        const storageKey = `vehicles/${vehicleId}/${file}`;

        if (!activeStorageKeys.includes(storageKey)) {
          await this.deletePhoto(storageKey);
          deletedCount++;
        }
      }

      return deletedCount;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        // Directory doesn't exist, nothing to clean
        return 0;
      }
      throw error;
    }
  }
}
