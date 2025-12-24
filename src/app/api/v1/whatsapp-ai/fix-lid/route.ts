/**
 * Fix LID Data API
 * POST /api/v1/whatsapp-ai/fix-lid?tenantId=xxx
 *
 * Fixes existing conversations that have LID (Linked ID) stored in customerPhone
 * by resolving to real phone numbers from contextData.verifiedStaffPhone
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';

// Helper to check if a number looks like a LID (not a real phone)
function isLIDNumber(num: string): boolean {
  if (!num) return false;
  const digits = num.replace(/\D/g, "");
  if (digits.length < 10) return false;

  // LID patterns:
  // 1. Very long numbers (16+ digits)
  if (digits.length >= 16) return true;

  // 2. Numbers starting with 100/101/102 that are 14+ digits
  if (digits.length >= 14 && (digits.startsWith("100") || digits.startsWith("101") || digits.startsWith("102"))) return true;

  // 3. Indonesian numbers that are too long (normal is 10-13 digits after 62)
  if (digits.startsWith("62") && digits.length > 14) return true;

  // 4. Numbers starting with 1 that are too long (not toll-free)
  if (digits.startsWith("1") && digits.length > 11 && !digits.startsWith("1800")) return true;

  // 5. Contains @lid suffix
  if (num.includes("@lid")) return true;

  return false;
}

// Normalize phone for comparison
function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "").replace(/^0+/, "");
}

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get("tenantId");
    const dryRun = searchParams.get("dryRun") === "true";

    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: "Missing required parameter: tenantId" },
        { status: 400 }
      );
    }

    console.log(`[Fix LID] Starting LID fix for tenant: ${tenantId}, dryRun: ${dryRun}`);

    // Get all conversations for this tenant
    const allConversations = await prisma.whatsAppConversation.findMany({
      where: { tenantId },
      orderBy: { lastMessageAt: "desc" },
    });

    console.log(`[Fix LID] Found ${allConversations.length} total conversations`);

    const results = {
      total: allConversations.length,
      lidConversations: 0,
      fixed: 0,
      skipped: 0, // LID without real phone available (will be auto-detected by Aimeow)
      alreadyReal: 0,
      details: [] as Array<{
        id: string;
        oldPhone: string;
        newPhone: string | null;
        status: string;
        verifiedStaffPhone: string | null;
      }>,
    };

    for (const conv of allConversations) {
      const customerPhone = conv.customerPhone;
      const contextData = conv.contextData as Record<string, any> | null;

      // Check if customerPhone is a LID
      if (!isLIDNumber(customerPhone)) {
        results.alreadyReal++;
        continue;
      }

      results.lidConversations++;

      // Try to get real phone from contextData
      const verifiedStaffPhone = contextData?.verifiedStaffPhone;
      const realPhone = verifiedStaffPhone || contextData?.realPhone || contextData?.actualPhone;

      // Check if realPhone is also a LID (can't fix this one)
      if (!realPhone || isLIDNumber(realPhone)) {
        results.skipped++;
        results.details.push({
          id: conv.id,
          oldPhone: customerPhone,
          newPhone: null,
          status: "skipped_no_real_phone",
          verifiedStaffPhone: verifiedStaffPhone || null,
        });
        // Skip - Aimeow will detect real phone automatically on next message
        continue;
      }

      // We have a real phone - update the conversation
      results.details.push({
        id: conv.id,
        oldPhone: customerPhone,
        newPhone: realPhone,
        status: dryRun ? "would_fix" : "fixed",
        verifiedStaffPhone: verifiedStaffPhone || null,
      });

      if (!dryRun) {
        await prisma.whatsAppConversation.update({
          where: { id: conv.id },
          data: {
            customerPhone: realPhone,
            contextData: {
              ...contextData,
              originalLID: customerPhone,
              phoneFixedAt: new Date().toISOString(),
              phoneFixedFrom: "fix-lid-api",
              pendingPhoneResolution: false,
            },
          },
        });
        results.fixed++;
      }
    }

    console.log(`[Fix LID] Complete:`, {
      total: results.total,
      lidConversations: results.lidConversations,
      fixed: results.fixed,
      skipped: results.skipped,
      alreadyReal: results.alreadyReal,
    });

    return NextResponse.json({
      success: true,
      dryRun,
      data: results,
    });
  } catch (error: any) {
    console.error("[Fix LID] Error:", error);
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

// GET to check current LID status
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

    // Get all conversations for this tenant
    const allConversations = await prisma.whatsAppConversation.findMany({
      where: {
        tenantId,
        status: { not: "deleted" },
      },
      select: {
        id: true,
        customerPhone: true,
        isStaff: true,
        conversationType: true,
        status: true,
        contextData: true,
        lastMessageAt: true,
      },
      orderBy: { lastMessageAt: "desc" },
    });

    const lidConversations = allConversations.filter(conv => isLIDNumber(conv.customerPhone));
    const realConversations = allConversations.filter(conv => !isLIDNumber(conv.customerPhone));

    // Check which LID conversations have real phone available
    const lidWithRealPhone = lidConversations.filter(conv => {
      const ctx = conv.contextData as Record<string, any> | null;
      const realPhone = ctx?.verifiedStaffPhone || ctx?.realPhone || ctx?.actualPhone;
      return realPhone && !isLIDNumber(realPhone);
    });

    const lidWithoutRealPhone = lidConversations.filter(conv => {
      const ctx = conv.contextData as Record<string, any> | null;
      const realPhone = ctx?.verifiedStaffPhone || ctx?.realPhone || ctx?.actualPhone;
      return !realPhone || isLIDNumber(realPhone);
    });

    return NextResponse.json({
      success: true,
      data: {
        total: allConversations.length,
        realPhoneConversations: realConversations.length,
        lidConversations: lidConversations.length,
        lidWithRealPhoneAvailable: lidWithRealPhone.length,
        lidWithoutRealPhone: lidWithoutRealPhone.length,
        canFix: lidWithRealPhone.length,
        willSkip: lidWithoutRealPhone.length, // Will be auto-detected by Aimeow on next message
        details: {
          lidWithRealPhone: lidWithRealPhone.map(c => ({
            id: c.id,
            customerPhone: c.customerPhone,
            verifiedStaffPhone: (c.contextData as any)?.verifiedStaffPhone,
            isStaff: c.isStaff,
          })),
          lidWithoutRealPhone: lidWithoutRealPhone.map(c => ({
            id: c.id,
            customerPhone: c.customerPhone,
            isStaff: c.isStaff,
            conversationType: c.conversationType,
          })),
        },
      },
    });
  } catch (error: any) {
    console.error("[Fix LID] Error:", error);
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
