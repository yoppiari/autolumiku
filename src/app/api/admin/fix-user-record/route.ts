/**
 * API Endpoint: Fix User Record
 * 
 * POST /api/admin/fix-user-record
 * 
 * Fixes incorrect user data for Super Admins
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { phone, firstName, lastName, role } = body;

        if (!phone) {
            return NextResponse.json(
                { error: 'Phone number is required' },
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

        // Find all users with this phone
        const allUsers = await prisma.user.findMany();
        const matchingUsers = allUsers.filter(u =>
            u.phone && normalizePhone(u.phone) === normalized
        );

        if (matchingUsers.length === 0) {
            return NextResponse.json(
                { error: `No user found with phone ${phone}` },
                { status: 404 }
            );
        }

        const results = [];

        // Update each matching user
        for (const user of matchingUsers) {
            const updateData: any = {};

            if (firstName) updateData.firstName = firstName;
            if (lastName) updateData.lastName = lastName;
            if (role) {
                updateData.role = role;
                // Set roleLevel based on role
                if (role === 'SUPER_ADMIN' || role === 'OWNER') updateData.roleLevel = 100;
                else if (role === 'ADMIN') updateData.roleLevel = 80;
                else if (role === 'MANAGER') updateData.roleLevel = 60;
                else updateData.roleLevel = 30;

                // Super Admins should have null tenantId
                if (role === 'SUPER_ADMIN') updateData.tenantId = null;
            }

            const updated = await prisma.user.update({
                where: { id: user.id },
                data: updateData,
            });

            results.push({
                id: updated.id,
                before: {
                    firstName: user.firstName,
                    lastName: user.lastName,
                    role: user.role,
                    tenantId: user.tenantId,
                },
                after: {
                    firstName: updated.firstName,
                    lastName: updated.lastName,
                    role: updated.role,
                    tenantId: updated.tenantId,
                },
            });
        }

        return NextResponse.json({
            success: true,
            message: `Updated ${results.length} user record(s)`,
            results,
        });

    } catch (error: any) {
        console.error('[Fix User Record API] Error:', error);
        return NextResponse.json(
            { error: error.message },
            { status: 500 }
        );
    }
}
