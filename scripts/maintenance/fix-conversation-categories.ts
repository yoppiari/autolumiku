import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function normalizePhone(phone: string): string {
    if (!phone) return '';
    if (phone.includes('@')) phone = phone.split('@')[0];
    if (phone.includes(':')) phone = phone.split(':')[0];
    let digits = phone.replace(/\D/g, '');
    if (digits.startsWith('0')) digits = '62' + digits.substring(1);
    return digits;
}

async function fixConversations() {
    console.log('--- Checking Conversation Categorization ---');

    // Get all staff, including OWNER and SUPER_ADMIN
    const staffUsers = await prisma.user.findMany({
        where: {
            role: { in: ['ADMIN', 'MANAGER', 'SALES', 'STAFF', 'OWNER', 'SUPER_ADMIN'] },
            phone: { not: null },
        },
        select: { phone: true, role: true, email: true },
    });

    console.log(`Found ${staffUsers.length} staff users with phone numbers.`);

    const staffPhoneSet = new Set<string>();
    const staffInfoMap = new Map<string, any>();

    for (const user of staffUsers) {
        if (user.phone) {
            const norm = normalizePhone(user.phone);
            staffPhoneSet.add(norm);
            staffInfoMap.set(norm, user);
            console.log(`Staff: ${user.email} (${user.role}) -> ${norm}`);
        }
    }

    const conversations = await prisma.whatsAppConversation.findMany();
    console.log(`Checking ${conversations.length} total conversations...`);

    let fixCount = 0;
    for (const conv of conversations) {
        const normPhone = normalizePhone(conv.customerPhone);
        const isStaffByRole = staffPhoneSet.has(normPhone);

        if (isStaffByRole && !conv.isStaff) {
            const staffInfo = staffInfoMap.get(normPhone);
            console.log(`[FIX] Conv ${conv.id} (${conv.customerPhone}) should be STAFF (User: ${staffInfo.email} - ${staffInfo.role})`);

            await prisma.whatsAppConversation.update({
                where: { id: conv.id },
                data: {
                    isStaff: true,
                    conversationType: 'staff'
                }
            });
            fixCount++;
        } else if (!isStaffByRole && conv.isStaff) {
            console.log(`[NOTE] Conv ${conv.id} (${conv.customerPhone}) is marked as staff but no user found with this phone. (Might be stale)`);
        }
    }

    console.log(`--- Finished. Fixed ${fixCount} conversations. ---`);
}

fixConversations()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
