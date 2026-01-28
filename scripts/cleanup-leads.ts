
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanupStaffLeads() {
  console.log('🧹 Starting cleanup of leads created by staff/admin...');

  try {
    // 1. Get all staff users
    const staffUsers = await prisma.user.findMany({
      where: {
        OR: [
          { roleLevel: { gte: 30 } }, // Admin/Owner
          { role: { in: ['STAFF', 'SALES', 'ADMIN', 'OWNER', 'SUPER_ADMIN'] } }
        ],
        phone: { not: null }
      },
      select: { id: true, firstName: true, phone: true, role: true }
    });

    console.log(`Found ${staffUsers.length} staff users.`);

    let totalDeleted = 0;

    for (const user of staffUsers) {
      if (!user.phone) continue;

      // Normalize phone for matching (remove non-digits)
      const cleanPhone = user.phone.replace(/\D/g, '');
      if (cleanPhone.length < 5) continue;

      // Search matching phones (08... 628...)
      const searchPhones = [
        cleanPhone,
        cleanPhone.startsWith('62') ? '0' + cleanPhone.slice(2) : '62' + cleanPhone.slice(1),
        cleanPhone.startsWith('0') ? '62' + cleanPhone.slice(1) : '0' + cleanPhone
      ];

      // Find leads with these phones
      const leads = await prisma.lead.findMany({
        where: {
          OR: searchPhones.map(p => ({ phone: { contains: p } }))
        }
      });

      if (leads.length > 0) {
        console.log(`User ${user.firstName} (${user.role}, ${user.phone}) has ${leads.length} leads. Deleting...`);
        
        const deleteResult = await prisma.lead.deleteMany({
          where: {
            id: { in: leads.map(l => l.id) }
          }
        });

        totalDeleted += deleteResult.count;
        console.log(`Deleted ${deleteResult.count} leads for ${user.firstName}.`);
      }
    }

    console.log(`\n✅ Cleanup complete. Total leads deleted: ${totalDeleted}`);

  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  } finally {
    await prisma.$disconnect();
  }
}

cleanupStaffLeads();
