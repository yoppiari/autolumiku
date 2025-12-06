/**
 * GET/PUT /api/v1/whatsapp-ai-config
 * WhatsApp AI configuration management
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

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

    // Get the aimeow account and AI config
    const account = await prisma.aimeowAccount.findUnique({
      where: { tenantId },
      include: {
        aiConfig: true,
        tenant: true,
      },
    });

    if (!account) {
      return NextResponse.json(
        { error: 'WhatsApp account not found for this tenant' },
        { status: 404 }
      );
    }

    // If no AI config exists, return default values
    if (!account.aiConfig) {
      return NextResponse.json({
        success: true,
        data: {
          tenantId,
          accountId: account.id,
          aiName: 'AI Assistant',
          aiPersonality: 'friendly',
          welcomeMessage: `Halo! Saya adalah asisten virtual ${account.tenant.name}. Ada yang bisa saya bantu?`,
          customerChatEnabled: true,
          autoReply: true,
          staffCommandsEnabled: true,
          temperature: 0.7,
          maxTokens: 1000,
          enableVehicleInfo: true,
          enableTestDriveBooking: true,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: account.aiConfig,
    });
  } catch (error) {
    console.error('Get WhatsApp AI config error:', error);
    return NextResponse.json(
      {
        error: 'Failed to get WhatsApp AI config',
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
      customerChatEnabled,
      aiName,
      aiPersonality,
      welcomeMessage,
      autoReply,
      staffCommandsEnabled,
      temperature,
      maxTokens,
      enableVehicleInfo,
      enableTestDriveBooking,
      businessHours,
      timezone,
      afterHoursMessage,
    } = body;

    if (!tenantId) {
      return NextResponse.json(
        { error: 'tenantId is required' },
        { status: 400 }
      );
    }

    // Get the aimeow account
    const account = await prisma.aimeowAccount.findUnique({
      where: { tenantId },
      include: {
        aiConfig: true,
        tenant: true,
      },
    });

    if (!account) {
      return NextResponse.json(
        { error: 'WhatsApp account not found for this tenant' },
        { status: 404 }
      );
    }

    // Upsert AI config
    const config = await prisma.whatsAppAIConfig.upsert({
      where: { accountId: account.id },
      create: {
        accountId: account.id,
        tenantId,
        aiName: aiName || 'AI Assistant',
        aiPersonality: aiPersonality || 'friendly',
        welcomeMessage: welcomeMessage || `Halo! Saya adalah asisten virtual ${account.tenant.name}. Ada yang bisa saya bantu?`,
        customerChatEnabled: customerChatEnabled !== undefined ? customerChatEnabled : true,
        autoReply: autoReply !== undefined ? autoReply : true,
        staffCommandsEnabled: staffCommandsEnabled !== undefined ? staffCommandsEnabled : true,
        temperature: temperature !== undefined ? temperature : 0.7,
        maxTokens: maxTokens !== undefined ? maxTokens : 1000,
        enableVehicleInfo: enableVehicleInfo !== undefined ? enableVehicleInfo : true,
        enableTestDriveBooking: enableTestDriveBooking !== undefined ? enableTestDriveBooking : true,
        businessHours,
        timezone: timezone || 'Asia/Jakarta',
        afterHoursMessage,
      },
      update: {
        ...(aiName !== undefined && { aiName }),
        ...(aiPersonality !== undefined && { aiPersonality }),
        ...(welcomeMessage !== undefined && { welcomeMessage }),
        ...(customerChatEnabled !== undefined && { customerChatEnabled }),
        ...(autoReply !== undefined && { autoReply }),
        ...(staffCommandsEnabled !== undefined && { staffCommandsEnabled }),
        ...(temperature !== undefined && { temperature }),
        ...(maxTokens !== undefined && { maxTokens }),
        ...(enableVehicleInfo !== undefined && { enableVehicleInfo }),
        ...(enableTestDriveBooking !== undefined && { enableTestDriveBooking }),
        ...(businessHours !== undefined && { businessHours }),
        ...(timezone !== undefined && { timezone }),
        ...(afterHoursMessage !== undefined && { afterHoursMessage }),
      },
    });

    return NextResponse.json({
      success: true,
      data: config,
    });
  } catch (error) {
    console.error('Update WhatsApp AI config error:', error);
    return NextResponse.json(
      {
        error: 'Failed to update WhatsApp AI config',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
