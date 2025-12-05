/**
 * WhatsApp AI - Check Outbound Messages
 * GET /api/v1/whatsapp-ai/check-outbound?tenantId=xxx
 * Check all outbound messages and their send status
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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

    // Get all outbound messages
    const outboundMessages = await prisma.whatsAppMessage.findMany({
      where: {
        tenantId,
        direction: "outbound",
      },
      take: 20,
      orderBy: { createdAt: "desc" },
      include: {
        conversation: {
          select: {
            customerPhone: true,
            customerName: true,
          },
        },
      },
    });

    // Get count by status
    const statusCounts = await prisma.whatsAppMessage.groupBy({
      by: ["aimeowStatus"],
      where: {
        tenantId,
        direction: "outbound",
      },
      _count: true,
    });

    // Get failed messages (null status = never sent)
    const failedMessages = outboundMessages.filter(
      (msg) => !msg.aimeowStatus || msg.aimeowStatus === "failed"
    );

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          totalOutbound: outboundMessages.length,
          failed: failedMessages.length,
          statusBreakdown: statusCounts.map((s) => ({
            status: s.aimeowStatus || "not_sent",
            count: s._count,
          })),
        },
        outboundMessages: outboundMessages.map((msg) => ({
          id: msg.id,
          content: msg.content.substring(0, 100),
          customerPhone: msg.conversation.customerPhone,
          customerName: msg.conversation.customerName,
          senderType: msg.senderType,
          aiResponse: msg.aiResponse,
          aimeowMessageId: msg.aimeowMessageId,
          aimeowStatus: msg.aimeowStatus || "NOT_SENT",
          createdAt: msg.createdAt,
          deliveredAt: msg.deliveredAt,
          readAt: msg.readAt,
        })),
        failedMessages: failedMessages.map((msg) => ({
          id: msg.id,
          content: msg.content.substring(0, 100),
          customerPhone: msg.conversation.customerPhone,
          aimeowMessageId: msg.aimeowMessageId,
          aimeowStatus: msg.aimeowStatus || "NOT_SENT",
          createdAt: msg.createdAt,
        })),
      },
    });
  } catch (error: any) {
    console.error("[Check Outbound] Error:", error);
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
