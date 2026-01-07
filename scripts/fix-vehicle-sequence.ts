import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🔄 Starting Vehicle ID Resequencing...');

    // 1. Find Tenant
    const tenantSlug = 'primamobil-id'; // Default based on hostname
    const tenant = await prisma.tenant.findUnique({
        where: { slug: tenantSlug },
    });

    if (!tenant) {
        console.error(`❌ Tenant '${tenantSlug}' not found.`);
        // Try to find any tenant
        const anyTenant = await prisma.tenant.findFirst();
        if (anyTenant) {
            console.log(`💡 Found alternative tenant: ${anyTenant.name} (${anyTenant.slug})`);
        }
        return;
    }

    console.log(`✅ Found Tenant: ${tenant.name} (${tenant.id})`);

    // 2. Clear IDs of DELETED vehicles
    // This ensures they don't block the sequence
    const deletedUpdate = await prisma.vehicle.updateMany({
        where: {
            tenantId: tenant.id,
            status: 'DELETED',
            displayId: { not: null },
        },
        data: { displayId: null },
    });

    console.log(`🗑️ Cleared displayId for ${deletedUpdate.count} DELETED vehicles.`);

    // 3. Get ACTIVE vehicles (ordered by creation time)
    // We resequence them based on when they were created to maintain logical order
    const vehicles = await prisma.vehicle.findMany({
        where: {
            tenantId: tenant.id,
            status: { not: 'DELETED' },
        },
        orderBy: { createdAt: 'asc' },
        select: { id: true, displayId: true, make: true, model: true, year: true, status: true },
    });

    console.log(`📋 Found ${vehicles.length} ACTIVE vehicles to resequence.`);

    if (vehicles.length === 0) {
        console.log('⚠️ No active vehicles found.');
        return;
    }

    // Determine prefix
    const tenantCode = 'PM'; // Hardcoded for Prima Mobil
    const showroomCode = 'PST';
    const prefix = `${tenantCode}-${showroomCode}-`;

    // 4. Reset to TEMP IDs first (to avoid unique constraint violations during swap)
    console.log('🔄 Step 1: Setting temporary IDs...');
    const tempPrefix = `TEMP-${Date.now()}-`;
    for (let i = 0; i < vehicles.length; i++) {
        await prisma.vehicle.update({
            where: { id: vehicles[i].id },
            data: { displayId: `${tempPrefix}${i}` },
        });
    }

    // 5. Apply Final IDs
    console.log('✨ Step 2: Assigning correct sequential IDs...');
    let sequence = 1;
    const updates = [];

    for (const vehicle of vehicles) {
        const newDisplayId = `${prefix}${String(sequence).padStart(3, '0')}`;

        await prisma.vehicle.update({
            where: { id: vehicle.id },
            data: { displayId: newDisplayId },
        });

        updates.push({
            vehicle: `${vehicle.make} ${vehicle.model} ${vehicle.year}`,
            oldId: vehicle.displayId,
            newId: newDisplayId,
            status: vehicle.status
        });

        sequence++;
    }

    // 6. Report
    console.log('\n✅ Resequencing Complete!');
    console.log('--------------------------------------------------');
    updates.forEach(u => {
        console.log(`[${u.newId}] ${u.vehicle} (${u.status})`);
    });
    console.log('--------------------------------------------------');
    console.log(`Total: ${updates.length} vehicles resequenced.`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
