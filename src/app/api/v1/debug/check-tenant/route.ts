import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force_dynamic';

export async function GET(request: NextRequest) {
    const PRIMA_MOBIL_TENANT_ID = 'e592973f-9eff-4f40-adf6-ca6b2ad9721f';

    try {
        const tenant = await prisma.tenant.findUnique({
            where: { id: PRIMA_MOBIL_TENANT_ID },
            select: {
                id: true,
                slug: true,
                name: true,
                whatsappNumber: true,
                aimeowAccount: {
                    select: {
                        clientId: true,
                        phoneNumber: true,
                        isActive: true,
                        connectionStatus: true
                    }
                },
                vehicles: {
                    where: {
                        status: { not: 'DELETED' },
                        photos: { some: {} }
                    },
                    select: {
                        id: true,
                        make: true,
                        model: true,
                        year: true,
                        _count: { select: { photos: true } }
                    },
                    take: 5
                }
            }
        });

        if (!tenant) {
            return NextResponse.json({ error: 'Tenant not found', tenantId: PRIMA_MOBIL_TENANT_ID }, { status: 404 });
        }

        return NextResponse.json({
            tenant: {
                id: tenant.id,
                name: tenant.name,
                slug: tenant.slug,
                whatsappNumber: tenant.whatsappNumber || 'NOT SET',
            },
            aimeowAccount: tenant.aimeowAccount || { error: 'No Aimeow account configured' },
            vehiclesWithPhotos: tenant.vehicles.length,
            sampleVehicles: tenant.vehicles,
            solution: tenant.aimeowAccount?.clientId
                ? '✅ Client ID found! Ready to test.'
                : '❌ Need to configure Aimeow account. Go to WhatsApp AI settings.'
        });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
