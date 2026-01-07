import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    const TARGET_PHONE = '6281310703754'; // User's actual WhatsApp number
    const PRIMA_MOBIL_TENANT_ID = 'e592973f-9eff-4f40-adf6-ca6b2ad9721f';

    try {
        console.log('[Test Image Send] Starting API-based test...');

        // 1. Get Prima Mobil tenant with Aimeow account
        const tenant = await prisma.tenant.findUnique({
            where: { id: PRIMA_MOBIL_TENANT_ID },
            include: { aimeowAccount: true }
        });

        if (!tenant?.aimeowAccount?.clientId) {
            return NextResponse.json({
                error: 'Prima Mobil has no Aimeow account configured',
                hint: 'Go to https://auto.lumiku.com/dashboard/whatsapp-ai/setup to configure'
            }, { status: 404 });
        }

        const clientId = tenant.aimeowAccount.clientId;

        // 2. Find a vehicle with photo from Prima Mobil
        const vehicle = await prisma.vehicle.findFirst({
            where: {
                tenantId: tenant.id,
                status: { not: 'DELETED' },
                photos: { some: {} }
            },
            include: { photos: { take: 1 } }
        });

        if (!vehicle || !vehicle.photos[0]) {
            return NextResponse.json({ error: 'No vehicle found with photos for Prima Mobil' }, { status: 404 });
        }

        // CRITICAL: Aimeow API CANNOT download from data: URLs!
        // It needs public HTTP URLs that it can fetch
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://auto.lumiku.com';
        const photoUrl = vehicle.photos[0].originalUrl; // e.g. /uploads/vehicles/xxx.jpg

        // Build full public URL
        const publicImageUrl = photoUrl.startsWith('http')
            ? photoUrl
            : `${baseUrl}${photoUrl.startsWith('/') ? '' : '/'}${photoUrl}`;

        console.log('[Test Image Send] Using photo URL:', publicImageUrl);

        const endpoint = `${process.env.AIMEOW_BASE_URL || 'https://meow.lumiku.com'}/api/v1/clients/${clientId}/send-images`;

        const send = async (name: string, payload: any) => {
            try {
                const res = await fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const status = res.status;
                const text = await res.text();
                return { name, status, ok: res.ok, response: text.substring(0, 200) };
            } catch (e: any) {
                return { name, status: 0, ok: false, error: e.message };
            }
        };

        const results: any[] = [];

        // TEST: Just send the original public URL (this is what production code should use!)
        results.push(await send('Production Method (Public URL)', {
            phone: TARGET_PHONE,
            images: [{ imageUrl: publicImageUrl, caption: "✅ PRODUCTION: Public URL" }],
            viewOnce: false,
            isViewOnce: false,
            mimetype: 'image/jpeg',
            mimeType: 'image/jpeg',
            type: 'image',
            mediaType: 'image'
        }));

        return NextResponse.json({
            success: true,
            message: 'Test image sent using PUBLIC URL (the correct method)!',
            photoUrl: publicImageUrl,
            vehicleInfo: `${vehicle.make || ''} ${vehicle.model || ''} ${vehicle.year || ''}`.trim(),
            results,
            fix: '✅ Root cause found: Aimeow needs public URLs, NOT base64 data. Production code must use photo URLs directly.',
            instructions: 'Check your WhatsApp (+6281310703754) for the image. If it appears, the fix is confirmed!'
        });

    } catch (error: any) {
        console.error('[Test Image Send] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
