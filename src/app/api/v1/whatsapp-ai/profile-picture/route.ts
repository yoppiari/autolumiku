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

    console.log(`[Profile Picture API] Attempting fetch for phone: ${cleanPhone}, clientId: ${apiClientId}`);

    try {
      // PHASE 1: Resolve JID first
      // Some versions of WA Web API fail if we ask for profile picture using simple phone number
      // We must get the real JID (e.g. 6281234@s.whatsapp.net) from check-whatsapp first
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
            // Use the authoritative JID from WhatsApp
            targetJid = checkData.jid;
            console.log(`[Profile Picture API] Resolved JID: ${cleanPhone} -> ${targetJid}`);

            // Encode JID properly for URL
            // targetJid usually contains @s.whatsapp.net, which might need encoding if API expects it
            // but usually standard URL path handles it fine or encoded. 
            // We'll try to use the user part first if it fails, or full JID.
            // Aimeow usually expects just the number part OR full JID.

            // Let's try to use the number part from JID which is guaranteed to be correct format
            targetJid = targetJid.split('@')[0];
            console.log(`[Profile Picture API] Using standardized number from JID: ${targetJid}`);
          }
        }
      } catch (jidError) {
        console.warn(`[Profile Picture API] Failed to resolve JID, falling back to cleanPhone:`, jidError);
      }

      // PHASE 2: Fetch Profile Picture using resolved target
      const profilePicUrl = `${AIMEOW_BASE_URL}/api/v1/clients/${apiClientId}/profile-picture/${targetJid}`;
      console.log(`[Profile Picture API] Fetching from: ${profilePicUrl}`);

      const response = await fetch(
        profilePicUrl,
        {
          headers: { Accept: "application/json" },
          cache: 'no-store',
        }
      );

      console.log(`[Profile Picture API] Response status: ${response.status}`);

      if (response.ok) {
        const data = await response.json();
        console.log(`[Profile Picture API] Response data:`, data);

        if (data && data.success) {
          pictureUrl = data.pictureUrl || null;
          hasPicture = data.hasPicture || false;
          console.log(`[Profile Picture API] ✅ Got picture - URL: ${pictureUrl}, hasPicture: ${hasPicture}`);
        } else {
          console.log(`[Profile Picture API] ❌ Response not successful or no data`);
        }
      } else {
        console.error(`[Profile Picture API] ❌ HTTP Error: ${response.status} ${response.statusText}`);
      }
    } catch (fetchError: any) {
      console.error("[Profile Picture API] ❌ Fetch failed:", fetchError.message, fetchError.stack);
    }

    return NextResponse.json({
      success: true,
      pictureUrl: pictureUrl,
      hasPicture: hasPicture,
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
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
