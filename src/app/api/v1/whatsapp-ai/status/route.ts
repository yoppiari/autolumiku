/**
 * WhatsApp AI - Get Status
 * GET /api/v1/whatsapp-ai/status?tenantId=xxx atau ?clientId=xxx
 * Returns connection status dan basic statistics
 *
 * AUTO-SYNC: Automatically syncs with Aimeow if database is out of sync
 */

import { NextRequest, NextResponse } from "next/server";
import { AimeowClientService } from "@/lib/services/aimeow/aimeow-client.service";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';

const AIMEOW_BASE_URL = process.env.AIMEOW_BASE_URL || "https://meow.lumiku.com";

/**
 * Auto-sync Aimeow connection with database
 * Called when account doesn't exist or isActive is false
 */
async function autoSyncAimeow(tenantId: string) {
  try {
    console.log(`[Status API] Auto-syncing Aimeow for tenant: ${tenantId}`);

    // Fetch all clients from Aimeow
    const aimeowResponse = await fetch(`${AIMEOW_BASE_URL}/api/v1/clients`, {
      cache: 'no-store',
    });

    if (!aimeowResponse.ok) {
      console.error(`[Status API] Failed to fetch Aimeow clients: ${aimeowResponse.statusText}`);
      return null;
    }

    const aimeowClients = await aimeowResponse.json();
    const connectedClient = aimeowClients.find((c: any) => c.isConnected === true);

    if (!connectedClient) {
      console.log(`[Status API] No connected client found on Aimeow`);
      return null;
    }

    console.log(`[Status API] Found connected Aimeow client: ${connectedClient.id} (${connectedClient.phone})`);

    // Get webhook URL
    const configResponse = await fetch(`${AIMEOW_BASE_URL}/api/v1/config`, { cache: 'no-store' });
    const configData = configResponse.ok ? await configResponse.json() : {};
    const webhookUrl = configData.callbackUrl || "";

    // Upsert AimeowAccount
    const account = await prisma.aimeowAccount.upsert({
      where: { tenantId },
      update: {
        clientId: connectedClient.id,
        phoneNumber: connectedClient.phone || "",
        isActive: true,
        connectionStatus: "connected",
        lastConnectedAt: connectedClient.connectedAt
          ? new Date(connectedClient.connectedAt)
          : new Date(),
        webhookUrl,
      },
      create: {
        tenantId,
        clientId: connectedClient.id,
        apiKey: "",
        phoneNumber: connectedClient.phone || "",
        isActive: true,
        connectionStatus: "connected",
        lastConnectedAt: connectedClient.connectedAt
          ? new Date(connectedClient.connectedAt)
          : new Date(),
        webhookUrl,
      },
    });

    // Ensure WhatsApp AI config exists
    await prisma.whatsAppAIConfig.upsert({
      where: { tenantId },
      update: { accountId: account.id },
      create: {
        tenantId,
        accountId: account.id,
        welcomeMessage: "Halo! 👋 Saya asisten virtual showroom. Ada yang bisa saya bantu?",
        aiName: "AI Assistant",
        aiPersonality: "friendly",
        autoReply: true,
        customerChatEnabled: true,
        staffCommandsEnabled: true,
        businessHours: {
          monday: { open: "09:00", close: "17:00" },
          tuesday: { open: "09:00", close: "17:00" },
          wednesday: { open: "09:00", close: "17:00" },
          thursday: { open: "09:00", close: "17:00" },
          friday: { open: "09:00", close: "17:00" },
          saturday: { open: "09:00", close: "15:00" },
          sunday: { open: "closed", close: "closed" },
        },
        timezone: "Asia/Jakarta",
        afterHoursMessage: "Terima kasih telah menghubungi kami.",
      },
    });

    console.log(`[Status API] Auto-sync completed: ${account.phoneNumber} (${account.connectionStatus})`);
    return account;
  } catch (error: any) {
    console.error(`[Status API] Auto-sync error:`, error.message);
    return null;
  }
}

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

    // AUTO-SYNC: If no account or not active, try to sync with Aimeow
    if (tenantId && (!account || !account.isActive)) {
      console.log(`[Status API] Account missing or inactive, attempting auto-sync...`);
      const syncedAccount = await autoSyncAimeow(tenantId);
      if (syncedAccount) {
        account = syncedAccount;
      }
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
