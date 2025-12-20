/**
 * API Client Utility
 * Handles authenticated API requests with token management
 */

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/**
 * Get auth token from localStorage
 */
function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('authToken');
}

/**
 * Make authenticated API request
 */
export async function apiClient<T = any>(
  url: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const token = getAuthToken();

  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> || {}),
  };

  // Add Authorization header if token exists
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Add Content-Type for JSON requests (unless it's FormData)
  if (options.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    const data = await response.json();

    // Handle 401 Unauthorized - redirect to login
    if (response.status === 401) {
      if (typeof window !== 'undefined') {
        // Check if user is showroom user (has tenantId) or admin
        const storedUser = localStorage.getItem('user');
        let redirectPath = '/login'; // Default for showroom users
        if (storedUser) {
          try {
            const user = JSON.parse(storedUser);
            if (!user.tenantId || user.role === 'super_admin') {
              redirectPath = '/admin/login';
            }
          } catch {}
        }

        localStorage.removeItem('authToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        window.location.href = `${redirectPath}?error=session_expired`;
      }
    }

    // Handle 403 Forbidden
    if (response.status === 403) {
      console.error('[API] Forbidden - no permission');
    }

    return data;
  } catch (error) {
    console.error('API request failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

/**
 * Convenience methods
 */
export const api = {
  get: <T = any>(url: string) => apiClient<T>(url, { method: 'GET' }),

  post: <T = any>(url: string, body: any) =>
    apiClient<T>(url, {
      method: 'POST',
      body: body instanceof FormData ? body : JSON.stringify(body),
    }),

  put: <T = any>(url: string, body: any) =>
    apiClient<T>(url, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),

  patch: <T = any>(url: string, body: any) =>
    apiClient<T>(url, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  delete: <T = any>(url: string) =>
    apiClient<T>(url, { method: 'DELETE' }),
};
