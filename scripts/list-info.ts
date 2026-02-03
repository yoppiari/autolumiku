
import { PrismaClient } from '@prisma/client';

async function listTenants() {
    const url = process.env.DATABASE_URL?.replace('postgres-dk0ck4sc0kg4cowgkws4cowog', 'localhost');
    console.log('Using URL:', url);
    const prisma = new PrismaClient({
        datasources: {
            db: { url }
        }
    });

    try {
        const tenants = await prisma.tenant.findMany({
            select: { id: true, name: true, slug: true, domain: true }
        });
        console.log('Tenants:', JSON.stringify(tenants, null, 2));

        // Find Aimeow accounts
        const accounts = await prisma.aimeowAccount.findMany({
            select: { tenantId: true, phoneNumber: true, clientId: true }
        });
        console.log('Aimeow Accounts:', JSON.stringify(accounts, null, 2));

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await prisma.$disconnect();
    }
}

listTenants();
