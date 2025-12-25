/**
 * WhatsApp AI Staff Sync API
 * POST /api/v1/whatsapp-ai/sync-staff
 *
 * Syncs all WhatsApp conversations with registered staff from User table
 * Updates isStaff flag on conversations that belong to registered staff members
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * Normalize phone number for comparison
 */
function normalizePhone(phone: string): string {
  if (!phone) return '';

  // Handle JID format (e.g., "6281234567890@s.whatsapp.net")
  if (phone.includes('@')) {
    phone = phone.split('@')[0];
  }

  // Handle device suffix (e.g., "6281234567890:17")
  if (phone.includes(':')) {
    phone = phone.split(':')[0];
  }

  // Remove all non-digits
  let digits = phone.replace(/\D/g, '');

  // Convert 0xxx to 62xxx (Indonesian format)
  if (digits.startsWith('0')) {
    digits = '62' + digits.substring(1);
  }

  return digits;
}

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');

    if (!tenantId) {
      return NextResponse.json(
        { error: 'tenantId is required' },
        { status: 400 }
      );
    }

    console.log(`[Staff Sync] Starting sync for tenant: ${tenantId}`);

    // Get all staff users with phone numbers
    const staffUsers = await prisma.user.findMany({
      where: {
        tenantId,
        role: { in: ['ADMIN', 'MANAGER', 'SALES', 'STAFF'] },
        phone: { not: null },
      },
      select: {
        id: true,
        phone: true,
        firstName: true,
        lastName: true,
        role: true,
      },
    });

    console.log(`[Staff Sync] Found ${staffUsers.length} staff users with phones`);

    // Get all conversations for this tenant
    const conversations = await prisma.whatsAppConversation.findMany({
      where: { tenantId },
      select: {
        id: true,
        customerPhone: true,
        isStaff: true,
        customerName: true,
      },
    });

    console.log(`[Staff Sync] Found ${conversations.length} conversations to check`);

    // Build staff phone lookup map
    const staffPhoneMap = new Map<string, { name: string; role: string }>();
    for (const user of staffUsers) {
      if (user.phone) {
        const normalized = normalizePhone(user.phone);
        staffPhoneMap.set(normalized, {
          name: `${user.firstName} ${user.lastName || ''}`.trim(),
          role: user.role,
        });
      }
    }

    // Check each conversation and update if needed
    let updated = 0;
    let alreadyStaff = 0;

    for (const conv of conversations) {
      const normalizedConvPhone = normalizePhone(conv.customerPhone);
      const staffInfo = staffPhoneMap.get(normalizedConvPhone);

      if (staffInfo) {
        if (!conv.isStaff) {
          // Update conversation to mark as staff
          await prisma.whatsAppConversation.update({
            where: { id: conv.id },
            data: {
              isStaff: true,
              conversationType: 'staff',
              customerName: staffInfo.name || conv.customerName,
            },
          });
          updated++;
          console.log(`[Staff Sync] Updated conversation ${conv.id} (${normalizedConvPhone}) as staff: ${staffInfo.name}`);
        } else {
          alreadyStaff++;
        }
      }
    }

    console.log(`[Staff Sync] Complete. Updated: ${updated}, Already staff: ${alreadyStaff}`);

    return NextResponse.json({
      success: true,
      data: {
        totalConversations: conversations.length,
        staffUsers: staffUsers.length,
        updated,
        alreadyStaff,
      },
      message: `Synced ${updated} conversations as staff`,
    });
  } catch (error) {
    console.error('[Staff Sync] Error:', error);
    return NextResponse.json(
      { error: 'Failed to sync staff' },
      { status: 500 }
    );
  }
}
