/**
 * Test WhatsApp Upload Flow
 * GET /api/v1/whatsapp-ai/test-upload?phone=6281235108908&tenantId=xxx
 *
 * This endpoint tests if the staff detection and upload flow is working
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const phone = searchParams.get("phone");
    const tenantId = searchParams.get("tenantId");

    if (!phone || !tenantId) {
      return NextResponse.json({
        error: "phone and tenantId are required",
        example: "/api/v1/whatsapp-ai/test-upload?phone=6281235108908&tenantId=xxx"
      }, { status: 400 });
    }

    // Normalize phone
    let normalizedInput = phone.replace(/\D/g, "");
    if (normalizedInput.startsWith("0")) {
      normalizedInput = "62" + normalizedInput.substring(1);
    }

    // Get all users in tenant
    const users = await prisma.user.findMany({
      where: { tenantId },
      select: { id: true, phone: true, firstName: true, lastName: true, email: true },
    });

    // Check for match
    let matchedUser = null;
    const userPhones = [];

    for (const user of users) {
      let normalizedUserPhone = "";
      if (user.phone) {
        normalizedUserPhone = user.phone.replace(/\D/g, "");
        if (normalizedUserPhone.startsWith("0")) {
          normalizedUserPhone = "62" + normalizedUserPhone.substring(1);
        }
      }

      userPhones.push({
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        originalPhone: user.phone,
        normalizedPhone: normalizedUserPhone,
        matches: normalizedInput === normalizedUserPhone,
      });

      if (normalizedInput === normalizedUserPhone) {
        matchedUser = user;
      }
    }

    // Get Aimeow account info
    const aimeowAccount = await prisma.aimeowAccount.findFirst({
      where: { tenantId, isActive: true },
      select: {
        id: true,
        clientId: true,
        phoneNumber: true,
        connectionStatus: true,
        isActive: true,
      },
    });

    return NextResponse.json({
      success: true,
      test: {
        inputPhone: phone,
        normalizedInputPhone: normalizedInput,
        tenantId,
      },
      staffDetection: {
        isStaff: !!matchedUser,
        matchedUser: matchedUser ? {
          id: matchedUser.id,
          name: `${matchedUser.firstName} ${matchedUser.lastName}`,
          email: matchedUser.email,
        } : null,
      },
      allUsers: userPhones,
      whatsappBot: aimeowAccount ? {
        connected: aimeowAccount.connectionStatus === "connected",
        botPhone: aimeowAccount.phoneNumber,
        clientId: aimeowAccount.clientId,
        status: aimeowAccount.connectionStatus,
      } : { error: "No Aimeow account found" },
      nextSteps: !matchedUser ? [
        "Phone tidak ditemukan di daftar staff",
        "Pastikan nomor WhatsApp sudah didaftarkan di dashboard/users",
        "Format nomor harus: 62xxxxxxxxxx (tanpa + atau 0 di awal)",
      ] : [
        "Staff terdeteksi dengan benar",
        "Coba kirim /upload dari WhatsApp dengan foto",
      ],
    });
  } catch (error: any) {
    console.error("[Test Upload] Error:", error);
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}
