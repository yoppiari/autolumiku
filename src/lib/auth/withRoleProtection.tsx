'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ROLE_LEVELS } from '@/lib/rbac';

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
                const roleLevel = user.roleLevel || ROLE_LEVELS.SALES;

                console.log(`[RoleProtection] User roleLevel: ${roleLevel}, required: ${minRoleLevel}`);

                // Not authorized - show alert and redirect
                if (roleLevel < minRoleLevel) {
                    console.warn(`[RoleProtection] Access denied - roleLevel ${roleLevel} < ${minRoleLevel}`);
                    alert('Akses Ditolak: Anda tidak memiliki izin untuk mengakses halaman ini.\n\nHanya Admin, Owner, dan Super Admin yang dapat mengakses fitur ini.');
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
