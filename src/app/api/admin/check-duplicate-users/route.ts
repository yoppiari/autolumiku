/**
 * Diagnostic API: Check for duplicate users by phone
 * GET /api/admin/check-duplicate-users?phone=081310703754
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    try {
        const phone = req.nextUrl.searchParams.get('phone');

        if (!phone) {
            return NextResponse.json(
                { error: 'Phone parameter required' },
                { status: 400 }
            );
        }

        // Normalize phone for search
        const normalizePhone = (phone: string): string => {
            if (!phone) return "";
            if (phone.includes("@")) phone = phone.split("@")[0];
            if (phone.includes(":")) phone = phone.split(":")[0];
            let digits = phone.replace(/\D/g, "");
            if (digits.startsWith("0")) digits = "62" + digits.substring(1);
            return digits;
        };

        const normalized = normalizePhone(phone);

        // Get ALL users from database
        const allUsers = await prisma.user.findMany({
            select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
                role: true,
                roleLevel: true,
                tenantId: true,
                tenant: {
                    select: {
                        id: true,
                        name: true,
                    }
                },
                createdAt: true,
                updatedAt: true,
            },
            orderBy: { createdAt: 'desc' }
        });

        // Find all matching users
        const matches = allUsers.filter(u => {
            if (!u.phone) return false;
            return normalizePhone(u.phone) === normalized;
        });

        return NextResponse.json({
            success: true,
            searchPhone: phone,
            normalizedPhone: normalized,
            totalUsers: allUsers.length,
            matchingUsers: matches.length,
            users: matches.map(u => ({
                id: u.id,
                name: `${u.firstName} ${u.lastName || ''}`.trim(),
                email: u.email,
                phone: u.phone,
                role: u.role,
                roleLevel: u.roleLevel,
                tenantId: u.tenantId,
                tenantName: u.tenant?.name || '(Platform Admin)',
                createdAt: u.createdAt,
                updatedAt: u.updatedAt,
            }))
        });

    } catch (error: any) {
        console.error('[Check Duplicate Users API] Error:', error);
        return NextResponse.json(
            { error: error.message },
            { status: 500 }
        );
    }
}
