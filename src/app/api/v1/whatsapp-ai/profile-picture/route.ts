/**
 * WhatsApp Profile Picture API
 * GET /api/v1/whatsapp-ai/profile-picture?tenantId=xxx&phone=xxx
 * Returns the WhatsApp profile picture URL for a contact
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';

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
    let tenantAccount: any = null;

    try {
      const clientsResponse = await fetch(`${AIMEOW_BASE_URL}/api/v1/clients`, {
        cache: 'no-store',
      });

      if (clientsResponse.ok) {
        const clients = await clientsResponse.json();

        // If tenantId provided, try to match with account in database
        if (tenantId) {
          tenantAccount = await prisma.aimeowAccount.findUnique({
            where: { tenantId },
          });

          if (tenantAccount) {
            // Try to find client by phone number match first
            if (tenantAccount.phoneNumber) {
              const matchingClient = clients.find((c: any) =>
                c.isConnected && c.phone === tenantAccount.phoneNumber
              );
              if (matchingClient) {
                apiClientId = matchingClient.id;
              }
            }

            // If not found by phone, try by clientId
            if (!apiClientId && tenantAccount.clientId) {
              const matchingClient = clients.find((c: any) =>
                c.isConnected && c.id === tenantAccount.clientId
              );
              if (matchingClient) {
                apiClientId = matchingClient.id;
              }
            }
          }
        }

        // Fallback: use any connected client if still not found
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
    let cleanPhone = phone.replace(/@.*$/, "").replace(/:/g, "").replace(/[^0-9]/g, "");

    // Validasi & Normalisasi Indonesia (08 -> 628)
    if (cleanPhone.startsWith("08")) {
      cleanPhone = "62" + cleanPhone.substring(1);
    }

    if (!cleanPhone) {
      return NextResponse.json(
        { success: false, hasPicture: false, error: "Invalid phone" },
        { status: 200 }
      );
    }

    // Fetch profile picture from Aimeow
    let pictureUrl: string | null = null;
    let hasPicture = false;
    let pushName: string | null = null;

    console.log(`[Profile Picture API] Attempting fetch for phone: ${cleanPhone}, clientId: ${apiClientId}`);

    try {
      // PHASE 1: Resolve JID and Pushname
      let targetJid = cleanPhone;

      try {
        const checkUrl = `${AIMEOW_BASE_URL}/api/v1/clients/${apiClientId}/check-whatsapp/${cleanPhone}`;
        const checkRes = await fetch(checkUrl, {
          headers: { Accept: "application/json" },
          cache: 'no-store'
        });

        if (checkRes.ok) {
          const checkData = await checkRes.json();
          if (checkData && checkData.jid) {
            targetJid = checkData.jid;
            pushName = checkData.pushname || null;
            console.log(`[Profile Picture API] Resolved: ${cleanPhone} -> ${targetJid} (${pushName})`);
          }
        }
      } catch (jidError) {
        console.warn(`[Profile Picture API] Failed to resolve JID:`, jidError);
      }

      // PHASE 2: Fetch Profile Picture
      // Aimeow prefers JID if available
      const profilePicUrl = `${AIMEOW_BASE_URL}/api/v1/clients/${apiClientId}/profile-picture/${targetJid.split('@')[0]}`;

      const response = await fetch(
        profilePicUrl,
        {
          headers: { Accept: "application/json" },
          cache: 'no-store',
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data && data.success) {
          pictureUrl = data.pictureUrl || null;
          hasPicture = data.hasPicture || false;
        }
      }
    } catch (fetchError: any) {
      console.error("[Profile Picture API] Fetch failed:", fetchError.message);
    }

    return NextResponse.json({
      success: true,
      pictureUrl: pictureUrl,
      hasPicture: hasPicture,
      pushName: pushName,
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache',
      }
    });
  } catch (error: any) {
    console.error("[Profile Picture API] Error:", error.message);
    return NextResponse.json(
      { success: false, hasPicture: false, error: error.message },
      { status: 200 }
    );
  }
}
