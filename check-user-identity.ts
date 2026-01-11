import { prisma } from './src/lib/prisma';

async function checkUserIdentity() {
    const phone = '081310703754';

    // Normalize phone number
    const normalizePhone = (phone: string): string => {
        if (!phone) return "";
        if (phone.includes("@")) {
            phone = phone.split("@")[0];
        }
        if (phone.includes(":")) {
            phone = phone.split(":")[0];
        }
        let digits = phone.replace(/\D/g, "");
        if (digits.startsWith("0")) {
            digits = "62" + digits.substring(1);
        }
        return digits;
    };

    const normalized = normalizePhone(phone);
    console.log(`\n🔍 Checking for phone: ${phone}`);
    console.log(`✅ Normalized: ${normalized}\n`);

    // Find ALL users with this phone (both tenant-specific and global)
    const allUsers = await prisma.user.findMany({
        select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            role: true,
            roleLevel: true,
            tenantId: true,
            tenant: {
                select: {
                    id: true,
                    name: true,
                }
            }
        }
    });

    console.log(`📊 Total users in database: ${allUsers.length}\n`);

    // Find matches
    const matches = allUsers.filter(u => {
        if (!u.phone) return false;
        return normalizePhone(u.phone) === normalized;
    });

    if (matches.length === 0) {
        console.log(`❌ NO USER FOUND with phone ${phone}`);
        console.log(`\n💡 Suggestion: User needs to be created in the database first.`);
    } else {
        console.log(`✅ Found ${matches.length} matching user(s):\n`);
        matches.forEach((user, idx) => {
            console.log(`${idx + 1}. User Record:`);
            console.log(`   - ID: ${user.id}`);
            console.log(`   - Name: ${user.firstName} ${user.lastName || ''}`);
            console.log(`   - Email: ${user.email || 'N/A'}`);
            console.log(`   - Phone: ${user.phone}`);
            console.log(`   - Role: ${user.role}`);
            console.log(`   - Role Level: ${user.roleLevel}`);
            console.log(`   - Tenant ID: ${user.tenantId || 'NULL (Super Admin)'}`);
            console.log(`   - Tenant Name: ${user.tenant?.name || 'N/A (Global Admin)'}`);
            console.log('');
        });

        if (matches.length > 1) {
            console.log(`⚠️  WARNING: Multiple user records found!`);
            console.log(`   This might cause identification issues.`);
        }
    }

    // Check WhatsApp conversations for this phone
    const conversations = await prisma.whatsAppConversation.findMany({
        where: {
            customerPhone: {
                contains: phone.replace(/^0/, '')
            }
        },
        select: {
            id: true,
            customerPhone: true,
            customerName: true,
            isStaff: true,
            contextData: true,
            tenantId: true,
        },
        take: 5,
        orderBy: { lastMessageAt: 'desc' }
    });

    console.log(`\n💬 WhatsApp Conversations for this phone: ${conversations.length}\n`);
    conversations.forEach((conv, idx) => {
        console.log(`${idx + 1}. Conversation ${conv.id}:`);
        console.log(`   - Phone: ${conv.customerPhone}`);
        console.log(`   - Name: ${conv.customerName || 'N/A'}`);
        console.log(`   - Is Staff: ${conv.isStaff}`);
        console.log(`   - Tenant ID: ${conv.tenantId}`);
        const ctx = conv.contextData as any;
        if (ctx?.verifiedStaffPhone) {
            console.log(`   - Verified Staff Phone: ${ctx.verifiedStaffPhone}`);
        }
        console.log('');
    });
}

checkUserIdentity()
    .catch(e => console.error('❌ Error:', e))
    .finally(async () => {
        await prisma.$disconnect();
    });
