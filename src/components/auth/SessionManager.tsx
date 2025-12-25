'use client';

/**
 * SessionManager Component
 *
 * Manages user session with smart activity tracking:
 * - Tracks user activity (mouse, keyboard, scroll, click, touch)
 * - Auto-refreshes token when user is active
 * - Only logs out after 60 minutes of TRUE inactivity (no activity at all)
 * - Shows warning before session expires
 */

import React, { useEffect, useRef, useCallback, useState } from 'react';

interface SessionManagerProps {
  children: React.ReactNode;
  inactivityTimeout?: number; // Timeout in ms (default: 60 minutes)
  refreshInterval?: number; // Token refresh interval in ms (default: 50 minutes)
  warningTime?: number; // Show warning X ms before timeout (default: 5 minutes)
}

// Activity events to track
const ACTIVITY_EVENTS = [
  'mousedown',
  'mousemove',
  'keydown',
  'scroll',
  'touchstart',
  'click',
  'wheel',
  'resize',
  'focus',
];

export default function SessionManager({
  children,
  inactivityTimeout = 60 * 60 * 1000, // 60 minutes
  refreshInterval = 50 * 60 * 1000, // 50 minutes (refresh before token expires)
  warningTime = 5 * 60 * 1000, // 5 minutes warning
}: SessionManagerProps) {
  const lastActivityRef = useRef<number>(Date.now());
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);
  const warningTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [showWarning, setShowWarning] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);

  // Update last activity timestamp
  const updateActivity = useCallback(() => {
    lastActivityRef.current = Date.now();

    // Hide warning if user becomes active
    if (showWarning) {
      setShowWarning(false);
    }

    // Reset inactivity timer
    resetInactivityTimer();
  }, [showWarning]);

  // Refresh the access token
  const refreshToken = useCallback(async () => {
    const refreshTokenStr = localStorage.getItem('refreshToken');
    if (!refreshTokenStr) {
      console.log('[SessionManager] No refresh token found');
      return false;
    }

    try {
      console.log('[SessionManager] Refreshing token...');
      const response = await fetch('/api/v1/auth/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken: refreshTokenStr }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.data) {
          // Update tokens in localStorage
          localStorage.setItem('authToken', data.data.accessToken);
          localStorage.setItem('refreshToken', data.data.refreshToken);
          localStorage.setItem('user', JSON.stringify(data.data.user));
          console.log('[SessionManager] Token refreshed successfully');
          return true;
        }
      } else {
        console.log('[SessionManager] Token refresh failed:', response.status);
        return false;
      }
    } catch (error) {
      console.error('[SessionManager] Token refresh error:', error);
      return false;
    }

    return false;
  }, []);

  // Handle session expiry
  const handleSessionExpiry = useCallback(() => {
    console.log('[SessionManager] Session expired due to inactivity');
    localStorage.removeItem('authToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    window.location.href = '/login?error=session_expired';
  }, []);

  // Reset inactivity timer
  const resetInactivityTimer = useCallback(() => {
    // Clear existing timers
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }
    if (warningTimerRef.current) {
      clearTimeout(warningTimerRef.current);
    }

    // Set warning timer (5 minutes before timeout)
    warningTimerRef.current = setTimeout(() => {
      setShowWarning(true);
      // Start countdown
      const countdownEnd = Date.now() + warningTime;
      const countdownInterval = setInterval(() => {
        const remaining = Math.max(0, countdownEnd - Date.now());
        setTimeRemaining(remaining);
        if (remaining <= 0) {
          clearInterval(countdownInterval);
        }
      }, 1000);
    }, inactivityTimeout - warningTime);

    // Set inactivity timer
    inactivityTimerRef.current = setTimeout(() => {
      handleSessionExpiry();
    }, inactivityTimeout);
  }, [inactivityTimeout, warningTime, handleSessionExpiry]);

  // Auto-refresh token periodically when user is active
  const scheduleTokenRefresh = useCallback(() => {
    if (refreshTimerRef.current) {
      clearInterval(refreshTimerRef.current);
    }

    refreshTimerRef.current = setInterval(async () => {
      // Only refresh if user has been active recently (within last 5 minutes)
      const timeSinceLastActivity = Date.now() - lastActivityRef.current;
      if (timeSinceLastActivity < 5 * 60 * 1000) {
        console.log('[SessionManager] User active, refreshing token...');
        const success = await refreshToken();
        if (!success) {
          console.log('[SessionManager] Token refresh failed, but user is active - will retry');
        }
      } else {
        console.log('[SessionManager] User inactive, skipping token refresh');
      }
    }, refreshInterval);
  }, [refreshInterval, refreshToken]);

  // Extend session (called when user clicks "Stay logged in")
  const extendSession = useCallback(async () => {
    setShowWarning(false);
    updateActivity();
    await refreshToken();
  }, [updateActivity, refreshToken]);

  // Set up activity listeners
  useEffect(() => {
    // Throttle activity updates (max once per second)
    let lastUpdate = 0;
    const throttledUpdate = () => {
      const now = Date.now();
      if (now - lastUpdate > 1000) {
        lastUpdate = now;
        updateActivity();
      }
    };

    // Add event listeners
    ACTIVITY_EVENTS.forEach(event => {
      window.addEventListener(event, throttledUpdate, { passive: true });
    });

    // Also track visibility changes (tab switching)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        throttledUpdate();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Start timers
    resetInactivityTimer();
    scheduleTokenRefresh();

    // Initial token refresh if close to expiry
    // This handles the case where user refreshes the page
    const checkInitialTokenExpiry = async () => {
      const token = localStorage.getItem('authToken');
      if (token) {
        try {
          // Decode token to check expiry (unsafe decode, just for checking)
          const payload = JSON.parse(atob(token.split('.')[1]));
          const expiresAt = payload.exp * 1000; // Convert to ms
          const now = Date.now();
          const timeUntilExpiry = expiresAt - now;

          // If token expires in less than 10 minutes, refresh immediately
          if (timeUntilExpiry < 10 * 60 * 1000) {
            console.log('[SessionManager] Token expiring soon, refreshing immediately...');
            await refreshToken();
          }
        } catch (e) {
          console.error('[SessionManager] Error checking token expiry:', e);
        }
      }
    };
    checkInitialTokenExpiry();

    // Cleanup
    return () => {
      ACTIVITY_EVENTS.forEach(event => {
        window.removeEventListener(event, throttledUpdate);
      });
      document.removeEventListener('visibilitychange', handleVisibilityChange);

      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
      }
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
      if (warningTimerRef.current) {
        clearTimeout(warningTimerRef.current);
      }
    };
  }, [updateActivity, resetInactivityTimer, scheduleTokenRefresh, refreshToken]);

  const formatTime = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <>
      {children}

      {/* Session Warning Modal */}
      {showWarning && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md mx-4 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Sesi Akan Berakhir</h3>
                <p className="text-sm text-gray-500">Tidak ada aktivitas terdeteksi</p>
              </div>
            </div>

            <p className="text-gray-600 mb-4">
              Sesi Anda akan berakhir dalam <span className="font-bold text-red-600">{formatTime(timeRemaining)}</span> karena tidak ada aktivitas.
            </p>

            <div className="flex gap-3">
              <button
                onClick={extendSession}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
              >
                Tetap Login
              </button>
              <button
                onClick={handleSessionExpiry}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
