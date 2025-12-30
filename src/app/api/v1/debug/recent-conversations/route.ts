/**
 * Debug endpoint to check recent conversations
 * GET /api/v1/debug/recent-conversations
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    // Get recent conversations with messages
    const conversations = await prisma.whatsAppConversation.findMany({
      where: {
        tenantId: 'primamobil-id',
      },
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 3,
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: 5,
    });

    return NextResponse.json({
      success: true,
      conversations: conversations.map(conv => ({
        id: conv.id,
        customerPhone: conv.customerPhone,
        isStaff: conv.isStaff,
        conversationState: conv.conversationState,
        lastMessage: conv.messages[0]?.content?.substring(0, 100),
        lastMessageTime: conv.messages[0]?.createdAt,
        messageCount: conv.messages.length,
      }))
    });

  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
