
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
    datasources: {
        db: {
            url: 'postgres://postgres:postgres@localhost:5432/autolumiku',
        },
    },
});

async function main() {
    console.log('🔍 Checking for conversations needing catch-up...');

    try {
        const pendingConvos = await prisma.whatsAppConversation.findMany({
            where: {
                contextData: {
                    path: ['needsCatchup'],
                    equals: true
                }
            },
            select: {
                id: true,
                customerPhone: true,
                customerName: true,
                lastMessageAt: true
            }
        });

        console.log(`📊 Found ${pendingConvos.length} conversations needing catch-up.`);
        pendingConvos.forEach(c => {
            console.log(`- ${c.customerName || 'Unknown'} (${c.customerPhone}) last message at ${c.lastMessageAt}`);
        });

    } catch (error) {
        console.error('❌ Database error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
