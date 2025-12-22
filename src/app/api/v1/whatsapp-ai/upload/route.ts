/**
 * WhatsApp AI - Image Upload
 * POST /api/v1/whatsapp-ai/upload
 * Upload image from device for WhatsApp sending
 */

import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import { StorageService } from '@/lib/services/storage.service';

export async function POST(request: NextRequest) {
  try {
    // Get form data
    let formData;
    try {
      formData = await request.formData();
    } catch (e) {
      return NextResponse.json(
        { success: false, error: 'Failed to parse form data' },
        { status: 400 }
      );
    }

    const file = formData.get('file') as File;
    const tenantId = formData.get('tenantId') as string;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }

    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: 'Tenant ID is required' },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: `Tipe file tidak valid: ${file.type}. Hanya JPEG, PNG, WebP, dan GIF yang diperbolehkan.` },
        { status: 400 }
      );
    }

    // Validate file size (max 10MB for WhatsApp images)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { success: false, error: `File terlalu besar: ${(file.size / 1024 / 1024).toFixed(2)}MB. Maksimal 10MB.` },
        { status: 400 }
      );
    }

    // Convert File to Buffer
    let buffer;
    try {
      buffer = Buffer.from(await file.arrayBuffer());
    } catch (e) {
      return NextResponse.json(
        { success: false, error: 'Gagal membaca file' },
        { status: 500 }
      );
    }

    // Process image - compress and optimize for WhatsApp
    // WhatsApp recommends max 5MB and 1280px max dimension
    let processedBuffer;
    try {
      processedBuffer = await sharp(buffer)
        .resize(1280, 1280, {
          fit: 'inside', // Maintain aspect ratio, fit within bounds
          withoutEnlargement: true, // Don't upscale small images
        })
        .jpeg({ quality: 85 })
        .toBuffer();
    } catch (e) {
      console.error('Sharp processing error:', e);
      return NextResponse.json(
        { success: false, error: `Gagal memproses gambar: ${e instanceof Error ? e.message : 'Unknown error'}` },
        { status: 500 }
      );
    }

    // Generate storage key
    const timestamp = Date.now();
    const filename = `wa-${timestamp}.jpg`;
    const storageKey = `whatsapp/${tenantId}/${filename}`;

    // Upload to storage
    let relativeUrl;
    try {
      relativeUrl = await StorageService.uploadPhoto(
        processedBuffer,
        storageKey,
        'image/jpeg'
      );
    } catch (e) {
      console.error('Storage upload error:', e);
      return NextResponse.json(
        { success: false, error: `Gagal menyimpan gambar: ${e instanceof Error ? e.message : 'Unknown error'}` },
        { status: 500 }
      );
    }

    // Build absolute URL for WhatsApp
    // Get protocol and host from request headers
    const proto = request.headers.get('x-forwarded-proto') || 'https';
    const host = request.headers.get('host') || request.headers.get('x-forwarded-host') || '';
    const absoluteUrl = host ? `${proto}://${host}${relativeUrl}` : relativeUrl;

    return NextResponse.json({
      success: true,
      message: 'Image uploaded successfully',
      data: {
        url: absoluteUrl,
        relativeUrl,
        storageKey,
      },
    });
  } catch (error) {
    console.error('WhatsApp image upload error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: `Gagal upload gambar: ${errorMessage}` },
      { status: 500 }
    );
  }
}
