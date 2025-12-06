/**
 * Debug Webhook Payload
 * GET /api/v1/whatsapp-ai/debug-webhook?tenantId=xxx
 * Returns last 5 webhook payloads received for debugging
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';

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

    // Get recent incoming messages to see the phone numbers
    const recentMessages = await prisma.whatsAppMessage.findMany({
      where: {
        tenantId,
        direction: "inbound",
      },
      take: 10,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        sender: true,
        content: true,
        aimeowMessageId: true,
        createdAt: true,
        conversation: {
          select: {
            customerPhone: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        recentInboundMessages: recentMessages.map((msg) => ({
          sender: msg.sender,
          customerPhone: msg.conversation.customerPhone,
          content: msg.content.substring(0, 50),
          messageId: msg.aimeowMessageId,
          createdAt: msg.createdAt,
        })),
      },
    });
  } catch (error: any) {
    console.error("[Debug Webhook] Error:", error);
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
