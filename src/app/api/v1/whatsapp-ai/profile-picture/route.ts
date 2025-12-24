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

    if (!phone) {
      return NextResponse.json(
        { success: false, error: "Missing phone" },
        { status: 400 }
      );
    }

    // Always fetch connected clients from Aimeow
    // This is more reliable than checking database isActive flag
    let apiClientId: string | null = null;

    try {
      const clientsResponse = await fetch(`${AIMEOW_BASE_URL}/api/v1/clients`, {
        cache: 'no-store',
      });

      if (clientsResponse.ok) {
        const clients = await clientsResponse.json();

        // If tenantId provided, try to match with account in database
        if (tenantId) {
          const account = await prisma.aimeowAccount.findUnique({
            where: { tenantId },
          });

          if (account) {
            // Try to find client by phone number match first
            if (account.phoneNumber) {
              const matchingClient = clients.find((c: any) =>
                c.isConnected && c.phone === account.phoneNumber
              );
              if (matchingClient) {
                apiClientId = matchingClient.id;
              }
            }

            // If not found by phone, try by clientId
            if (!apiClientId && account.clientId) {
              const matchingClient = clients.find((c: any) =>
                c.isConnected && c.id === account.clientId
              );
              if (matchingClient) {
                apiClientId = matchingClient.id;
              }
            }
          }
        }

        // Fallback: use any connected client
        // This handles cases where tenantId is wrong or not provided
        if (!apiClientId) {
          const anyConnected = clients.find((c: any) => c.isConnected);
          if (anyConnected) {
            apiClientId = anyConnected.id;
          }
        }
      }
    } catch (fetchError) {
      console.error("[Profile Picture API] Failed to fetch clients:", fetchError);
    }

    if (!apiClientId) {
      return NextResponse.json(
        { success: false, hasPicture: false, error: "No connected WhatsApp" },
        { status: 200 }
      );
    }

    // Clean phone number - remove suffixes and non-digits
    const cleanPhone = phone.replace(/@.*$/, "").replace(/:/g, "").replace(/[^0-9]/g, "");

    if (!cleanPhone) {
      return NextResponse.json(
        { success: false, hasPicture: false, error: "Invalid phone" },
        { status: 200 }
      );
    }

    // Fetch profile picture from Aimeow
    const response = await fetch(
      `${AIMEOW_BASE_URL}/api/v1/clients/${apiClientId}/profile-picture/${cleanPhone}`,
      {
        headers: { Accept: "application/json" },
        cache: 'no-store',
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
