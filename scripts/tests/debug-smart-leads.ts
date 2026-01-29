
// Script to test Smart Leads logic without live traffic
// Run with: npx ts-node src/scripts/debug-smart-leads.ts

// Adjust path imports for script execution context if needed
// Or easier: put this in src/app/api/test-leads/route.ts temporarily and curl it
// Let's try standalone script first, assuming ts-node is setup.

import { PrismaClient } from '@prisma/client';
import { LeadService } from '../lib/services/lead-service';

const prisma = new PrismaClient();

async function testSmartLeads() {
    console.log('--- STARTING SMART LEADS TEST ---');

    const TEST_TENANT_ID = 'cm5k5123400010cjx9y8z7w6v'; // Replace with a valid tenant ID from your DB if known, or fetch one
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
    console.log(`Simulating message from: ${TEST_NAME} (${TEST_PHONE})`);
    console.log(`Message: "${TEST_MESSAGE}"`);

    try {
        // 1. Clean up potential previous test data
        const existing = await prisma.lead.findFirst({
            where: { tenantId, phone: '08999998888' } // '0' normalized
        });

        if (existing) {
            console.log('Found existing test lead, deleting...');
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
            console.log('Source:', result.source);
        } else {
            console.error('❌ Service returned null (failed or ignored).');
        }

    } catch (err) {
        console.error('❌ Test Failed with error:', err);
    } finally {
        await prisma.$disconnect();
        console.log('--- TEST FINISHED ---');
    }
}

testSmartLeads();
