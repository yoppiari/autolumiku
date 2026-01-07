import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    const TARGET_PHONE = '6281310703754'; // User's actual WhatsApp number

    try {
        console.log('[Test Image Send] Starting API-based test...');

        // 1. Find a vehicle with photo
        const vehicle = await prisma.vehicle.findFirst({
            where: {
                status: { not: 'DELETED' },
                photos: { some: {} }
            },
            include: { photos: { take: 1 } }
        });

        if (!vehicle || !vehicle.photos[0]) {
            return NextResponse.json({ error: 'No vehicle found with photos' }, { status: 404 });
        }

        const tenant = await prisma.tenant.findUnique({ where: { id: vehicle.tenantId } });
        if (!tenant?.aimeowApiClientId) {
            return NextResponse.json({ error: 'No client ID found' }, { status: 404 });
        }

        // 2. Read file
        const storageKey = vehicle.photos[0].originalUrl.split('/uploads/')[1];
        const possibleDirs = [process.env.UPLOAD_DIR, '/app/uploads', path.join(process.cwd(), 'uploads')].filter(Boolean) as string[];

        let buffer: Buffer | undefined;
        for (const dir of possibleDirs) {
            try {
                const fullPath = path.join(dir, storageKey);
                if (fs.existsSync(fullPath)) {
                    buffer = fs.readFileSync(fullPath);
                    break;
                }
            } catch (e) { }
        }

        if (!buffer) {
            return NextResponse.json({ error: 'File not found' }, { status: 404 });
        }

        // 3. Process with sharp
        let sharp;
        try {
            sharp = require('sharp');
        } catch (e) {
            return NextResponse.json({ error: 'Sharp not installed' }, { status: 500 });
        }

        const endpoint = `${process.env.AIMEOW_BASE_URL || 'https://meow.lumiku.com'}/api/v1/clients/${tenant.aimeowApiClientId}/send-images`;

        const send = async (name: string, payload: any) => {
            try {
                const res = await fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const status = res.status;
                const text = await res.text();
                return { name, status, ok: res.ok, response: text.substring(0, 100) };
            } catch (e: any) {
                return { name, status: 0, ok: false, error: e.message };
            }
        };

        const results: any[] = [];

        // VARIANT A: CURRENT LOGIC
        const jpegBuffer = await sharp(buffer)
            .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: 80 })
            .toBuffer();
        const base64A = jpegBuffer.toString('base64');

        results.push(await send('Variant A (Standard)', {
            phone: TARGET_PHONE,
            images: [{ imageUrl: `data:image/jpeg;base64,${base64A}`, caption: "Test A: Standard (1024px, MimeType)" }],
            viewOnce: false,
            isViewOnce: false,
            mimetype: 'image/jpeg',
            mimeType: 'image/jpeg',
            type: 'image',
            mediaType: 'image'
        }));

        // VARIANT B: NO TOP MIME
        results.push(await send('Variant B (No Top Mime)', {
            phone: TARGET_PHONE,
            images: [{ imageUrl: `data:image/jpeg;base64,${base64A}`, caption: "Test B: No Top-Level Mime" }],
            viewOnce: false,
            isViewOnce: false
        }));

        // VARIANT C: RAW BASE64
        results.push(await send('Variant C (Raw Base64)', {
            phone: TARGET_PHONE,
            images: [{ imageUrl: base64A, caption: "Test C: Raw Base64 (No Prefix)" }],
            viewOnce: false,
            isViewOnce: false,
            mimetype: 'image/jpeg',
            mimeType: 'image/jpeg'
        }));

        // VARIANT D: SMALL (512px)
        const smallBuffer = await sharp(buffer).resize(512, 512, { fit: 'inside' }).jpeg({ quality: 70 }).toBuffer();
        const base64D = smallBuffer.toString('base64');

        results.push(await send('Variant D (Small 512px)', {
            phone: TARGET_PHONE,
            images: [{ imageUrl: `data:image/jpeg;base64,${base64D}`, caption: "Test D: Small 512px" }],
            viewOnce: false,
            isViewOnce: false,
            mimetype: 'image/jpeg',
            mimeType: 'image/jpeg'
        }));

        return NextResponse.json({
            success: true,
            message: 'Test images sent! Check WhatsApp to see which variant displays correctly.',
            results,
            instructions: 'Check your phone (085385419766) and tell us which variant (A, B, C, or D) shows the image.'
        });

    } catch (error: any) {
        console.error('[Test Image Send] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
