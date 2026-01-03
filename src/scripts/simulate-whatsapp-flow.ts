
import { PrismaClient } from '@prisma/client';
import { MessageOrchestratorService } from '../lib/services/whatsapp-ai/message-orchestrator.service';

const prisma = new PrismaClient();

async function simulateWhatsAppFlow() {
    console.log('🚀 Starting WhatsApp AI Simulation...');

    try {
        // 1. Get a valid Tenant and Account
        let account = await prisma.aimeowAccount.findFirst({
            include: { tenant: true }
        });

        if (!account) {
            console.log('⚠️ No Aimeow Account found. Trying to find a Tenant to create one...');
            const tenant = await prisma.tenant.findFirst();
            if (!tenant) {
                console.error('❌ No Tenant found. Cannot run simulation.');
                return;
            }

            console.log(`✅ Found Tenant: ${tenant.name}. Creating dummy Aimeow Account...`);
            account = await prisma.aimeowAccount.create({
                data: {
                    tenantId: tenant.id,
                    clientId: `test-${Date.now()}`,
                    apiKey: 'test-api-key-encrypted',
                    phoneNumber: '628123456789',
                },
                include: { tenant: true }
            });
        }

        if (!account) {
            console.error('❌ Failed to get or create account');
            return;
        }

        console.log(`✅ Using Account for Tenant: ${account.tenant?.name || 'Unknown'} (${account.tenantId})`);

        // 2. Simulate "Escalated Loop" Closing
        console.log('\n🧪 TEST 1: Auto-Resolve Escalated Conversation with "cuup"');

        const customerPhone = '628999999999';
        const conv = await prisma.whatsAppConversation.create({
            data: {
                accountId: account.id,
                tenantId: account.tenantId,
                customerPhone: customerPhone,
                isStaff: false,
                conversationType: 'customer',
                status: 'escalated',
                escalatedAt: new Date(),
            }
        });
        console.log(`   - Created Escalated Conversation: ${conv.id}`);

        const incomingMsg = {
            accountId: account.id,
            clientId: account.clientId,
            tenantId: account.tenantId,
            from: customerPhone,
            message: 'sudah cuup makasih',
            messageId: `msg-${Date.now()}`
        };

        try {
            await MessageOrchestratorService.processIncomingMessage(incomingMsg);
        } catch (e) {
            console.log('   - (Expected) Message sending failed (no real WA), but checking logic...');
        }

        const updatedConv = await prisma.whatsAppConversation.findUnique({
            where: { id: conv.id }
        });

        if (updatedConv?.status === 'closed') {
            console.log('✅ PASS: Conversation status changed to "closed"');
            const contextData = updatedConv.contextData as any;
            console.log(`   - Closing Message: ${contextData?.closingMessage || 'N/A'}`);
        } else {
            console.error(`❌ FAIL: Conversation status is ${updatedConv?.status} (Expected: closed)`);
        }

        // 3. Simulate "Tidak Terima Kasih"
        console.log('\n🧪 TEST 2: Auto-Resolve with "tidak, terima kasih"');
        const conv2 = await prisma.whatsAppConversation.create({
            data: {
                accountId: account.id,
                tenantId: account.tenantId,
                customerPhone: '628888888888',
                isStaff: false,
                conversationType: 'customer',
                status: 'escalated',
                escalatedAt: new Date(),
            }
        });

        const incomingMsg2 = {
            accountId: account.id,
            clientId: account.clientId,
            tenantId: account.tenantId,
            from: '628888888888',
            message: 'tidak, terima kasih',
            messageId: `msg-${Date.now()}-2`
        };

        try {
            await MessageOrchestratorService.processIncomingMessage(incomingMsg2);
        } catch (e) { }

        const updatedConv2 = await prisma.whatsAppConversation.findUnique({ where: { id: conv2.id } });
        if (updatedConv2?.status === 'closed') {
            console.log('✅ PASS: Conversation status changed to "closed"');
        } else {
            console.error(`❌ FAIL: Conversation status is ${updatedConv2?.status}`);
        }

        console.log('\n✅ WhatsApp AI simulation completed!');

    } catch (error) {
        console.error('❌ Simulation Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

simulateWhatsAppFlow();
