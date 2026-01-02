
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();

async function main() {
    const email = 'yudho.dwi.laksono@gmail.com';
    console.log(`Inspecting user: ${email}`);

    const user = await prisma.user.findUnique({
        where: { email },
        include: { tenant: true }
    });

    if (user) {
        console.log('✅ User Found:');
        console.log(`- ID: ${user.id}`);
        console.log(`- Role: ${user.role}`);
        console.log(`- Tenant ID: ${user.tenantId}`);
        console.log(`- Tenant Name: ${user.tenant?.name || 'N/A (Platform Admin?)'}`);
        console.log(`- Tenant Slug: ${user.tenant?.slug}`);
    } else {
        console.log('❌ User NOT found in database.');
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
