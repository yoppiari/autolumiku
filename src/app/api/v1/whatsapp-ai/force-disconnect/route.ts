/**
 * WhatsApp AI - Force Disconnect
 * POST /api/v1/whatsapp-ai/force-disconnect?tenantId=xxx
 *
 * Force disconnects WhatsApp by:
 * 1. Finding the correct UUID from Aimeow API
 * 2. Deleting it from Aimeow
 * 3. Clearing the database record
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const AIMEOW_BASE_URL = process.env.AIMEOW_BASE_URL || "https://meow.lumiku.com";

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get("tenantId");

    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: "Missing required parameter: tenantId" },
        { status: 400 }
      );
    }

    // Get account from database
    const account = await prisma.aimeowAccount.findUnique({
      where: { tenantId },
    });

    if (!account) {
      return NextResponse.json(
        { success: false, error: "Account not found in database" },
        { status: 404 }
      );
    }

    console.log(`[Force Disconnect] Current DB clientId: ${account.clientId}`);
    console.log(`[Force Disconnect] Current DB phone: ${account.phoneNumber}`);

    const results: string[] = [];

    // Step 1: Get all clients from Aimeow and find connected ones
    try {
      const clientsResponse = await fetch(`${AIMEOW_BASE_URL}/api/v1/clients`);

      if (clientsResponse.ok) {
        const clients = await clientsResponse.json();
        console.log(`[Force Disconnect] Found ${clients.length} clients on Aimeow`);
        results.push(`Found ${clients.length} clients on Aimeow`);

        // Find and delete all connected clients
        for (const client of clients) {
          console.log(`[Force Disconnect] Client: ${client.id}, phone: ${client.phone}, connected: ${client.isConnected}`);

          // Delete this client
          try {
            const deleteResponse = await fetch(`${AIMEOW_BASE_URL}/api/v1/clients/${client.id}`, {
              method: "DELETE",
            });

            if (deleteResponse.ok || deleteResponse.status === 404) {
              console.log(`[Force Disconnect] ✅ Deleted client ${client.id} from Aimeow`);
              results.push(`Deleted client ${client.id} (phone: ${client.phone || 'N/A'})`);
            } else {
              const errorText = await deleteResponse.text();
              console.log(`[Force Disconnect] ⚠️ Failed to delete ${client.id}: ${errorText}`);
              results.push(`Failed to delete ${client.id}: ${deleteResponse.status}`);
            }
          } catch (deleteError: any) {
            console.log(`[Force Disconnect] ⚠️ Error deleting ${client.id}: ${deleteError.message}`);
            results.push(`Error deleting ${client.id}: ${deleteError.message}`);
          }
        }
      } else {
        results.push(`Failed to fetch clients from Aimeow: ${clientsResponse.status}`);
      }
    } catch (fetchError: any) {
      results.push(`Error fetching clients: ${fetchError.message}`);
    }

    // Step 2: Also try to delete the stored clientId (in case it's different)
    if (account.clientId) {
      try {
        const deleteResponse = await fetch(`${AIMEOW_BASE_URL}/api/v1/clients/${account.clientId}`, {
          method: "DELETE",
        });

        if (deleteResponse.ok || deleteResponse.status === 404) {
          results.push(`Deleted stored clientId ${account.clientId}`);
        }
      } catch (e) {
        // Ignore
      }
    }

    // Step 3: Update database - mark as disconnected and clear phone
    await prisma.aimeowAccount.update({
      where: { tenantId },
      data: {
        connectionStatus: "disconnected",
        isActive: false,
        phoneNumber: "",
        qrCode: null,
        qrCodeExpiresAt: null,
      },
    });
    results.push("Database updated: marked as disconnected");

    return NextResponse.json({
      success: true,
      message: "Force disconnect completed",
      details: results,
    });

  } catch (error: any) {
    console.error("[Force Disconnect] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
        details: error.message,
      },
      { status: 500 }
    );
  }
}
