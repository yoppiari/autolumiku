/**
 * Restart WhatsApp Connection Script
 * Disconnect + Reinitialize dengan webhook URL otomatis
 */

import { PrismaClient } from "@prisma/client";
import { AimeowClientService } from "../src/lib/services/aimeow/aimeow-client.service";

const prisma = new PrismaClient();

async function restartWhatsAppConnection() {
  console.log("=== RESTART WHATSAPP CONNECTION ===\n");

  try {
    // 1. Get first tenant (or you can specify tenantId)
    console.log("1. Looking for tenant with WhatsApp connection...");
    const account = await prisma.aimeowAccount.findFirst({
      include: {
        tenant: {
          select: { id: true, name: true, slug: true, domain: true },
        },
      },
    });

    if (!account) {
      console.error("❌ No WhatsApp account found in database!");
      console.log("   Please setup WhatsApp first via dashboard");
      return;
    }

    console.log(`✅ Found account for tenant: ${account.tenant.name}`);
    console.log(`   Client ID: ${account.clientId}`);
    console.log(`   Status: ${account.connectionStatus}`);
    console.log(`   Current Webhook: ${account.webhookUrl || "NOT SET"}\n`);

    // 2. Disconnect existing connection
    console.log("2. Disconnecting existing connection...");
    const disconnectSuccess = await AimeowClientService.disconnectClient(
      account.clientId
    );

    if (disconnectSuccess) {
      console.log("✅ Disconnected successfully\n");
    } else {
      console.log("⚠️  Disconnect returned false (might already be disconnected)\n");
    }

    // 3. Construct webhook URL
    const domain = account.tenant.domain || `${account.tenant.slug}.auto.lumiku.com`;
    const webhookUrl = `https://${domain}/api/v1/webhooks/aimeow`;

    // If domain is auto.lumiku.com, use it directly
    const finalWebhookUrl = account.tenant.domain === "auto.lumiku.com"
      ? "https://auto.lumiku.com/api/v1/webhooks/aimeow"
      : webhookUrl;

    console.log("3. Initializing new connection...");
    console.log(`   Webhook URL: ${finalWebhookUrl}`);

    // 4. Restart connection
    const result = await AimeowClientService.restartClient(
      account.tenantId,
      account.clientId,
      finalWebhookUrl
    );

    if (!result.success) {
      console.error("❌ Failed to restart connection:", result.error);
      return;
    }

    console.log("✅ New connection initialized!\n");

    // 5. Display QR Code info
    console.log("=== QR CODE READY ===");
    console.log(`Client ID: ${result.clientId}`);
    console.log(`\nQR Code String Length: ${result.qrCode?.length || 0} characters`);

    if (result.qrCode) {
      if (result.qrCode.startsWith("http")) {
        console.log(`QR Code URL: ${result.qrCode}`);
      } else {
        console.log("\n📱 Scan this QR code with WhatsApp Business:");
        console.log("─".repeat(50));
        console.log(result.qrCode.substring(0, 100) + "...");
        console.log("─".repeat(50));
      }
    }

    console.log("\n=== NEXT STEPS ===");
    console.log("1. Open WhatsApp Business on your phone");
    console.log("2. Go to: Settings → Linked Devices → Link a Device");
    console.log("3. Scan the QR code from dashboard:");
    console.log(`   https://${domain}/dashboard/whatsapp-ai/setup`);
    console.log("\n4. After scanning, test by sending a message!");
    console.log("5. Check conversations at:");
    console.log(`   https://${domain}/dashboard/whatsapp-ai/conversations`);

    // 6. Show webhook verification
    console.log("\n=== WEBHOOK VERIFICATION ===");
    const updatedAccount = await prisma.aimeowAccount.findUnique({
      where: { tenantId: account.tenantId },
    });

    if (updatedAccount) {
      console.log(`✅ Webhook URL saved: ${updatedAccount.webhookUrl}`);
      console.log(`   Client ID: ${updatedAccount.clientId}`);
      console.log(`   Status: ${updatedAccount.connectionStatus}`);
    }

    console.log("\n✅ Restart completed! You can now scan the QR code.");
  } catch (error: any) {
    console.error("❌ Error:", error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
restartWhatsAppConnection();
