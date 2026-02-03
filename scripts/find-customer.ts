
import { prisma } from '../src/lib/prisma';

async function findCustomer() {
    const searchNumbers = [
        '6281216206368',
        '081216206368',
        '+6281216206368',
        '62812-1620-6368'
    ];

    console.log('--- Searching for Customer: +62 812-1620-6368 ---');

    try {
        // 1. Search in WhatsAppConversation
        const conversations = await prisma.whatsAppConversation.findMany({
            where: {
                OR: [
                    { customerPhone: { contains: '16206368' } },
                    { customerName: { contains: '16206368' } },
                    { contextData: { path: ['verifiedStaffPhone'], string_contains: '16206368' } }
                ]
            },
            include: {
                account: {
                    select: { phoneNumber: true, clientId: true }
                }
            }
        });

        console.log(`Found ${conversations.length} matching conversations.`);
        conversations.forEach(c => {
            console.log(`ID: ${c.id}, Phone: ${c.customerPhone}, Name: ${c.customerName}, Tenant: ${c.tenantId}, Account: ${c.account.phoneNumber}`);
        });

        // 2. Search in WhatsAppMessage (content or sender)
        const messages = await prisma.whatsAppMessage.findMany({
            where: {
                OR: [
                    { sender: { contains: '16206368' } },
                    { content: { contains: '16206368' } }
                ]
            },
            orderBy: { createdAt: 'desc' },
            take: 10
        });

        console.log(`\nFound ${messages.length} matching messages.`);
        messages.forEach(m => {
            console.log(`[${m.createdAt.toISOString()}] From: ${m.sender}, Content: ${m.content.substring(0, 50)}...`);
        });

        // 3. Search in Lead
        const leads = await (prisma as any).lead.findMany({
            where: {
                OR: [
                    { phone: { contains: '16206368' } },
                    { whatsappNumber: { contains: '16206368' } }
                ]
            }
        });
        console.log(`\nFound ${leads.length} matching leads.`);
        leads.forEach(l => {
            console.log(`Lead Name: ${l.name}, Phone: ${l.phone}, Status: ${l.status}`);
        });

    } catch (err) {
        console.error('Search error:', err);
    } finally {
        await prisma.$disconnect();
    }
}

findCustomer();
