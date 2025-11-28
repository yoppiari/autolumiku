/**
 * WhatsApp AI - Refresh QR Code
 * POST /api/v1/whatsapp-ai/refresh-qr
 * Generates new QR code when the previous one expired
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

    // Get existing account
    const account = await AimeowClientService.getAccountByTenant(tenantId);

    if (!account) {
      return NextResponse.json(
        { success: false, error: "WhatsApp account not found for this tenant" },
        { status: 404 }
      );
    }

    // If already connected, return error
    if (account.isActive && account.connectionStatus === "connected") {
      return NextResponse.json(
        {
          success: false,
          error: "WhatsApp is already connected. Disconnect first if you want to reconnect.",
        },
        { status: 400 }
      );
    }

    // Get fresh QR code dari Aimeow
    const result = await AimeowClientService.getQRCode(account.clientId);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || "Failed to refresh QR code",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "QR code refreshed successfully",
      data: {
        clientId: account.clientId,
        qrCode: result.qrCode,
        expiresIn: 120, // seconds
      },
    });
  } catch (error: any) {
    console.error("[WhatsApp AI Refresh QR] Error:", error);
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
