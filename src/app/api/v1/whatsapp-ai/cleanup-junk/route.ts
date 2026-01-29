import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const tenantId = searchParams.get("tenantId");
        const secret = searchParams.get("secret");

        // Emergency secret check
        if (secret !== "clean123") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        if (!tenantId) {
            return NextResponse.json({ error: "Missing tenantId" }, { status: 400 });
        }

        console.log(`[Emergency Cleanup] Starting for tenant: ${tenantId}`);

        // 1. Find all staff phone numbers and names to identify staff leads
        const staff = await prisma.user.findMany({
            where: {
                OR: [{ tenantId }, { tenantId: null }],
                role: { in: ['OWNER', 'ADMIN', 'MANAGER', 'SALES', 'STAFF'] }
            },
            select: { phone: true, firstName: true, lastName: true }
        });

        const staffPhones = staff.map(s => s.phone?.replace(/\D/g, '')).filter(Boolean) as string[];
        const staffNames = staff.map(s => `${s.firstName} ${s.lastName}`);

        // 2. Perform targeted deletions
        const deletedCount = await prisma.lead.deleteMany({
            where: {
                tenantId,
                OR: [
                    // Staff Leads
                    { phone: { in: staffPhones } },
                    { whatsappNumber: { in: staffPhones } },
                    { name: { in: staffNames } },
                    // Junk Names
                    { name: 'Unknown' },
                    { name: 'Customer Baru' },
                    { name: 'Customer' },
                    { name: 'Kak' },
                    // Number-only names (regex approx)
                    { name: { contains: '628' } },
                    { name: { contains: '08' } },
                    // Leads with no interest (placeholder N/A)
                    { interestedIn: null },
                    { interestedIn: '' }
                ]
            }
        });

        // 3. Delete orphaned leads (no conversation)
        const whatsappLeads = await prisma.lead.findMany({
            where: { tenantId, source: 'whatsapp_auto' },
            select: { id: true, phone: true }
        });

        const conversations = await prisma.whatsAppConversation.findMany({
            where: { tenantId },
            select: { customerPhone: true }
        });

        const convPhones = new Set(conversations.map(c => c.customerPhone.replace(/\D/g, '')));
        const orphanIds = whatsappLeads
            .filter(l => !convPhones.has(l.phone.replace(/\D/g, '')))
            .map(l => l.id);

        let orphanedDeleted = 0;
        if (orphanIds.length > 0) {
            const result = await prisma.lead.deleteMany({
                where: { id: { in: orphanIds } }
            });
            orphanedDeleted = result.count;
        }

        return NextResponse.json({
            success: true,
            message: "Emergency cleanup completed successfully",
            details: {
                totalDeleted: deletedCount.count + orphanedDeleted,
                targetedDeleted: deletedCount.count,
                orphanedDeleted: orphanedDeleted
            }
        });

    } catch (error: any) {
        console.error("[Emergency Cleanup] Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
