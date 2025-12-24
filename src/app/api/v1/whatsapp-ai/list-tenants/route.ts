/**
 * List Tenants API (Debug)
 * GET /api/v1/whatsapp-ai/list-tenants
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Get all tenants with WhatsApp conversation count
    const tenants = await prisma.tenant.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
      },
    });

    // Get conversation counts per tenant (exclude deleted)
    const convCounts = await prisma.whatsAppConversation.groupBy({
      by: ['tenantId'],
      where: { status: { not: "deleted" } },
      _count: true,
    });

    const countMap = new Map(convCounts.map(c => [c.tenantId, c._count]));

    const tenantsWithCounts = tenants.map(t => ({
      ...t,
      conversationCount: countMap.get(t.id) || 0,
    }));

    return NextResponse.json({
      success: true,
      data: tenantsWithCounts,
    });
  } catch (error: any) {
    console.error("[List Tenants] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
