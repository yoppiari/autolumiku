
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { MessageOrchestratorService } from '@/lib/services/whatsapp-ai/core/message-orchestrator.service';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes

/**
 * After-Hours Catch-Up Cron
 * Proactively responds to messages received during off-hours once the showroom opens.
 */
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const key = searchParams.get('key');

        // Verify secret key
        const CRON_SECRET = process.env.CRON_SECRET || 'autolumiku_scraper_secret_Key_2026';
        if (key !== CRON_SECRET) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        console.log('[Cron] Checking for After-Hours Catch-Up...');

        // 1. Find conversations marked for catch-up
        // Standard Prisma JSON check
        const pendingConversations = await prisma.whatsAppConversation.findMany({
            where: {
                contextData: {
                    path: ['needsCatchup'],
                    equals: true
                }
            },
            include: {
                account: {
                    include: {
                        tenant: true
                    }
                },
                messages: {
                    where: {
                        direction: 'inbound'
                    },
                    orderBy: {
                        createdAt: 'desc'
                    },
                    take: 1
                }
            }
        });

        console.log(`[Cron] Found ${pendingConversations.length} conversations needing catch-up.`);

        const results = [];

        for (const convo of pendingConversations) {
            try {
                const lastInbound = convo.messages[0];
                if (!lastInbound) {
                    console.log(`[Cron] No inbound message found for convo ${convo.id}. Clearing flag.`);
                    await clearCatchupFlag(convo.id, convo.contextData);
                    continue;
                }

                console.log(`[Cron] Re-processing message for catch-up: "${lastInbound.content}" from ${convo.customerPhone}`);

                // Reconstruct IncomingMessage
                const incoming = {
                    accountId: convo.accountId,
                    clientId: convo.account.clientId,
                    tenantId: convo.tenantId,
                    from: convo.customerPhone,
                    message: lastInbound.content,
                    messageId: lastInbound.aimeowMessageId || `catchup_${Date.now()}`,
                    customerName: convo.customerName || undefined,
                    isCatchup: true
                };

                // Clear FLAG FIRST to prevent infinite loops if something fails
                // We'll re-set it in processIncomingMessage if it's STILL after hours
                await clearCatchupFlag(convo.id, convo.contextData);

                // Process message - this will trigger AI response if now within hours
                const processResult = await MessageOrchestratorService.processIncomingMessage(incoming);

                results.push({
                    conversationId: convo.id,
                    success: processResult.success,
                    intent: processResult.intent
                });

            } catch (err: any) {
                console.error(`[Cron] Error catching up convo ${convo.id}:`, err);
                results.push({ conversationId: convo.id, success: false, error: err.message });
            }
        }

        return NextResponse.json({
            success: true,
            processed: results.length,
            results
        });

    } catch (error: any) {
        console.error('[Cron] Catch-up Master Error:', error);
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
}

async function clearCatchupFlag(convoId: string, currentContext: any) {
    const context = (currentContext as Record<string, any>) || {};
    delete context.needsCatchup;
    context.catchupAt = new Date().toISOString();

    await prisma.whatsAppConversation.update({
        where: { id: convoId },
        data: { contextData: context }
    });
}
