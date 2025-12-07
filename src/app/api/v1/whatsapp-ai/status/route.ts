/**
 * WhatsApp AI - Get Status
 * GET /api/v1/whatsapp-ai/status?tenantId=xxx atau ?clientId=xxx
 * Returns connection status dan basic statistics
 */

import { NextRequest, NextResponse } from "next/server";
import { AimeowClientService } from "@/lib/services/aimeow/aimeow-client.service";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get("tenantId");
    const clientId = searchParams.get("clientId");

    if (!tenantId && !clientId) {
      return NextResponse.json(
        { success: false, error: "Missing required parameter: tenantId or clientId" },
        { status: 400 }
      );
    }

    // Get account by tenantId or clientId
    let account;
    if (clientId) {
      account = await AimeowClientService.getAccountByClientId(clientId);
    } else if (tenantId) {
      account = await AimeowClientService.getAccountByTenant(tenantId);
    }

    if (!account) {
      return NextResponse.json({
        success: true,
        data: {
          isConnected: false,
          totalConversations: 0,
          activeConversations: 0,
          todayMessages: 0,
          aiResponseRate: 0,
        },
      });
    }

    // Update status dari Aimeow API (jika sudah ada clientId)
    if (account.clientId) {
      console.log(`[Status API] Checking Aimeow status for clientId: ${account.clientId}`);
      const aimeowStatus = await AimeowClientService.getClientStatus(account.clientId);
      console.log(`[Status API] Aimeow returned:`, aimeowStatus);

      // Re-fetch account untuk get updated data
      if (clientId) {
        account = await AimeowClientService.getAccountByClientId(clientId);
      } else if (tenantId) {
        account = await AimeowClientService.getAccountByTenant(tenantId);
      }

      // Check if account still exists after re-fetch
      if (!account) {
        return NextResponse.json({
          success: false,
          error: "Account not found after status update",
        }, { status: 404 });
      }

      console.log(`[Status API] Updated account - isActive: ${account.isActive}, connectionStatus: ${account.connectionStatus}, phoneNumber: ${account.phoneNumber}`);
    }

    // Get conversation statistics
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [totalConversations, activeConversations, todayMessages] = await Promise.all([
      prisma.whatsAppConversation.count({
        where: { tenantId: account.tenantId },
      }),
      prisma.whatsAppConversation.count({
        where: {
          tenantId: account.tenantId,
          status: "active",
        },
      }),
      prisma.whatsAppMessage.count({
        where: {
          tenantId: account.tenantId,
          createdAt: { gte: todayStart },
        },
      }),
    ]);

    // Calculate AI response rate
    const [totalInbound, aiResponded] = await Promise.all([
      prisma.whatsAppMessage.count({
        where: {
          tenantId: account.tenantId,
          direction: "inbound",
          createdAt: { gte: todayStart },
        },
      }),
      prisma.whatsAppMessage.count({
        where: {
          tenantId: account.tenantId,
          direction: "outbound",
          aiResponse: true,
          createdAt: { gte: todayStart },
        },
      }),
    ]);

    const aiResponseRate = totalInbound > 0 ? Math.round((aiResponded / totalInbound) * 100) : 0;

    const responseData = {
      success: true,
      data: {
        isConnected: account.isActive,
        phoneNumber: account.phoneNumber,
        clientId: account.clientId,
        qrCode: account.qrCode,
        connectionStatus: account.connectionStatus,
        lastConnectedAt: account.lastConnectedAt,
        totalConversations,
        activeConversations,
        todayMessages,
        aiResponseRate,
      },
    };

    console.log(`[Status API] Returning to frontend:`, JSON.stringify(responseData, null, 2));

    return NextResponse.json(responseData);
  } catch (error: any) {
    console.error("[WhatsApp AI Status] Error:", error);
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
