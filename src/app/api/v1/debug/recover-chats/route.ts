
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ChatService } from "@/lib/services/whatsapp-ai/core/chat.service";
import { AimeowClientService } from "@/lib/services/aimeow/aimeow-client.service";

// Mark as dynamic to avoid static generation issues
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const execute = searchParams.get('execute') === 'true';
        const tenantId = searchParams.get('tenantId');

        // 1. Find conversations where the LAST message is INBOUND (from Customer)
        // and older than 1 minute (to avoid catching currently processing ones)
        const fiveMinutesAgo = new Date(Date.now() - 1000 * 60 * 5); // 5 mins ago
        const twentyFourHoursAgo = new Date(Date.now() - 1000 * 60 * 60 * 24);

        const activeConversations = await prisma.whatsAppConversation.findMany({
            where: {
                ...(tenantId ? { tenantId } : {}),
                lastMessageAt: {
                    gt: twentyFourHoursAgo,
                    lt: fiveMinutesAgo
                },
                status: 'active'
            },
            include: {
                messages: {
                    orderBy: { createdAt: 'desc' },
                    take: 1
                },
                account: true
            }
        });

        const unansweredChats = activeConversations.filter(c => {
            const lastMsg = c.messages[0];
            return lastMsg && lastMsg.direction === 'inbound';
        });

        if (!execute) {
            return NextResponse.json({
                success: true,
                message: "Dry run complete. Use ?execute=true to process.",
                found: unansweredChats.length,
                details: unansweredChats.map(c => ({
                    conversationId: c.id,
                    customer: c.customerName || c.customerPhone,
                    lastMessage: c.messages[0].content,
                    time: c.messages[0].createdAt
                }))
            });
        }

        // 2. Process unanswered chats
        const results = [];
        for (const chat of unansweredChats) {
            const lastMsg = chat.messages[0];
            console.log(`[Recovery] Processing conversation ${chat.id} - ${lastMsg.content}`);

            try {
                // Re-construct context
                // We need message history
                const history = await prisma.whatsAppMessage.findMany({
                    where: { conversationId: chat.id },
                    orderBy: { createdAt: 'asc' },
                    take: 10
                });

                const messageHistory = history.map(m => ({
                    role: m.senderType === 'ai' ? 'assistant' : 'user', // Basic mapping
                    content: m.content
                })) as any[];

                const context = {
                    tenantId: chat.tenantId,
                    conversationId: chat.id,
                    customerPhone: chat.customerPhone,
                    customerName: chat.customerName || "Customer",
                    intent: 'unknown' as any, // Will be re-detected
                    messageHistory: messageHistory,
                    isStaff: false
                };

                // Generate Response (Force Smart Fallback if needed, or normal AI)
                // We use ChatService.generateResponse
                const aiResponse = await ChatService.generateResponse(
                    lastMsg.content,
                    context,
                    false // No media by default for recovery
                );

                if (aiResponse.message) {
                    // Send Message via Aimeow (Corrected Object Params)
                    await AimeowClientService.sendMessage({
                        clientId: chat.account.clientId,
                        to: chat.customerPhone,
                        message: aiResponse.message
                    });

                    // Save to DB
                    await prisma.whatsAppMessage.create({
                        data: {
                            conversationId: chat.id,
                            tenantId: chat.tenantId,
                            direction: 'outbound',
                            sender: 'ai',
                            senderType: 'ai',
                            content: aiResponse.message,
                            aiResponse: true,
                            intent: 'recovery_script',
                            confidence: 1.0,
                            processingTime: 0
                        }
                    });

                    // Update conversation
                    await prisma.whatsAppConversation.update({
                        where: { id: chat.id },
                        data: { lastMessageAt: new Date() }
                    });

                    results.push({ id: chat.id, status: 'recovered', reply: aiResponse.message });
                } else {
                    results.push({ id: chat.id, status: 'failed_no_response' });
                }

            } catch (err: any) {
                console.error(`[Recovery] Failed chat ${chat.id}:`, err);
                results.push({ id: chat.id, status: 'error', error: err.message });
            }
        }

        return NextResponse.json({
            success: true,
            processed: results.length,
            results
        });

    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
