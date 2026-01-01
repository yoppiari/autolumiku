
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const AIMEOW_API_URL = process.env.AIMEOW_DOMAIN || 'https://api.aimeow.com';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://primamobil.id';

async function debugAimeowState() {
    console.log('🐞 Debugging Aimeow Connection State...');
    console.log(`🌐 App URL: ${APP_URL}`);
    console.log(`📡 Aimeow API: ${AIMEOW_API_URL}`);

    try {
        // 1. Check Local DB State
        console.log('\n1️⃣  Checking Local Database...');
        const accounts = await prisma.aimeowAccount.findMany({
            include: {
                tenant: { select: { name: true } }
            }
        });

        console.log(`Found ${accounts.length} Aimeow accounts in DB.`);

        for (const acc of accounts) {
            console.log(`   - [${acc.tenant.name}] ClientID: ${acc.clientId}`);
            console.log(`     DB ConnectionStatus: ${acc.connectionStatus}, DB IsActive: ${acc.isActive}`);
            console.log(`     Phone: ${acc.phoneNumber || 'N/A'}`);

            // 2. Cross-check with Aimeow API
            console.log(`\n2️⃣  Verifying with Aimeow API for Client: ${acc.clientId}...`);
            try {
                const response = await fetch(`${AIMEOW_API_URL}/api/v1/clients/${acc.clientId}`);
                if (response.ok) {
                    const remoteData: any = await response.json();
                    console.log(`     ✅ API Status: ${response.status}`);
                    console.log(`     📡 Remote State: Connected=${remoteData.isConnected}, Status=${remoteData.status}`);

                    if (remoteData.isConnected !== acc.isActive) {
                        console.warn(`     ⚠️ STATE MISMATCH! DB calls it IsActive=${acc.isActive}, API calls it Connected=${remoteData.isConnected}`);
                    }
                } else {
                    console.error(`     ❌ API Error: ${response.status} ${response.statusText}`);
                    const errText = await response.text();
                    console.error(`     Error details: ${errText}`);

                    if (response.status === 404) {
                        console.error(`     🚨 CRITICAL: Client ID not found on Aimeow server! Integration is broken.`);
                    }
                }
            } catch (apiErr) {
                console.error(`     ❌ Network Error contacting Aimeow:`, apiErr);
            }
        }

        // 3. List actual clients on Aimeow to find orphans
        console.log('\n3️⃣  Listing ALL Clients on Aimeow Server...');
        try {
            const listResponse = await fetch(`${AIMEOW_API_URL}/api/v1/clients`);
            if (listResponse.ok) {
                const allClients = await listResponse.json();
                console.log(`Found ${allClients.length} clients on Aimeow server:`);
                allClients.forEach((c: any) => {
                    console.log(`   - ID: ${c.id}, Phone: ${c.phoneNumber}, Status: ${c.status}, Connected: ${c.isConnected}`);
                });
            }
        } catch (listErr) {
            console.error("Failed to list clients:", listErr);
        }

    } catch (error) {
        console.error('❌ Fatal Error during debug:', error);
    } finally {
        await prisma.$disconnect();
    }
}

debugAimeowState();
