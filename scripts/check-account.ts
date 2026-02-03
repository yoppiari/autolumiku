
import { PrismaClient } from '@prisma/client';

async function main() {
    const prisma = new PrismaClient();
    const tenantId = "e592973f-9eff-4f40-adf6-ca6b2ad9721f";
    const slug = "primamobil-id";

    console.log(`🔍 Checking AimeowAccount for Tenant: ${slug} (${tenantId})`);

    try {
        const tenant = await prisma.tenant.findFirst({
            where: { OR: [{ id: tenantId }, { slug }] }
        });

        if (!tenant) {
            console.log("❌ Tenant not found");
            return;
        }

        console.log(`✅ Tenant found: ${tenant.name} (${tenant.id})`);

        const account = await prisma.aimeowAccount.findUnique({
            where: { tenantId: tenant.id }
        });

        if (account) {
            console.log("✅ AimeowAccount found:");
            console.log(JSON.stringify(account, null, 2));
        } else {
            console.log("❌ AimeowAccount not found");
        }

        // List all accounts to see if there are duplicates or orphans
        const allAccounts = await prisma.aimeowAccount.findMany();
        console.log(`\n📋 Total AimeowAccounts: ${allAccounts.length}`);
        allAccounts.forEach(acc => {
            console.log(`- ID: ${acc.id}, TenantID: ${acc.tenantId}, ClientID: ${acc.clientId}, Phone: ${acc.phoneNumber}`);
        });

    } catch (error) {
        console.error("❌ Error:", error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
