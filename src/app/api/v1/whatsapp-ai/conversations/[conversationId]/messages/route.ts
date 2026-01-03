/**
 * WhatsApp AI Conversation Messages API
 * GET /api/v1/whatsapp-ai/conversations/[conversationId]/messages
 * DELETE /api/v1/whatsapp-ai/conversations/[conversationId]/messages
 * Returns/manages messages for a specific conversation
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AimeowClientService } from "@/lib/services/aimeow/aimeow-client.service";

export async function GET(
  request: NextRequest,
  { params }: { params: any }
) {
  try {
    const { conversationId } = await params;

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
 * Delete a specific message from conversation (both dashboard and WhatsApp)
 * Query params: messageId - ID of message to delete
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: any }
) {
  try {
    const { conversationId } = await params;
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

    // Get message with conversation details for WhatsApp deletion
    const message = await prisma.whatsAppMessage.findFirst({
      where: {
        id: messageId,
        conversationId,
      },
      include: {
        conversation: {
          include: {
            account: true,
          },
        },
      },
    });

    if (!message) {
      return NextResponse.json(
        { success: false, error: "Message not found" },
        { status: 404 }
      );
    }

    // Try to delete from WhatsApp if we have aimeowMessageId
    let whatsappDeleted = false;
    if (message.aimeowMessageId && message.conversation?.account?.clientId) {
      console.log(`[Conversation Messages API] Attempting to delete from WhatsApp...`);
      console.log(`[Conversation Messages API] aimeowMessageId: ${message.aimeowMessageId}`);

      const deleteResult = await AimeowClientService.deleteMessage(
        message.conversation.account.clientId,
        message.sender, // Phone number
        message.aimeowMessageId
      );

      whatsappDeleted = deleteResult.success;
      console.log(`[Conversation Messages API] WhatsApp deletion: ${whatsappDeleted ? 'success' : 'failed'}`);
    } else {
      console.log(`[Conversation Messages API] No aimeowMessageId or clientId, skipping WhatsApp deletion`);
    }

    // Delete from dashboard database
    await prisma.whatsAppMessage.delete({
      where: { id: messageId },
    });

    console.log(`[Conversation Messages API] Deleted message ${messageId} from conversation ${conversationId}`);

    return NextResponse.json({
      success: true,
      message: "Message deleted successfully",
      whatsappDeleted,
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
