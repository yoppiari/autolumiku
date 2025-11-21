/**
 * Connection Status Indicator Component
 * Shows real-time network connection status for Indonesian mobile networks
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, Signal, SignalLow, SignalMedium, SignalHigh } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export interface ConnectionStatus {
  isOnline: boolean;
  effectiveType: 'slow-2g' | '2g' | '3g' | '4g' | '5g' | 'wifi' | 'unknown';
  downlink?: number; // Mbps
  rtt?: number; // Round trip time in ms
  saveData?: boolean;
}

export function ConnectionStatusIndicator() {
  const [status, setStatus] = useState<ConnectionStatus>({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    effectiveType: 'unknown'
  });

  useEffect(() => {
    // Update connection status
    const updateConnectionStatus = () => {
      const connection = (navigator as any).connection ||
                         (navigator as any).mozConnection ||
                         (navigator as any).webkitConnection;

      setStatus({
        isOnline: navigator.onLine,
        effectiveType: connection?.effectiveType || 'unknown',
        downlink: connection?.downlink,
        rtt: connection?.rtt,
        saveData: connection?.saveData
      });
    };

    // Initial update
    updateConnectionStatus();

    // Listen for online/offline events
    window.addEventListener('online', updateConnectionStatus);
    window.addEventListener('offline', updateConnectionStatus);

    // Listen for connection changes (if available)
    const connection = (navigator as any).connection ||
                       (navigator as any).mozConnection ||
                       (navigator as any).webkitConnection;

    if (connection) {
      connection.addEventListener('change', updateConnectionStatus);
    }

    // Cleanup
    return () => {
      window.removeEventListener('online', updateConnectionStatus);
      window.removeEventListener('offline', updateConnectionStatus);
      if (connection) {
        connection.removeEventListener('change', updateConnectionStatus);
      }
    };
  }, []);

  const getConnectionIcon = () => {
    if (!status.isOnline) {
      return <WifiOff className="h-4 w-4" />;
    }

    switch (status.effectiveType) {
      case 'slow-2g':
      case '2g':
        return <SignalLow className="h-4 w-4" />;
      case '3g':
        return <SignalMedium className="h-4 w-4" />;
      case '4g':
      case '5g':
      case 'wifi':
        return <SignalHigh className="h-4 w-4" />;
      default:
        return <Signal className="h-4 w-4" />;
    }
  };

  const getConnectionLabel = () => {
    if (!status.isOnline) {
      return 'Offline';
    }

    switch (status.effectiveType) {
      case 'slow-2g':
        return 'Koneksi Sangat Lambat';
      case '2g':
        return 'Koneksi Lambat (2G)';
      case '3g':
        return 'Koneksi Sedang (3G)';
      case '4g':
        return 'Koneksi Baik (4G)';
      case '5g':
        return 'Koneksi Cepat (5G)';
      case 'wifi':
        return 'WiFi Terhubung';
      default:
        return status.isOnline ? 'Terhubung' : 'Tidak Terhubung';
    }
  };

  const getConnectionColor = (): 'default' | 'secondary' | 'destructive' | 'outline' => {
    if (!status.isOnline) {
      return 'destructive';
    }

    switch (status.effectiveType) {
      case 'slow-2g':
      case '2g':
        return 'destructive';
      case '3g':
        return 'secondary';
      case '4g':
      case '5g':
      case 'wifi':
        return 'default';
      default:
        return 'outline';
    }
  };

  const getDetailedInfo = () => {
    if (!status.isOnline) {
      return 'Tidak ada koneksi internet. Beberapa fitur mungkin tidak tersedia.';
    }

    const parts = [];

    if (status.downlink) {
      parts.push(`${status.downlink.toFixed(1)} Mbps`);
    }

    if (status.rtt) {
      parts.push(`Ping: ${status.rtt}ms`);
    }

    if (status.saveData) {
      parts.push('Mode Hemat Data Aktif');
    }

    return parts.length > 0 ? parts.join(' • ') : null;
  };

  return (
    <div className="flex items-center gap-2">
      <Badge variant={getConnectionColor()} className="flex items-center gap-1.5">
        {getConnectionIcon()}
        <span className="text-xs font-medium">{getConnectionLabel()}</span>
      </Badge>

      {getDetailedInfo() && (
        <span className="text-xs text-muted-foreground hidden sm:inline">
          {getDetailedInfo()}
        </span>
      )}

      {!status.isOnline && (
        <span className="text-xs text-destructive font-medium">
          Sesi akan dipulihkan saat online
        </span>
      )}
    </div>
  );
}

/**
 * Compact version for mobile/small spaces
 */
export function ConnectionStatusIndicatorCompact() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const updateStatus = () => setIsOnline(navigator.onLine);

    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);

    return () => {
      window.removeEventListener('online', updateStatus);
      window.removeEventListener('offline', updateStatus);
    };
  }, []);

  return (
    <div className="flex items-center gap-1">
      {isOnline ? (
        <Wifi className="h-3 w-3 text-green-600" />
      ) : (
        <WifiOff className="h-3 w-3 text-red-600" />
      )}
    </div>
  );
}
