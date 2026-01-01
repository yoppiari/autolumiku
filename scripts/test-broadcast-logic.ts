
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testBroadcastLogic() {
    console.log('🧪 Testing Broadcast Logic Recipient Discovery...');

    try {
        // 1. Find a valid tenant
        const tenant = await prisma.tenant.findFirst();
        if (!tenant) {
            console.error('❌ No tenant found. Cannot test.');
            return;
        }
        console.log(`✅ Using Tenant: ${tenant.name} (${tenant.id})`);

        // 2. Simulate a sender (e.g., the first ADMIN found)
        const sender = await prisma.user.findFirst({
            where: {
                tenantId: tenant.id,
                role: 'ADMIN',
                phone: { not: null }
            }
        });

        if (!sender || !sender.phone) {
            console.error('❌ No ADMIN sender found for test.');
            return;
        }
        console.log(`👤 Simulate Sender: ${sender.firstName} ${sender.lastName} (${sender.role}) - ${sender.phone}`);

        // 3. Define broadcast roles
        const broadcastToRoles = ['OWNER', 'ADMIN', 'SUPER_ADMIN'];
        console.log(`📢 Target Roles: ${broadcastToRoles.join(', ')}`);

        // 4. Run the query logic used in MessageOrchestrator
        // Normalize sender phone for exclusion
        const phoneForLookup = sender.phone;
        const digits = phoneForLookup.replace(/\D/g, '');
        const phoneWith0 = digits.startsWith('62') ? '0' + digits.slice(2) : digits;
        const phoneWith62 = digits.startsWith('0') ? '62' + digits.slice(1) : digits;

        const recipients = await prisma.user.findMany({
            where: {
                tenantId: tenant.id,
                role: { in: broadcastToRoles },
                phone: { not: null },
                // Exclude the original sender
                NOT: {
                    OR: [
                        { phone: phoneWith0 },
                        { phone: phoneWith62 },
                        { phone: phoneForLookup }
                    ]
                }
            },
            select: {
                firstName: true,
                lastName: true,
                phone: true,
                role: true
            }
        });

        // 5. Output results
        console.log(`\n📋 Broadcast Recipients Found: ${recipients.length}`);
        if (recipients.length > 0) {
            recipients.forEach((r, i) => {
                console.log(`   ${i + 1}. ${r.firstName} ${r.lastName} (${r.role}) - ${r.phone}`);
            });
            console.log('\n✅ Verification Successful: Recipients identified correctly (Sender excluded).');
        } else {
            console.log('⚠️ No other admins found. This might be correct if there is only 1 admin.');

            // Check total admins to verify
            const totalAdmins = await prisma.user.count({
                where: {
                    tenantId: tenant.id,
                    role: { in: broadcastToRoles },
                    phone: { not: null }
                }
            });
            console.log(`   (Total Admins in DB: ${totalAdmins})`);
            if (totalAdmins > 1) {
                console.error('❌ FAILURE: There are multiple admins but 0 recipients found. Exclusion logic might be too aggressive.');
            } else {
                console.log('✅ Verification Successful: Only 1 admin exists, so 0 broadcast recipients is correct.');
            }
        }

    } catch (error) {
        console.error('❌ Error during test:', error);
    } finally {
        await prisma.$disconnect();
    }
}

testBroadcastLogic();
