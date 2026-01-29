/**
 * WhatsApp AI Data Reset API
 * POST /api/v1/whatsapp-ai/reset-data?tenantId=xxx&confirm=true
 * 
 * Resets all WhatsApp AI data for a tenant:
 * - Deletes all WhatsApp Messages
 * - Deletes all WhatsApp Conversations
 * - Deletes all Staff Command Logs
 * 
 * This is useful for clearing test data before going live.
 * REQUIRES confirm=true query parameter to prevent accidental execution.
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

        if (confirm !== "true") {
            return NextResponse.json(
                {
                    success: false,
                    error: "Please add ?confirm=true to the URL to confirm data reset. This action is IRREVERSIBLE.",
                    warning: "This will delete ALL WhatsApp conversations, messages, and staff command logs for this tenant."
                },
                { status: 400 }
            );
        }

        // Verify tenant exists
        const tenant = await prisma.tenant.findUnique({
            where: { id: tenantId },
            select: { id: true, name: true, slug: true }
        });

        if (!tenant) {
            return NextResponse.json(
                { success: false, error: "Tenant not found" },
                { status: 404 }
            );
        }

        console.log(`[Reset Data] Starting data reset for tenant: ${tenant.name} (${tenantId})`);

        // Count existing data before deletion
        const [existingMessages, existingConversations, existingLogs, existingLeads] = await Promise.all([
            prisma.whatsAppMessage.count({ where: { tenantId } }),
            prisma.whatsAppConversation.count({ where: { tenantId } }),
            prisma.staffCommandLog.count({ where: { tenantId } }),
            prisma.lead.count({ where: { tenantId, source: 'whatsapp_auto' } }),
        ]);

        console.log(`[Reset Data] Found: ${existingMessages} messages, ${existingConversations} conversations, ${existingLogs} command logs, ${existingLeads} auto-leads`);

        // Delete in order (messages first due to foreign key constraints)
        const [deletedMessages, deletedConversations, deletedLogs, deletedLeads] = await prisma.$transaction([
            // 1. Delete all WhatsApp Messages
            prisma.whatsAppMessage.deleteMany({
                where: { tenantId }
            }),

            // 2. Delete all WhatsApp Conversations
            prisma.whatsAppConversation.deleteMany({
                where: { tenantId }
            }),

            // 3. Delete all Staff Command Logs
            prisma.staffCommandLog.deleteMany({
                where: { tenantId }
            }),

            // 4. Delete all WhatsApp Auto Leads
            prisma.lead.deleteMany({
                where: { tenantId, source: 'whatsapp_auto' }
            }),
        ]);

        console.log(`[Reset Data] ✅ Deleted: ${deletedMessages.count} messages, ${deletedConversations.count} conversations, ${deletedLogs.count} command logs, ${deletedLeads.count} auto-leads`);

        return NextResponse.json({
            success: true,
            message: `Data reset completed for tenant: ${tenant.name}`,
            details: {
                tenant: {
                    id: tenant.id,
                    name: tenant.name,
                    slug: tenant.slug
                },
                deleted: {
                    messages: deletedMessages.count,
                    conversations: deletedConversations.count,
                    commandLogs: deletedLogs.count,
                    leads: deletedLeads.count,
                },
                timestamp: new Date().toISOString()
            }
        });

    } catch (error: any) {
        console.error("[Reset Data] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: "Failed to reset data",
                details: error.message,
            },
            { status: 500 }
        );
    }
}

// Also support GET for checking current data counts (safe, no deletion)
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

        const tenant = await prisma.tenant.findUnique({
            where: { id: tenantId },
            select: { id: true, name: true, slug: true }
        });

        if (!tenant) {
            return NextResponse.json(
                { success: false, error: "Tenant not found" },
                { status: 404 }
            );
        }

        // Count existing data
        const [messages, conversations, commandLogs] = await Promise.all([
            prisma.whatsAppMessage.count({ where: { tenantId } }),
            prisma.whatsAppConversation.count({ where: { tenantId } }),
            prisma.staffCommandLog.count({ where: { tenantId } }),
        ]);

        return NextResponse.json({
            success: true,
            message: "Current data counts (use POST with ?confirm=true to reset)",
            data: {
                tenant: {
                    id: tenant.id,
                    name: tenant.name,
                    slug: tenant.slug
                },
                counts: {
                    messages,
                    conversations,
                    commandLogs,
                }
            }
        });

    } catch (error: any) {
        console.error("[Reset Data] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: "Failed to get data counts",
                details: error.message,
            },
            { status: 500 }
        );
    }
}
