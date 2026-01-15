
import { PrismaClient } from '@prisma/client';
import { MessageOrchestratorService } from '../lib/services/whatsapp-ai/message-orchestrator.service';

const prisma = new PrismaClient();

async function runSystemTest() {
    console.log("🚀 STARTING FULL AI 5.2 SYSTEM TEST");
    console.log("===================================");

    try {
        // 1. Setup Tenant & Account
        console.log("\n[1] Setting up Test Environment...");
        let account = await prisma.aimeowAccount.findFirst({
            include: { tenant: true },
            where: { isActive: true }
        });

        if (!account) {
            console.log("⚠️ No active Aimeow Account found. Finding a tenant to create one...");
            const tenant = await prisma.tenant.findFirst();
            if (!tenant) throw new Error("No Tenant found!");

            // Fix: Add apiKey
            account = await prisma.aimeowAccount.create({
                data: {
                    tenantId: tenant.id,
                    clientId: `test-${Date.now()}`,
                    phoneNumber: '628123456789',
                    isActive: true,
                    connectionStatus: 'connected',
                    apiKey: 'test-api-key'
                },
                include: { tenant: true }
            });
            console.log("✅ Created Test Account");
        } else {
            console.log(`✅ Using Account: ${account.clientId} (Tenant: ${account.tenant.name})`);
        }

        // 2. Scenario A: CUEK Customer
        console.log("\n[2] Testing Scenario A: CUEK Customer ('hrg avanza')");
        const phoneCuek = '6289911112222';
        const msgCuek = 'hrg avanza';

        const payloadCuek = {
            accountId: account.id,
            clientId: account.clientId,
            tenantId: account.tenantId,
            from: phoneCuek,
            message: msgCuek,
            messageId: `msg-cuek-${Date.now()}`,
            data: {
                from: phoneCuek,
                message: msgCuek,
                // Add required data fields for webhook payload
                type: 'text'
            }
        };

        // Note: processIncomingMessage expects the internal IncomingMessage type, NOT the webhook payload directly.
        // But the orchestrator service method signature is: processIncomingMessage(incoming: IncomingMessage)
        // IncomingMessage = { accountId, clientId, tenantId, from, customerName?, message, mediaUrl?, mediaType?, messageId }

        // So we pass that structure directly.
        console.log(`   - Sending: "${msgCuek}"`);
        const resCuek = await MessageOrchestratorService.processIncomingMessage({
            accountId: account.id,
            clientId: account.clientId,
            tenantId: account.tenantId,
            from: phoneCuek,
            message: msgCuek,
            messageId: `msg-cuek-${Date.now()}`
        });

        console.log(`   - AI Response: "${resCuek.responseMessage}"`);

        const isResponseCuek = (resCuek.responseMessage?.length || 0) < 150 && !(resCuek.responseMessage?.includes("😊"));
        console.log(`   - Response Style Check: ${isResponseCuek ? "✅ CUEK Compatible" : "⚠️ Potential Mismatch"}`);

        const leadCuek = await prisma.lead.findFirst({
            where: { whatsappNumber: phoneCuek, tenantId: account.tenantId }
        });
        if (leadCuek) {
            console.log(`   - Lead Created: ✅ ID=${leadCuek.id}, Status=${leadCuek.status}`);
        } else {
            console.error(`   - Lead Creation: ❌ FAILED`);
        }


        // 3. Scenario B: AKTIF Customer
        console.log("\n[3] Testing Scenario B: AKTIF Customer ('Halo kak 😊 info jazz dong')");
        const phoneAktif = '6289933334444';
        const msgAktif = 'Halo kak 😊 info jazz dong';

        console.log(`   - Sending: "${msgAktif}"`);
        const resAktif = await MessageOrchestratorService.processIncomingMessage({
            accountId: account.id,
            clientId: account.clientId,
            tenantId: account.tenantId,
            from: phoneAktif,
            message: msgAktif,
            messageId: `msg-aktif-${Date.now()}`
        });

        console.log(`   - AI Response: "${resAktif.responseMessage}"`);

        const isResponseAktif = resAktif.responseMessage?.includes("😊") || resAktif.responseMessage?.includes("🙏");
        console.log(`   - Response Style Check: ${isResponseAktif ? "✅ AKTIF Compatible" : "⚠️ Potential Mismatch"}`);

        const leadAktif = await prisma.lead.findFirst({
            where: { whatsappNumber: phoneAktif, tenantId: account.tenantId }
        });
        if (leadAktif) {
            console.log(`   - Lead Created: ✅ ID=${leadAktif.id}, Status=${leadAktif.status}`);
        } else {
            console.error(`   - Lead Creation: ❌ FAILED`);
        }

    } catch (error) {
        console.error("❌ CRITICAL ERROR:", error);
    } finally {
        await prisma.$disconnect();
        console.log("\n===================================");
        console.log("🏁 TEST COMPLETED");
    }
}

runSystemTest();
