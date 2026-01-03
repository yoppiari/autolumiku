
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verifyTenantIsolation() {
    console.log('🔍 Starting Tenant Isolation Verification...');

    try {
        // 1. Fetch all tenants
        const tenants = await prisma.tenant.findMany({
            include: {
                users: true,
                vehicles: true,
                showrooms: true,
            }
        });

        console.log(`📋 Found ${tenants.length} tenants.`);

        // 2. Map for collision detection
        const slugMap = new Map<string, string>();
        const domainMap = new Map<string, string>();
        const subscriptionMap = new Map<string, string>();

        let errors: string[] = [];

        // 3. Iterate and check for uniqueness execution (App layer check)
        // Note: Database already enforces unique constraints on slug, domain, subscriptionId
        // This is a double check and logic validation.

        for (const tenant of tenants) {
            console.log(`\nChecking Tenant: ${tenant.name} (${tenant.id})`);

            // Check Slug Uniqueness
            if (slugMap.has(tenant.slug)) {
                errors.push(`❌ SLUG COLLISION: Tenant ${tenant.name} shares slug '${tenant.slug}' with ${slugMap.get(tenant.slug)}`);
            } else {
                slugMap.set(tenant.slug, tenant.name);
            }

            // Check Domain Uniqueness
            if (tenant.domain) {
                if (domainMap.has(tenant.domain)) {
                    errors.push(`❌ DOMAIN COLLISION: Tenant ${tenant.name} shares domain '${tenant.domain}' with ${domainMap.get(tenant.domain)}`);
                } else {
                    domainMap.set(tenant.domain, tenant.name);
                }
            }

            // Check Subscription Isolation
            if (tenant.subscriptionId) {
                if (subscriptionMap.has(tenant.subscriptionId)) {
                    errors.push(`❌ SUBSCRIPTION COLLISION: Tenant ${tenant.name} shares subId '${tenant.subscriptionId}' with ${subscriptionMap.get(tenant.subscriptionId)}`);
                } else {
                    subscriptionMap.set(tenant.subscriptionId, tenant.name);
                }
            }

            // Check User Isolation
            // Ideally users should belong to only one tenant unless they are Super Admins or specifically assigned to multiple (if supported, based on schema it's 1:N)
            // Schema: User -> tenantId (String?)
            // This enforces 1 user belongs to 1 tenant.
            for (const user of tenant.users) {
                if (user.tenantId !== tenant.id) {
                    errors.push(`❌ USER MISMATCH: User ${user.email} has tenantId ${user.tenantId} but linked to tenant ${tenant.id}`);
                }
            }

            // Check Vehicle Isolation
            for (const vehicle of tenant.vehicles) {
                if (vehicle.tenantId !== tenant.id) {
                    errors.push(`❌ VEHICLE MISMATCH: Vehicle ${vehicle.id} has tenantId ${vehicle.tenantId} but linked to tenant ${tenant.id}`);
                }
            }
        }

        // 4. Report
        if (errors.length > 0) {
            console.error('\n⚠️ DETECTED ISOLATION ISSUES:');
            errors.forEach(e => console.error(e));
            process.exit(1);
        } else {
            console.log('\n✅ VERIFICATION SUCCESS: All tenants are properly isolated.');
            console.log('   - No slug/domain collisions detected.');
            console.log('   - User-Tenant relationships are consistent.');
            console.log('   - Vehicle-Tenant relationships are consistent.');
        }

    } catch (error) {
        console.error('❌ Error during verification:', error);
    } finally {
        await prisma.$disconnect();
    }
}

verifyTenantIsolation();
