import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const users = await prisma.user.findMany({
        take: 50,
        include: { tenant: true }
    });

    console.log('--- USER LIST ---');
    users.forEach(u => {
        console.log(`[${u.id}] ${u.email} | Tenant: ${u.tenant?.name || 'PLATFORM'} | Role: ${u.role}`);
    });
}

main().finally(() => prisma.$disconnect());
