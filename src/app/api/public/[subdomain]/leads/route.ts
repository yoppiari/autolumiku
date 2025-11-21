/**
 * Public Lead Submission API
 * Epic 5: Story 5.5 - Contact Forms & Lead Capture
 *
 * POST /api/public/[subdomain]/leads - Submit customer inquiry
 */

import { NextRequest, NextResponse } from 'next/server';
import { leadService } from '@/services/catalog/lead.service';
import { brandingService } from '@/services/catalog/branding.service';

export async function POST(
  request: NextRequest,
  { params }: { params: { subdomain: string } }
) {
  try {
    const { subdomain } = params;

    // Resolve tenant from subdomain
    const branding = await brandingService.getBrandingBySubdomain(subdomain);
    if (!branding) {
      return NextResponse.json(
        { error: 'Showroom not found' },
        { status: 404 }
      );
    }

    const body = await request.json();

    // Validate required fields
    if (!body.name || !body.phone || !body.message) {
      return NextResponse.json(
        { error: 'Missing required fields: name, phone, message' },
        { status: 400 }
      );
    }

    // Validate phone format (basic)
    const phoneRegex = /^(\+62|62|0)[0-9]{9,12}$/;
    if (!phoneRegex.test(body.phone.replace(/\s|-/g, ''))) {
      return NextResponse.json(
        { error: 'Invalid phone number format' },
        { status: 400 }
      );
    }

    // Create lead
    const lead = await leadService.createLead(branding.tenantId, {
      name: body.name,
      email: body.email,
      phone: body.phone,
      whatsappNumber: body.whatsappNumber || body.phone,
      message: body.message,
      vehicleId: body.vehicleId,
      source: body.source || 'website',
      interestedIn: body.interestedIn,
      budgetRange: body.budgetRange,
      timeframe: body.timeframe,
    });

    // Generate WhatsApp URL if needed
    let whatsappUrl: string | undefined;
    if (branding.whatsappNumber) {
      const whatsappMessage = leadService.generateWhatsAppMessage({
        make: body.vehicleMake || '',
        model: body.vehicleModel || '',
        year: body.vehicleYear || 0,
        price: body.vehiclePrice || 0,
      });

      whatsappUrl = leadService.generateWhatsAppURL(
        branding.whatsappNumber,
        whatsappMessage
      );
    }

    return NextResponse.json(
      {
        success: true,
        leadId: lead.id,
        message: 'Terima kasih! Kami akan segera menghubungi Anda.',
        whatsappUrl,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Lead submission error:', error);
    return NextResponse.json(
      { error: 'Failed to submit inquiry', details: error.message },
      { status: 500 }
    );
  }
}
