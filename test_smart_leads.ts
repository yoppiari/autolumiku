
// Run with: npx ts-node --compiler-options "{\"module\":\"commonjs\"}" test_smart_leads.ts

import { PrismaClient } from '@prisma/client';
// Use explicit relative path targeting the file
import { LeadService } from './src/lib/services/lead-service';

const prisma = new PrismaClient();

async function testSmartLeads() {
    console.log('--- STARTING SMART LEADS TEST ---');

    // Fetch a real tenant to be safe
    const tenant = await prisma.user.findFirst({
        select: { tenantId: true }
    });

    if (!tenant || !tenant.tenantId) {
        console.error('❌ No tenant found in DB to test with.');
        return;
    }

    const tenantId = tenant.tenantId;
    const TEST_PHONE = '08999998888'; // Fake number
    const TEST_NAME = 'Budi Tester';
    const TEST_MESSAGE = 'Info harga Pajero dong gan';

    console.log(`Testing with Tenant: ${tenantId}`);

    try {
        // 1. Clean up potential previous test data
        // Use raw query or findMany to avoid unique constraint issues if normalization differs
        const existings = await prisma.lead.findMany({
            where: { tenantId, phone: { contains: '8999998888' } }
        });

        for (const existing of existings) {
            console.log('Deleting existing test lead:', existing.id);
            await prisma.lead.delete({ where: { id: existing.id } });
        }

        // 2. Call the service
        console.log('Calling LeadService.createOrUpdateFromWhatsApp...');
        const result = await LeadService.createOrUpdateFromWhatsApp({
            tenantId,
            customerPhone: TEST_PHONE,
            customerName: TEST_NAME,
            message: TEST_MESSAGE,
            intent: 'customer_inquiry_price', // Simulated intent
            isStaff: false
        });

        if (result) {
            console.log('✅ Lead Created/Updated Successfully!');
            console.log('Lead ID:', result.id);
            console.log('Status:', result.status);
            console.log('Name:', result.name);
            console.log('Phone:', result.phone);
            console.log('Interested In:', result.interestedIn);
        } else {
            console.error('❌ Service returned null (failed or ignored).');
        }

    } catch (err) {
        console.error('❌ Test Failed with error:', err);
    } finally {
        await prisma.$disconnect();
    }
}

testSmartLeads();
