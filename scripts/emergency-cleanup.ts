import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanup() {
    console.log('🚀 Starting targeted lead cleanup...');

    // 1. Get all staff phone numbers
    const staff = await prisma.user.findMany({
        where: {
            OR: [
                { role: 'OWNER' },
                { role: 'ADMIN' },
                { role: 'MANAGER' },
                { roleLevel: { gte: 30 } }
            ]
        },
        select: { phone: true, firstName: true, lastName: true }
    });

    const staffPhones = staff.map(s => s.phone?.replace(/\D/g, '')).filter(Boolean) as string[];
    const staffNames = staff.map(s => `${s.firstName} ${s.lastName}`);

    console.log(`📋 Found ${staffPhones.length} staff phone numbers and ${staffNames.length} staff names.`);

    // 2. Delete Staff Leads
    const deletedStaff = await prisma.lead.deleteMany({
        where: {
            OR: [
                { phone: { in: staffPhones } },
                { whatsappNumber: { in: staffPhones } },
                { name: { in: staffNames } }
            ]
        }
    });
    console.log(`✅ Deleted ${deletedStaff.count} staff leads.`);

    // 3. Delete Junk Leads (Number-only names or known junk tags)
    const deletedJunk = await prisma.lead.deleteMany({
        where: {
            OR: [
                { name: { equals: 'Unknown' } },
                { name: { equals: 'Customer Baru' } },
                { name: { equals: 'Customer' } },
                { name: { contains: '628' } }, // Names that are just phone numbers
                { name: { contains: '08' } },
                { interestedIn: null }
            ]
        }
    });
    console.log(`✅ Deleted ${deletedJunk.count} junk leads.`);

    // 4. Delete orphaned leads (No matching conversation)
    const allLeads = await prisma.lead.findMany({
        where: { source: 'whatsapp_auto' },
        select: { id: true, phone: true }
    });

    const allConvs = await prisma.whatsAppConversation.findMany({
        select: { customerPhone: true }
    });

    const convPhones = new Set(allConvs.map(c => c.customerPhone.replace(/\D/g, '')));
    const orphanIds = allLeads
        .filter(l => !convPhones.has(l.phone.replace(/\D/g, '')))
        .map(l => l.id);

    if (orphanIds.length > 0) {
        const deletedOrphans = await prisma.lead.deleteMany({
            where: { id: { in: orphanIds } }
        });
        console.log(`✅ Deleted ${deletedOrphans.count} orphaned leads.`);
    }

    console.log('✨ Cleanup complete!');
}

cleanup()
    .catch(e => console.error('❌ Error during cleanup:', e))
    .finally(async () => await prisma.$disconnect());
