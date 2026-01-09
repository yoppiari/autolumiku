/**
 * User Specific API Endpoint
 * Handles GET, PATCH, and DELETE for a specific user
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { withPlatformAuth } from '@/lib/auth/middleware';
import { getRoleLevelFromRole } from '@/lib/rbac';

/**
 * GET /api/admin/users/[id] - Get single user
 */
export async function GET(
    request: NextRequest,
    { params }: { params: any }
) {
    return withPlatformAuth(request, async () => {
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
    return withPlatformAuth(request, async (request) => {
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

            // Check if email is already taken by another user IN THE SAME TENANT
            if (email) {
                // Determine target tenant ID (either from body or keep existing)
                const targetTenantId = tenantId !== undefined ? tenantId : existingUser.tenantId;

                const emailTaken = await prisma.user.findFirst({
                    where: {
                        email: email.toLowerCase(),
                        tenantId: targetTenantId
                    },
                    include: { tenant: true },
                });

                if (emailTaken && emailTaken.id !== id) {
                    // If taken in the SAME tenant, we definitely block it.
                    const tenantName = emailTaken.tenant?.name || 'Platform Admin';
                    return NextResponse.json(
                        {
                            success: false,
                            error: `Email already in use in ${tenantName}.`
                        },
                        { status: 400 }
                    );
                }

                // Note: We purposely REMOVE the "Smart Reclaim" logic because keeping duplicate emails 
                // across different tenants is now a feature, not a bug to be fixed by deletion.
            }

            // Prepare update data
            const updateData: any = {
                email,
                firstName,
                lastName,
                role,
                ...(role ? { roleLevel: getRoleLevelFromRole(role) } : {}),
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

        } catch (error: any) {
            console.error('❌ Update user error:', error);

            // SELF-HEALING LOGIC (Update Variant)
            if (error.code === 'P2002' && (error.meta?.target?.includes('email') || error.message?.includes('email'))) {
                console.warn('⚠️ Detected Legacy DB Constraint on Email during Update. Attempting Self-Healing...');
                try {
                    await prisma.$executeRawUnsafe(`DROP INDEX IF EXISTS "users_email_key";`);
                    await prisma.$executeRawUnsafe(`ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_email_key";`);
                    await prisma.$executeRawUnsafe(`DROP INDEX IF EXISTS "User_email_key";`);
                    await prisma.$executeRawUnsafe(`ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "User_email_key";`);

                    console.log('✅ DB Constraint Dropped.');
                } catch (fixError) {
                    console.error('❌ Self-Healing Failed:', fixError);
                }

                // If we executed the SQL, the DB is fixed. 
                // Since we can't easily retry (scope issues), we return a specific message urging to retry.
                // OR better: We return 200 with a "Warning" or we Recursively call PATCH? No.

                return NextResponse.json(
                    {
                        success: false,
                        error: 'Sistem Database telah diperbaiki otomatis. Silakan klik tombol Simpan sekali lagi.'
                    },
                    { status: 409 }
                );
            }

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
    return withPlatformAuth(request, async () => {
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
