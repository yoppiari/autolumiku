/**
 * API Client Utility
 * Handles authenticated API requests with token management
 * Auto-refreshes token on 401 errors
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
 * Get refresh token from localStorage
 */
function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('refreshToken');
}

/**
 * Refresh access token using refresh token
 * Returns true if refresh was successful, false otherwise
 */
async function refreshAccessToken(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    console.log('[API] No refresh token available');
    return false;
  }

  try {
    console.log('[API] Attempting to refresh access token...');
    const response = await fetch('/api/v1/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (response.ok) {
      const data = await response.json();
      if (data.data) {
        // Update tokens in localStorage
        localStorage.setItem('authToken', data.data.accessToken);
        localStorage.setItem('refreshToken', data.data.refreshToken);
        localStorage.setItem('user', JSON.stringify(data.data.user));
        console.log('[API] Token refreshed successfully');
        return true;
      }
    } else {
      console.log('[API] Token refresh failed:', response.status);
    }
  } catch (error) {
    console.error('[API] Token refresh error:', error);
  }

  return false;
}

/**
 * Handle session expiry - redirect to login
 */
function handleSessionExpiry() {
  if (typeof window === 'undefined') return;

  console.log('[API] Session expired, redirecting to login...');

  // Check if user is showroom user (has tenantId) or admin
  const storedUser = localStorage.getItem('user');
  let redirectPath = '/login'; // Default for showroom users
  if (storedUser) {
    try {
      const user = JSON.parse(storedUser);
      if (!user.tenantId || user.role.toLowerCase() === 'super_admin') {
        redirectPath = '/admin/login';
      }
    } catch { }
  }

  localStorage.removeItem('authToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('user');
  window.location.href = `${redirectPath}?error=session_expired`;
}

/**
 * Make authenticated API request with automatic token refresh on 401
 */
export async function apiClient<T = any>(
  url: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  let token = getAuthToken();

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
    let response = await fetch(url, {
      ...options,
      headers,
    });

    // Handle 401 Unauthorized - try to refresh token and retry
    if (response.status === 401) {
      console.log('[API] Received 401, attempting token refresh...');

      // Try to refresh the token
      const refreshSuccess = await refreshAccessToken();

      if (refreshSuccess) {
        // Get new token and retry the original request
        token = getAuthToken();
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;

          response = await fetch(url, {
            ...options,
            headers,
          });

          // If still 401 after refresh, session is truly expired
          if (response.status === 401) {
            handleSessionExpiry();
            return { success: false, error: 'Sesi Anda telah berakhir. Silakan login kembali.' };
          }
        }
      } else {
        // Refresh failed, session is expired
        handleSessionExpiry();
        return { success: false, error: 'Sesi Anda telah berakhir. Silakan login kembali.' };
      }
    }

    // Handle 403 Forbidden
    if (response.status === 403) {
      console.error('[API] Forbidden - no permission');
    }

    // Try to parse JSON, fallback to text
    let data: any;
    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      data = await response.json();
    } else {
      data = { success: response.ok, data: await response.blob() };
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
