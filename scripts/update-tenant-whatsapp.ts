/**
 * Update Tenant WhatsApp Number
 * Usage: npx ts-node scripts/update-tenant-whatsapp.ts <tenant-slug> <whatsapp-number>
 * Example: npx ts-node scripts/update-tenant-whatsapp.ts primamobil-id 6281234567890
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
    const args = process.argv.slice(2);

    if (args.length < 2) {
        console.log('Usage: npx ts-node scripts/update-tenant-whatsapp.ts <tenant-slug> <whatsapp-number>');
        console.log('Example: npx ts-node scripts/update-tenant-whatsapp.ts primamobil-id 6281234567890');
        process.exit(1);
    }

    const tenantSlug = args[0];
    const whatsappNumber = args[1];

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

    console.log('Connecting with limited pool...');

    const prisma = new PrismaClient({
        datasources: {
            db: {
                url: dbUrl,
            },
        },
    });

    try {
        // Check if tenant exists
        const existingTenant = await prisma.tenant.findUnique({
            where: { slug: tenantSlug },
        });

        if (!existingTenant) {
            console.error(`❌ Tenant with slug '${tenantSlug}' not found`);
            process.exit(1);
        }

        console.log(`Updating tenant '${tenantSlug}' WhatsApp number to ${whatsappNumber}...`);

        const tenant = await prisma.tenant.update({
            where: { slug: tenantSlug },
            data: {
                whatsappNumber: whatsappNumber,
                phoneNumber: existingTenant.phoneNumber || whatsappNumber,
            },
        });

        console.log(`✅ Updated tenant: ${tenant.name}`);
        console.log(`   Slug: ${tenant.slug}`);
        console.log(`   WhatsApp: ${tenant.whatsappNumber}`);
        console.log(`   Phone: ${tenant.phoneNumber}`);
    } catch (e) {
        console.error('Error updating tenant:', e);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();
