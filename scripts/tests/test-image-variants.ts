
import { AimeowClientService } from '../src/lib/services/aimeow/aimeow-client.service';
import { prisma } from '../src/lib/prisma';
import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';

const TARGET_PHONE = '085385419766'; // User's number from screenshot

async function main() {
    console.log('🧪 Starting Variant Test for Aimeow Image Delivery...');

    // 1. Find a valid vehicle with photo
    const vehicle = await prisma.vehicle.findFirst({
        where: {
            status: { not: 'DELETED' },
            photos: { some: {} }
        },
        include: { photos: { take: 1 } }
    });

    if (!vehicle || !vehicle.photos[0]) {
        console.error('❌ No vehicle found.');
        return;
    }

    const tenant = await prisma.tenant.findUnique({ where: { id: vehicle.tenantId } });
    if (!tenant?.aimeowApiClientId) {
        console.error('❌ No Tenant Client ID.');
        return;
    }

    // 2. Prepare Base64 (Standard 1024px JPEG)
    // We simulate what the service does
    let buffer;
    // Try to find file
    const storageKey = vehicle.photos[0].originalUrl.split('/uploads/')[1];
    const possibleDirs = [process.env.UPLOAD_DIR, '/app/uploads', path.join(process.cwd(), 'uploads')].filter(Boolean) as string[];

    for (const dir of possibleDirs) {
        try {
            buffer = await fs.readFile(path.join(dir, storageKey));
            break;
        } catch (e) { }
    }

    if (!buffer) {
        console.error('❌ Could not read local file for test.');
        return;
    }

    const jpegBuffer = await sharp(buffer)
        .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toBuffer();

    const base64 = jpegBuffer.toString('base64');
    console.log(`📦 Prepared Base64 size: ${(base64.length / 1024).toFixed(2)} KB`);

    const endpoint = `${process.env.AIMEOW_BASE_URL || 'https://meow.lumiku.com'}/api/v1/clients/${tenant.aimeowApiClientId}/send-images`;

    // VARIANT A: CURRENT LOGIC (Top-level MIME, Data URI)
    await sendVariant(endpoint, 'A (Current)', {
        phone: TARGET_PHONE,
        images: [{
            imageUrl: `data:image/jpeg;base64,${base64}`,
            caption: "Test Variant A: Current Logic"
        }],
        viewOnce: false,
        isViewOnce: false,
        mimetype: 'image/jpeg',
        mimeType: 'image/jpeg',
        type: 'image',
        mediaType: 'image'
    });

    // VARIANT B: NO TOP-LEVEL MIME (Clean)
    // Maybe top-level mime confuses it when using array?
    await sendVariant(endpoint, 'B (No Top Mime)', {
        phone: TARGET_PHONE,
        images: [{
            imageUrl: `data:image/jpeg;base64,${base64}`,
            caption: "Test Variant B: No Top-level Mime"
        }],
        viewOnce: false,
        isViewOnce: false
    });

    // VARIANT C: RAW BASE64 (No Prefix) - Unlikely but possible
    await sendVariant(endpoint, 'C (Raw Base64)', {
        phone: TARGET_PHONE,
        images: [{
            imageUrl: base64,
            caption: "Test Variant C: Raw Base64 (No prefix)"
        }],
        viewOnce: false,
        isViewOnce: false,
        mimetype: 'image/jpeg',
        mimeType: 'image/jpeg'
    });

    // VARIANT D: SMALLER (512px)
    const smallBuffer = await sharp(buffer)
        .resize(512, 512, { fit: 'inside' })
        .jpeg({ quality: 70 })
        .toBuffer();
    const smallBase64 = smallBuffer.toString('base64');

    await sendVariant(endpoint, 'D (Small 512px)', {
        phone: TARGET_PHONE,
        images: [{
            imageUrl: `data:image/jpeg;base64,${smallBase64}`,
            caption: "Test Variant D: Small 512px"
        }],
        viewOnce: false,
        isViewOnce: false,
        mimetype: 'image/jpeg',
        mimeType: 'image/jpeg'
    });

}

async function sendVariant(url: string, name: string, payload: any) {
    console.log(`\n📤 Sending ${name}...`);
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const txt = await res.text();
        console.log(`✅ ${name} Result: ${res.status} - ${txt.substring(0, 100)}`);
    } catch (e: any) {
        console.log(`❌ ${name} Failed: ${e.message}`);
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
