/**
 * WhatsApp Number Verification API
 * GET /api/v1/whatsapp-ai/check-whatsapp?phone=xxx
 * Returns whether a phone number is registered on WhatsApp
 */

import { NextRequest, NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

const AIMEOW_BASE_URL = process.env.AIMEOW_BASE_URL || "https://meow.lumiku.com";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const phone = searchParams.get("phone");

    if (!phone) {
      return NextResponse.json(
        { success: false, error: "Missing phone" },
        { status: 400 }
      );
    }

    // Clean phone number
    const cleanPhone = phone.replace(/@.*$/, "").replace(/:/g, "").replace(/[^0-9]/g, "");

    if (!cleanPhone) {
      return NextResponse.json(
        { success: false, isRegistered: false, error: "Invalid phone" },
        { status: 200 }
      );
    }

    // Get connected client from Aimeow
    let apiClientId: string | null = null;

    try {
      const clientsResponse = await fetch(`${AIMEOW_BASE_URL}/api/v1/clients`, {
        cache: 'no-store',
      });

      if (clientsResponse.ok) {
        const clients = await clientsResponse.json();
        const anyConnected = clients.find((c: any) => c.isConnected);
        if (anyConnected) {
          apiClientId = anyConnected.id;
        }
      }
    } catch (fetchError) {
      console.error("[Check WhatsApp API] Failed to fetch clients:", fetchError);
    }

    if (!apiClientId) {
      return NextResponse.json(
        { success: false, isRegistered: false, error: "No connected WhatsApp" },
        { status: 200 }
      );
    }

    // Check WhatsApp registration
    const response = await fetch(
      `${AIMEOW_BASE_URL}/api/v1/clients/${apiClientId}/check-whatsapp/${cleanPhone}`,
      {
        headers: { Accept: "application/json" },
        cache: 'no-store',
      }
    );

    if (!response.ok) {
      return NextResponse.json(
        { success: false, isRegistered: false },
        { status: 200 }
      );
    }

    const data = await response.json();

    return NextResponse.json({
      success: true,
      phone: cleanPhone,
      isRegistered: data.isRegistered || false,
      jid: data.jid || null,
    });
  } catch (error: any) {
    console.error("[Check WhatsApp API] Error:", error.message);
    return NextResponse.json(
      { success: false, isRegistered: false, error: error.message },
      { status: 200 }
    );
  }
}
