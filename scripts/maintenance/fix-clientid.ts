/**
 * Fix ClientId Script
 * Updates the database with the correct UUID from Aimeow API
 * Run with: npx tsx scripts/fix-clientid.ts
 */

import { prisma } from "../src/lib/prisma";

const AIMEOW_BASE_URL = process.env.AIMEOW_BASE_URL || "https://meow.lumiku.com";
const TENANT_ID = "92f0a5fd-fe4b-425e-a5d2-aeb4e91781e4";

async function fixClientId() {
  console.log("🔧 Fixing ClientId...");

  try {
    // Get current account
    const account = await prisma.aimeowAccount.findUnique({
      where: { tenantId: TENANT_ID },
    });

    if (!account) {
      console.error("❌ Account not found");
      process.exit(1);
    }

    console.log(`Current clientId: ${account.clientId}`);
    console.log(`Current phoneNumber: ${account.phoneNumber}`);

    // Fetch all clients from Aimeow
    const response = await fetch(`${AIMEOW_BASE_URL}/api/v1/clients`);

    if (!response.ok) {
      throw new Error(`Failed to fetch clients: ${response.statusText}`);
    }

    const clients = await response.json();
    console.log(`\nFound ${clients.length} clients on Aimeow:`);
    clients.forEach((c: any) => {
      console.log(`  - ${c.id}: ${c.isConnected ? '✅ Connected' : '❌ Disconnected'}`);
    });

    // Find connected client
    const connectedClient = clients.find((c: any) => c.isConnected === true);

    if (!connectedClient) {
      console.error("\n❌ No connected client found on Aimeow");
      process.exit(1);
    }

    const correctClientId = connectedClient.id;
    console.log(`\n✅ Found connected client: ${correctClientId}`);

    // Extract phone number from current JID if needed
    let phoneNumber = account.phoneNumber;
    if (account.clientId.includes("@s.whatsapp.net")) {
      phoneNumber = account.clientId.split(":")[0];
      console.log(`Extracted phone number from JID: ${phoneNumber}`);
    }

    // Update database
    console.log(`\n🔄 Updating database...`);
    await prisma.aimeowAccount.update({
      where: { id: account.id },
      data: {
        clientId: correctClientId,
        phoneNumber: phoneNumber,
        connectionStatus: "connected",
        isActive: true,
        lastConnectedAt: new Date(),
      },
    });

    console.log(`\n✅ SUCCESS! ClientId updated:`);
    console.log(`   Old: ${account.clientId}`);
    console.log(`   New: ${correctClientId}`);
    console.log(`   Phone: ${phoneNumber}`);

  } catch (error: any) {
    console.error("\n❌ Error:", error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

fixClientId();
