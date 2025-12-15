/**
 * Blog Image Upload API
 * POST /api/v1/blog/upload
 * Handles featured image uploads for blog posts
 */

import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import { StorageService } from '@/lib/services/storage.service';

export async function POST(request: NextRequest) {
  try {
    // Get form data
    const formData = await request.formData();
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
        { error: 'Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed.' },
        { status: 400 }
      );
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 5MB.' },
        { status: 400 }
      );
    }

    // Convert File to Buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // Process image - resize to max 1200x630 (optimal for social sharing/OG image)
    const processedBuffer = await sharp(buffer)
      .resize(1200, 630, { fit: 'cover', position: 'center' })
      .jpeg({ quality: 85 })
      .toBuffer();

    // Generate storage key
    const timestamp = Date.now();
    const filename = `blog-${timestamp}.jpg`;
    const storageKey = `blog/${tenantId}/${filename}`;

    // Upload to storage
    const uploadedUrl = await StorageService.uploadPhoto(
      processedBuffer,
      storageKey,
      'image/jpeg'
    );

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
    return NextResponse.json(
      { error: 'Failed to upload image' },
      { status: 500 }
    );
  }
}
