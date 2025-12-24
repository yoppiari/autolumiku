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

    // Helper to check if a number looks like a LID (not a real phone)
    const isLIDNumber = (num: string): boolean => {
      if (!num) return false;
      const digits = num.replace(/\D/g, "");
      if (digits.length < 10) return false;
      // LID patterns: very long numbers, or numbers starting with 100/101/102
      if (digits.length >= 16) return true;
      if (digits.length >= 14 && (digits.startsWith("100") || digits.startsWith("101") || digits.startsWith("102"))) return true;
      // Numbers that are too long for valid country codes
      if (digits.startsWith("62") && digits.length > 14) return true;
      if (digits.startsWith("1") && digits.length > 11 && !digits.startsWith("1800")) return true;
      return false;
    };

    // Format response - resolve real phone from contextData if customerPhone is LID
    const formattedConversations = conversations.map((conv) => {
      const contextData = conv.contextData as Record<string, any> | null;
      let displayPhone = conv.customerPhone;

      // If customerPhone looks like a LID, try to get real phone from contextData
      if (isLIDNumber(conv.customerPhone)) {
        const realPhone = contextData?.verifiedStaffPhone || contextData?.realPhone || contextData?.actualPhone;
        if (realPhone && !isLIDNumber(realPhone)) {
          displayPhone = realPhone;
        }
      }

      return {
        id: conv.id,
        customerPhone: displayPhone,
        originalPhone: conv.customerPhone, // Keep original for debugging
        customerName: conv.customerName,
        isStaff: conv.isStaff,
        conversationType: conv.conversationType,
        lastIntent: conv.lastIntent,
        status: conv.status,
        lastMessageAt: conv.lastMessageAt.toISOString(),
        escalatedTo: conv.escalatedTo,
        messageCount: conv._count.messages,
        unreadCount: 0, // TODO: Implement unread tracking
        hasRealPhone: !isLIDNumber(displayPhone), // Flag to indicate if we have real phone
      };
    });

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
