/**
 * Sync Aimeow Connection Status
 * POST /api/v1/whatsapp-ai/sync-aimeow
 *
 * Syncs the Aimeow client status with the database.
 * Use this when the Aimeow is connected but the dashboard shows "Setup Required"
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const AIMEOW_BASE_URL = process.env.AIMEOW_BASE_URL || "https://meow.lumiku.com";

export async function POST(request: NextRequest) {
  try {
    const { tenantId } = await request.json();

    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: "tenantId is required" },
        { status: 400 }
      );
    }

    console.log(`[Sync Aimeow] Starting sync for tenant: ${tenantId}`);

    // 1. Fetch all clients from Aimeow
    const aimeowResponse = await fetch(`${AIMEOW_BASE_URL}/api/v1/clients`);
    if (!aimeowResponse.ok) {
      throw new Error(`Failed to fetch Aimeow clients: ${aimeowResponse.statusText}`);
    }

    const aimeowClients = await aimeowResponse.json();
    console.log(`[Sync Aimeow] Found ${aimeowClients.length} clients on Aimeow`);

    // 2. Find connected client
    const connectedClient = aimeowClients.find((c: any) => c.isConnected === true);

    if (!connectedClient) {
      return NextResponse.json({
        success: false,
        error: "No connected client found on Aimeow",
        hint: "Please scan QR code to connect WhatsApp first",
      });
    }

    console.log(`[Sync Aimeow] Found connected client:`, {
      id: connectedClient.id,
      phone: connectedClient.phone,
      isConnected: connectedClient.isConnected,
    });

    // 3. Get webhook URL
    const configResponse = await fetch(`${AIMEOW_BASE_URL}/api/v1/config`);
    const configData = configResponse.ok ? await configResponse.json() : {};
    const webhookUrl = configData.callbackUrl || "";
    console.log(`[Sync Aimeow] Webhook URL: ${webhookUrl}`);

    // 4. Update or create AimeowAccount for this tenant
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
        qrCode: connectedClient.qrCode || null,
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
        qrCode: connectedClient.qrCode || null,
        webhookUrl,
      },
    });

    console.log(`[Sync Aimeow] Updated AimeowAccount:`, {
      id: account.id,
      tenantId: account.tenantId,
      clientId: account.clientId,
      phoneNumber: account.phoneNumber,
      isActive: account.isActive,
      connectionStatus: account.connectionStatus,
    });

    // 5. Ensure WhatsApp AI config exists
    await prisma.whatsAppAIConfig.upsert({
      where: { tenantId },
      update: {
        accountId: account.id,
      },
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
        afterHoursMessage: "Terima kasih telah menghubungi kami. Kami sedang tutup sekarang.",
      },
    });

    return NextResponse.json({
      success: true,
      message: "Aimeow connection synced successfully",
      data: {
        clientId: account.clientId,
        phoneNumber: account.phoneNumber,
        isActive: account.isActive,
        connectionStatus: account.connectionStatus,
        webhookUrl,
      },
    });
  } catch (error: any) {
    console.error("[Sync Aimeow] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// GET - Check current sync status
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get("tenantId");

    // Get Aimeow clients
    const aimeowResponse = await fetch(`${AIMEOW_BASE_URL}/api/v1/clients`);
    const aimeowClients = aimeowResponse.ok ? await aimeowResponse.json() : [];

    // Get database records
    const dbAccounts = await prisma.aimeowAccount.findMany({
      select: {
        id: true,
        tenantId: true,
        clientId: true,
        phoneNumber: true,
        isActive: true,
        connectionStatus: true,
        tenant: {
          select: { name: true, slug: true },
        },
      },
    });

    // Get webhook config
    const configResponse = await fetch(`${AIMEOW_BASE_URL}/api/v1/config`);
    const webhookConfig = configResponse.ok ? await configResponse.json() : {};

    return NextResponse.json({
      success: true,
      aimeow: {
        clients: aimeowClients.map((c: any) => ({
          id: c.id,
          phone: c.phone,
          isConnected: c.isConnected,
          messageCount: c.messageCount,
        })),
        webhookUrl: webhookConfig.callbackUrl,
      },
      database: {
        accounts: dbAccounts.map((a) => ({
          ...a,
          tenantName: a.tenant?.name,
          tenantSlug: a.tenant?.slug,
        })),
      },
      syncNeeded: aimeowClients.some((c: any) =>
        c.isConnected && !dbAccounts.some((a) => a.clientId === c.id && a.isActive)
      ),
    });
  } catch (error: any) {
    console.error("[Sync Status] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
