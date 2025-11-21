/**
 * Vehicle Photo Upload API
 * POST /api/v1/vehicles/upload-photos
 *
 * Epic 2: AI-Powered Vehicle Upload
 * Story 2.1: Drag-and-Drop Photo Upload Interface
 */

import { NextRequest, NextResponse } from 'next/server';
import { vehicleService } from '@/services/vehicle-service';
import { z } from 'zod';

const uploadPhotoSchema = z.object({
  filename: z.string().min(1, 'Filename required'),
  contentType: z.enum(['image/jpeg', 'image/png', 'image/webp'], {
    errorMap: () => ({ message: 'Tipe file harus JPG, PNG, atau WEBP' })
  }),
  fileSize: z.number().positive('File size must be positive'),
  tenantId: z.string().uuid('Invalid tenant ID'),
  userId: z.string().uuid('Invalid user ID')
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate request
    const validated = uploadPhotoSchema.parse(body);

    // Generate upload URL
    const result = await vehicleService.generatePhotoUploadUrl({
      filename: validated.filename,
      contentType: validated.contentType,
      fileSize: validated.fileSize,
      tenantId: validated.tenantId,
      userId: validated.userId
    });

    return NextResponse.json({
      success: true,
      data: result
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validasi gagal',
          details: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message
          }))
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Upload gagal'
      },
      { status: 500 }
    );
  }
}
