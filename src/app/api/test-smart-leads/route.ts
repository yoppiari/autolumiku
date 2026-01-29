
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { LeadService } from '@/lib/services/leads/lead-service';

export const dynamic = 'force-dynamic';

export async function GET() {
    console.log('--- STARTING SMART LEADS API TEST ---');

    const TEST_PHONE = '08999998888';
    const TEST_NAME = 'Budi Tester API';
    const TEST_MESSAGE = 'Tes API Leads';

    try {
        // 1. Get Tenant
        const tenant = await prisma.user.findFirst({ select: { tenantId: true } });
        if (!tenant?.tenantId) return NextResponse.json({ error: 'No tenant found' });
        const tenantId = tenant.tenantId;

        // 2. Cleanup
        const existings = await prisma.lead.findMany({
            where: { tenantId, phone: { contains: '8999998888' } }
        });
        for (const existing of existings) {
            await prisma.lead.delete({ where: { id: existing.id } });
        }

        // 3. Execute
        const result = await LeadService.createOrUpdateFromWhatsApp({
            tenantId,
            customerPhone: TEST_PHONE,
            customerName: TEST_NAME,
            message: TEST_MESSAGE,
            intent: 'customer_inquiry_price',
            isStaff: false
        });

        return NextResponse.json({
            success: true,
            lead: result,
            message: 'Lead created successfully'
        });

    } catch (error: any) {
        console.error('Test failed:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
