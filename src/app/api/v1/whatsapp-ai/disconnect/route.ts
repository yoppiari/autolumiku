/**
 * WhatsApp AI - Disconnect
 * POST /api/v1/whatsapp-ai/disconnect?tenantId=xxx
 */

import { NextRequest, NextResponse } from "next/server";
import { AimeowClientService } from "@/lib/services/aimeow/aimeow-client.service";
import { prisma } from "@/lib/prisma";

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

        // Disconnect client via Aimeow Service
        const success = await AimeowClientService.disconnectClient(account.clientId);

        if (success) {
            return NextResponse.json({ success: true });
        } else {
            return NextResponse.json(
                { success: false, error: "Failed to disconnect client" },
                { status: 500 }
            );
        }
    } catch (error: any) {
        console.error("[WhatsApp AI Disconnect] Error:", error);
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
