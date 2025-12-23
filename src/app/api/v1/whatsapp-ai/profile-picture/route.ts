/**
 * WhatsApp Profile Picture API
 * GET /api/v1/whatsapp-ai/profile-picture?tenantId=xxx&phone=xxx
 * Returns the WhatsApp profile picture URL for a contact
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const AIMEOW_BASE_URL = process.env.AIMEOW_BASE_URL || "https://meow.lumiku.com";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get("tenantId");
    const phone = searchParams.get("phone");

    if (!tenantId || !phone) {
      return NextResponse.json(
        { success: false, error: "Missing tenantId or phone" },
        { status: 400 }
      );
    }

    // Get Aimeow account for this tenant
    const account = await prisma.aimeowAccount.findUnique({
      where: { tenantId },
    });

    if (!account || !account.isActive) {
      return NextResponse.json(
        { success: false, hasPicture: false, error: "WhatsApp not connected" },
        { status: 200 }
      );
    }

    // Get correct client UUID
    let apiClientId = account.clientId;
    if (account.clientId.includes("@") || !account.clientId.includes("-")) {
      const clientsResponse = await fetch(`${AIMEOW_BASE_URL}/api/v1/clients`);
      if (clientsResponse.ok) {
        const clients = await clientsResponse.json();
        const connectedClient = clients.find((c: any) => c.isConnected === true);
        if (connectedClient) {
          apiClientId = connectedClient.id;
        }
      }
    }

    // Clean phone number
    const cleanPhone = phone.replace(/@.*$/, "").replace(/[^0-9]/g, "");

    // Fetch profile picture from Aimeow
    const response = await fetch(
      `${AIMEOW_BASE_URL}/api/v1/clients/${apiClientId}/profile-picture/${cleanPhone}`,
      {
        headers: { Accept: "application/json" },
        // Cache for 5 minutes
        next: { revalidate: 300 },
      }
    );

    if (!response.ok) {
      return NextResponse.json(
        { success: false, hasPicture: false },
        { status: 200 }
      );
    }

    const data = await response.json();

    return NextResponse.json({
      success: true,
      pictureUrl: data.pictureUrl || null,
      hasPicture: data.hasPicture || false,
    });
  } catch (error: any) {
    console.error("[Profile Picture API] Error:", error.message);
    return NextResponse.json(
      { success: false, hasPicture: false, error: error.message },
      { status: 200 }
    );
  }
}
