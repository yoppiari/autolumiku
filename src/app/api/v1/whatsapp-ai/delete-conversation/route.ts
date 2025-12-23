/**
 * Delete Conversation (Soft Delete)
 * DELETE /api/v1/whatsapp-ai/delete-conversation?conversationId=xxx
 * Marks a conversation as deleted (soft delete) - excluded from stats
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

    // Soft delete - mark as deleted instead of removing
    // This excludes conversation from stats but keeps data for audit
    await prisma.whatsAppConversation.update({
      where: { id: conversationId },
      data: { status: "deleted" },
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
