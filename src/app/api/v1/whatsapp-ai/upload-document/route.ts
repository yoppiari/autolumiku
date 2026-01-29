/**
 * WhatsApp AI - Document Upload
 * POST /api/v1/whatsapp-ai/upload-document
 * Upload document from device for WhatsApp sending
 */

import { NextRequest, NextResponse } from 'next/server';
import { StorageService } from '@/lib/services/infrastructure/storage.service';

// Allowed document types
const ALLOWED_TYPES: Record<string, string[]> = {
  'application/pdf': ['.pdf'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/vnd.ms-excel': ['.xls'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'application/vnd.ms-powerpoint': ['.ppt'],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
};

const ALLOWED_EXTENSIONS = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx'];

function getFileExtension(filename: string): string {
  const ext = filename.toLowerCase().match(/\.[^.]+$/);
  return ext ? ext[0] : '';
}

export async function POST(request: NextRequest) {
  try {
    // Get form data
    let formData;
    try {
      formData = await request.formData();
    } catch (e) {
      return NextResponse.json(
        { success: false, error: 'Gagal membaca form data' },
        { status: 400 }
      );
    }

    const file = formData.get('file') as File;
    const tenantId = formData.get('tenantId') as string;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'File tidak ditemukan' },
        { status: 400 }
      );
    }

    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: 'Tenant ID diperlukan' },
        { status: 400 }
      );
    }

    // Get file extension
    const fileExtension = getFileExtension(file.name);

    // Validate file type by extension (more reliable than MIME type)
    if (!ALLOWED_EXTENSIONS.includes(fileExtension)) {
      return NextResponse.json(
        {
          success: false,
          error: `Tipe file tidak valid: ${fileExtension}. Hanya PDF, Word (.doc/.docx), Excel (.xls/.xlsx), dan PowerPoint (.ppt/.pptx) yang diperbolehkan.`
        },
        { status: 400 }
      );
    }

    // Validate file size (max 25MB for documents)
    const maxSize = 25 * 1024 * 1024; // 25MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { success: false, error: `File terlalu besar: ${(file.size / 1024 / 1024).toFixed(2)}MB. Maksimal 25MB.` },
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

    // Generate storage key with original extension
    const timestamp = Date.now();
    const safeFilename = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const storageKey = `documents/${tenantId}/${timestamp}-${safeFilename}`;

    // Determine MIME type based on extension
    const mimeTypeMap: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.ppt': 'application/vnd.ms-powerpoint',
      '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    };
    const mimeType = mimeTypeMap[fileExtension] || 'application/octet-stream';

    // Upload to storage
    let relativeUrl;
    try {
      relativeUrl = await StorageService.uploadPhoto(
        buffer,
        storageKey,
        mimeType
      );
    } catch (e) {
      console.error('Storage upload error:', e);
      return NextResponse.json(
        { success: false, error: `Gagal menyimpan dokumen: ${e instanceof Error ? e.message : 'Unknown error'}` },
        { status: 500 }
      );
    }

    // Build absolute URL for WhatsApp
    const proto = request.headers.get('x-forwarded-proto') || 'https';
    const host = request.headers.get('host') || request.headers.get('x-forwarded-host') || '';
    const absoluteUrl = host ? `${proto}://${host}${relativeUrl}` : relativeUrl;

    return NextResponse.json({
      success: true,
      message: 'Document uploaded successfully',
      data: {
        url: absoluteUrl,
        relativeUrl,
        storageKey,
        filename: file.name,
        fileSize: file.size,
        fileType: fileExtension,
      },
    });
  } catch (error) {
    console.error('WhatsApp document upload error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: `Gagal upload dokumen: ${errorMessage}` },
      { status: 500 }
    );
  }
}
