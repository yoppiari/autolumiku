/**
 * WhatsApp AI - Webhook Logs Viewer
 * GET /api/v1/whatsapp-ai/webhook-logs?tenantId=xxx
 * Shows recent webhook activity for debugging
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

    // Get account info
    const account = await prisma.aimeowAccount.findUnique({
      where: { tenantId },
    });

    if (!account) {
      return NextResponse.json(
        { success: false, error: "Account not found" },
        { status: 404 }
      );
    }

    // Get recent conversations
    const conversations = await prisma.whatsAppConversation.findMany({
      where: { tenantId },
      take: 5,
      orderBy: { lastMessageAt: "desc" },
      include: {
        _count: {
          select: { messages: true },
        },
      },
    });

    // Get recent messages
    const messages = await prisma.whatsAppMessage.findMany({
      where: { tenantId },
      take: 20,
      orderBy: { createdAt: "desc" },
      include: {
        conversation: {
          select: { customerPhone: true, customerName: true },
        },
      },
    });

    // Check webhook status
    const webhookStatus = {
      webhookUrl: account.webhookUrl,
      isActive: account.isActive,
      connectionStatus: account.connectionStatus,
      lastConnectedAt: account.lastConnectedAt,
    };

    return NextResponse.json({
      success: true,
      data: {
        account: {
          clientId: account.clientId,
          phoneNumber: account.phoneNumber,
          ...webhookStatus,
        },
        stats: {
          totalConversations: conversations.length,
          totalMessages: messages.length,
          lastMessageAt: messages[0]?.createdAt || null,
        },
        conversations: conversations.map((c) => ({
          id: c.id,
          customerPhone: c.customerPhone,
          customerName: c.customerName,
          messageCount: c._count.messages,
          lastMessageAt: c.lastMessageAt,
          status: c.status,
        })),
        recentMessages: messages.map((m) => ({
          id: m.id,
          direction: m.direction,
          sender: m.sender,
          senderType: m.senderType,
          content: m.content.substring(0, 100),
          intent: m.intent,
          aiResponse: m.aiResponse,
          createdAt: m.createdAt,
          customerPhone: m.conversation.customerPhone,
        })),
      },
    });
  } catch (error: any) {
    console.error("[Webhook Logs] Error:", error);
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
