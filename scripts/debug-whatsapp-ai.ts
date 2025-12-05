/**
 * Debug Script untuk WhatsApp AI Issue
 * Cek database dan configuration
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function debugWhatsAppAI() {
  console.log("=== DEBUG WHATSAPP AI ===\n");

  try {
    // 1. Check AimeowAccount
    console.log("1. Checking AimeowAccount...");
    const accounts = await prisma.aimeowAccount.findMany({
      include: {
        tenant: {
          select: { name: true, slug: true, domain: true },
        },
        aiConfig: true,
      },
    });

    console.log(`   Found ${accounts.length} account(s)`);
    accounts.forEach((acc) => {
      console.log(`   - Account ID: ${acc.id}`);
      console.log(`     Client ID: ${acc.clientId}`);
      console.log(`     Phone: ${acc.phoneNumber || "NOT SET"}`);
      console.log(`     Status: ${acc.connectionStatus}`);
      console.log(`     Active: ${acc.isActive}`);
      console.log(`     Webhook URL: ${acc.webhookUrl || "NOT SET"}`);
      console.log(`     Tenant: ${acc.tenant.name} (${acc.tenant.slug})`);
      console.log(`     AI Config: ${acc.aiConfig ? "EXISTS" : "NOT FOUND"}`);
      console.log("");
    });

    // 2. Check WhatsAppConversation
    console.log("\n2. Checking WhatsAppConversation...");
    const conversations = await prisma.whatsAppConversation.findMany({
      take: 5,
      orderBy: { lastMessageAt: "desc" },
    });

    console.log(`   Found ${conversations.length} conversation(s)`);
    conversations.forEach((conv) => {
      console.log(`   - Conversation ID: ${conv.id}`);
      console.log(`     Customer: ${conv.customerPhone}`);
      console.log(`     Type: ${conv.conversationType}`);
      console.log(`     Status: ${conv.status}`);
      console.log(`     Last Message: ${conv.lastMessageAt}`);
      console.log("");
    });

    // 3. Check WhatsAppMessage
    console.log("\n3. Checking WhatsAppMessage...");
    const messages = await prisma.whatsAppMessage.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
      include: {
        conversation: {
          select: { customerPhone: true },
        },
      },
    });

    console.log(`   Found ${messages.length} message(s)`);
    messages.forEach((msg) => {
      console.log(`   - Message ID: ${msg.id}`);
      console.log(`     Direction: ${msg.direction}`);
      console.log(`     From: ${msg.sender}`);
      console.log(`     Type: ${msg.senderType}`);
      console.log(`     Content: ${msg.content.substring(0, 50)}...`);
      console.log(`     Intent: ${msg.intent || "NOT SET"}`);
      console.log(`     Created: ${msg.createdAt}`);
      console.log("");
    });

    // 4. Check AI Config
    console.log("\n4. Checking WhatsAppAIConfig...");
    const aiConfigs = await prisma.whatsAppAIConfig.findMany({});

    console.log(`   Found ${aiConfigs.length} AI config(s)`);
    aiConfigs.forEach((cfg) => {
      console.log(`   - Config ID: ${cfg.id}`);
      console.log(`     Tenant ID: ${cfg.tenantId}`);
      console.log(`     AI Name: ${cfg.aiName}`);
      console.log(`     Auto Reply: ${cfg.autoReply}`);
      console.log(`     Customer Chat: ${cfg.customerChatEnabled}`);
      console.log(`     Staff Commands: ${cfg.staffCommandsEnabled}`);
      console.log("");
    });

    // 5. Webhook URL recommendation
    console.log("\n5. RECOMMENDATIONS:");

    const account = accounts[0];
    if (!account) {
      console.log("   ❌ NO AIMEOW ACCOUNT FOUND!");
      console.log("   → Please setup WhatsApp connection first");
    } else {
      if (!account.webhookUrl) {
        console.log("   ⚠️  WEBHOOK URL NOT SET!");
        console.log("   → This is likely the problem!");
        console.log("");
        console.log("   Webhook URL should be:");
        console.log(`   https://auto.lumiku.com/api/v1/webhooks/aimeow`);
        console.log("");
        console.log("   To fix:");
        console.log("   1. Go to Aimeow dashboard (https://meow.lumiku.com)");
        console.log(`   2. Find client: ${account.clientId}`);
        console.log("   3. Set webhook URL to: https://auto.lumiku.com/api/v1/webhooks/aimeow");
        console.log("   4. Or restart connection in AutoLumiku dashboard");
      } else {
        console.log(`   ✅ Webhook URL is set: ${account.webhookUrl}`);

        if (!account.isActive || account.connectionStatus !== "connected") {
          console.log("   ⚠️  WhatsApp is NOT CONNECTED!");
          console.log(`   Status: ${account.connectionStatus}`);
          console.log("   → Please scan QR code to connect WhatsApp");
        } else {
          console.log("   ✅ WhatsApp is connected!");

          if (messages.length === 0) {
            console.log("   ⚠️  NO MESSAGES in database!");
            console.log("   → Webhook might not be receiving messages");
            console.log("   → Check Aimeow webhook logs");
          }
        }
      }
    }

    console.log("\n=== END DEBUG ===");
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

debugWhatsAppAI();
