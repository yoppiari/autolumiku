/**
 * Debug endpoint to check recent WhatsApp webhook logs
 * GET /api/v1/debug/check-logs
 *
 * Shows recent incoming messages with phone numbers
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Get recent conversations with messages
    const conversations = await prisma.whatsAppConversation.findMany({
      where: {
        tenantId: request.headers.get('x-tenant-id') || 'primamobil-id',
      },
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
      orderBy: { lastMessageAt: 'desc' },
      take: 10,
    });

    const results = conversations.map(conv => ({
      conversationId: conv.id,
      customerPhone: conv.customerPhone,
      isStaff: conv.isStaff,
      conversationState: conv.conversationState,
      messageCount: conv.messages.length,
      recentMessages: conv.messages.map(msg => ({
        from: msg.direction === 'incoming' ? 'USER' : 'BOT',
        content: msg.content?.substring(0, 100),
        timestamp: msg.createdAt,
      })),
      contextData: {
        verifiedStaffPhone: (conv.contextData as any)?.verifiedStaffPhone,
        originalLID: (conv.contextData as any)?.originalLID,
        linkedLIDs: (conv.contextData as any)?.linkedLIDs,
      },
    }));

    return NextResponse.json({
      success: true,
      count: results.length,
      conversations: results,
    });

  } catch (error: any) {
    console.error('[Check Logs] Error:', error);
    return NextResponse.json(
      { error: error.message, stack: error.stack },
      { status: 500 }
    );
  }
}
