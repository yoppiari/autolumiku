/**
 * WhatsApp AI - Initialize Connection
 * POST /api/v1/whatsapp-ai/initialize
 * Generates QR code untuk connect WhatsApp Business
 */

import { NextRequest, NextResponse } from "next/server";
import { AimeowClientService } from "@/lib/services/aimeow/aimeow-client.service";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tenantId } = body;

    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: "Missing required field: tenantId" },
        { status: 400 }
      );
    }

    // Check if already connected
    const existingAccount = await AimeowClientService.getAccountByTenant(tenantId);

    if (existingAccount && existingAccount.isActive) {
      return NextResponse.json(
        {
          success: false,
          error: "WhatsApp already connected for this tenant",
          data: {
            clientId: existingAccount.clientId,
            phoneNumber: existingAccount.phoneNumber,
            isConnected: true,
          },
        },
        { status: 400 }
      );
    }

    // Construct webhook URL
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || `https://${request.headers.get("host")}`;
    const webhookUrl = `${appUrl}/api/v1/webhooks/aimeow`;

    // Initialize new connection
    const result = await AimeowClientService.initializeClient(tenantId, webhookUrl);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || "Failed to initialize WhatsApp connection" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "QR code generated successfully",
      data: {
        clientId: result.clientId,
        qrCode: result.qrCode,
      },
    });
  } catch (error: any) {
    console.error("[WhatsApp AI Initialize] Error:", error);
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
