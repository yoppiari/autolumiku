import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import crypto from 'crypto';

/**
 * POST /api/admin/tenants/[id]/upload - Upload logo or favicon
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const formData = await request.formData();

    const file = formData.get('file') as File;
    const type = formData.get('type') as string; // 'logo' or 'favicon'

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }

    if (!type || !['logo', 'favicon'].includes(type)) {
      return NextResponse.json(
        { success: false, error: 'Invalid type. Must be "logo" or "favicon"' },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: 'Invalid file type. Only PNG, JPG, and SVG are allowed' },
        { status: 400 }
      );
    }

    // Validate file size (5MB max)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { success: false, error: 'File size exceeds 5MB limit' },
        { status: 400 }
      );
    }

    // Verify tenant exists
    const tenant = await prisma.tenant.findUnique({
      where: { id },
    });

    if (!tenant) {
      return NextResponse.json(
        { success: false, error: 'Tenant not found' },
        { status: 404 }
      );
    }

    // Generate unique filename
    const fileExtension = file.name.split('.').pop();
    const uniqueId = crypto.randomBytes(8).toString('hex');
    const fileName = `${tenant.slug}_${type}_${uniqueId}.${fileExtension}`;

    // Create upload directory if it doesn't exist
    const uploadDir = join(process.cwd(), 'public', 'uploads', 'tenants', tenant.slug);
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true });
    }

    // Save file to disk
    const filePath = join(uploadDir, fileName);
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);

    // Generate public URL
    const fileUrl = `/uploads/tenants/${tenant.slug}/${fileName}`;

    // Update tenant in database
    const updateData = type === 'logo'
      ? { logoUrl: fileUrl }
      : { faviconUrl: fileUrl };

    const updatedTenant = await prisma.tenant.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      data: {
        url: fileUrl,
        type,
        tenant: updatedTenant,
      },
      message: `${type === 'logo' ? 'Logo' : 'Favicon'} uploaded successfully`,
    });
  } catch (error) {
    console.error('Failed to upload file:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to upload file',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
