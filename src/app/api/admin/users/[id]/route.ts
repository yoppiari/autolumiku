/**
 * User Specific API Endpoint
 * Handles GET, PATCH, and DELETE for a specific user
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { withSuperAdminAuth } from '@/lib/auth/middleware';

/**
 * GET /api/admin/users/[id] - Get single user
 */
export async function GET(
    request: NextRequest,
    { params }: { params: any }
) {
    return withSuperAdminAuth(request, async () => {
        try {
            const { id } = await params;

            const user = await prisma.user.findUnique({
                where: { id },
                include: {
                    tenant: {
                        select: {
                            id: true,
                            name: true,
                            slug: true,
                        },
                    },
                },
            });

            if (!user) {
                return NextResponse.json(
                    { success: false, error: 'User not found' },
                    { status: 404 }
                );
            }

            // Remove password hash from response
            const { passwordHash, ...userWithoutPassword } = user;

            return NextResponse.json({
                success: true,
                data: { ...userWithoutPassword, isActive: true },
            });

        } catch (error) {
            console.error('Get user error:', error);
            return NextResponse.json(
                { success: false, error: 'Internal server error' },
                { status: 500 }
            );
        }
    });
}

/**
 * PATCH /api/admin/users/[id] - Update user
 */
export async function PATCH(
    request: NextRequest,
    { params }: { params: any }
) {
    return withSuperAdminAuth(request, async (request) => {
        try {
            const { id } = await params;
            const body = await request.json();
            const {
                email,
                firstName,
                lastName,
                password,
                role,
                tenantId,
                isActive,
                emailVerified,
                phone,
            } = body;

            // Check if user exists
            const existingUser = await prisma.user.findUnique({
                where: { id },
            });

            if (!existingUser) {
                return NextResponse.json(
                    { success: false, error: 'User not found' },
                    { status: 404 }
                );
            }

            // Check if email is already taken by another user
            if (email) {
                const emailTaken = await prisma.user.findUnique({
                    where: { email },
                    include: { tenant: true },
                });

                if (emailTaken && emailTaken.id !== id) {
                    // SMART RECLAIM: If the owner of this email is in a "DUMMY" or PLATFORM tenant, 
                    // auto-delete them so this user can take the email.
                    const isDummyUser = emailTaken?.tenant?.name && [
                        "Tenant 1 Demo",
                        "Showroom Jakarta Premium",
                        "Showroom Jakarta",
                        "Dealer Mobil",
                        "AutoMobil",
                        "AutoLumiku Platform"
                    ].includes(emailTaken.tenant.name);

                    // CRITICAL PROTECTION: Never reclaim from Super Admin or Platform Admin (tenantId is null)
                    const isSuperAdmin = !emailTaken?.tenantId || (emailTaken?.roleLevel && emailTaken.roleLevel >= 90);

                    // Scenario A: Collision with a Dummy account (Delete & Proceed) - BUT ONLY IF NOT SUPER ADMIN
                    if (isDummyUser && !isSuperAdmin) {
                        console.log(`[SmartReclaim] Deleting dummy/platform user ${emailTaken.id} to reclaim email ${email}`);
                        await prisma.user.delete({ where: { id: emailTaken.id } });
                    }
                    // Scenario B: Collision with a Real account OR Super Admin (Block)
                    else {
                        const tenantName = emailTaken.tenant?.name || 'Platform Admin';
                        return NextResponse.json(
                            {
                                success: false,
                                error: `Email already in use by ${tenantName}. ${isSuperAdmin ? 'Platform accounts cannot be reclaimed.' : ''}`
                            },
                            { status: 400 }
                        );
                    }
                }
            }

            // Prepare update data
            const updateData: any = {
                email,
                firstName,
                lastName,
                role,
                tenantId: role === 'super_admin' ? null : tenantId,
                emailVerified,
                phone: phone !== undefined ? phone : existingUser.phone,
            };

            // Hash password if provided
            if (password) {
                updateData.passwordHash = await bcrypt.hash(password, 10);
            }

            const updatedUser = await prisma.user.update({
                where: { id },
                data: updateData,
                include: {
                    tenant: {
                        select: {
                            id: true,
                            name: true,
                            slug: true,
                        },
                    },
                },
            });

            const { passwordHash, ...userWithoutPassword } = updatedUser;

            return NextResponse.json({
                success: true,
                message: 'User updated successfully',
                data: { ...userWithoutPassword, isActive: true },
            });

        } catch (error) {
            console.error('Update user error:', error);
            return NextResponse.json(
                { success: false, error: 'Internal server error' },
                { status: 500 }
            );
        }
    });
}

/**
 * DELETE /api/admin/users/[id] - Delete user
 */
export async function DELETE(
    request: NextRequest,
    { params }: { params: any }
) {
    return withSuperAdminAuth(request, async () => {
        try {
            const { id } = await params;

            // Prevent self-deletion if we had session info here, 
            // but for now just delete.

            await prisma.user.delete({
                where: { id },
            });

            return NextResponse.json({
                success: true,
                message: 'User deleted successfully',
            });

        } catch (error) {
            console.error('Delete user error:', error);
            return NextResponse.json(
                { success: false, error: 'Internal server error' },
                { status: 500 }
            );
        }
    });
}
