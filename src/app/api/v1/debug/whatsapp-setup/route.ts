/**
 * Debug endpoint untuk verifikasi WhatsApp AI setup
 * GET /api/v1/debug/whatsapp-setup?tenant=primamobil-id
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';

const AIMEOW_BASE_URL = process.env.AIMEOW_BASE_URL || "https://meow.lumiku.com";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const tenantSlug = searchParams.get("tenant") || "primamobil-id";

  try {
    // 1. Get tenant by slug
    const tenant = await prisma.tenant.findUnique({
      where: { slug: tenantSlug },
      select: {
        id: true,
        name: true,
        slug: true,
        whatsappNumber: true,
        phoneNumber: true,
      },
    });

    if (!tenant) {
      return NextResponse.json(
        { error: `Tenant '${tenantSlug}' not found` },
        { status: 404 }
      );
    }

    // 2. Get AimeowAccount for this tenant
    const aimeowAccount = await prisma.aimeowAccount.findUnique({
      where: { tenantId: tenant.id },
      select: {
        id: true,
        clientId: true,
        phoneNumber: true,
        connectionStatus: true,
        isActive: true,
        qrCode: true,
        qrCodeExpiresAt: true,
        webhookUrl: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // 3. Get WhatsApp AI Config
    let aiConfig = null;
    if (aimeowAccount) {
      aiConfig = await prisma.whatsAppAIConfig.findUnique({
        where: { accountId: aimeowAccount.id },
        select: {
          id: true,
          aiName: true,
          aiPersonality: true,
          customerChatEnabled: true,
          autoReply: true,
          staffCommandsEnabled: true,
          enableVehicleInfo: true,
          enableTestDriveBooking: true,
          businessHours: true,
          timezone: true,
        },
      });
    }

    // 4. Get staff users for this tenant (with phone numbers)
    const staffUsers = await prisma.user.findMany({
      where: { tenantId: tenant.id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        emailVerified: true,
        lastLoginAt: true,
      },
      orderBy: { createdAt: "asc" },
    });

    // 5. Get recent WhatsApp conversations
    let recentConversations: any[] = [];
    if (aimeowAccount) {
      recentConversations = await prisma.whatsAppConversation.findMany({
        where: { accountId: aimeowAccount.id },
        select: {
          id: true,
          customerPhone: true,
          isStaff: true,
          conversationType: true,
          conversationState: true,
          status: true,
          lastMessageAt: true,
          lastIntent: true,
        },
        orderBy: { lastMessageAt: "desc" },
        take: 5,
      });
    }

    // 6. Get recent staff command logs
    const recentCommandLogs = await prisma.staffCommandLog.findMany({
      where: { tenantId: tenant.id },
      select: {
        id: true,
        staffPhone: true,
        command: true,
        commandType: true,
        success: true,
        resultMessage: true,
        vehicleId: true,
        executedAt: true,
      },
      orderBy: { executedAt: "desc" },
      take: 10,
    });

    // 7. Check Aimeow API connection and client status
    let aimeowApiStatus: any = { status: "UNKNOWN" };
    if (aimeowAccount?.clientId) {
      try {
        // Try to fetch client status from Aimeow API
        const clientStatusUrl = `${AIMEOW_BASE_URL}/api/v1/clients/${aimeowAccount.clientId}`;
        console.log(`[Debug] Fetching Aimeow client status: ${clientStatusUrl}`);

        const response = await fetch(clientStatusUrl, {
          headers: { 'Accept': 'application/json' },
          cache: 'no-store',
        });

        if (response.ok) {
          const data = await response.json();
          aimeowApiStatus = {
            status: data.isConnected ? "CONNECTED" : "DISCONNECTED",
            clientId: aimeowAccount.clientId,
            isConnected: data.isConnected,
            phone: data.phone,
            hasQrCode: !!data.qrCode,
            lastSeen: data.lastSeen,
            rawResponse: data,
          };
        } else if (response.status === 404) {
          // Client not found on Aimeow - need to reinitialize
          aimeowApiStatus = {
            status: "NOT_FOUND",
            error: "Client ID not found on Aimeow server. Need to reinitialize.",
            clientId: aimeowAccount.clientId,
          };
        } else {
          aimeowApiStatus = {
            status: "ERROR",
            error: `HTTP ${response.status}: ${response.statusText}`,
            clientId: aimeowAccount.clientId,
          };
        }
      } catch (fetchError: any) {
        aimeowApiStatus = {
          status: "ERROR",
          error: fetchError.message,
          clientId: aimeowAccount.clientId,
        };
      }
    }

    // 8. Get ALL Aimeow clients to compare
    let allAimeowClients: any[] = [];
    try {
      const clientsResponse = await fetch(`${AIMEOW_BASE_URL}/api/v1/clients`, {
        headers: { 'Accept': 'application/json' },
        cache: 'no-store',
      });
      if (clientsResponse.ok) {
        allAimeowClients = await clientsResponse.json();
      }
    } catch (e) {
      console.error('[Debug] Failed to fetch all clients:', e);
    }

    // 9. Get recent messages to see if webhook is receiving
    let recentMessages: any[] = [];
    if (aimeowAccount) {
      recentMessages = await prisma.whatsAppMessage.findMany({
        where: {
          conversation: {
            accountId: aimeowAccount.id,
          },
        },
        select: {
          id: true,
          direction: true,
          sender: true,
          senderType: true,
          content: true,
          intent: true,
          aimeowStatus: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      });
    }

    // Build response
    const response = {
      tenant: {
        ...tenant,
        status: "OK",
      },
      aimeowAccount: aimeowAccount
        ? {
            ...aimeowAccount,
            status: aimeowAccount.connectionStatus === "connected" ? "OK" : "WARNING",
            statusMessage:
              aimeowAccount.connectionStatus === "connected"
                ? "WhatsApp connected"
                : `Status: ${aimeowAccount.connectionStatus}. May need to scan QR code.`,
          }
        : {
            status: "ERROR",
            statusMessage: "AimeowAccount not found. Need to setup WhatsApp integration.",
          },
      aiConfig: aiConfig
        ? {
            ...aiConfig,
            status: aiConfig.customerChatEnabled ? "OK" : "WARNING",
            statusMessage: aiConfig.customerChatEnabled
              ? "AI chat enabled"
              : "Customer chat is DISABLED. AI will not reply to customers.",
          }
        : {
            status: "WARNING",
            statusMessage: "AI Config not found. Will be auto-created on first message.",
          },
      staffUsers: {
        count: staffUsers.length,
        users: staffUsers.map((u) => ({
          ...u,
          phoneNormalized: u.phone ? normalizePhone(u.phone) : null,
          canUpload: !!u.phone,
        })),
        status: staffUsers.some((u) => u.phone) ? "OK" : "WARNING",
        statusMessage: staffUsers.some((u) => u.phone)
          ? `${staffUsers.filter((u) => u.phone).length} staff with phone numbers can use WhatsApp commands`
          : "No staff users have phone numbers. They cannot use WhatsApp commands.",
      },
      recentConversations: {
        count: recentConversations.length,
        conversations: recentConversations,
      },
      recentCommandLogs: {
        count: recentCommandLogs.length,
        logs: recentCommandLogs,
      },
      aimeowApiStatus: {
        ...aimeowApiStatus,
        baseUrl: AIMEOW_BASE_URL,
      },
      allAimeowClients: {
        count: allAimeowClients.length,
        clients: allAimeowClients.map((c: any) => ({
          id: c.id,
          phone: c.phone,
          isConnected: c.isConnected,
          hasQrCode: !!c.qrCode,
        })),
        connectedClient: allAimeowClients.find((c: any) => c.isConnected),
      },
      recentMessages: {
        count: recentMessages.length,
        messages: recentMessages,
        webhookWorking: recentMessages.length > 0,
        lastMessageAt: recentMessages[0]?.createdAt || null,
      },
      diagnosis: generateDiagnosis(
        aimeowAccount,
        aiConfig,
        aimeowApiStatus,
        allAimeowClients,
        recentMessages
      ),
      testInstructions: {
        whatsappNumber: aimeowAccount?.phoneNumber || tenant.whatsappNumber || "Not configured",
        steps: [
          "1. Pastikan nomor WhatsApp Anda terdaftar di staffUsers dengan field 'phone'",
          "2. Kirim pesan 'halo' ke nomor WhatsApp AI untuk test koneksi",
          "3. Kirim '/upload' untuk memulai upload vehicle",
          "4. Kirim 6 foto (interior + exterior)",
          "5. Ketik info mobil: 'Brio 2020 120jt hitam matic km 30rb'",
          "6. Vehicle akan dibuat otomatis",
        ],
        photoRequirements: [
          "Minimal 6 foto WAJIB:",
          "- Eksterior: depan, belakang, samping kiri, samping kanan",
          "- Interior: dashboard, jok depan, bagasi",
        ],
      },
    };

    return NextResponse.json(response);
  } catch (error: any) {
    console.error("[Debug WhatsApp Setup] Error:", error);
    return NextResponse.json(
      { error: error.message, stack: error.stack },
      { status: 500 }
    );
  }
}

/**
 * Normalize phone number for comparison
 */
function normalizePhone(phone: string): string {
  if (!phone) return "";
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0")) {
    digits = "62" + digits.substring(1);
  }
  return digits;
}

/**
 * Generate diagnosis based on all the checks
 */
function generateDiagnosis(
  aimeowAccount: any,
  aiConfig: any,
  aimeowApiStatus: any,
  allAimeowClients: any[],
  recentMessages: any[]
): { issues: string[]; fixes: string[]; status: string } {
  const issues: string[] = [];
  const fixes: string[] = [];

  // Check 1: AimeowAccount exists
  if (!aimeowAccount) {
    issues.push("❌ AimeowAccount tidak ditemukan di database");
    fixes.push("Pergi ke Dashboard > WhatsApp AI > Setup untuk menghubungkan WhatsApp");
    return { issues, fixes, status: "CRITICAL" };
  }

  // Check 2: ClientId valid di Aimeow API
  if (aimeowApiStatus.status === "NOT_FOUND") {
    issues.push("❌ ClientId tidak ditemukan di Aimeow server");
    fixes.push("Perlu reinitialize WhatsApp - pergi ke Dashboard > WhatsApp AI > Reconnect");
  }

  // Check 3: WhatsApp connected
  if (aimeowApiStatus.status !== "CONNECTED" && aimeowApiStatus.status !== "NOT_FOUND") {
    issues.push(`⚠️ WhatsApp status: ${aimeowApiStatus.status}`);
    if (aimeowApiStatus.status === "DISCONNECTED") {
      fixes.push("Scan QR code untuk reconnect WhatsApp");
    }
  }

  // Check 4: ClientId mismatch - DB has different ID than what's connected
  const connectedClient = allAimeowClients.find((c: any) => c.isConnected);
  if (connectedClient && connectedClient.id !== aimeowAccount.clientId) {
    issues.push(`⚠️ ClientId mismatch! DB: ${aimeowAccount.clientId}, Connected: ${connectedClient.id}`);
    fixes.push(`Update database clientId ke: ${connectedClient.id}`);
  }

  // Check 5: AI Config exists and enabled
  if (!aiConfig) {
    issues.push("⚠️ AI Config tidak ditemukan (akan auto-create)");
  } else if (!aiConfig.customerChatEnabled) {
    issues.push("❌ customerChatEnabled = FALSE - AI tidak akan balas customer");
    fixes.push("Enable customer chat di Dashboard > WhatsApp AI > Settings");
  }

  // Check 6: Webhook receiving messages
  if (recentMessages.length === 0) {
    issues.push("⚠️ Tidak ada message di database - webhook mungkin tidak terhubung");
    fixes.push("Pastikan webhook URL sudah di-register di Aimeow");
  } else {
    // Check if last message is recent (within 24h)
    const lastMsg = recentMessages[0];
    const hoursSinceLastMsg = (Date.now() - new Date(lastMsg.createdAt).getTime()) / (1000 * 60 * 60);
    if (hoursSinceLastMsg > 24) {
      issues.push(`⚠️ Message terakhir ${Math.round(hoursSinceLastMsg)} jam lalu`);
    }
  }

  // Determine overall status
  let status = "OK";
  if (issues.some(i => i.startsWith("❌"))) {
    status = "CRITICAL";
  } else if (issues.some(i => i.startsWith("⚠️"))) {
    status = "WARNING";
  }

  if (issues.length === 0) {
    issues.push("✅ Semua konfigurasi terlihat baik");
  }

  return { issues, fixes, status };
}

/**
 * POST endpoint to auto-fix issues
 * POST /api/v1/debug/whatsapp-setup?tenant=primamobil-id&action=fix-clientid
 */
export async function POST(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const tenantSlug = searchParams.get("tenant") || "primamobil-id";
  const action = searchParams.get("action");

  try {
    // Get tenant
    const tenant = await prisma.tenant.findUnique({
      where: { slug: tenantSlug },
    });

    if (!tenant) {
      return NextResponse.json(
        { error: `Tenant '${tenantSlug}' not found` },
        { status: 404 }
      );
    }

    // Get current account
    const account = await prisma.aimeowAccount.findUnique({
      where: { tenantId: tenant.id },
    });

    if (!account) {
      return NextResponse.json(
        { error: "AimeowAccount not found" },
        { status: 404 }
      );
    }

    if (action === "fix-clientid") {
      // Get connected client from Aimeow
      const clientsResponse = await fetch(`${AIMEOW_BASE_URL}/api/v1/clients`, {
        headers: { 'Accept': 'application/json' },
        cache: 'no-store',
      });

      if (!clientsResponse.ok) {
        return NextResponse.json(
          { error: "Failed to fetch clients from Aimeow" },
          { status: 500 }
        );
      }

      const clients = await clientsResponse.json();
      const connectedClient = clients.find((c: any) => c.isConnected);

      if (!connectedClient) {
        return NextResponse.json(
          { error: "No connected client found on Aimeow. Please scan QR code first." },
          { status: 400 }
        );
      }

      // Update database with correct clientId
      const updated = await prisma.aimeowAccount.update({
        where: { id: account.id },
        data: {
          clientId: connectedClient.id,
          phoneNumber: connectedClient.phone || account.phoneNumber,
          connectionStatus: "connected",
          isActive: true,
        },
      });

      return NextResponse.json({
        success: true,
        message: "ClientId updated successfully",
        oldClientId: account.clientId,
        newClientId: connectedClient.id,
        phone: connectedClient.phone,
      });
    }

    if (action === "enable-ai") {
      // Enable customer chat in AI config
      const config = await prisma.whatsAppAIConfig.findUnique({
        where: { accountId: account.id },
      });

      if (!config) {
        // Create new config
        await prisma.whatsAppAIConfig.create({
          data: {
            accountId: account.id,
            tenantId: tenant.id,
            aiName: "AI Assistant",
            aiPersonality: "friendly",
            welcomeMessage: "Halo! Ada yang bisa saya bantu?",
            customerChatEnabled: true,
            autoReply: true,
            staffCommandsEnabled: true,
          },
        });
      } else {
        await prisma.whatsAppAIConfig.update({
          where: { id: config.id },
          data: {
            customerChatEnabled: true,
            autoReply: true,
          },
        });
      }

      return NextResponse.json({
        success: true,
        message: "AI customer chat enabled",
      });
    }

    return NextResponse.json(
      { error: "Invalid action. Use: fix-clientid, enable-ai" },
      { status: 400 }
    );
  } catch (error: any) {
    console.error("[Debug WhatsApp Fix] Error:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
