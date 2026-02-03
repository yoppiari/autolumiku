/**
 * Enhanced Debug Index Route
 * GET /api/v1/debug?tenant=primamobil-id&mode=xxx
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from "@/lib/prisma";
import { MessageOrchestratorService } from "@/lib/services/whatsapp-ai/core/message-orchestrator.service";

export const dynamic = 'force-dynamic';

const AIMEOW_BASE_URL = process.env.AIMEOW_BASE_URL || "https://meow.lumiku.com";

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const tenantSlug = searchParams.get("tenant") || "primamobil-id";
    const mode = searchParams.get("mode");

    try {
        const tenant = await prisma.tenant.findUnique({
            where: { slug: tenantSlug },
            select: { id: true, name: true, slug: true, whatsappNumber: true }
        });

        if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });

        // MODE: WhatsApp Setup Details
        if (mode === 'whatsapp-setup') {
            const account = await prisma.aimeowAccount.findUnique({
                where: { tenantId: tenant.id },
                include: { aiConfig: true }
            });

            let aimeowClient: any = null;
            try {
                const res = await fetch(`${AIMEOW_BASE_URL}/api/v1/clients`, { cache: 'no-store' });
                if (res.ok) {
                    const clients = await res.json();
                    aimeowClient = clients.find((c: any) => c.isConnected) || clients[0];
                }
            } catch (e) { }

            return NextResponse.json({ tenant, account, aimeowClient });
        }

        // MODE: Force Fix WhatsApp Connection
        if (mode === 'fix-whatsapp') {
            const targetPhone = "6285385419766";
            const targetClientId = "892f77cb-c23c-493f-9dde-13bf19267450";

            const account = await prisma.aimeowAccount.findUnique({ where: { tenantId: tenant.id } });
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

            await prisma.whatsAppAIConfig.upsert({
                where: { tenantId: tenant.id },
                update: { alwaysReplyCustomer: true, customerChatEnabled: true, autoReply: true },
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

            return NextResponse.json({ success: true, message: "WhatsApp AI force connected.", account: updated });
        }

        // MODE: Trigger AI Reply
        if (mode === 'trigger-reply') {
            const phone = searchParams.get("phone") || "6281216206368";
            const cleanPhone = phone.replace(/\D/g, "");

            const conversation = await prisma.whatsAppConversation.findFirst({
                where: { customerPhone: { contains: cleanPhone.substring(cleanPhone.length - 10) } },
                include: { account: true, messages: { where: { direction: 'inbound' }, orderBy: { createdAt: 'desc' }, take: 1 } }
            });

            if (!conversation || !conversation.messages[0]) return NextResponse.json({ error: "No recent message found" }, { status: 404 });

            const result = await MessageOrchestratorService.processIncomingMessage({
                accountId: conversation.accountId,
                clientId: conversation.account.clientId,
                tenantId: conversation.tenantId,
                from: conversation.customerPhone,
                message: conversation.messages[0].content,
                messageId: `manual_${Date.now()}`,
                isCatchup: true
            });

            return NextResponse.json({ success: true, result });
        }

        // Default: List Tools
        const debugTools = [
            { name: 'WhatsApp Setup Details', path: '/api/v1/debug?mode=whatsapp-setup' },
            { name: 'Force Fix Connection', path: '/api/v1/debug?mode=fix-whatsapp' },
            { name: 'Trigger AI Reply', path: '/api/v1/debug?mode=trigger-reply&phone=6281216206368' },
            { name: 'User Check', path: '/api/v1/debug/user-check' },
            { name: 'Vehicle Check', path: '/api/v1/debug/vehicle-check' },
            { name: 'WA Status', path: '/api/v1/debug/wa-status' },
        ];

        return NextResponse.json({
            success: true,
            message: 'AutoLumiKu Debug Tools',
            tools: debugTools,
            tenant: tenantSlug
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
