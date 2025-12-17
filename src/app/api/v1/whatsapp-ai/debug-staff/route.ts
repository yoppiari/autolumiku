/**
 * Debug Staff Detection
 * GET /api/v1/whatsapp-ai/debug-staff
 *
 * Lists all tenants and their staff with phone numbers
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    // Get all tenants with Aimeow accounts
    const aimeowAccounts = await prisma.aimeowAccount.findMany({
      where: { isActive: true },
      select: {
        id: true,
        tenantId: true,
        phoneNumber: true,
        clientId: true,
        connectionStatus: true,
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    const result = [];

    for (const account of aimeowAccounts) {
      // Get all users in this tenant
      const users = await prisma.user.findMany({
        where: { tenantId: account.tenantId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          role: true,
        },
      });

      result.push({
        tenant: {
          id: account.tenantId,
          name: account.tenant?.name,
          slug: account.tenant?.slug,
        },
        whatsappBot: {
          botPhone: account.phoneNumber,
          clientId: account.clientId,
          status: account.connectionStatus,
        },
        staff: users.map(u => ({
          name: `${u.firstName} ${u.lastName}`,
          email: u.email,
          phone: u.phone || "(not set)",
          phoneNormalized: u.phone ? u.phone.replace(/\D/g, "").replace(/^0/, "62") : null,
          role: u.role,
          canUpload: !!u.phone,
        })),
        testUrl: `/api/v1/whatsapp-ai/test-upload?phone=PHONE_HERE&tenantId=${account.tenantId}`,
      });
    }

    return NextResponse.json({
      success: true,
      data: result,
      instructions: [
        "1. Temukan tenant Anda (Prima Mobil)",
        "2. Pastikan phone staff sudah terisi",
        "3. Gunakan testUrl untuk menguji deteksi staff",
        "4. Kirim pesan dari nomor yang terdaftar ke bot WhatsApp",
      ],
    });
  } catch (error: any) {
    console.error("[Debug Staff] Error:", error);
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}
