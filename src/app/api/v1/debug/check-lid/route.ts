/**
 * Debug endpoint to check LID conversations
 * GET /api/v1/debug/check-lid?lid=xxx
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const lid = request.nextUrl.searchParams.get('lid');

  if (!lid) {
    return NextResponse.json({
      error: "Missing lid parameter",
      usage: "GET /api/v1/debug/check-lid?lid=a101519c5365c6709950fd682b1e528d8c97dd02"
    }, { status: 400 });
  }

  try {
    // Search for this LID in conversations
    const conversations = await prisma.whatsAppConversation.findMany({
      where: {
        tenantId: 'primamobil-id',
        OR: [
          { customerPhone: { contains: lid } },
          { customerPhone: lid },
        ],
      },
      take: 10,
      orderBy: { lastMessageAt: 'desc' },
    });

    // Also search in linkedLIDs
    const allConversations = await prisma.whatsAppConversation.findMany({
      where: {
        tenantId: 'primamobil-id',
      },
      take: 50,
      orderBy: { lastMessageAt: 'desc' },
    });

    const lidLinked = allConversations.filter(conv => {
      const contextData = conv.contextData as Record<string, any> | null;
      return contextData?.linkedLIDs?.includes(lid) ||
             contextData?.originalLID === lid;
    });

    return NextResponse.json({
      searchedLid: lid,
      foundByCustomerPhone: conversations.length,
      foundByLinkedLIDs: lidLinked.length,
      conversations: {
        byPhone: conversations.map(c => ({
          id: c.id,
          customerPhone: c.customerPhone,
          isStaff: c.isStaff,
          conversationState: c.conversationState,
          lastMessageAt: c.lastMessageAt,
        })),
        byLinked: lidLinked.map(c => ({
          id: c.id,
          customerPhone: c.customerPhone,
          isStaff: c.isStaff,
          verifiedStaffPhone: (c.contextData as any)?.verifiedStaffPhone,
          linkedLIDs: (c.contextData as any)?.linkedLIDs,
          originalLID: (c.contextData as any)?.originalLID,
        })),
      },
    });

  } catch (error: any) {
    return NextResponse.json({
      error: error.message,
      stack: error.stack,
    }, { status: 500 });
  }
}
