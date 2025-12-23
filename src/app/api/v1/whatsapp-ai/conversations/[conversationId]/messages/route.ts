/**
 * WhatsApp AI Conversation Messages API
 * GET /api/v1/whatsapp-ai/conversations/[conversationId]/messages
 * DELETE /api/v1/whatsapp-ai/conversations/[conversationId]/messages
 * Returns/manages messages for a specific conversation
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

/**
 * DELETE /api/v1/whatsapp-ai/conversations/[conversationId]/messages
 * Delete a specific message from conversation
 * Query params: messageId - ID of message to delete
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { conversationId: string } }
) {
  try {
    const conversationId = params.conversationId;
    const { searchParams } = new URL(request.url);
    const messageId = searchParams.get("messageId");

    if (!conversationId) {
      return NextResponse.json(
        { success: false, error: "Missing conversationId" },
        { status: 400 }
      );
    }

    if (!messageId) {
      return NextResponse.json(
        { success: false, error: "Missing messageId" },
        { status: 400 }
      );
    }

    // Verify message exists and belongs to this conversation
    const message = await prisma.whatsAppMessage.findFirst({
      where: {
        id: messageId,
        conversationId,
      },
    });

    if (!message) {
      return NextResponse.json(
        { success: false, error: "Message not found" },
        { status: 404 }
      );
    }

    // Delete the message
    await prisma.whatsAppMessage.delete({
      where: { id: messageId },
    });

    console.log(`[Conversation Messages API] Deleted message ${messageId} from conversation ${conversationId}`);

    return NextResponse.json({
      success: true,
      message: "Message deleted successfully",
    });
  } catch (error: any) {
    console.error("[Conversation Messages API] Delete error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to delete message",
        details: error.message,
      },
      { status: 500 }
    );
  }
}
