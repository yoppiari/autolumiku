/**
 * Auth utility for handling token refresh and authentication
 */

export async function fetchWithAuth(url: string, options: RequestInit = {}) {
    const token = localStorage.getItem('authToken');

    if (!token) {
        console.warn('[Auth] No token found');
        return null;
    }

    const headers = {
        ...options.headers,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
    };

    try {
        const response = await fetch(url, { ...options, headers });

        // If 401, token is expired - redirect to login
        if (response.status === 401) {
            console.warn('[Auth] Token expired, redirecting to login');
            localStorage.removeItem('authToken');
            localStorage.removeItem('refreshToken');
            localStorage.removeItem('user');
            window.location.href = '/login';
            return null;
        }

        return response;
    } catch (error) {
        console.error('[Auth] Fetch error:', error);
        throw error;
    }
}

export function getAuthToken(): string | null {
    return localStorage.getItem('authToken');
}

export function isAuthenticated(): boolean {
    return !!getAuthToken();
}

export function logout() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    window.location.href = '/login';
}
