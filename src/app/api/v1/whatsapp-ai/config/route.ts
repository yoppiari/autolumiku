/**
 * WhatsApp AI - Configuration Management
 * GET /api/v1/whatsapp-ai/config?tenantId=xxx - Get configuration
 * PUT /api/v1/whatsapp-ai/config - Update configuration
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET - Retrieve WhatsApp AI configuration
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get("tenantId");

    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: "Missing required parameter: tenantId" },
        { status: 400 }
      );
    }

    // Get account and config
    const account = await prisma.aimeowAccount.findUnique({
      where: { tenantId },
      include: {
        aiConfig: true,
      },
    });

    if (!account) {
      return NextResponse.json(
        { success: false, error: "WhatsApp account not found for this tenant" },
        { status: 404 }
      );
    }

    if (!account.aiConfig) {
      return NextResponse.json(
        { success: false, error: "AI configuration not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: account.aiConfig,
    });
  } catch (error: any) {
    console.error("[WhatsApp AI Config GET] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
        details: error.message,
      },
      { status: 500 }
    );
  }
}

/**
 * PUT - Update WhatsApp AI configuration
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { tenantId, ...configUpdates } = body;

    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: "Missing required field: tenantId" },
        { status: 400 }
      );
    }

    // Get existing config
    const account = await prisma.aimeowAccount.findUnique({
      where: { tenantId },
      include: {
        aiConfig: true,
      },
    });

    if (!account) {
      return NextResponse.json(
        { success: false, error: "WhatsApp account not found" },
        { status: 404 }
      );
    }

    if (!account.aiConfig) {
      return NextResponse.json(
        { success: false, error: "AI configuration not found" },
        { status: 404 }
      );
    }

    // Validate and sanitize updates
    const allowedFields = [
      "aiName",
      "aiPersonality",
      "welcomeMessage",
      "autoReply",
      "customerChatEnabled",
      "staffCommandsEnabled",
      "businessHours",
      "timezone",
      "afterHoursMessage",
      "aiModel",
      "temperature",
      "maxTokens",
      "customFAQ",
      "productKnowledge",
      "enableVehicleInfo",
      "enablePriceNegotiation",
      "enableTestDriveBooking",
      "enableStaffUpload",
      "enableStaffStatus",
    ];

    const updates: any = {};
    for (const field of allowedFields) {
      if (field in configUpdates) {
        updates[field] = configUpdates[field];
      }
    }

    // Update config
    const updatedConfig = await prisma.whatsAppAIConfig.update({
      where: { id: account.aiConfig.id },
      data: updates,
    });

    // Send callback URL configuration to Aimeow
    try {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || `https://${request.headers.get("host")}` || "https://auto.lumiku.com";
      const callbackUrl = `${appUrl}/api/v1/webhooks/aimeow`;

      const aimeowBaseUrl = process.env.AIMEOW_BASE_URL || "https://meow.lumiku.com";

      // Update the callback URL configuration using the correct endpoint
      const aimeowResponse = await fetch(`${aimeowBaseUrl}/api/v1/config`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          callbackUrl: callbackUrl,
        }),
      });

      if (!aimeowResponse.ok) {
        console.error("[WhatsApp AI Config] Failed to update Aimeow callback URL:", await aimeowResponse.text());
      } else {
        console.log("[WhatsApp AI Config] Successfully updated Aimeow callback URL:", callbackUrl);

        // Update local database with the webhook URL
        await prisma.aimeowAccount.update({
          where: { id: account.id },
          data: { webhookUrl: callbackUrl },
        });
      }
    } catch (aimeowError: any) {
      // Log error but don't fail the entire config update
      console.error("[WhatsApp AI Config] Error sending callback URL to Aimeow:", aimeowError.message);
    }

    return NextResponse.json({
      success: true,
      message: "Configuration updated successfully",
      data: updatedConfig,
    });
  } catch (error: any) {
    console.error("[WhatsApp AI Config PUT] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
        details: error.message,
      },
      { status: 500 }
    );
  }
}

/**
 * POST - Create initial AI configuration (called during setup)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tenantId, accountId, ...configData } = body;

    if (!tenantId || !accountId) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: tenantId, accountId" },
        { status: 400 }
      );
    }

    // Check if config already exists
    const existing = await prisma.whatsAppAIConfig.findUnique({
      where: { tenantId },
    });

    if (existing) {
      return NextResponse.json(
        { success: false, error: "Configuration already exists for this tenant" },
        { status: 400 }
      );
    }

    // Create new config with defaults
    const config = await prisma.whatsAppAIConfig.create({
      data: {
        tenantId,
        accountId,
        aiName: configData.aiName || "AI Assistant",
        aiPersonality: configData.aiPersonality || "friendly",
        welcomeMessage: configData.welcomeMessage || "Halo! 👋 Saya asisten virtual showroom. Ada yang bisa saya bantu?",
        autoReply: configData.autoReply ?? true,
        customerChatEnabled: configData.customerChatEnabled ?? true,
        staffCommandsEnabled: configData.staffCommandsEnabled ?? true,
        businessHours: configData.businessHours || {
          monday: { open: "09:00", close: "17:00" },
          tuesday: { open: "09:00", close: "17:00" },
          wednesday: { open: "09:00", close: "17:00" },
          thursday: { open: "09:00", close: "17:00" },
          friday: { open: "09:00", close: "17:00" },
          saturday: { open: "09:00", close: "15:00" },
          sunday: { open: "closed", close: "closed" },
        },
        timezone: configData.timezone || "Asia/Jakarta",
        afterHoursMessage: configData.afterHoursMessage || "Terima kasih telah menghubungi kami. Kami sedang tutup sekarang. Jam operasional: Senin-Jumat 09:00-17:00, Sabtu 09:00-15:00.",
        aiModel: configData.aiModel || "glm-4.6",
        temperature: configData.temperature || 0.7,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Configuration created successfully",
      data: config,
    });
  } catch (error: any) {
    console.error("[WhatsApp AI Config POST] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
        details: error.message,
      },
      { status: 500 }
    );
  }
}
