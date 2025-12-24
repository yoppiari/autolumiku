/**
 * Delete All Tenant Conversations API
 * POST /api/v1/whatsapp-ai/delete-tenant-conversations?tenantId=xxx
 *
 * Soft-deletes all conversations for a tenant (sets status to "deleted")
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get("tenantId");
    const confirm = searchParams.get("confirm");

    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: "Missing required parameter: tenantId" },
        { status: 400 }
      );
    }

    // Get tenant info
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, name: true, slug: true },
    });

    if (!tenant) {
      return NextResponse.json(
        { success: false, error: "Tenant not found" },
        { status: 404 }
      );
    }

    // Count conversations
    const count = await prisma.whatsAppConversation.count({
      where: { tenantId, status: { not: "deleted" } },
    });

    if (confirm !== "yes") {
      return NextResponse.json({
        success: true,
        warning: "This will soft-delete all conversations. Add &confirm=yes to proceed.",
        data: {
          tenant: tenant,
          conversationsToDelete: count,
        },
      });
    }

    // Soft-delete all conversations
    const result = await prisma.whatsAppConversation.updateMany({
      where: { tenantId },
      data: {
        status: "deleted",
      },
    });

    console.log(`[Delete Tenant Conversations] Deleted ${result.count} conversations for tenant ${tenant.name}`);

    return NextResponse.json({
      success: true,
      data: {
        tenant: tenant,
        deletedCount: result.count,
      },
    });
  } catch (error: any) {
    console.error("[Delete Tenant Conversations] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
