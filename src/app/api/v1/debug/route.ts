/**
 * Consolidated Debug Route
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

        // MODE: SQL Sync (Emergency Column Addition)
        if (mode === 'sql-sync') {
            const results = [];
            // WhatsApp AI Configs
            results.push(await prisma.$executeRawUnsafe(`ALTER TABLE "whatsapp_ai_configs" ADD COLUMN IF NOT EXISTS "alwaysReplyCustomer" BOOLEAN DEFAULT true`));
            results.push(await prisma.$executeRawUnsafe(`ALTER TABLE "whatsapp_ai_configs" ADD COLUMN IF NOT EXISTS "bypassHoursForStaff" BOOLEAN DEFAULT false`));

            // WhatsApp Conversations (Catch-up & Tone)
            results.push(await prisma.$executeRawUnsafe(`ALTER TABLE "whatsapp_conversations" ADD COLUMN IF NOT EXISTS "needsCatchup" BOOLEAN DEFAULT false`));
            results.push(await prisma.$executeRawUnsafe(`ALTER TABLE "whatsapp_conversations" ADD COLUMN IF NOT EXISTS "lastAfterHoursAt" TIMESTAMP`));
            results.push(await prisma.$executeRawUnsafe(`ALTER TABLE "whatsapp_conversations" ADD COLUMN IF NOT EXISTS "lastCustomerTone" TEXT`));

            // Leads (Location Capture)
            results.push(await prisma.$executeRawUnsafe(`ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "location" TEXT`));

            // Users (Staff Online/Offline Status for AI 5.2)
            results.push(await prisma.$executeRawUnsafe(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "waStatus" TEXT DEFAULT 'online'`));

            return NextResponse.json({ success: true, message: "Schema synced via SQL.", results });
        }

        // MODE: Scan and Reply Pending (Catch-up)
        if (mode === 'scan-pending') {
            const conversations = await prisma.whatsAppConversation.findMany({
                where: {
                    tenantId: tenant.id,
                    messages: {
                        some: { direction: 'inbound' }
                    }
                },
                include: {
                    messages: {
                        orderBy: { createdAt: 'desc' },
                        take: 1
                    },
                    account: true
                }
            });

            const pending = conversations.filter(c =>
                c.messages[0]?.direction === 'inbound' &&
                (Date.now() - new Date(c.messages[0].createdAt).getTime()) < 86400000 // Last 24h
            );

            const results = [];
            for (const conv of pending) {
                try {
                    const res = await MessageOrchestratorService.processIncomingMessage({
                        accountId: conv.accountId,
                        clientId: conv.account.clientId,
                        tenantId: conv.tenantId,
                        from: conv.customerPhone,
                        message: conv.messages[0].content,
                        messageId: `catchup_${Date.now()}_${conv.id.substring(0, 5)}`,
                        isCatchup: true
                    });
                    results.push({ phone: conv.customerPhone, success: res.success });
                } catch (e: any) {
                    results.push({ phone: conv.customerPhone, error: e.message });
                }
            }

            return NextResponse.json({ success: true, processed: pending.length, results });
        }

        // MODE: User Check
        if (mode === 'user-check') {
            const email = searchParams.get('email') || 'admin@primamobil.id';
            const user = await prisma.user.findFirst({
                where: { email: email.toLowerCase() },
                select: { id: true, email: true, firstName: true, lastName: true, role: true, tenantId: true }
            });
            return NextResponse.json({ email, user, database: process.env.DATABASE_URL?.split('@')[1] });
        }

        // MODE: Tenant Users (list all users for this tenant + platform super admins)
        if (mode === 'tenant-users') {
            const tenantUsers = await prisma.user.findMany({
                where: { tenantId: tenant.id },
                select: {
                    id: true,
                    email: true,
                    firstName: true,
                    lastName: true,
                    role: true,
                    emailVerified: true,
                    lockedUntil: true,
                    failedLoginAttempts: true,
                    lastLoginAt: true,
                    createdAt: true,
                },
                orderBy: { createdAt: 'asc' },
            });
            const platformAdmins = await prisma.user.findMany({
                where: { tenantId: null },
                select: {
                    id: true,
                    email: true,
                    firstName: true,
                    lastName: true,
                    role: true,
                    lastLoginAt: true,
                },
                orderBy: { createdAt: 'asc' },
            });
            return NextResponse.json({
                tenant: { id: tenant.id, slug: tenant.slug, name: tenant.name },
                tenantUsers,
                platformAdmins,
            });
        }

        // MODE: Vehicle Check
        if (mode === 'vehicle-check') {
            const vehicles = await prisma.vehicle.findMany({
                where: { tenantId: tenant.id },
                take: 10,
                orderBy: { createdAt: 'desc' },
                select: { id: true, make: true, model: true, year: true, price: true, status: true }
            });
            return NextResponse.json({ count: vehicles.length, samples: vehicles });
        }

        // MODE: Force Fix WhatsApp Connection
        if (mode === 'fix-whatsapp') {
            const targetPhone = "6285385419766";
            const targetClientId = "892f77cb-c23c-493f-9dde-13bf19267450";

            const account = await prisma.aimeowAccount.findUnique({ where: { tenantId: tenant.id } });
            if (!account) return NextResponse.json({ error: "Account not found" }, { status: 404 });

            const updated = await prisma.aimeowAccount.update({
                where: { id: account.id },
                data: { clientId: targetClientId, phoneNumber: targetPhone, connectionStatus: "connected", isActive: true }
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

            if (!conversation || !conversation.messages[0]) return NextResponse.json({ error: "No recent message" }, { status: 404 });

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
            { name: 'Manual SQL Schema Sync', path: '/api/v1/debug?mode=sql-sync' },
            { name: 'Force Fix Connection', path: '/api/v1/debug?mode=fix-whatsapp' },
            { name: 'Trigger AI Reply', path: '/api/v1/debug?mode=trigger-reply&phone=6281216206368' },
            { name: 'User Check', path: '/api/v1/debug?mode=user-check&email=admin@primamobil.id' },
            { name: 'Tenant Users', path: '/api/v1/debug?mode=tenant-users&tenant=primamobil-id' },
            { name: 'Vehicle Check', path: '/api/v1/debug?mode=vehicle-check' },
        ];

        return NextResponse.json({
            success: true,
            message: 'AutoLumiKu Debug Tools Consolidated',
            tools: debugTools,
            tenant: tenantSlug
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
