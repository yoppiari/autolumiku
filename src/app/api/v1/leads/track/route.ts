/**
 * POST/GET /api/v1/leads/track
 * Handles both event tracking (POST) and WhatsApp redirection (GET)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { LeadService } from '@/lib/services/leads/lead-service';

export const dynamic = 'force-dynamic';

/**
 * GET - WhatsApp Redirect & Track
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');
    const vehicleId = searchParams.get('vehicleId');
    const source = searchParams.get('source') || 'website_click';

    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant ID is required' }, { status: 400 });
    }

    // Track the click in background
    LeadService.trackWhatsAppClick({
      tenantId,
      vehicleId: vehicleId || undefined,
      source,
      metadata: {
        userAgent: request.headers.get('user-agent'),
        ip: request.headers.get('x-forwarded-for') || 'unknown'
      }
    }).catch(err => console.error('BG Track Error:', err));

    // Get tenant's WhatsApp number
    const account = await prisma.aimeowAccount.findUnique({
      where: { tenantId },
      select: { phoneNumber: true }
    });

    const waNumber = account?.phoneNumber || '6285385419766'; // Fallback
    let whatsappUrl = `https://wa.me/${waNumber.replace(/\D/g, '')}`;

    // Construct pre-filled message
    let text = 'Halo, saya tertarik dengan mobil di website.';
    if (vehicleId) {
      const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
      if (vehicle) {
        text = `Halo, saya tertarik dengan ${vehicle.make} ${vehicle.model} ${vehicle.year} (Rp ${vehicle.price.toLocaleString('id-ID')}). Masih ada?`;
      }
    }

    return NextResponse.redirect(`${whatsappUrl}?text=${encodeURIComponent(text)}`);

  } catch (error) {
    console.error('Track Click Redirect Error:', error);
    return NextResponse.redirect('https://primamobil.id');
  }
}

/**
 * POST - Standard Event Tracking
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tenantId, vehicleId, source, metadata } = body;

    if (!tenantId || !source) {
      return NextResponse.json({ error: 'tenantId and source are required' }, { status: 400 });
    }

    const result = await LeadService.trackWhatsAppClick({
      tenantId,
      vehicleId,
      source,
      metadata,
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Track event error:', error);
    return NextResponse.json({ error: 'Failed to track', message: error.message }, { status: 500 });
  }
}
