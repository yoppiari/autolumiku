
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Inspecting Tenants...');
    const tenants = await prisma.tenant.findMany({
        select: {
            id: true,
            name: true,
            slug: true,
            status: true,
            _count: {
                select: {
                    users: true,
                    vehicles: true,
                    sessions: true
                }
            }
        }
    });

    console.table(tenants);

    const targets = ["Tenant 1 Demo", "Showroom Jakarta Premium", "AutoLumiku Platform"];
    const toDelete = tenants.filter(t => targets.includes(t.name));

    console.log('\nCandidates for deletion:');
    if (toDelete.length > 0) {
        console.table(toDelete);
    } else {
        console.log('No matching tenants found for deletion candidates.');
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
