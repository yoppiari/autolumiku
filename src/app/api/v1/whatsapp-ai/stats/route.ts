/**
 * WhatsApp AI - Get Detailed Statistics
 * GET /api/v1/whatsapp-ai/stats?tenantId=xxx
 * Returns detailed conversation and performance statistics
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';

/**
 * Calculate average response time in seconds
 * Measures time between inbound customer message and AI response
 */
async function calculateAvgResponseTime(tenantId: string): Promise<number> {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30); // Last 30 days

    const conversations = await prisma.whatsAppConversation.findMany({
      where: {
        tenantId,
        startedAt: { gte: startDate },
        status: { not: "deleted" },
      },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
          take: 10,
        },
      },
      take: 50,
    });

    const responseTimes: number[] = [];

    for (const conv of conversations) {
      const messages = conv.messages;
      for (let i = 0; i < messages.length - 1; i++) {
        const current = messages[i];
        const next = messages[i + 1];

        if (
          current.direction === "inbound" &&
          next.direction === "outbound" &&
          next.aiResponse
        ) {
          const responseTime =
            (new Date(next.createdAt).getTime() - new Date(current.createdAt).getTime()) / 1000;

          if (responseTime > 0 && responseTime < 300) {
            responseTimes.push(responseTime);
          }
        }
      }
    }

    if (responseTimes.length === 0) return 5;
    return Math.round(responseTimes.reduce((sum, t) => sum + t, 0) / responseTimes.length);
  } catch (error) {
    console.error("[Stats] Error calculating response time:", error);
    return 5;
  }
}

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

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Get conversation counts (exclude deleted conversations - data sampah)
    const [
      totalConversations,
      activeConversations,
      escalatedConversations,
      customerConversations,
      staffConversations,
    ] = await Promise.all([
      prisma.whatsAppConversation.count({
        where: {
          tenantId,
          status: { not: "deleted" },
        },
      }),
      prisma.whatsAppConversation.count({
        where: {
          tenantId,
          status: "active",
        },
      }),
      prisma.whatsAppConversation.count({
        where: {
          tenantId,
          escalatedTo: { not: null },
          status: { not: "deleted" },
        },
      }),
      prisma.whatsAppConversation.count({
        where: {
          tenantId,
          conversationType: "customer",
          status: { not: "deleted" },
        },
      }),
      prisma.whatsAppConversation.count({
        where: {
          tenantId,
          isStaff: true,
          status: { not: "deleted" },
        },
      }),
    ]);

    // Get message counts (exclude messages from deleted conversations)
    const [totalMessages, aiMessages, customerMessages] = await Promise.all([
      prisma.whatsAppMessage.count({
        where: {
          tenantId,
          conversation: { status: { not: "deleted" } },
        },
      }),
      prisma.whatsAppMessage.count({
        where: {
          tenantId,
          aiResponse: true,
          conversation: { status: { not: "deleted" } },
        },
      }),
      prisma.whatsAppMessage.count({
        where: {
          tenantId,
          direction: "inbound",
          conversation: { status: { not: "deleted" } },
        },
      }),
    ]);

    // Calculate AI performance metrics
    const aiAccuracy = customerMessages > 0 ? Math.round((aiMessages / customerMessages) * 100) : 0;

    // Calculate average response time from actual message timestamps
    const avgResponseTime = await calculateAvgResponseTime(tenantId);

    // Get staff command stats
    const staffCommands = await prisma.staffCommandLog.count({
      where: {
        tenantId,
        executedAt: { gte: todayStart },
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        total: totalConversations,
        active: activeConversations,
        escalated: escalatedConversations,
        customerChats: customerConversations,
        staffCommands: staffConversations,
        avgResponseTime,
        aiAccuracy,
        totalMessages,
        aiMessages,
        staffCommandsToday: staffCommands,
      },
    });
  } catch (error: any) {
    console.error("[WhatsApp AI Stats] Error:", error);
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
