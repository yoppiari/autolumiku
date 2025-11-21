/**
 * WhatsApp Integration API
 * Epic 6: Story 6.2 - WhatsApp Messaging
 *
 * POST /api/v1/leads/[leadId]/whatsapp - Send WhatsApp message
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { whatsappIntegrationService } from '@/services/lead/whatsapp-integration.service';
import { prisma } from '@/lib/prisma';

export const POST = withAuth(
  async (request, { user, params }: { user: any; params: { leadId: string } }) => {
    try {
      const { leadId } = params;
      const body = await request.json();

      if (!body.message) {
        return NextResponse.json(
          { error: 'Missing required field: message' },
          { status: 400 }
        );
      }

      // Get lead to get WhatsApp number
      const lead = await prisma.lead.findUnique({
        where: { id: leadId },
      });

      if (!lead || lead.tenantId !== user.tenantId) {
        return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
      }

      if (!lead.whatsappNumber) {
        return NextResponse.json(
          { error: 'WhatsApp number not available' },
          { status: 400 }
        );
      }

      const result = await whatsappIntegrationService.sendMessage(
        leadId,
        user.tenantId,
        lead.whatsappNumber,
        body.message,
        user.id,
        `${user.firstName} ${user.lastName}`
      );

      if (!result.success) {
        return NextResponse.json(
          { error: result.error },
          { status: 500 }
        );
      }

      return NextResponse.json(result);
    } catch (error: any) {
      console.error('WhatsApp send error:', error);
      return NextResponse.json(
        { error: 'Failed to send WhatsApp message', details: error.message },
        { status: 500 }
      );
    }
  }
);
