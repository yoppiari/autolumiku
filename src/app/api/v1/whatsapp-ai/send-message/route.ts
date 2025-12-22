/**
 * WhatsApp AI - Send Manual Message
 * POST /api/v1/whatsapp-ai/send-message
 * Kirim pesan manual dari dashboard ke customer
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AimeowClientService } from "@/lib/services/aimeow/aimeow-client.service";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tenantId, conversationId, to, message } = body;

    // Validate required fields
    if (!tenantId || !to || !message) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: tenantId, to, message" },
        { status: 400 }
      );
    }

    // Get Aimeow account for tenant
    const account = await prisma.aimeowAccount.findFirst({
      where: { tenantId, isActive: true },
    });

    if (!account) {
      return NextResponse.json(
        { success: false, error: "No active WhatsApp account found for tenant" },
        { status: 404 }
      );
    }

    // Send message via Aimeow
    const result = await AimeowClientService.sendMessage({
      clientId: account.clientId,
      to,
      message,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || "Failed to send message" },
        { status: 500 }
      );
    }

    // Save outbound message to database
    if (conversationId) {
      await prisma.whatsAppMessage.create({
        data: {
          conversationId,
          tenantId,
          direction: "outbound",
          sender: "Admin",
          senderType: "human",
          content: message,
          intent: "manual_reply",
          aiResponse: false,
          aimeowMessageId: result.messageId || `msg_${Date.now()}`,
          aimeowStatus: "sent",
        },
      });

      // Update conversation last message time
      await prisma.whatsAppConversation.update({
        where: { id: conversationId },
        data: { lastMessageAt: new Date() },
      });
    }

    return NextResponse.json({
      success: true,
      message: "Message sent successfully",
      messageId: result.messageId,
    });
  } catch (error: any) {
    console.error("[Send Message API] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
