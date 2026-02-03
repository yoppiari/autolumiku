
import { prisma } from '../src/lib/prisma';
import { MessageOrchestratorService } from '../src/lib/services/whatsapp-ai/core/message-orchestrator.service';

async function runCatchup() {
    console.log('--- Manual Catch-up Trigger ---');
    try {
        const pendingConversations = await prisma.whatsAppConversation.findMany({
            where: {
                OR: [
                    { needsCatchup: true },
                    {
                        contextData: {
                            path: ['needsCatchup'],
                            equals: true
                        }
                    }
                ]
            },
            include: {
                account: true,
                messages: {
                    where: { direction: 'inbound' },
                    orderBy: { createdAt: 'desc' },
                    take: 1
                }
            }
        });

        console.log(`Found ${pendingConversations.length} conversations needing catch-up.`);

        for (const convo of pendingConversations) {
            try {
                const lastInbound = convo.messages[0];
                if (!lastInbound) {
                    console.log(`[Catchup] No inbound for ${convo.customerPhone}. Clearing flag.`);
                    await clearFlag(convo.id, convo.contextData);
                    continue;
                }

                console.log(`[Catchup] Replying to ${convo.customerPhone}: "${lastInbound.content}"`);

                const incoming = {
                    accountId: convo.accountId,
                    clientId: convo.account.clientId,
                    tenantId: convo.tenantId,
                    from: convo.customerPhone,
                    message: lastInbound.content,
                    messageId: lastInbound.aimeowMessageId || `manual_${Date.now()}`,
                    isCatchup: true
                };

                await clearFlag(convo.id, convo.contextData);
                const result = await MessageOrchestratorService.processIncomingMessage(incoming);
                console.log(`[Catchup] Result for ${convo.customerPhone}: ${result.success ? '✅ Success' : '❌ Failed: ' + result.error}`);

            } catch (err) {
                console.error(`Error processing ${convo.customerPhone}:`, err);
            }
        }
    } catch (err) {
        console.error('Master Error:', err);
    } finally {
        await prisma.$disconnect();
    }
}

async function clearFlag(convoId: string, currentContext: any) {
    const context = (currentContext as Record<string, any>) || {};
    delete context.needsCatchup;
    await prisma.whatsAppConversation.update({
        where: { id: convoId },
        data: {
            contextData: context,
            needsCatchup: false
        }
    });
}

runCatchup();
