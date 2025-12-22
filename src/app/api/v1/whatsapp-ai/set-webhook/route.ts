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

    // Try to set webhook via Aimeow API - TRY BOTH endpoints
    let globalConfigSuccess = false;
    let clientWebhookSuccess = false;

    // 1. Try global /config endpoint (per Aimeow Swagger docs)
    try {
      console.log(`[Set Webhook] Trying global /config endpoint...`);
      const configResponse = await fetch(
        `${AIMEOW_BASE_URL}/config`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            callbackUrl: webhookUrl,  // Aimeow uses 'callbackUrl' not 'webhookUrl'
          }),
        }
      );

      const configData = await configResponse.json().catch(() => ({}));
      console.log(`[Set Webhook] /config Response (${configResponse.status}):`, configData);

      if (configResponse.ok) {
        globalConfigSuccess = true;
        console.log(`[Set Webhook] ✅ Global callback URL set successfully`);
      }
    } catch (configError: any) {
      console.warn(`[Set Webhook] /config Error:`, configError.message);
    }

    // 2. Also try per-client /webhook endpoint as fallback
    try {
      console.log(`[Set Webhook] Trying per-client /webhook endpoint...`);
      const aimeowResponse = await fetch(
        `${AIMEOW_BASE_URL}/api/v1/clients/${account.clientId}/webhook`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            webhookUrl,
            callbackUrl: webhookUrl,  // Try both field names
          }),
        }
      );

      const aimeowData = await aimeowResponse.json().catch(() => ({}));
      console.log(`[Set Webhook] /clients/.../webhook Response (${aimeowResponse.status}):`, aimeowData);

      if (aimeowResponse.ok) {
        clientWebhookSuccess = true;
        console.log(`[Set Webhook] ✅ Per-client webhook set successfully`);
      }
    } catch (aimeowError: any) {
      console.warn(`[Set Webhook] /clients/.../webhook Error:`, aimeowError.message);
    }

    if (!globalConfigSuccess && !clientWebhookSuccess) {
      console.warn(`[Set Webhook] ⚠️ Both Aimeow endpoints failed - webhook may need manual configuration`);
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
        globalConfigSuccess,
        clientWebhookSuccess,
        note: globalConfigSuccess || clientWebhookSuccess
          ? "Webhook URL configured on Aimeow successfully"
          : "Webhook URL saved to database. Aimeow may need manual configuration via meow.lumiku.com",
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
