/**
 * WhatsApp AI - Test Webhook
 * POST /api/v1/whatsapp-ai/test-webhook?tenantId=xxx
 * Simulates incoming message untuk debug
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { MessageOrchestratorService } from "@/lib/services/whatsapp-ai/core/message-orchestrator.service";

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get("tenantId");
    const body = await request.json();

    const testMessage = body.message || "Halo, test pesan";
    const testPhone = body.phone || "6281234567890";

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

    console.log("[Test Webhook] Starting test...");
    console.log(`[Test Webhook] Account ID: ${account.id}`);
    console.log(`[Test Webhook] Client ID: ${account.clientId}`);
    console.log(`[Test Webhook] Test Phone: ${testPhone}`);
    console.log(`[Test Webhook] Test Message: ${testMessage}`);

    // Simulate incoming message
    const result = await MessageOrchestratorService.processIncomingMessage({
      accountId: account.id,
      clientId: account.id, // Aimeow client ID is the same as account ID
      tenantId,
      from: testPhone,
      message: testMessage,
      messageId: `test_${Date.now()}`,
    });

    console.log("[Test Webhook] Result:", result);

    return NextResponse.json({
      success: true,
      message: "Test webhook executed",
      data: {
        testInput: {
          accountId: account.id,
          tenantId,
          from: testPhone,
          message: testMessage,
        },
        processingResult: result,
      },
    });
  } catch (error: any) {
    console.error("[Test Webhook] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Test webhook failed",
        details: error.message,
        stack: error.stack,
      },
      { status: 500 }
    );
  }
}
