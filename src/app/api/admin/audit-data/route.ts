/**
 * Tenant Data Audit API
 * GET /api/admin/audit-data
 * Returns comprehensive data audit per tenant for super admin
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withSuperAdminAuth } from '@/lib/auth/middleware';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return withSuperAdminAuth(request, async () => {
    try {
      const tenants = await prisma.tenant.findMany({
        orderBy: { name: 'asc' }
      });

      const tenantsData = await Promise.all(
        tenants.map(async (tenant) => {
          // Vehicle stats
          const vehicleCount = await prisma.vehicle.count({ where: { tenantId: tenant.id } });
          const vehicleStats = await prisma.vehicle.groupBy({
            by: ['status'],
            where: { tenantId: tenant.id },
            _count: true
          });

          // Users
          const users = await prisma.user.findMany({
            where: { tenantId: tenant.id },
            select: { email: true, role: true, firstName: true, lastName: true }
          });

          // Leads
          const leadCount = await prisma.lead.count({ where: { tenantId: tenant.id } });

          // Subscription
          let subscription = null;
          if (tenant.subscriptionId) {
            subscription = await prisma.subscription.findUnique({
              where: { id: tenant.subscriptionId }
            });
          }

          // WhatsApp AI
          const waConfig = await prisma.whatsAppAIConfig.findUnique({
            where: { tenantId: tenant.id }
          });
          const waAccount = await prisma.aimeowAccount.findUnique({
            where: { tenantId: tenant.id }
          });
          const waConversations = await prisma.whatsAppConversation.count({
            where: { tenantId: tenant.id, status: { not: 'deleted' } }
          });
          const waMessages = await prisma.whatsAppMessage.count({
            where: { tenantId: tenant.id }
          });

          // Audit Logs
          const auditCount = await prisma.auditLog.count({
            where: { tenantId: tenant.id }
          });

          return {
            tenant: {
              id: tenant.id,
              name: tenant.name,
              slug: tenant.slug,
              status: tenant.status,
              domain: tenant.domain,
            },
            vehicles: {
              total: vehicleCount,
              byStatus: vehicleStats.reduce((acc, s) => {
                acc[s.status] = s._count;
                return acc;
              }, {} as Record<string, number>)
            },
            users: {
              total: users.length,
              list: users.map(u => ({
                email: u.email,
                role: u.role,
                name: `${u.firstName} ${u.lastName}`.trim()
              }))
            },
            leads: {
              total: leadCount
            },
            subscription: subscription ? {
              plan: subscription.plan,
              status: subscription.status,
              pricePerMonth: subscription.pricePerMonth,
              periodStart: subscription.currentPeriodStart,
              periodEnd: subscription.currentPeriodEnd,
            } : null,
            whatsappAI: {
              configured: !!waConfig,
              accountConnected: waAccount?.isActive || false,
              phoneNumber: waAccount?.phoneNumber || null,
              conversations: waConversations,
              messages: waMessages,
            },
            auditLogs: auditCount,
          };
        })
      );

      // Summary
      const summary = {
        totalTenants: tenants.length,
        totalVehicles: await prisma.vehicle.count(),
        totalUsers: await prisma.user.count(),
        totalLeads: await prisma.lead.count(),
        totalConversations: await prisma.whatsAppConversation.count({ where: { status: { not: 'deleted' } } }),
        totalMessages: await prisma.whatsAppMessage.count(),
      };

      return NextResponse.json({
        success: true,
        data: {
          tenants: tenantsData,
          summary,
          generatedAt: new Date().toISOString(),
        }
      });

    } catch (error) {
      console.error('Audit data API error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch audit data' },
        { status: 500 }
      );
    }
  });
}
