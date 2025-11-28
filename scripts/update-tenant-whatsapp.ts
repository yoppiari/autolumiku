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

    console.log('Connecting with limited pool...');

    const prisma = new PrismaClient({
        datasources: {
            db: {
                url: dbUrl,
            },
        },
    });

    try {
        console.log('Updating tenant WhatsApp number...');
        const tenant = await prisma.tenant.update({
            where: { slug: 'showroomjakarta' },
            data: {
                whatsappNumber: '6281234567890',
                phoneNumber: '6281234567890',
                address: 'Jl. Jend. Sudirman No. 1, Jakarta Pusat',
                city: 'Jakarta Pusat',
                province: 'DKI Jakarta',
            },
        });

        console.log(`✅ Updated tenant: ${tenant.name}`);
        console.log(`   WhatsApp: ${tenant.whatsappNumber}`);
    } catch (e) {
        console.error('Error updating tenant:', e);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();
