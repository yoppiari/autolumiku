/**
 * Tenant Data Investigation API
 * GET /api/admin/audit-data/investigate?tenantId=xxx
 * Deep investigation of tenant data issues
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withSuperAdminAuth } from '@/lib/auth/middleware';

export const dynamic = 'force-dynamic';

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

      // 1. Investigate Vehicles
      const vehicles = await prisma.vehicle.findMany({
        where: { tenantId },
        select: {
          id: true,
          make: true,
          model: true,
          year: true,
          status: true,
          price: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { updatedAt: 'desc' }
      });

      const vehiclesByStatus = vehicles.reduce((acc, v) => {
        if (!acc[v.status]) acc[v.status] = [];
        acc[v.status].push(v);
        return acc;
      }, {} as Record<string, typeof vehicles>);

      // 2. Investigate WhatsApp Messages without Conversations
      const messagesWithoutConversation = await prisma.whatsAppMessage.findMany({
        where: {
          tenantId,
          conversationId: { equals: null }
        },
        select: {
          id: true,
          content: true,
          direction: true,
          createdAt: true,
          senderPhone: true,
        },
        take: 20,
        orderBy: { createdAt: 'desc' }
      });

      // 3. Get all conversations
      const conversations = await prisma.whatsAppConversation.findMany({
        where: { tenantId },
        select: {
          id: true,
          customerPhone: true,
          customerName: true,
          status: true,
          createdAt: true,
          _count: {
            select: { messages: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      // 4. Get all messages grouped by conversation status
      const allMessages = await prisma.whatsAppMessage.findMany({
        where: { tenantId },
        select: {
          id: true,
          conversationId: true,
          conversation: {
            select: {
              status: true
            }
          }
        }
      });

      const messagesByConvStatus = allMessages.reduce((acc, m) => {
        const status = m.conversation?.status || 'NO_CONVERSATION';
        if (!acc[status]) acc[status] = 0;
        acc[status]++;
        return acc;
      }, {} as Record<string, number>);

      // 5. Check orphaned messages (messages with conversationId that doesn't exist)
      const orphanedMessages = await prisma.whatsAppMessage.findMany({
        where: {
          tenantId,
          conversationId: { not: null },
          conversation: null
        },
        select: {
          id: true,
          conversationId: true,
          content: true,
          createdAt: true,
        },
        take: 10
      });

      // 6. Get conversations with deleted status
      const deletedConversations = await prisma.whatsAppConversation.findMany({
        where: {
          tenantId,
          status: 'deleted'
        },
        select: {
          id: true,
          customerPhone: true,
          status: true,
          _count: {
            select: { messages: true }
          }
        }
      });

      const totalMessagesInDeletedConv = deletedConversations.reduce(
        (sum, c) => sum + c._count.messages, 0
      );

      return NextResponse.json({
        success: true,
        data: {
          tenant: {
            id: tenant.id,
            name: tenant.name,
            slug: tenant.slug,
          },
          vehicles: {
            total: vehicles.length,
            byStatus: Object.keys(vehiclesByStatus).map(status => ({
              status,
              count: vehiclesByStatus[status].length,
              samples: vehiclesByStatus[status].slice(0, 5).map(v => ({
                id: v.id,
                name: `${v.make} ${v.model} ${v.year}`,
                price: v.price,
                updatedAt: v.updatedAt,
              }))
            }))
          },
          whatsapp: {
            conversations: {
              total: conversations.length,
              byStatus: conversations.reduce((acc, c) => {
                if (!acc[c.status]) acc[c.status] = 0;
                acc[c.status]++;
                return acc;
              }, {} as Record<string, number>),
              list: conversations.slice(0, 10)
            },
            messages: {
              total: allMessages.length,
              byConversationStatus: messagesByConvStatus,
              withoutConversation: messagesWithoutConversation.length,
              samplesWithoutConv: messagesWithoutConversation.slice(0, 5),
              orphaned: orphanedMessages.length,
              inDeletedConversations: totalMessagesInDeletedConv,
            },
            deletedConversations: {
              count: deletedConversations.length,
              totalMessages: totalMessagesInDeletedConv,
              list: deletedConversations.slice(0, 5)
            }
          },
          generatedAt: new Date().toISOString(),
        }
      });

    } catch (error) {
      console.error('Investigation API error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to investigate tenant data' },
        { status: 500 }
      );
    }
  });
}
