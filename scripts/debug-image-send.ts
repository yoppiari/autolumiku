
import { AimeowClientService } from '../src/lib/services/aimeow/aimeow-client.service';
import { prisma } from '../src/lib/prisma';
import fs from 'fs/promises';
import path from 'path';

// MOCK CONSTANTS
const MOCK_PHONE = '085385419766'; // Use user's phone for real feedback
const MOCK_CAPTION = 'Auto-Test: Silent Fail Debug';

async function main() {
    console.log('🔍 Starting Reproduction of Image Failure...');
    console.log('-------------------------------------------');

    // 1. Find a valid vehicle with photo
    const vehicle = await prisma.vehicle.findFirst({
        where: {
            status: { not: 'DELETED' },
            photos: { some: {} }
        },
        include: { photos: { take: 1 } }
    });

    if (!vehicle || !vehicle.photos[0]) {
        console.error('❌ No vehicle with photos found to test.');
        return;
    }

    const photo = vehicle.photos[0];
    console.log(`🚗 Found Vehicle: ${vehicle.make} ${vehicle.model}`);
    console.log(`📸 Photo URL: ${photo.originalUrl}`);

    // 2. Identify storage path
    // We need to simulate exactly what getImageAsBase64 does
    let storageKey = '';
    if (photo.originalUrl.includes('/uploads/')) {
        storageKey = photo.originalUrl.split('/uploads/')[1];
    } else {
        // If it's a full URL, try to parse
        try {
            const url = new URL(photo.originalUrl);
            if (url.pathname.includes('/uploads/')) {
                storageKey = url.pathname.split('/uploads/')[1];
            }
        } catch (e) { }
    }

    console.log(`📂 Storage Key: ${storageKey}`);

    if (!storageKey) {
        console.error('❌ Could not extract storage key from URL');
        return; // Can't test filesystem read if not a local file
    }

    // 3. Test Filesystem Read (Crucial Step)
    const possibleDirs = [
        process.env.UPLOAD_DIR,
        '/app/uploads',
        path.join(process.cwd(), 'uploads')
    ].filter(Boolean) as string[];

    let foundPath = '';
    for (const dir of possibleDirs) {
        const p = path.join(dir, storageKey);
        try {
            await fs.access(p);
            console.log(`✅ File FOUND at: ${p}`);
            foundPath = p;
            break;
        } catch (e) {
            console.log(`⚠️ File NOT found at: ${p}`);
        }
    }

    if (!foundPath) {
        console.error(`❌ CRITICAL: File does not exist in any expected directory! This is why it fails silently (Base64 becomes null/empty).`);

        // Check if we can list the directory to see what IS there
        try {
            const uploadDir = path.join(process.cwd(), 'uploads');
            const files = await fs.readdir(uploadDir);
            console.log(`📂 Listing ${uploadDir} (First 10 files):`, files.slice(0, 10));
        } catch (e) { }

        return;
    }

    // 4. Test Base64 Generation Size
    const buffer = await fs.readFile(foundPath);
    const base64 = buffer.toString('base64');
    console.log(`📦 Base64 generated. Length: ${base64.length} chars (~${(base64.length / 1024).toFixed(0)} KB)`);

    if (base64.length > 5 * 1024 * 1024) { // > 5MB
        console.warn(`⚠️ WARNING: File is HUGE. Aimeow might reject it without error.`);
    }

    // 5. Simulate Send (Real Request)
    console.log('📤 Attempting Real Send via Service...');

    // We need a dummy tenant context or just fetch the client manually
    const tenant = await prisma.tenant.findUnique({
        where: { id: vehicle.tenantId }
    });

    if (!tenant || !tenant.aimeowApiClientId) {
        console.error('❌ Tenant has no API Client ID');
        return;
    }

    // Call the public method if accessible, or just replicate the fetch logic
    // Since we can't easily instantiate the service with full private context, we'll replicate the exact FETCH call

    const endpoint = `${process.env.AIMEOW_BASE_URL || 'https://meow.lumiku.com'}/api/v1/clients/${tenant.aimeowApiClientId}/send-images`;

    console.log(`🌐 POST to: ${endpoint}`);

    const payload = {
        phone: MOCK_PHONE,
        images: [{
            imageUrl: `data:image/jpeg;base64,${base64}`,
            caption: MOCK_CAPTION
        }],
        viewOnce: false,
        isViewOnce: false,
        mimetype: 'image/jpeg',
        mimeType: 'image/jpeg',
        type: 'image',
        mediaType: 'image'
    };

    try {
        const response = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        console.log(`📡 Response Status: ${response.status} ${response.statusText}`);
        const text = await response.text();
        console.log(`📄 Response Body: ${text.substring(0, 500)}`); // detailed log

    } catch (e: any) {
        console.error(`❌ FETCH ERROR:`, e.message);
    }

}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
