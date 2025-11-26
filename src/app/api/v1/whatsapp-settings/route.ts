/**
 * GET/PUT /api/v1/whatsapp-settings
 * WhatsApp settings management
 */

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');

    if (!tenantId) {
      return NextResponse.json(
        { error: 'tenantId is required' },
        { status: 400 }
      );
    }

    const settings = await prisma.whatsAppSettings.findUnique({
      where: { tenantId },
    });

    if (!settings) {
      // Return default settings
      return NextResponse.json({
        success: true,
        data: {
          tenantId,
          phoneNumber: '',
          isActive: false,
          defaultMessage: 'Halo! Terima kasih telah menghubungi kami. Ada yang bisa kami bantu?',
          autoReply: false,
          autoReplyMessage: null,
          workingHours: {
            start: '08:00',
            end: '17:00',
            timezone: 'Asia/Jakarta',
          },
          quickReplies: [],
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: settings,
    });
  } catch (error) {
    console.error('Get WhatsApp settings error:', error);
    return NextResponse.json(
      {
        error: 'Failed to get WhatsApp settings',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      tenantId,
      phoneNumber,
      isActive,
      defaultMessage,
      autoReply,
      autoReplyMessage,
      workingHours,
      quickReplies,
    } = body;

    if (!tenantId) {
      return NextResponse.json(
        { error: 'tenantId is required' },
        { status: 400 }
      );
    }

    const settings = await prisma.whatsAppSettings.upsert({
      where: { tenantId },
      create: {
        tenantId,
        phoneNumber: phoneNumber || '',
        isActive: isActive !== undefined ? isActive : false,
        defaultMessage: defaultMessage || 'Halo! Terima kasih telah menghubungi kami.',
        autoReply: autoReply !== undefined ? autoReply : false,
        autoReplyMessage,
        workingHours,
        quickReplies,
      },
      update: {
        phoneNumber,
        isActive,
        defaultMessage,
        autoReply,
        autoReplyMessage,
        workingHours,
        quickReplies,
      },
    });

    return NextResponse.json({
      success: true,
      data: settings,
    });
  } catch (error) {
    console.error('Update WhatsApp settings error:', error);
    return NextResponse.json(
      {
        error: 'Failed to update WhatsApp settings',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
