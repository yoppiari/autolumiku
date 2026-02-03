/**
 * Enhanced Debug Index Route
 * GET /api/v1/debug?tenant=primamobil-id
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';

const AIMEOW_BASE_URL = process.env.AIMEOW_BASE_URL || "https://meow.lumiku.com";

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const tenantSlug = searchParams.get("tenant") || "primamobil-id";
    const mode = searchParams.get("mode");

    // Mode: WhatsApp Setup Details
    if (mode === 'whatsapp-setup') {
        try {
            const tenant = await prisma.tenant.findUnique({
                where: { slug: tenantSlug },
                select: { id: true, name: true, slug: true, whatsappNumber: true }
            });

            if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });

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

            return NextResponse.json({
                tenant,
                account,
                aimeowClient,
                serverTime: new Date().toISOString()
            });
        } catch (error: any) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }
    }

    // Default: List Tools
    const debugTools = [
        { name: 'WhatsApp Setup Details', path: '/api/v1/debug?mode=whatsapp-setup' },
        { name: 'WhatsApp PDF Test', path: '/api/v1/debug/test-whatsapp-pdf' },
        { name: 'Sales Report PDF Test', path: '/api/v1/debug/test-sales-report-pdf' },
        { name: 'User Check', path: '/api/v1/debug/user-check' },
        { name: 'Vehicle Check', path: '/api/v1/debug/vehicle-check' },
        { name: 'WA Status', path: '/api/v1/debug/wa-status' },
        { name: 'Fix WhatsApp Connection', path: '/api/v1/debug/fix-whatsapp' },
    ];

    return NextResponse.json({
        success: true,
        message: 'AutoLumiKu Debug Tools',
        tools: debugTools,
        tenant: tenantSlug
    });
}
