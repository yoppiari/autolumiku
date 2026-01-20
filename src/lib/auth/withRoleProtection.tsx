'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ROLE_LEVELS, getRoleLevelFromRole } from '@/lib/rbac';

/**
 * Higher-Order Component for Role-Based Page Protection
 * Wraps a page component to enforce minimum role level requirement
 * 
 * Usage:
 * export default withRoleProtection(MyPage, ROLE_LEVELS.ADMIN);
 */
export function withRoleProtection<P extends object>(
    WrappedComponent: React.ComponentType<P>,
    minRoleLevel: number = ROLE_LEVELS.ADMIN
) {
    return function ProtectedPage(props: P) {
        const router = useRouter();
        const [isAuthorized, setIsAuthorized] = useState(false);
        const [isLoading, setIsLoading] = useState(true);

        useEffect(() => {
            const storedUser = localStorage.getItem('user');

            // Not authenticated - redirect to login
            if (!storedUser) {
                console.log('[RoleProtection] No user found, redirecting to login');
                router.push('/login');
                return;
            }

            try {
                const user = JSON.parse(storedUser);

                // Get role level - prioritize the higher value between stored level and derived level
                // This fixes issues where localStorage has stale roleLevel (e.g. 30) but role is "ADMIN"
                let roleLevel = user.roleLevel || 0;
                if (user.role) {
                    const derivedLevel = getRoleLevelFromRole(user.role);
                    if (derivedLevel > roleLevel) {
                        console.log(`[RoleProtection] Upgrading role level from ${roleLevel} to ${derivedLevel} based on role "${user.role}"`);
                        roleLevel = derivedLevel;
                    }
                }

                // Fallback if still 0
                if (roleLevel === 0) roleLevel = ROLE_LEVELS.SALES;

                console.log(`[RoleProtection] User role: ${user.role}, roleLevel: ${roleLevel}, required: ${minRoleLevel}`);

                // Not authorized - show alert and redirect
                if (roleLevel < minRoleLevel) {
                    const currentRole = user.role || 'Staff';
                    console.warn(`[RoleProtection] Access denied - roleLevel ${roleLevel} < ${minRoleLevel} (User Role: ${currentRole})`);

                    alert(`Akses Ditolak: Anda login sebagai "${currentRole}" (Level ${roleLevel}).\n\nHalaman ini hanya dapat diakses oleh Admin, Owner, atau Super Admin.\n\nJika Anda seharusnya memiliki akses, silakan logout dan login kembali untuk memperbarui sesi.`);

                    router.push('/dashboard');
                    return;
                }

                // Authorized
                setIsAuthorized(true);
                setIsLoading(false);
            } catch (error) {
                console.error('[RoleProtection] Error parsing user data:', error);
                router.push('/login');
            }
        }, [router, minRoleLevel]);

        // Show loading spinner while checking authorization
        if (isLoading || !isAuthorized) {
            return (
                <div className="flex items-center justify-center min-h-screen bg-[#1a1a1a]">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                        <p className="text-gray-400 mt-4">Memeriksa izin akses...</p>
                    </div>
                </div>
            );
        }

        // Render protected component
        return <WrappedComponent {...props} />;
    };
}
