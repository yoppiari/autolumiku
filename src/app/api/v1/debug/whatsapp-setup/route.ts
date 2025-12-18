/**
 * Debug endpoint untuk verifikasi WhatsApp AI setup
 * GET /api/v1/debug/whatsapp-setup?tenant=primamobil-id
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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
