/**
 * Tenant Logo/Favicon Upload API
 * POST /api/admin/tenants/[id]/upload
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { StorageService } from '@/lib/services/storage.service';
import { ImageProcessingService } from '@/lib/services/image-processing.service';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id: tenantId } = params;

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
    const processedBuffer = type === 'favicon'
      ? await ImageProcessingService.resizeImage(buffer, 32, 32) // Favicon: 32x32
      : await ImageProcessingService.resizeImage(buffer, 400, 400); // Logo: max 400x400

    // Generate filename
    const extension = file.name.split('.').pop() || 'png';
    const filename = `${type}-${Date.now()}.${extension}`;
    const path = `tenants/${tenant.slug}`;

    // Upload to storage
    const uploadedUrl = await StorageService.uploadFile(
      processedBuffer,
      path,
      filename,
      file.type
    );

    // Delete old file if exists
    const oldUrl = type === 'logo' ? tenant.logoUrl : tenant.faviconUrl;
    if (oldUrl) {
      try {
        await StorageService.deleteFile(oldUrl);
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
