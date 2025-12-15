/**
 * Fix Prima Mobil WhatsApp Number
 * One-time script to set WhatsApp number for primamobil-id tenant
 * Run: npx ts-node scripts/fix-primamobil-whatsapp.ts
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
        // Prima Mobil WhatsApp number (format: country code without +)
        const WHATSAPP_NUMBER = '62811360752';
        const PHONE_NUMBER = '+62-811-360-752';
        const TENANT_SLUG = 'primamobil-id';

        // Check if tenant exists
        const existingTenant = await prisma.tenant.findUnique({
            where: { slug: TENANT_SLUG },
        });

        if (!existingTenant) {
            console.error(`❌ Tenant with slug '${TENANT_SLUG}' not found`);
            process.exit(1);
        }

        console.log(`📱 Updating Prima Mobil WhatsApp number...`);
        console.log(`   Current WhatsApp: ${existingTenant.whatsappNumber || '(not set)'}`);

        const tenant = await prisma.tenant.update({
            where: { slug: TENANT_SLUG },
            data: {
                whatsappNumber: WHATSAPP_NUMBER,
                phoneNumber: PHONE_NUMBER,
            },
        });

        console.log(`✅ Successfully updated tenant: ${tenant.name}`);
        console.log(`   Slug: ${tenant.slug}`);
        console.log(`   WhatsApp: ${tenant.whatsappNumber}`);
        console.log(`   Phone: ${tenant.phoneNumber}`);
        console.log('');
        console.log('🎉 WhatsApp button should now be active on the website!');
    } catch (e) {
        console.error('❌ Error updating tenant:', e);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();
