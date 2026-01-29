/**
 * Reset WhatsApp Analytics Data
 * Menghapus data test untuk Customer Satisfaction dan Staff Activity
 * Run: npx ts-node scripts/reset-whatsapp-analytics.ts
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
    // Read .env manually to get the URL and append connection limit
    const envPath = path.join(process.cwd(), '.env');
    let dbUrl: string | undefined;

    try {
        const envContent = fs.readFileSync(envPath, 'utf-8');
        const dbUrlMatch = envContent.match(/DATABASE_URL="?([^"\n]+)"?/);
        if (dbUrlMatch) {
            dbUrl = dbUrlMatch[1];
        }
    } catch (e) {
        console.log('Could not read .env file, trying process.env');
    }

    if (!dbUrl) {
        dbUrl = process.env.DATABASE_URL;
    }

    if (!dbUrl) {
        throw new Error('Could not find DATABASE_URL');
    }

    // Append connection limit to avoid "Too many connections" error
    if (!dbUrl.includes('connection_limit')) {
        if (dbUrl.includes('?')) {
            dbUrl += '&connection_limit=1';
        } else {
            dbUrl += '?connection_limit=1';
        }
    }

    console.log('🔌 Connecting to database...');

    const prisma = new PrismaClient({
        datasources: {
            db: {
                url: dbUrl,
            },
        },
    });

    try {
        const TENANT_SLUG = 'primamobil-id';

        // Get tenant
        const tenant = await prisma.tenant.findUnique({
            where: { slug: TENANT_SLUG },
        });

        if (!tenant) {
            console.error(`❌ Tenant with slug '${TENANT_SLUG}' not found`);
            process.exit(1);
        }

        console.log(`📊 Resetting analytics data for: ${tenant.name}`);
        console.log('');

        // Preview counts
        const staffCommandLogsCount = await prisma.staffCommandLog.count({
            where: { tenantId: tenant.id }
        });
        const messagesCount = await prisma.whatsAppMessage.count({
            where: { tenantId: tenant.id }
        });
        const conversationsCount = await prisma.whatsAppConversation.count({
            where: { tenantId: tenant.id }
        });

        console.log('📋 Data yang akan dihapus:');
        console.log(`   - Staff Command Logs: ${staffCommandLogsCount}`);
        console.log(`   - WhatsApp Messages: ${messagesCount}`);
        console.log(`   - WhatsApp Conversations: ${conversationsCount}`);
        console.log('');

        // 1. Delete Staff Command Logs (Staff Activity)
        console.log('🗑️  Menghapus Staff Command Logs...');
        const deletedStaffLogs = await prisma.staffCommandLog.deleteMany({
            where: { tenantId: tenant.id }
        });
        console.log(`   ✅ Deleted: ${deletedStaffLogs.count} records`);

        // 2. Delete WhatsApp Messages (Customer Satisfaction)
        console.log('🗑️  Menghapus WhatsApp Messages...');
        const deletedMessages = await prisma.whatsAppMessage.deleteMany({
            where: { tenantId: tenant.id }
        });
        console.log(`   ✅ Deleted: ${deletedMessages.count} records`);

        // 3. Delete WhatsApp Conversations (Customer Satisfaction)
        console.log('🗑️  Menghapus WhatsApp Conversations...');
        const deletedConversations = await prisma.whatsAppConversation.deleteMany({
            where: { tenantId: tenant.id }
        });
        console.log(`   ✅ Deleted: ${deletedConversations.count} records`);

        console.log('');
        console.log('✅ Reset selesai! Customer Satisfaction dan Staff Activity sekarang 0%');
        console.log('');
        console.log('📊 Hasil:');
        console.log(`   - Staff Activity: 0 (dari ${staffCommandLogsCount})`);
        console.log(`   - Customer Satisfaction: 0% (conversations & messages dihapus)`);

    } catch (e) {
        console.error('❌ Error resetting analytics:', e);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();
