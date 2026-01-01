
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Inline helper to avoid import issues
function parseVehicleSlug(slug: string): { id: string; isUuid: boolean } {
    if (!slug) return { id: '', isUuid: false };
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (uuidRegex.test(slug)) {
        return { id: slug, isUuid: true };
    }

    const yearMatch = slug.match(/-(\d{4})-/);

    if (yearMatch) {
        const yearIndex = (yearMatch.index ?? 0) + yearMatch[0].length;
        const possibleId = slug.substring(yearIndex).split('?')[0].split('#')[0];
        return { id: possibleId.toUpperCase(), isUuid: false };
    }

    return { id: slug, isUuid: false };
}

async function main() {
    console.log('--- Debugging Vehicle Issue (v2) ---');

    // 1. Test parseVehicleSlug
    const testSlug = 'honda-city-2006-PM-PST-001';
    console.log(`\nTesting parseVehicleSlug with "${testSlug}"...`);
    const parsed = parseVehicleSlug(testSlug);
    console.log('Result:', parsed);

    if (parsed.id !== 'PM-PST-001') {
        console.error('❌ Mismatch! Expected PM-PST-001');
    } else {
        console.log('✅ Slug parsing matches expectation.');
    }

    // 2. Test DB Query
    console.log('\nTesting Prisma DB Query...');
    try {
        const result = await prisma.vehicle.findUnique({
            where: { displayId: parsed.id },
        });
        console.log('✅ Query success. Result:', result ? 'Found Vehicle' : 'Not Found');
        if (result) {
            console.log('Vehicle ID:', result.id);
            console.log('Display ID:', result.displayId);
            console.log('Price (Raw):', result.price);
        } else {
            console.log('⚠️ Vehicle not found by displayId. Trying to find ANY vehicle to verify schema...');
            const anyV = await prisma.vehicle.findFirst();
            if (anyV) {
                console.log('Found generic vehicle:', anyV.id);
                console.log('Keys:', Object.keys(anyV));
            } else {
                console.log('DB seems empty of vehicles.');
            }
        }
    } catch (error) {
        console.error('❌ Query FAILED.');
        console.error(error);
    }
}

main()
    .catch((e) => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
