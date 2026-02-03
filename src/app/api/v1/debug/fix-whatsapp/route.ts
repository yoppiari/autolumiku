
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const tenantSlug = searchParams.get("tenant") || "primamobil-id";
    const targetPhone = "6285385419766";
    const targetClientId = "892f77cb-c23c-493f-9dde-13bf19267450";

    try {
        const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
        if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });

        const account = await prisma.aimeowAccount.findUnique({
            where: { tenantId: tenant.id }
        });

        if (!account) return NextResponse.json({ error: "Account not found" }, { status: 404 });

        const updated = await prisma.aimeowAccount.update({
            where: { id: account.id },
            data: {
                clientId: targetClientId,
                phoneNumber: targetPhone,
                connectionStatus: "connected",
                isActive: true,
            }
        });

        // Also update AI Config to be active and 24/7
        const config = await prisma.whatsAppAIConfig.upsert({
            where: { tenantId: tenant.id },
            update: {
                alwaysReplyCustomer: true,
                customerChatEnabled: true,
                autoReply: true,
            },
            create: {
                tenantId: tenant.id,
                accountId: account.id,
                aiName: "AI Assistant",
                alwaysReplyCustomer: true,
                customerChatEnabled: true,
                autoReply: true,
                welcomeMessage: "Halo! Asisten AI Prima Mobil siap membantu Kakak 24 jam. 😊"
            }
        });

        return NextResponse.json({
            success: true,
            message: "WhatsApp AI has been FORCE CONNECTED to the active Aimeow client.",
            account: {
                id: updated.id,
                clientId: updated.clientId,
                phone: updated.phoneNumber
            },
            config: {
                alwaysReplyCustomer: config.alwaysReplyCustomer,
                customerChatEnabled: config.customerChatEnabled
            }
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
