/**
 * WhatsApp AI Conversations API
 * GET /api/v1/whatsapp-ai/conversations?tenantId=xxx
 * Returns list of conversations dengan stats
 *
 * Auto-validates staff status against registered users
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';

/**
 * Normalize phone number for comparison
 */
function normalizePhone(phone: string): string {
  if (!phone) return '';

  // Handle JID format (e.g., "6281234567890@s.whatsapp.net")
  if (phone.includes('@')) {
    phone = phone.split('@')[0];
  }

  // Handle device suffix (e.g., "6281234567890:17")
  if (phone.includes(':')) {
    phone = phone.split(':')[0];
  }

  // Remove all non-digits
  let digits = phone.replace(/\D/g, '');

  // Convert 0xxx or 8xxx (Indonesian) to 62xxx
  if (digits.startsWith('0')) {
    digits = '62' + digits.substring(1);
  } else if (digits.startsWith('8') && (digits.length >= 9 && digits.length <= 13)) {
    digits = '62' + digits;
  }

  return digits;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get("tenantId");

    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: "Missing required parameter: tenantId" },
        { status: 400 }
      );
    }

    // Get all staff users with phone numbers for validation
    const staffUsers = await prisma.user.findMany({
      where: {
        tenantId,
        role: { in: ['ADMIN', 'MANAGER', 'SALES', 'STAFF', 'OWNER', 'SUPER_ADMIN'] },
        phone: { not: null },
      },
      select: { phone: true },
    });

    // Build staff phone lookup set
    const staffPhoneSet = new Set<string>();
    for (const user of staffUsers) {
      if (user.phone) {
        staffPhoneSet.add(normalizePhone(user.phone));
      }
    }

    // Get conversations dengan message count
    // Exclude deleted conversations from the list (soft-deleted)
    const conversations = await prisma.whatsAppConversation.findMany({
      where: {
        tenantId,
        status: { not: "deleted" }, // Exclude deleted conversations
      },
      include: {
        _count: {
          select: { messages: true },
        },
      },
      orderBy: { lastMessageAt: "desc" },
    });

    // Auto-validate and fix stale staff flags
    const staleStaffConversations: string[] = [];
    const promoteToStaffConversations: string[] = [];

    for (const conv of conversations) {
      const normalizedPhone = normalizePhone(conv.customerPhone);
      const isCurrentlyStaff = staffPhoneSet.has(normalizedPhone);

      if (conv.isStaff && !isCurrentlyStaff) {
        // Conversation marked as staff but user is no longer staff
        staleStaffConversations.push(conv.id);
      } else if (!conv.isStaff && isCurrentlyStaff) {
        // User is now staff (Owner/Admin/etc) but conversation not marked yet
        promoteToStaffConversations.push(conv.id);
      }
    }

    // Update stale staff conversations in background
    if (staleStaffConversations.length > 0) {
      console.log(`[Conversations API] Auto-fixing ${staleStaffConversations.length} stale staff conversations`);
      prisma.whatsAppConversation.updateMany({
        where: { id: { in: staleStaffConversations } },
        data: { isStaff: false, conversationType: 'customer' },
      }).catch((err) => {
        console.error('[Conversations API] Error fixing stale staff flags:', err);
      });
    }

    // Auto-promote new staff conversations in background
    if (promoteToStaffConversations.length > 0) {
      console.log(`[Conversations API] Auto-promoting ${promoteToStaffConversations.length} conversations to staff status`);
      prisma.whatsAppConversation.updateMany({
        where: { id: { in: promoteToStaffConversations } },
        data: { isStaff: true, conversationType: 'staff' },
      }).catch((err) => {
        console.error('[Conversations API] Error promoting staff flags:', err);
      });
    }

    // Helper to check if a number looks like a LID (not a real phone)
    const isLIDNumber = (num: string): boolean => {
      if (!num) return false;
      const digits = num.replace(/\D/g, "");
      if (digits.length < 10) return false;
      // LID patterns: very long numbers, or numbers starting with 100/101/102
      if (digits.length >= 16) return true;
      if (digits.length >= 14 && (digits.startsWith("100") || digits.startsWith("101") || digits.startsWith("102"))) return true;
      // Numbers that are too long for valid country codes
      if (digits.startsWith("62") && digits.length > 14) return true;
      if (digits.startsWith("1") && digits.length > 11 && !digits.startsWith("1800")) return true;
      return false;
    };

    // Group conversations by normalized phone number
    // Show only 1 entry per phone, with combined data
    const phoneGroupMap = new Map<string, {
      id: string;
      allIds: string[];
      customerPhone: string;
      originalPhone: string;
      customerName: string | null;
      isStaff: boolean;
      conversationType: string | null;
      lastIntent: string | null;
      status: string;
      lastMessageAt: Date;
      escalatedTo: string | null;
      isEscalated: boolean;
      messageCount: number;
      hasRealPhone: boolean;
    }>();

    for (const conv of conversations) {
      const contextData = conv.contextData as Record<string, any> | null;
      let displayPhone = conv.customerPhone;
      let hasRealPhone = true;

      // Check if customerPhone is a LID
      if (isLIDNumber(conv.customerPhone)) {
        // Try to get real phone from contextData
        const realPhone = contextData?.verifiedStaffPhone || contextData?.realPhone || contextData?.actualPhone;
        if (realPhone && !isLIDNumber(realPhone)) {
          displayPhone = realPhone;
        } else {
          // No real phone available - skip
          hasRealPhone = false;
        }
      }

      if (!hasRealPhone) continue;

      // Normalize for grouping
      const normalizedPhone = normalizePhone(displayPhone);
      if (!normalizedPhone) continue;

      // Check actual staff status against registered users
      const isCurrentlyStaff = staffPhoneSet.has(normalizedPhone);
      const isStale = conv.isStaff && !isCurrentlyStaff;
      const correctedIsStaff = isStale ? false : conv.isStaff;
      const correctedType = isStale ? 'customer' : conv.conversationType;

      // Check if this conversation is escalated
      const isEscalated = conv.status === 'escalated' || !!conv.escalatedTo;

      const existing = phoneGroupMap.get(normalizedPhone);

      if (!existing) {
        // First conversation for this phone
        phoneGroupMap.set(normalizedPhone, {
          id: conv.id,
          allIds: [conv.id],
          customerPhone: displayPhone,
          originalPhone: conv.customerPhone,
          customerName: conv.customerName,
          isStaff: correctedIsStaff,
          conversationType: correctedType,
          lastIntent: conv.lastIntent,
          status: conv.status,
          lastMessageAt: conv.lastMessageAt,
          escalatedTo: conv.escalatedTo,
          isEscalated,
          messageCount: conv._count.messages,
          hasRealPhone: true,
        });
      } else {
        // Merge with existing - keep most recent data
        existing.allIds.push(conv.id);
        existing.messageCount += conv._count.messages;

        // If ANY conversation is escalated, mark as escalated
        if (isEscalated) {
          existing.isEscalated = true;
          existing.escalatedTo = existing.escalatedTo || conv.escalatedTo;
        }

        // If this conversation is more recent, update primary data
        if (conv.lastMessageAt > existing.lastMessageAt) {
          existing.id = conv.id;
          existing.lastMessageAt = conv.lastMessageAt;
          existing.lastIntent = conv.lastIntent;
          existing.status = conv.status;
          existing.customerName = conv.customerName || existing.customerName;
        }

        // Use corrected staff status if any conversation has it
        if (correctedIsStaff) {
          existing.isStaff = true;
          existing.conversationType = 'staff';
        }
      }
    }

    // Convert map to array and format response
    const formattedConversations = Array.from(phoneGroupMap.values())
      .map((group) => ({
        id: group.id,
        allConversationIds: group.allIds, // For reference if needed
        customerPhone: group.customerPhone,
        originalPhone: group.originalPhone,
        customerName: group.customerName,
        isStaff: group.isStaff,
        conversationType: group.conversationType,
        lastIntent: group.lastIntent,
        status: group.isEscalated ? 'escalated' : group.status,
        lastMessageAt: group.lastMessageAt.toISOString(),
        escalatedTo: group.escalatedTo,
        isEscalated: group.isEscalated, // Explicit flag for UI
        messageCount: group.messageCount,
        unreadCount: 0, // TODO: Implement unread tracking
        hasRealPhone: group.hasRealPhone,
      }))
      // Sort by lastMessageAt descending
      .sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());

    return NextResponse.json({
      success: true,
      data: formattedConversations,
    });
  } catch (error: any) {
    console.error("[Conversations API] Error:", error);
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
