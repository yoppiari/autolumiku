
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Starting User Clean Up...');

    const targetTenants = [
        "Tenant 1 Demo",
        "Showroom Jakarta Premium",
        "AutoLumiku Platform"
    ];

    console.log('Target Tenants to clean users from:', targetTenants);

    // 1. Find the tenants first to get their IDs
    const tenants = await prisma.tenant.findMany({
        where: {
            name: { in: targetTenants }
        },
        select: { id: true, name: true }
    });

    if (tenants.length === 0) {
        console.log('No dummy tenants found. Checking for orphaned users via name match logic if tenant was hard deleted...');
        // If tenants were already deleted, we might have users attached to nothing (orphaned) 
        // OR if we want to delete users by email pattern? 
        // But safely, let's look for users where tenant name matches, if using direct relation? 
        // Prisma users have tenantId. If tenant is gone, user should be gone if cascade delete works.
        // However, let's try to find users specifically.
    } else {
        console.log(`Found ${tenants.length} dummy tenants. Deleting their users...`);

        for (const tenant of tenants) {
            const deleteResult = await prisma.user.deleteMany({
                where: { tenantId: tenant.id }
            });
            console.log(`- Deleted ${deleteResult.count} users from ${tenant.name}`);
        }
    }

    // Also, strictly delete any user whose tenant matches the names, in case they exist
    // We can do this by finding users where tenant.name is in the list
    const usersToDelete = await prisma.user.findMany({
        where: {
            tenant: {
                name: { in: targetTenants }
            }
        },
        select: { id: true, email: true, tenant: { select: { name: true } } }
    });

    console.log(`\nFound ${usersToDelete.length} users remaining in dummy tenants.`);

    for (const user of usersToDelete) {
        console.log(`Deleting user: ${user.email} (Tenant: ${user.tenant?.name})`);
        await prisma.user.delete({ where: { id: user.id } });
    }

    console.log('\n✅ User cleanup complete.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
