/**
 * WhatsApp AI - Initialize Connection
 * POST /api/v1/whatsapp-ai/initialize
 * Generates QR code untuk connect WhatsApp Business
 */

import { NextRequest, NextResponse } from "next/server";
import { AimeowClientService } from "@/lib/services/aimeow/aimeow-client.service";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    let { tenantId } = body;

    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: "Missing required field: tenantId" },
        { status: 400 }
      );
    }

    // Resolve tenantId - could be UUID or slug
    let tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      tenant = await prisma.tenant.findUnique({ where: { slug: tenantId } });
    }

    if (!tenant) {
      return NextResponse.json(
        { success: false, error: `Tenant not found: ${tenantId}` },
        { status: 404 }
      );
    }

    // Use the actual tenant UUID
    const resolvedTenantId = tenant.id;
    console.log(`[WhatsApp AI Initialize] Resolved: ${tenantId} -> ${resolvedTenantId}`);

    // Check if already connected
    const existingAccount = await AimeowClientService.getAccountByTenant(resolvedTenantId);

    if (existingAccount && existingAccount.isActive) {
      return NextResponse.json({
        success: true,
        message: "WhatsApp already connected",
        data: {
          clientId: existingAccount.clientId,
          phoneNumber: existingAccount.phoneNumber,
          isConnected: true,
        },
      });
    }

    // Construct webhook URL
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || `https://${request.headers.get("host")}`;
    const webhookUrl = `${appUrl}/api/v1/webhooks/aimeow`;

    // Initialize new connection with resolved tenant UUID
    const result = await AimeowClientService.initializeClient(resolvedTenantId, webhookUrl);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || "Failed to initialize WhatsApp connection" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "QR code generated successfully",
      data: {
        clientId: result.clientId,
        qrCode: result.qrCode,
      },
    });
  } catch (error: any) {
    console.error("[WhatsApp AI Initialize] Error:", error);
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
