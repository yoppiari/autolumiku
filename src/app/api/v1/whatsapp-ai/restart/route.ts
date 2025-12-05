/**
 * WhatsApp AI - Restart Connection
 * POST /api/v1/whatsapp-ai/restart?tenantId=xxx
 * Disconnect + Reinitialize dengan webhook URL otomatis
 */

import { NextRequest, NextResponse } from "next/server";
import { AimeowClientService } from "@/lib/services/aimeow/aimeow-client.service";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get("tenantId");

    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: "Missing required parameter: tenantId" },
        { status: 400 }
      );
    }

    // 1. Get existing account
    const account = await prisma.aimeowAccount.findUnique({
      where: { tenantId },
      include: {
        tenant: {
          select: { id: true, name: true, slug: true, domain: true },
        },
      },
    });

    if (!account) {
      return NextResponse.json(
        {
          success: false,
          error: "WhatsApp account not found. Please initialize first.",
        },
        { status: 404 }
      );
    }

    // 2. Construct webhook URL
    const host = request.headers.get("host") || "auto.lumiku.com";
    const protocol = host.includes("localhost") ? "http" : "https";
    const webhookUrl = `${protocol}://${host}/api/v1/webhooks/aimeow`;

    console.log(`[Restart] Tenant: ${account.tenant.name}`);
    console.log(`[Restart] Old Client ID: ${account.clientId}`);
    console.log(`[Restart] Webhook URL: ${webhookUrl}`);

    // 3. Restart connection (disconnect + initialize)
    const result = await AimeowClientService.restartClient(
      tenantId,
      account.clientId,
      webhookUrl
    );

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || "Failed to restart connection",
        },
        { status: 500 }
      );
    }

    console.log(`[Restart] New Client ID: ${result.clientId}`);
    console.log(`[Restart] Webhook registered: ${webhookUrl}`);

    // 4. Return success with QR code
    return NextResponse.json({
      success: true,
      message: "Connection restarted successfully. Please scan QR code.",
      data: {
        clientId: result.clientId,
        qrCode: result.qrCode,
        webhookUrl,
        instructions: [
          "1. Open WhatsApp Business on your phone",
          "2. Go to: Settings → Linked Devices → Link a Device",
          "3. Scan the QR code",
          "4. Test by sending a message to your WhatsApp number",
          "5. Check conversations in dashboard",
        ],
      },
    });
  } catch (error: any) {
    console.error("[WhatsApp AI Restart] Error:", error);
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
