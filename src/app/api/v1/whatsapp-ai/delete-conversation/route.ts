/**
 * Delete Conversation
 * DELETE /api/v1/whatsapp-ai/delete-conversation?conversationId=xxx
 * Deletes a conversation and all its messages
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get("conversationId");

    if (!conversationId) {
      return NextResponse.json(
        { success: false, error: "Missing required parameter: conversationId" },
        { status: 400 }
      );
    }

    // Delete all messages in conversation first
    await prisma.whatsAppMessage.deleteMany({
      where: { conversationId },
    });

    // Delete conversation
    await prisma.whatsAppConversation.delete({
      where: { id: conversationId },
    });

    return NextResponse.json({
      success: true,
      message: "Conversation deleted successfully",
    });
  } catch (error: any) {
    console.error("[Delete Conversation] Error:", error);
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
