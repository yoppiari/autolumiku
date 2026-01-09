import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { LeadService } from '@/lib/services/lead-service';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const tenantId = searchParams.get('tenantId');
        const vehicleId = searchParams.get('vehicleId');
        const phone = searchParams.get('phone'); // Optional: if we know the user's phone (e.g. logged in)
        const source = searchParams.get('source') || 'website_click';

        if (!tenantId) {
            return NextResponse.json({ error: 'Tenant ID is required' }, { status: 400 });
        }

        // Track the click
        await LeadService.trackWhatsAppClick({
            tenantId,
            vehicleId: vehicleId || undefined,
            source,
            metadata: {
                userAgent: request.headers.get('user-agent'),
                ip: request.headers.get('x-forwarded-for') || 'unknown'
            }
        });

        // If we have vehicle details, we can construct a specific WhatsApp message URL
        let whatsappUrl = 'https://wa.me/6281234567890'; // Default fallback

        // Get tenant's WhatsApp number
        const tenantConfig = await prisma.whatsAppAIConfig.findUnique({
            where: { tenantId }
        });

        if (tenantConfig && tenantConfig.phoneNumber) {
            // Format: 628...
            whatsappUrl = `https://wa.me/${tenantConfig.phoneNumber}`;
        }

        // Add pre-filled message
        let text = 'Halo, saya tertarik dengan mobil di website.';
        if (vehicleId) {
            const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
            if (vehicle) {
                text = `Halo, saya tertarik dengan ${vehicle.make} ${vehicle.model} ${vehicle.year} (Rp ${vehicle.price.toLocaleString('id-ID')}). Masih ada?`;
            }
        }

        const encodedText = encodeURIComponent(text);
        const finalUrl = `${whatsappUrl}?text=${encodedText}`;

        // Redirect user to WhatsApp
        return NextResponse.redirect(finalUrl);

    } catch (error) {
        console.error('Track Click Error:', error);
        // On error, just redirect to home or generic WA to fail gracefully
        return NextResponse.redirect('https://primamobil.id');
    }
}
