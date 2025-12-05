/**
 * WhatsApp AI - Fix ClientId
 * POST /api/v1/whatsapp-ai/fix-clientid?tenantId=xxx
 * Update clientId to JID format based on latest webhook
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

    console.log(`[Fix ClientId] Current clientId: ${account.clientId}`);
    console.log(`[Fix ClientId] Phone: ${account.phoneNumber}`);

    // Based on logs, the correct clientId from Aimeow webhook is:
    // "6283134446903:80@s.whatsapp.net"
    // Format: {phoneNumber}:80@s.whatsapp.net

    if (!account.phoneNumber) {
      return NextResponse.json(
        {
          success: false,
          error: "Phone number not set. Cannot determine correct clientId.",
        },
        { status: 400 }
      );
    }

    // Extract just the phone number part if it's already in JID format
    let phoneNumber = account.phoneNumber;
    if (phoneNumber.includes("@") || phoneNumber.includes(":")) {
      phoneNumber = phoneNumber.split(":")[0].split("@")[0];
    }

    // Build correct JID format based on Aimeow's format from logs
    // The format from webhook is: 6283134446903:80@s.whatsapp.net
    const correctClientId = `${phoneNumber}:80@s.whatsapp.net`;

    console.log(`[Fix ClientId] Updating to correct JID format: ${correctClientId}`);

    // Update to the correct JID format
    await prisma.aimeowAccount.update({
      where: { id: account.id },
      data: {
        clientId: correctClientId,
      },
    });

    console.log(`[Fix ClientId] ✅ Updated clientId successfully`);

    return NextResponse.json({
      success: true,
      message: "ClientId fixed successfully! Now using JID format from Aimeow webhook.",
      data: {
        oldClientId: account.clientId,
        newClientId: correctClientId,
        phoneNumber: account.phoneNumber,
        explanation: "ClientId updated to match the format Aimeow sends in webhooks. This should fix the send message issue.",
      },
    });
  } catch (error: any) {
    console.error("[Fix ClientId] Error:", error);
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
