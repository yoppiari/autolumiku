/**
 * Tenant Logo/Favicon Upload API
 * POST /api/admin/tenants/[id]/upload
 */

import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import { prisma } from '@/lib/prisma';
import { StorageService } from '@/lib/services/storage.service';

export async function POST(
  request: NextRequest,
  { params }: { params: any }
) {
  try {
    const { id: tenantId } = await params;

    // Get form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const type = formData.get('type') as string; // 'logo' or 'favicon'

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    if (!type || !['logo', 'favicon'].includes(type)) {
      return NextResponse.json(
        { error: 'Invalid type. Must be "logo" or "favicon"' },
        { status: 400 }
      );
    }

    // Verify tenant exists
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, slug: true, logoUrl: true, faviconUrl: true },
    });

    if (!tenant) {
      return NextResponse.json(
        { error: 'Tenant not found' },
        { status: 404 }
      );
    }

    // Convert File to Buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // Process image (resize if needed)
    let processedBuffer: Buffer;
    if (type === 'favicon') {
      // Favicon: resize to 32x32 PNG
      processedBuffer = await sharp(buffer)
        .resize(32, 32, { fit: 'cover' })
        .png()
        .toBuffer();
    } else {
      // Logo: resize to max 400x400, maintain aspect ratio
      processedBuffer = await sharp(buffer)
        .resize(400, 400, { fit: 'inside', withoutEnlargement: true })
        .png()
        .toBuffer();
    }

    // Generate storage key
    const timestamp = Date.now();
    const extension = 'png'; // Always save as PNG after processing
    const filename = `${type}-${timestamp}.${extension}`;
    const storageKey = `tenants/${tenant.slug}/${filename}`;

    // Upload to storage
    const uploadedUrl = await StorageService.uploadPhoto(
      processedBuffer,
      storageKey,
      'image/png'
    );

    // Delete old file if exists
    const oldUrl = type === 'logo' ? tenant.logoUrl : tenant.faviconUrl;
    if (oldUrl) {
      try {
        // Extract storage key from URL (remove /uploads/ prefix)
        const oldStorageKey = oldUrl.replace(/^\/uploads\//, '');
        await StorageService.deletePhoto(oldStorageKey);
      } catch (error) {
        console.warn('Failed to delete old file:', error);
      }
    }

    // Update tenant in database
    const updateData = type === 'logo'
      ? { logoUrl: uploadedUrl }
      : { faviconUrl: uploadedUrl };

    const updatedTenant = await prisma.tenant.update({
      where: { id: tenantId },
      data: updateData,
      select: {
        id: true,
        slug: true,
        name: true,
        logoUrl: true,
        faviconUrl: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: `${type} uploaded successfully`,
      data: {
        url: uploadedUrl,
        tenant: updatedTenant,
      },
    });
  } catch (error) {
    console.error('Tenant upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload file' },
      { status: 500 }
    );
  }
}
