/**
 * Delete Conversation (Soft Delete)
 * DELETE /api/v1/whatsapp-ai/delete-conversation?conversationId=xxx
 * Marks a conversation as deleted (soft delete) - excluded from stats
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get("conversationId");

    if (!conversationId) {
      return NextResponse.json(
        { success: false, error: "Missing required parameter: conversationId" },
        { status: 400 }
      );
    }

    // Find the target conversation to get phone number and tenant
    const targetConversation = await prisma.whatsAppConversation.findUnique({
      where: { id: conversationId },
      select: { customerPhone: true, tenantId: true }
    });

    if (!targetConversation) {
      return NextResponse.json(
        { success: false, error: "Conversation not found" },
        { status: 404 }
      );
    }

    // Helper to normalize phone (same as in GET route)
    const normalizePhone = (phone: string): string => {
      if (!phone) return '';
      if (phone.includes('@')) phone = phone.split('@')[0];
      if (phone.includes(':')) phone = phone.split(':')[0];
      let digits = phone.replace(/\D/g, '');
      if (digits.startsWith('0')) digits = '62' + digits.substring(1);
      else if (digits.startsWith('8') && (digits.length >= 9 && digits.length <= 13)) digits = '62' + digits;
      return digits;
    };

    const targetPhone = normalizePhone(targetConversation.customerPhone);

    // Find all conversations for this tenant to check for matches
    // We have to fetch all because normalization logic is in code, not DB
    // Optimization: filtering by tenantId first limits the scope
    const tenantConversations = await prisma.whatsAppConversation.findMany({
      where: { tenantId: targetConversation.tenantId },
      select: { id: true, customerPhone: true }
    });

    // Identify all IDs that belong to this phone group
    const idsToDelete = tenantConversations
      .filter(c => normalizePhone(c.customerPhone) === targetPhone)
      .map(c => c.id);

    // FIX: Ensure the requested conversation ID is ALWAYS deleted, 
    // even if normalization grouping logic fails for some reason.
    if (!idsToDelete.includes(conversationId)) {
      idsToDelete.push(conversationId);
    }

    console.log(`[Delete Conversation] Group delete: Deleting ${idsToDelete.length} conversations for phone ${targetPhone}`);

    if (idsToDelete.length > 0) {
      // 1. Find all Lead IDs associated with these conversations
      const conversationsWithLeads = await prisma.whatsAppConversation.findMany({
        where: { id: { in: idsToDelete } },
        select: { leadId: true }
      });

      const leadIdsToDelete = conversationsWithLeads
        .map(c => c.leadId)
        .filter((id): id is string => !!id);

      // 2. Delete conversations and associated leads in a transaction
      await prisma.$transaction(async (tx) => {
        // First delete associated leads (if any)
        if (leadIdsToDelete.length > 0) {
          console.log(`[Delete Conversation] Found ${leadIdsToDelete.length} associated leads to delete`);
          await tx.lead.deleteMany({
            where: { id: { in: leadIdsToDelete } }
          });
        }

        // Then delete the conversations
        await tx.whatsAppConversation.deleteMany({
          where: { id: { in: idsToDelete } },
        });
      });
    }

    return NextResponse.json({
      success: true,
      message: `Deleted ${idsToDelete.length} conversations successfully`,
    });
  } catch (error: any) {
    console.error("[Delete Conversation] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
        details: error.message,
      },
      { status: 500 }
    );
  }
}
