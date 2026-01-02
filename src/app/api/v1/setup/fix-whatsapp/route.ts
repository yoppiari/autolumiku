/**
 * One-time fix endpoint for Prima Mobil WhatsApp number
 * GET /api/v1/setup/fix-whatsapp
 *
 * This endpoint updates the WhatsApp number for primamobil-id tenant
 * Can be called via browser: https://auto.lumiku.com/api/v1/setup/fix-whatsapp
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const TENANT_SLUG = 'primamobil-id';
    const WHATSAPP_NUMBER = '6285385419766';
    const PHONE_NUMBER = '+62 853-8541-9766';

    // Check if tenant exists
    const existingTenant = await prisma.tenant.findUnique({
      where: { slug: TENANT_SLUG },
    });

    if (!existingTenant) {
      return NextResponse.json(
        { error: `Tenant '${TENANT_SLUG}' not found` },
        { status: 404 }
      );
    }

    // Update tenant with WhatsApp number
    const updatedTenant = await prisma.tenant.update({
      where: { slug: TENANT_SLUG },
      data: {
        whatsappNumber: WHATSAPP_NUMBER,
        phoneNumber: existingTenant.phoneNumber || PHONE_NUMBER,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'WhatsApp number updated successfully!',
      data: {
        tenant: updatedTenant.name,
        slug: updatedTenant.slug,
        whatsappNumber: updatedTenant.whatsappNumber,
        phoneNumber: updatedTenant.phoneNumber,
      },
    });
  } catch (error) {
    console.error('Fix WhatsApp error:', error);
    return NextResponse.json(
      {
        error: 'Failed to update WhatsApp number',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
