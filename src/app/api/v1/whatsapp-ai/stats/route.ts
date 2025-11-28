/**
 * WhatsApp AI - Get Detailed Statistics
 * GET /api/v1/whatsapp-ai/stats?tenantId=xxx
 * Returns detailed conversation and performance statistics
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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

    // Get conversation counts
    const [
      totalConversations,
      activeConversations,
      escalatedConversations,
      customerConversations,
      staffConversations,
    ] = await Promise.all([
      prisma.whatsAppConversation.count({
        where: { tenantId },
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
        },
      }),
      prisma.whatsAppConversation.count({
        where: {
          tenantId,
          conversationType: "customer",
        },
      }),
      prisma.whatsAppConversation.count({
        where: {
          tenantId,
          isStaff: true,
        },
      }),
    ]);

    // Get message counts
    const [totalMessages, aiMessages, customerMessages] = await Promise.all([
      prisma.whatsAppMessage.count({
        where: { tenantId },
      }),
      prisma.whatsAppMessage.count({
        where: {
          tenantId,
          aiResponse: true,
        },
      }),
      prisma.whatsAppMessage.count({
        where: {
          tenantId,
          direction: "inbound",
        },
      }),
    ]);

    // Calculate AI performance metrics
    const aiAccuracy = customerMessages > 0 ? Math.round((aiMessages / customerMessages) * 100) : 0;

    // Calculate average response time (simplified - dalam production harus lebih sophisticated)
    // For now, return mock data - akan diimplementasi dengan tracking timestamps
    const avgResponseTime = 5; // 5 seconds (mock)

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
