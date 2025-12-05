/**
 * WhatsApp AI - Test Send Message
 * POST /api/v1/whatsapp-ai/test-send?tenantId=xxx
 * Test sending message ke WhatsApp untuk debug
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AimeowClientService } from "@/lib/services/aimeow/aimeow-client.service";

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get("tenantId");
    const body = await request.json();

    const testMessage = body.message || "Test pesan dari AutoLumiku";
    const testPhone = body.phone || "6281235108908";

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

    console.log("[Test Send] =".repeat(40));
    console.log(`[Test Send] Account ID: ${account.id}`);
    console.log(`[Test Send] Client ID: ${account.clientId}`);
    console.log(`[Test Send] Phone Number: ${account.phoneNumber}`);
    console.log(`[Test Send] Connection Status: ${account.connectionStatus}`);
    console.log(`[Test Send] Is Active: ${account.isActive}`);
    console.log(`[Test Send] Target Phone: ${testPhone}`);
    console.log(`[Test Send] Message: ${testMessage}`);

    // Test send message
    const result = await AimeowClientService.sendMessage({
      clientId: account.clientId,
      to: testPhone,
      message: testMessage,
    });

    console.log(`[Test Send] Result:`, JSON.stringify(result, null, 2));

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Failed to send message",
          details: result.error,
          debug: {
            accountId: account.id,
            clientId: account.clientId,
            phoneNumber: account.phoneNumber,
            connectionStatus: account.connectionStatus,
            isActive: account.isActive,
          },
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Test message sent successfully",
      data: {
        messageId: result.messageId,
        sentTo: testPhone,
        sentMessage: testMessage,
        accountInfo: {
          clientId: account.clientId,
          phoneNumber: account.phoneNumber,
          connectionStatus: account.connectionStatus,
        },
      },
    });
  } catch (error: any) {
    console.error("[Test Send] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Test send failed",
        details: error.message,
        stack: error.stack,
      },
      { status: 500 }
    );
  }
}
