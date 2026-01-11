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
    const cleanPhone = phone.replace(/@.*$/, "").replace(/:/g, "").replace(/[^0-9]/g, "");

    if (!cleanPhone) {
      return NextResponse.json(
        { success: false, hasPicture: false, error: "Invalid phone" },
        { status: 200 }
      );
    }

    // Fetch profile picture from Aimeow
    let pictureUrl: string | null = null;
    let hasPicture = false;

    try {
      const response = await fetch(
        `${AIMEOW_BASE_URL}/api/v1/clients/${apiClientId}/profile-picture/${cleanPhone}`,
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

          // If we got a valid picture URL, save it to the user database for future fallback
          if (pictureUrl && tenantId) {
            try {
              // Find user by phone to update
              // Phone format in DB might vary, but we'll try to match exact or partial
              // Ideally, we find by tenant match + phone

              const users = await prisma.user.findMany({
                where: {
                  tenantId,
                  phone: {
                    contains: cleanPhone.slice(-10) // Match last 10 digits as a safe heuristic
                  }
                }
              });

              // Filter for exact match after fetch if needed or update match
              for (const user of users) {
                // Update the user's profile picture
                await prisma.user.update({
                  where: { id: user.id },
                  data: {
                    profilePictureUrl: pictureUrl,
                    profilePictureFetchedAt: new Date()
                  }
                });
              }
            } catch (dbError) {
              console.error("[Profile Picture API] Failed to update DB cache:", dbError);
            }
          }
        }
      }
    } catch (fetchError) {
      console.error("[Profile Picture API] Failed to fetch from WA:", fetchError);
    }

    // If real-time fetch failed or returned no picture, try to use cached one from DB
    if (!pictureUrl && tenantId) {
      try {
        const user = await prisma.user.findFirst({
          where: {
            tenantId,
            phone: {
              contains: cleanPhone.slice(-10)
            }
          }
        });

        if (user && user.profilePictureUrl) {
          console.log(`[Profile Picture API] Using cached picture for ${cleanPhone}`);
          pictureUrl = user.profilePictureUrl;
          hasPicture = true;
        }
      } catch (dbErr) {
        console.error("[Profile Picture API] DB fallback failed:", dbErr);
      }
    }

    return NextResponse.json({
      success: true,
      pictureUrl: pictureUrl,
      hasPicture: hasPicture,
    });
  } catch (error: any) {
    console.error("[Profile Picture API] Error:", error.message);
    return NextResponse.json(
      { success: false, hasPicture: false, error: error.message },
      { status: 200 }
    );
  }
}
