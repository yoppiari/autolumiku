
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Starting Clean Up...');

    const targetNames = [
        "Tenant 1 Demo",
        "Showroom Jakarta Premium",
        "AutoLumiku Platform"
    ];

    const tenants = await prisma.tenant.findMany({
        where: {
            name: { in: targetNames }
        },
        include: {
            _count: {
                select: {
                    users: true,
                    vehicles: true,
                    sessions: true
                }
            }
        }
    });

    console.log(`Found ${tenants.length} tenants to delete.`);

    for (const tenant of tenants) {
        console.log(`\nDeleting Tenant: ${tenant.name} (${tenant.id})`);
        console.log(`- Users: ${tenant._count.users}`);
        console.log(`- Vehicles: ${tenant._count.vehicles}`);

        try {
            await prisma.tenant.delete({
                where: { id: tenant.id }
            });
            console.log(`✅ Successfully deleted ${tenant.name}`);
        } catch (error: any) {
            console.error(`❌ Failed to delete ${tenant.name}:`, error.message);
        }
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
