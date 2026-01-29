
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { AimeowClientService } from '@/lib/services/aimeow/aimeow-client.service';
import { LeadPriority, LeadStatus } from '@prisma/client';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key');

    // Verify secret key
    const CRON_SECRET = process.env.CRON_SECRET || 'autolumiku_scraper_secret_Key_2026';
    if (key !== CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[Cron] Starting Smart Follow-up...');

    // 1. Find leads needing follow-up
    // Criteria: followUpDate is consistently in the past (e.g. < NOW)
    // Limit to 10 to prevent timeouts
    const leadsToFollowUp = await prisma.lead.findMany({
      where: {
        followUpDate: {
          lte: new Date(),
        },
        // Exclude closed/lost leads
        status: {
          notIn: ['WON', 'LOST'] as any // Exclude completed leads
        },
        phone: {
          not: ""
        }
      },
      take: 10,
      orderBy: {
        priority: 'desc' // Prioritize high priority leads
      }
    });

    console.log(`[Cron] Found ${leadsToFollowUp.length} leads requiring follow-up.`);

    const results = [];

    for (const lead of leadsToFollowUp) {
      try {
        console.log(`[Cron] Processing follow-up for lead: ${lead.name} (${lead.phone})`);

        // Check if tenant has active WhatsApp
        const account = await prisma.aimeowAccount.findUnique({
          where: { tenantId: lead.tenantId }
        });

        if (!account?.isActive || !account?.clientId) {
          console.log(`[Cron] Tenant ${lead.tenantId} has no active WhatsApp. Skipping.`);
          continue;
        }

        // Generate personalized message
        const vehicleInterest = lead.interestedIn ? `unit ${lead.interestedIn}` : 'mobil impiannya';
        const message = `Halo Kak ${lead.name || ''}, saya dari ${account.tenantId === 'default' ? 'Showroom' : 'Tim Penjualan'}. 👋\n\nMau tanya kabar nih, apakah masih berminat dengan ${vehicleInterest}? \n\nKalau ada yang ingin ditanyakan lagi atau mau cek unit lain, kabari ya! 😊`;

        // Send message via Aimeow
        const sendResult = await AimeowClientService.sendMessage({
          clientId: account.clientId,
          to: lead.phone,
          message: message
        });

        if (sendResult.success) {
          // Update Lead: Clear followUpDate and add Note
          await prisma.lead.update({
            where: { id: lead.id },
            data: {
              followUpDate: null, // Clear it so we don't send again immediately
              status: 'CONTACTED' as LeadStatus, // Ensure status is active
              notes: (lead.notes || '') + `\n[System] Auto follow-up sent at ${new Date().toLocaleString()}`
            }
          });

          // Log Activity
          await prisma.leadActivity.create({
            data: {
              leadId: lead.id,
              tenantId: lead.tenantId,
              type: 'WHATSAPP', // Enum LeadActivityType
              channel: 'WHATSAPP', // Enum CommunicationChannel
              direction: 'outbound',
              subject: 'Auto Smart Follow-up',
              message: message,
              performedByName: 'AI System'
            }
          });

          results.push({ leadId: lead.id, success: true });
          console.log(`[Cron] ✅ Follow-up sent to ${lead.name}`);
        } else {
          console.error(`[Cron] ❌ Failed to send to ${lead.name}: ${sendResult.error}`);
          results.push({ leadId: lead.id, success: false, error: sendResult.error });
        }

      } catch (err: any) {
        console.error(`[Cron] Error processing lead ${lead.id}:`, err);
        results.push({ leadId: lead.id, success: false, error: err.message });
      }
    }

    return NextResponse.json({
      success: true,
      processed: results.length,
      results
    });

  } catch (error: any) {
    console.error('[Cron] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
