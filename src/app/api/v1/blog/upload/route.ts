/**
 * Blog Image Upload API
 * POST /api/v1/blog/upload
 * Handles featured image uploads for blog posts
 */

import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import { StorageService } from '@/lib/services/infrastructure/storage.service';

export async function POST(request: NextRequest) {
  try {
    // Get form data
    let formData;
    try {
      formData = await request.formData();
    } catch (e) {
      return NextResponse.json(
        { error: 'Failed to parse form data' },
        { status: 400 }
      );
    }

    const file = formData.get('file') as File;
    const tenantId = formData.get('tenantId') as string;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    if (!tenantId) {
      return NextResponse.json(
        { error: 'Tenant ID is required' },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: `Invalid file type: ${file.type}. Only JPEG, PNG, WebP, and GIF are allowed.` },
        { status: 400 }
      );
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: `File too large: ${(file.size / 1024 / 1024).toFixed(2)}MB. Maximum size is 5MB.` },
        { status: 400 }
      );
    }

    // Convert File to Buffer
    let buffer;
    try {
      buffer = Buffer.from(await file.arrayBuffer());
    } catch (e) {
      return NextResponse.json(
        { error: 'Failed to read file buffer' },
        { status: 500 }
      );
    }

    // Process image - resize to max 1200x630 (optimal for social sharing/OG image)
    // Use 'contain' to fit image without cropping, with black background
    let processedBuffer;
    try {
      processedBuffer = await sharp(buffer)
        .resize(1200, 630, {
          fit: 'contain',
          position: 'center',
          background: { r: 0, g: 0, b: 0, alpha: 1 } // Black background for letterboxing
        })
        .jpeg({ quality: 85 })
        .toBuffer();
    } catch (e) {
      console.error('Sharp processing error:', e);
      return NextResponse.json(
        { error: `Image processing failed: ${e instanceof Error ? e.message : 'Unknown error'}` },
        { status: 500 }
      );
    }

    // Generate storage key
    const timestamp = Date.now();
    const filename = `blog-${timestamp}.jpg`;
    const storageKey = `blog/${tenantId}/${filename}`;

    // Upload to storage
    let uploadedUrl;
    try {
      uploadedUrl = await StorageService.uploadPhoto(
        processedBuffer,
        storageKey,
        'image/jpeg'
      );
    } catch (e) {
      console.error('Storage upload error:', e);
      return NextResponse.json(
        { error: `Storage upload failed: ${e instanceof Error ? e.message : 'Unknown error'}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Image uploaded successfully',
      data: {
        url: uploadedUrl,
        storageKey,
      },
    });
  } catch (error) {
    console.error('Blog image upload error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `Failed to upload image: ${errorMessage}` },
      { status: 500 }
    );
  }
}
