/**
 * WhatsApp AI Conversation Messages API
 * GET /api/v1/whatsapp-ai/conversations/[conversationId]/messages
 * Returns messages for a specific conversation
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: { conversationId: string } }
) {
  try {
    const conversationId = params.conversationId;

    if (!conversationId) {
      return NextResponse.json(
        { success: false, error: "Missing conversationId" },
        { status: 400 }
      );
    }

    // Get messages
    const messages = await prisma.whatsAppMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: "asc" },
    });

    // Format response
    const formattedMessages = messages.map((msg) => ({
      id: msg.id,
      direction: msg.direction,
      sender: msg.sender,
      senderType: msg.senderType,
      content: msg.content,
      mediaUrl: msg.mediaUrl,
      mediaType: msg.mediaType,
      intent: msg.intent,
      aiResponse: msg.aiResponse,
      createdAt: msg.createdAt.toISOString(),
    }));

    return NextResponse.json({
      success: true,
      data: formattedMessages,
    });
  } catch (error: any) {
    console.error("[Conversation Messages API] Error:", error);
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
