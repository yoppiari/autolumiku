/**
 * WhatsApp AI - Set Webhook URL
 * POST /api/v1/whatsapp-ai/set-webhook?tenantId=xxx
 * Manually register webhook URL ke Aimeow
 */

import { NextRequest, NextResponse } from "next/server";
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

    // Get account
    const account = await prisma.aimeowAccount.findUnique({
      where: { tenantId },
    });

    if (!account) {
      return NextResponse.json(
        { success: false, error: "Account not found" },
        { status: 404 }
      );
    }

    // Construct webhook URL
    const host = request.headers.get("host") || "primamobil.id";
    const protocol = host.includes("localhost") ? "http" : "https";
    const webhookUrl = `${protocol}://${host}/api/v1/webhooks/aimeow`;

    console.log(`[Set Webhook] Client ID: ${account.clientId}`);
    console.log(`[Set Webhook] Webhook URL: ${webhookUrl}`);

    // Get Aimeow base URL
    const AIMEOW_BASE_URL = process.env.AIMEOW_BASE_URL || "https://meow.lumiku.com";

    // Try to set webhook via Aimeow API
    try {
      const aimeowResponse = await fetch(
        `${AIMEOW_BASE_URL}/api/v1/clients/${account.clientId}/webhook`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            webhookUrl,
          }),
        }
      );

      const aimeowData = await aimeowResponse.json().catch(() => ({}));

      console.log(`[Set Webhook] Aimeow API Response:`, aimeowData);

      if (!aimeowResponse.ok) {
        console.warn(
          `[Set Webhook] Aimeow API returned ${aimeowResponse.status}: ${JSON.stringify(aimeowData)}`
        );
        // Continue anyway - update local DB
      } else {
        console.log(`[Set Webhook] Successfully registered with Aimeow`);
      }
    } catch (aimeowError: any) {
      console.error(`[Set Webhook] Aimeow API Error:`, aimeowError.message);
      // Continue anyway - update local DB
    }

    // Update database regardless
    await prisma.aimeowAccount.update({
      where: { id: account.id },
      data: {
        webhookUrl,
      },
    });

    console.log(`[Set Webhook] Updated database with webhook URL`);

    return NextResponse.json({
      success: true,
      message: "Webhook URL updated",
      data: {
        clientId: account.clientId,
        webhookUrl,
        note: "Webhook URL saved to database. Aimeow may need to be configured manually if API call failed.",
      },
    });
  } catch (error: any) {
    console.error("[Set Webhook] Error:", error);
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
