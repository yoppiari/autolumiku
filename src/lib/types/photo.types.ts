/**
 * Photo Management Types
 * Type definitions for photo upload, processing, and storage
 */

export interface PhotoUploadInput {
  base64: string;
  filename?: string;
}

export interface ProcessedPhoto {
  original: Buffer;
  large: Buffer;
  medium: Buffer;
  thumbnail: Buffer;
  metadata: PhotoMetadata;
  blurHash?: string;
}

export interface PhotoMetadata {
  width: number;
  height: number;
  format: string;
  size: number; // bytes
  mimeType: string;
}

export interface StorageUploadResult {
  storageKey: string;
  originalUrl: string;
  thumbnailUrl: string;
  mediumUrl: string;
  largeUrl: string;
  cdnUrl?: string;
}

export interface PhotoQualityResult {
  score: number; // 0-100
  status: 'APPROVED' | 'WARNING' | 'REJECTED';
  details: {
    sharpness: number;
    brightness: number;
    resolution: 'PASS' | 'FAIL';
    aspectRatio: 'PASS' | 'FAIL';
  };
  message: string;
}

export type PhotoSize = 'thumbnail' | 'medium' | 'large' | 'original';

export interface PhotoSizeConfig {
  width: number;
  height: number;
  fit: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
  quality: number; // 0-100 for WebP
}

export const PHOTO_SIZES: Record<PhotoSize, PhotoSizeConfig> = {
  thumbnail: {
    width: 300,
    height: 200,
    fit: 'cover',
    quality: 80,
  },
  medium: {
    width: 800,
    height: 600,
    fit: 'inside',
    quality: 85,
  },
  large: {
    width: 1920,
    height: 1080,
    fit: 'inside',
    quality: 90,
  },
  original: {
    width: 4000,
    height: 3000,
    fit: 'inside',
    quality: 95,
  },
};

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
export const MAX_PHOTOS_PER_VEHICLE = 30;
export const SUPPORTED_FORMATS = ['image/jpeg', 'image/png', 'image/webp'];
