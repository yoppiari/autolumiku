import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Force Link WhatsApp Account
 * POST /api/v1/whatsapp-ai/link-account
 * Body: { tenantId, clientId, phoneNumber }
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { tenantId, clientId, phoneNumber } = body;

        if (!tenantId || !clientId || !phoneNumber) {
            return NextResponse.json(
                { success: false, error: "Missing required fields: tenantId, clientId, phoneNumber" },
                { status: 400 }
            );
        }

        console.log(`[Link Account] Linking ${phoneNumber} (${clientId}) to tenant ${tenantId}`);

        // Check if account already exists for this tenant
        const existingAccount = await prisma.aimeowAccount.findUnique({
            where: { tenantId },
        });

        if (existingAccount) {
            // Update existing account
            await prisma.aimeowAccount.update({
                where: { tenantId },
                data: {
                    clientId,
                    phoneNumber,
                    isActive: true,
                    connectionStatus: "connected",
                    lastConnectedAt: new Date(),
                },
            });
            console.log(`[Link Account] Updated existing account ${existingAccount.id}`);
        } else {
            // Create new account
            // Note: We need a dummy apiKey since it's required in some logic, 
            // but Aimeow mostly uses clientId now
            await prisma.aimeowAccount.create({
                data: {
                    tenantId,
                    clientId,
                    phoneNumber,
                    apiKey: "LINKED_ACCOUNT", // Placeholder
                    isActive: true,
                    connectionStatus: "connected",
                    lastConnectedAt: new Date(),
                },
            });
            console.log(`[Link Account] Created new account for tenant ${tenantId}`);
        }

        return NextResponse.json({
            success: true,
            message: `Account ${phoneNumber} successfully linked to tenant.`,
        });

    } catch (error: any) {
        console.error("[Link Account] Error:", error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}
