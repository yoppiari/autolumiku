/**
 * Fix User Record - Update incorrect user data
 * 
 * This script updates the user record for phone 081310703754
 * to reflect the correct name and role (Super Admin)
 */

import { prisma } from './src/lib/prisma';

async function fixUserRecord() {
    const phone = '081310703754';

    console.log(`🔧 Fixing user record for phone: ${phone}\n`);

    // Normalize phone for search
    const normalizePhone = (phone: string): string => {
        if (!phone) return "";
        if (phone.includes("@")) phone = phone.split("@")[0];
        if (phone.includes(":")) phone = phone.split(":")[0];
        let digits = phone.replace(/\D/g, "");
        if (digits.startsWith("0")) digits = "62" + digits.substring(1);
        return digits;
    };

    const normalized = normalizePhone(phone);

    // Find all users with this phone
    const users = await prisma.user.findMany();
    const matchingUsers = users.filter(u => u.phone && normalizePhone(u.phone) === normalized);

    if (matchingUsers.length === 0) {
        console.log(`❌ No user found with phone ${phone}`);
        return;
    }

    console.log(`Found ${matchingUsers.length} matching user(s)\n`);

    // Update each matching user
    for (const user of matchingUsers) {
        console.log(`📝 Updating user: ${user.id}`);
        console.log(`   Current: ${user.firstName} ${user.lastName || ''} (${user.role})`);

        const updated = await prisma.user.update({
            where: { id: user.id },
            data: {
                firstName: 'Yudho',
                lastName: 'D.L.',
                role: 'SUPER_ADMIN',
                roleLevel: 100,
                // Ensure tenantId is null for Super Admin
                tenantId: null,
            },
        });

        console.log(`   Updated: ${updated.firstName} ${updated.lastName || ''} (${updated.role})`);
        console.log(`   ✅ Success!\n`);
    }

    console.log(`🎉 User record updated successfully!`);
    console.log(`\nThe AI should now recognize you correctly.`);
}

fixUserRecord()
    .catch(e => {
        console.error('❌ Error:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
