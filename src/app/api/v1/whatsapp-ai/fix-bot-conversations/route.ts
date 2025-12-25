/**
 * Fix Bot Conversations API
 * POST /api/v1/whatsapp-ai/fix-bot-conversations
 *
 * Cleans up any conversations where the bot phone was incorrectly marked as staff.
 * The bot phone should NEVER be treated as staff - always as customer.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const results: Array<{
      tenant: string;
      botPhone: string;
      conversationsFixed: number;
      conversationIds: string[];
    }> = [];

    // Get all active Aimeow accounts (these are the bot phones)
    const aimeowAccounts = await prisma.aimeowAccount.findMany({
      where: { isActive: true },
      select: {
        id: true,
        tenantId: true,
        phoneNumber: true,
        tenant: {
          select: { name: true, slug: true },
        },
      },
    });

    for (const account of aimeowAccounts) {
      if (!account.phoneNumber) continue;

      // Find any conversations where:
      // 1. customerPhone matches bot phone (exact or normalized)
      // 2. isStaff = true (incorrectly marked)
      const botPhoneVariants = [
        account.phoneNumber,
        account.phoneNumber.replace(/^62/, "0"), // 0xxx format
        `+${account.phoneNumber}`, // +62xxx format
      ];

      const incorrectConversations = await prisma.whatsAppConversation.findMany({
        where: {
          tenantId: account.tenantId,
          customerPhone: { in: botPhoneVariants },
          isStaff: true,
        },
        select: { id: true, customerPhone: true },
      });

      if (incorrectConversations.length > 0) {
        // Fix these conversations - set isStaff to false
        await prisma.whatsAppConversation.updateMany({
          where: {
            id: { in: incorrectConversations.map(c => c.id) },
          },
          data: {
            isStaff: false,
            conversationType: "customer",
          },
        });

        results.push({
          tenant: account.tenant?.name || account.tenantId,
          botPhone: account.phoneNumber,
          conversationsFixed: incorrectConversations.length,
          conversationIds: incorrectConversations.map(c => c.id),
        });
      } else {
        results.push({
          tenant: account.tenant?.name || account.tenantId,
          botPhone: account.phoneNumber,
          conversationsFixed: 0,
          conversationIds: [],
        });
      }
    }

    const totalFixed = results.reduce((sum, r) => sum + r.conversationsFixed, 0);

    return NextResponse.json({
      success: true,
      message: `Fixed ${totalFixed} conversation(s) where bot phone was incorrectly marked as staff`,
      details: results,
    });

  } catch (error: any) {
    console.error("[Fix Bot Conversations] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}

// GET endpoint to check status without fixing
export async function GET(request: NextRequest) {
  try {
    const results: Array<{
      tenant: string;
      botPhone: string;
      incorrectConversations: number;
    }> = [];

    const aimeowAccounts = await prisma.aimeowAccount.findMany({
      where: { isActive: true },
      select: {
        id: true,
        tenantId: true,
        phoneNumber: true,
        tenant: {
          select: { name: true, slug: true },
        },
      },
    });

    for (const account of aimeowAccounts) {
      if (!account.phoneNumber) continue;

      const botPhoneVariants = [
        account.phoneNumber,
        account.phoneNumber.replace(/^62/, "0"),
        `+${account.phoneNumber}`,
      ];

      const count = await prisma.whatsAppConversation.count({
        where: {
          tenantId: account.tenantId,
          customerPhone: { in: botPhoneVariants },
          isStaff: true,
        },
      });

      results.push({
        tenant: account.tenant?.name || account.tenantId,
        botPhone: account.phoneNumber,
        incorrectConversations: count,
      });
    }

    const totalIncorrect = results.reduce((sum, r) => sum + r.incorrectConversations, 0);

    return NextResponse.json({
      success: true,
      message: totalIncorrect > 0
        ? `Found ${totalIncorrect} conversation(s) with bot phone incorrectly marked as staff. Use POST to fix.`
        : "No incorrect conversations found. All bot phones are correctly categorized as customer.",
      details: results,
      instructions: totalIncorrect > 0
        ? "Send POST request to this endpoint to fix the conversations"
        : null,
    });

  } catch (error: any) {
    console.error("[Fix Bot Conversations] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}
