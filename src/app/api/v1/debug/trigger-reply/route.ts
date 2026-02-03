
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { MessageOrchestratorService } from "@/lib/services/whatsapp-ai/core/message-orchestrator.service";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const phone = searchParams.get("phone") || "6281216206368";
    const cleanPhone = phone.replace(/\D/g, "");

    try {
        // Find the conversation
        const conversation = await prisma.whatsAppConversation.findFirst({
            where: {
                customerPhone: { contains: cleanPhone.substring(cleanPhone.length - 10) }
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

        if (!conversation) {
            return NextResponse.json({ error: `Conversation for ${phone} not found` }, { status: 404 });
        }

        const lastMessage = conversation.messages[0];
        if (!lastMessage) {
            return NextResponse.json({ error: "No messages found for this conversation" }, { status: 404 });
        }

        console.log(`[Manual Reply] Triggering AI reply to: ${lastMessage.content}`);

        const incoming = {
            accountId: conversation.accountId,
            clientId: conversation.account.clientId,
            tenantId: conversation.tenantId,
            from: conversation.customerPhone,
            message: lastMessage.content,
            messageId: `manual_${Date.now()}`,
            isCatchup: true
        };

        // Process using the orchestrator
        const result = await MessageOrchestratorService.processIncomingMessage(incoming);

        return NextResponse.json({
            success: true,
            message: "AI has been triggered to reply.",
            result: result
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
