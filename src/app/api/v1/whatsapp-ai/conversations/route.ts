/**
 * WhatsApp AI Conversations API
 * GET /api/v1/whatsapp-ai/conversations?tenantId=xxx
 * Returns list of conversations dengan stats
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

    // Get conversations dengan message count
    // Exclude deleted conversations from the list (soft-deleted)
    const conversations = await prisma.whatsAppConversation.findMany({
      where: {
        tenantId,
        status: { not: "deleted" }, // Exclude deleted conversations
      },
      include: {
        _count: {
          select: { messages: true },
        },
      },
      orderBy: { lastMessageAt: "desc" },
    });

    // Format response
    const formattedConversations = conversations.map((conv) => ({
      id: conv.id,
      customerPhone: conv.customerPhone,
      customerName: conv.customerName,
      isStaff: conv.isStaff,
      conversationType: conv.conversationType,
      lastIntent: conv.lastIntent,
      status: conv.status,
      lastMessageAt: conv.lastMessageAt.toISOString(),
      escalatedTo: conv.escalatedTo,
      messageCount: conv._count.messages,
      unreadCount: 0, // TODO: Implement unread tracking
    }));

    return NextResponse.json({
      success: true,
      data: formattedConversations,
    });
  } catch (error: any) {
    console.error("[Conversations API] Error:", error);
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
