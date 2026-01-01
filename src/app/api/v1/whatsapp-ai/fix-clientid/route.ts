/**
 * WhatsApp AI - Fix ClientId
 * POST /api/v1/whatsapp-ai/fix-clientid?tenantId=xxx
 * Update clientId to correct UUID format from Aimeow API
 *
 * ISSUE: Database has JID format (6283134446903:80@s.whatsapp.net) but Aimeow API expects UUID
 * FIX: Fetch active client from Aimeow and update database with correct UUID
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

    // Get account
    const account = await prisma.aimeowAccount.findUnique({
      where: { tenantId },
    });

    if (!account) {
      return NextResponse.json(
        { success: false, error: "Account not found" },
        { status: 404 }
      );
    }

    console.log(`[Fix ClientId] Current clientId: ${account.clientId}`);
    console.log(`[Fix ClientId] Phone: ${account.phoneNumber}`);

    // Fetch all clients from Aimeow API
    const response = await fetch(`${AIMEOW_BASE_URL}/api/v1/clients`);

    if (!response.ok) {
      throw new Error(`Failed to fetch clients from Aimeow: ${response.statusText}`);
    }

    const clients = await response.json();
    console.log(`[Fix ClientId] Found ${clients.length} clients on Aimeow`);

    // Find the connected client
    const connectedClient = clients.find((c: any) => c.isConnected === true);

    if (!connectedClient) {
      return NextResponse.json({
        success: false,
        error: "No connected client found on Aimeow. Please reconnect WhatsApp first.",
        details: "Check the Configure page to scan QR code and connect.",
      }, { status: 404 });
    }

    const correctClientId = connectedClient.id;
    console.log(`[Fix ClientId] Found connected client UUID: ${correctClientId}`);

    // If already correct, no need for update
    const oldClientId = account.clientId;
    if (oldClientId === correctClientId) {
      console.log(`[Fix ClientId] ✅ ClientId is already correct: ${oldClientId}`);
      return NextResponse.json({
        success: true,
        message: "ClientId is already optimized! No changes needed.",
        data: {
          clientId: correctClientId,
          phoneNumber: account.phoneNumber,
          status: "optimized",
        },
      });
    }

    // Extract phone number from current clientId if it's in JID format
    let phoneNumber = account.phoneNumber;
    if (account.clientId.includes("@s.whatsapp.net")) {
      phoneNumber = account.clientId.split(":")[0];
      console.log(`[Fix ClientId] Extracted phone number from JID: ${phoneNumber}`);
    }

    // Update database with correct UUID clientId
    await prisma.aimeowAccount.update({
      where: { id: account.id },
      data: {
        clientId: correctClientId,
        phoneNumber: phoneNumber,
        connectionStatus: "connected",
        isActive: true,
        lastConnectedAt: new Date(),
      },
    });

    console.log(`[Fix ClientId] ✅ Updated clientId from ${oldClientId} to ${correctClientId}`);

    return NextResponse.json({
      success: true,
      message: "ClientId fixed successfully! Now using correct UUID from Aimeow API.",
      data: {
        oldClientId,
        newClientId: correctClientId,
        phoneNumber,
        status: "fixed",
        explanation: "ClientId must be a UUID (not JID format). The UUID is what Aimeow uses to identify sessions for sending messages.",
        connectedAt: connectedClient.connectedAt,
        messageCount: connectedClient.messageCount,
      },
    });

  } catch (error: any) {
    console.error("[Fix ClientId] Error:", error);
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
