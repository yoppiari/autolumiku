import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    const TARGET_PHONE = '6281310703754';
    const PRIMA_MOBIL_TENANT_ID = 'e592973f-9eff-4f40-adf6-ca6b2ad9721f';

    try {
        // Get tenant & vehicle
        const tenant = await prisma.tenant.findUnique({
            where: { id: PRIMA_MOBIL_TENANT_ID },
            include: { aimeowAccount: true }
        });

        if (!tenant?.aimeowAccount?.clientId) {
            return NextResponse.json({ error: 'No Aimeow account' }, { status: 404 });
        }

        const vehicle = await prisma.vehicle.findFirst({
            where: {
                tenantId: tenant.id,
                status: { not: 'DELETED' },
                photos: { some: {} }
            },
            include: { photos: { take: 1 } }
        });

        if (!vehicle?.photos[0]) {
            return NextResponse.json({ error: 'No vehicle with photos' }, { status: 404 });
        }

        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://auto.lumiku.com';
        const photoUrl = vehicle.photos[0].originalUrl;
        const publicUrl = photoUrl.startsWith('http') ? photoUrl : `${baseUrl}${photoUrl}`;

        const clientId = tenant.aimeowAccount.clientId;
        const aimeowBase = process.env.AIMEOW_BASE_URL || 'https://meow.lumiku.com';

        const results: any[] = [];

        // TEST 1: Singular endpoint (/send-image)
        try {
            const res1 = await fetch(`${aimeowBase}/api/v1/clients/${clientId}/send-image`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    phone: TARGET_PHONE,
                    imageUrl: publicUrl,
                    caption: "TEST 1: Singular endpoint (/send-image)"
                })
            });

            results.push({
                method: 'Singular (/send-image)',
                status: res1.status,
                ok: res1.ok,
                response: await res1.text()
            });
        } catch (e: any) {
            results.push({
                method: 'Singular (/send-image)',
                error: e.message
            });
        }

        // Wait 2 seconds between tests
        await new Promise(resolve => setTimeout(resolve, 2000));

        // TEST 2: Plural endpoint (/send-images) - CURRENT METHOD
        try {
            const res2 = await fetch(`${aimeowBase}/api/v1/clients/${clientId}/send-images`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    phone: TARGET_PHONE,
                    images: [{ imageUrl: publicUrl, caption: "TEST 2: Plural endpoint (/send-images)" }]
                })
            });

            results.push({
                method: 'Plural (/send-images)',
                status: res2.status,
                ok: res2.ok,
                response: await res2.text()
            });
        } catch (e: any) {
            results.push({
                method: 'Plural (/send-images)',
                error: e.message
            });
        }

        return NextResponse.json({
            success: true,
            message: 'Sent 2 test images - check WhatsApp to compare inline vs attachment display',
            photoUrl: publicUrl,
            results,
            instructions: [
                '1. Check WhatsApp (+6281310703754)',
                '2. Compare: Which one shows INLINE preview?',
                '3. Report back: "TEST 1" or "TEST 2" atau "BOTH ATTACHMENT"'
            ]
        });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
