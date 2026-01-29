/**
 * Tenant Data Cleanup API
 * POST /api/admin/cleanup
 * Permanently delete test/garbage data for a tenant
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withSuperAdminAuth } from '@/lib/auth/middleware';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  return withSuperAdminAuth(request, async () => {
    try {
      const body = await request.json();
      const { tenantId, cleanupOptions } = body;

      if (!tenantId) {
        return NextResponse.json(
          { success: false, error: 'tenantId is required' },
          { status: 400 }
        );
      }

      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId }
      });

      if (!tenant) {
        return NextResponse.json(
          { success: false, error: 'Tenant not found' },
          { status: 404 }
        );
      }

      const results: Record<string, any> = {
        tenant: tenant.name,
        tenantId: tenant.id,
        deletedAt: new Date().toISOString(),
        operations: []
      };

      // 1. Delete vehicles with DELETED status
      if (cleanupOptions?.vehicles !== false) {
        const deletedVehicles = await prisma.vehicle.deleteMany({
          where: {
            tenantId,
            status: 'DELETED'
          }
        });
        results.operations.push({
          type: 'vehicles_deleted',
          count: deletedVehicles.count
        });
      }

      // 2. Delete all WhatsApp messages
      if (cleanupOptions?.whatsappMessages !== false) {
        const deletedMessages = await prisma.whatsAppMessage.deleteMany({
          where: { tenantId }
        });
        results.operations.push({
          type: 'whatsapp_messages_deleted',
          count: deletedMessages.count
        });
      }

      // 3. Delete all WhatsApp conversations
      if (cleanupOptions?.whatsappConversations !== false) {
        const deletedConversations = await prisma.whatsAppConversation.deleteMany({
          where: { tenantId }
        });
        results.operations.push({
          type: 'whatsapp_conversations_deleted',
          count: deletedConversations.count
        });
      }

      // 4. Delete specific leads
      // Targeted: Junk leads (no name, no interest)
      if (cleanupOptions?.garbageLeads === true) {
        const phonePattern = /^(62|08|\+62|0)\d{8,13}$/;
        // We'll use a raw query or multiple conditions for precision since regex in Prisma is complex
        const deletedGarbageCount = await prisma.lead.deleteMany({
          where: {
            tenantId,
            source: 'whatsapp_auto',
            OR: [
              { name: 'Unknown' },
              { name: 'Customer Baru' },
              { name: 'Customer' },
              { interestedIn: null }
            ]
          }
        });
        results.operations.push({
          type: 'garbage_leads_deleted',
          count: deletedGarbageCount.count
        });
      }

      // Targeted: Staff leads
      if (cleanupOptions?.staffLeads === true) {
        // Fetch all staff phones
        const staff = await prisma.user.findMany({
          where: {
            OR: [{ tenantId }, { tenantId: null }],
            phone: { not: null }
          },
          select: { phone: true }
        });

        const staffPhones = staff.map(s => s.phone?.replace(/\D/g, '')).filter(Boolean) as string[];
        const staffPhonesWith0 = staffPhones.map(p => p.startsWith('62') ? '0' + p.substring(2) : p);

        const deletedStaffLeads = await prisma.lead.deleteMany({
          where: {
            tenantId,
            phone: { in: [...staffPhones, ...staffPhonesWith0] }
          }
        });

        results.operations.push({
          type: 'staff_leads_deleted',
          count: deletedStaffLeads.count
        });
      }

      // Targeted: Orphaned Leads (WhatsApp leads with no conversation)
      if (cleanupOptions?.orphanedLeads === true) {
        const orphanLeads = await prisma.lead.findMany({
          where: { tenantId, source: 'whatsapp_auto' },
          select: { id: true, phone: true }
        });

        const conversations = await prisma.whatsAppConversation.findMany({
          where: { tenantId },
          select: { customerPhone: true }
        });

        const convPhones = new Set(conversations.map(c => c.customerPhone.replace(/\D/g, '')));
        const orphanIds = orphanLeads
          .filter(l => !convPhones.has(l.phone.replace(/\D/g, '')))
          .map(l => l.id);

        const deletedOrphanCount = await prisma.lead.deleteMany({
          where: { id: { in: orphanIds } }
        });

        results.operations.push({
          type: 'orphaned_leads_deleted',
          count: deletedOrphanCount.count
        });
      }

      // 4. Delete ALL leads (Extreme)
      if (cleanupOptions?.leads === true) {
        const deletedLeads = await prisma.lead.deleteMany({
          where: { tenantId }
        });
        results.operations.push({
          type: 'leads_deleted',
          count: deletedLeads.count
        });
      }

      // 5. Delete staff command logs
      if (cleanupOptions?.staffCommandLogs !== false) {
        const deletedStaffLogs = await prisma.staffCommandLog.deleteMany({
          where: { tenantId }
        });
        results.operations.push({
          type: 'staff_command_logs_deleted',
          count: deletedStaffLogs.count
        });
      }

      // Log to audit
      console.log(`[Cleanup] Tenant ${tenant.name} (${tenantId}) cleanup completed:`, results);

      return NextResponse.json({
        success: true,
        data: results
      });

    } catch (error) {
      console.error('Cleanup API error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to cleanup tenant data' },
        { status: 500 }
      );
    }
  });
}

// GET - Preview what will be deleted
export async function GET(request: NextRequest) {
  return withSuperAdminAuth(request, async () => {
    try {
      const { searchParams } = new URL(request.url);
      const tenantId = searchParams.get('tenantId');

      if (!tenantId) {
        return NextResponse.json(
          { success: false, error: 'tenantId is required' },
          { status: 400 }
        );
      }

      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId }
      });

      if (!tenant) {
        return NextResponse.json(
          { success: false, error: 'Tenant not found' },
          { status: 404 }
        );
      }

      // Preview counts
      const deletedVehiclesCount = await prisma.vehicle.count({
        where: { tenantId, status: 'DELETED' }
      });

      const messagesCount = await prisma.whatsAppMessage.count({
        where: { tenantId }
      });

      const conversationsCount = await prisma.whatsAppConversation.count({
        where: { tenantId }
      });

      const leadsCount = await prisma.lead.count({
        where: { tenantId }
      });

      const staffCommandLogsCount = await prisma.staffCommandLog.count({
        where: { tenantId }
      });

      return NextResponse.json({
        success: true,
        data: {
          tenant: tenant.name,
          tenantId: tenant.id,
          preview: {
            vehicles_deleted_status: deletedVehiclesCount,
            whatsapp_messages: messagesCount,
            whatsapp_conversations: conversationsCount,
            leads: leadsCount,
            staff_command_logs: staffCommandLogsCount,
          },
          warning: 'Use POST to permanently delete this data. This action cannot be undone!'
        }
      });

    } catch (error) {
      console.error('Cleanup preview API error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to preview cleanup' },
        { status: 500 }
      );
    }
  });
}
