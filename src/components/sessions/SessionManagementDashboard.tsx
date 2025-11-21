'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ConnectionStatusIndicator } from './ConnectionStatusIndicator';
import {
  Smartphone,
  Monitor,
  Tablet,
  MapPin,
  Clock,
  Shield,
  AlertTriangle,
  LogOut
} from 'lucide-react';

interface Session {
  sessionId: string;
  device: {
    deviceName: string;
    deviceType: 'desktop' | 'mobile' | 'tablet';
    browser: string;
    os: string;
  };
  createdAt: string;
  lastActivity: string;
  expiresAt: string;
  ipAddress: string;
  location?: {
    country: string;
    city: string;
  };
  isActive: boolean;
}

interface SessionManagementDashboardProps {
  currentSessionId?: string;
}

export function SessionManagementDashboard({ currentSessionId }: SessionManagementDashboardProps) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/v1/sessions', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
      });

      const data = await response.json();

      if (data.success) {
        setSessions(data.data.sessions);
      } else {
        setError(data.error || 'Failed to load sessions');
      }
    } catch (err) {
      setError('Network error. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    if (sessionId === currentSessionId) {
      if (!confirm('You are about to log out of this device. Continue?')) {
        return;
      }
    } else {
      if (!confirm('Revoke this session? The user will be logged out from that device.')) {
        return;
      }
    }

    try {
      setRevoking(sessionId);

      const response = await fetch(`/api/v1/sessions/${sessionId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
      });

      const data = await response.json();

      if (data.success) {
        if (sessionId === currentSessionId) {
          // Logout current session
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          window.location.href = '/login';
        } else {
          // Refresh session list
          await fetchSessions();
        }
      } else {
        setError(data.error || 'Failed to revoke session');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setRevoking(null);
    }
  };

  const handleRevokeAllOtherSessions = async () => {
    if (!confirm('Revoke all other sessions? You will remain logged in on this device only.')) {
      return;
    }

    try {
      setLoading(true);

      const otherSessions = sessions.filter(s => s.sessionId !== currentSessionId);

      for (const session of otherSessions) {
        await fetch(`/api/v1/sessions/${session.sessionId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
          }
        });
      }

      await fetchSessions();
    } catch (err) {
      setError('Failed to revoke other sessions');
    } finally {
      setLoading(false);
    }
  };

  const getDeviceIcon = (deviceType: string) => {
    switch (deviceType) {
      case 'mobile':
        return <Smartphone className="w-5 h-5" />;
      case 'tablet':
        return <Tablet className="w-5 h-5" />;
      default:
        return <Monitor className="w-5 h-5" />;
    }
  };

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days} hari yang lalu`;
    if (hours > 0) return `${hours} jam yang lalu`;
    if (minutes > 0) return `${minutes} menit yang lalu`;
    return 'Baru saja';
  };

  if (loading && sessions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Kelola Sesi</CardTitle>
          <CardDescription>Loading...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Connection Status Indicator */}
      <div className="flex justify-end">
        <ConnectionStatusIndicator />
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Kelola Sesi Aktif</CardTitle>
              <CardDescription>
                Lihat dan kelola perangkat yang sedang login ke akun Anda
              </CardDescription>
            </div>
            {sessions.length > 1 && (
              <Button
                variant="outline"
                onClick={handleRevokeAllOtherSessions}
                disabled={loading}
              >
                Keluar dari Semua Perangkat Lain
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-4">
            {sessions.map((session) => {
              const isCurrentSession = session.sessionId === currentSessionId;

              return (
                <Card key={session.sessionId} className={isCurrentSession ? 'border-primary' : ''}>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-4">
                        <div className="p-3 bg-muted rounded-lg">
                          {getDeviceIcon(session.device.deviceType)}
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2">
                            <h4 className="font-semibold">
                              {session.device.deviceName}
                            </h4>
                            {isCurrentSession && (
                              <Badge variant="default">Perangkat Ini</Badge>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground space-y-1">
                            <div className="flex items-center space-x-2">
                              <Shield className="w-4 h-4" />
                              <span>{session.device.browser} • {session.device.os}</span>
                            </div>
                            {session.location && (
                              <div className="flex items-center space-x-2">
                                <MapPin className="w-4 h-4" />
                                <span>
                                  {session.location.city}, {session.location.country}
                                </span>
                              </div>
                            )}
                            <div className="flex items-center space-x-2">
                              <Clock className="w-4 h-4" />
                              <span>
                                Terakhir aktif {formatRelativeTime(session.lastActivity)}
                              </span>
                            </div>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            IP: {session.ipAddress}
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRevokeSession(session.sessionId)}
                        disabled={revoking === session.sessionId}
                      >
                        <LogOut className="w-4 h-4 mr-2" />
                        {isCurrentSession ? 'Keluar' : 'Cabut Akses'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            {sessions.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Shield className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Tidak ada sesi aktif</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Keamanan Sesi</CardTitle>
          <CardDescription>
            Informasi tentang keamanan dan pengelolaan sesi Anda
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start space-x-3">
            <Shield className="w-5 h-5 text-green-500 mt-0.5" />
            <div>
              <p className="font-medium">Refresh Token Otomatis</p>
              <p className="text-sm text-muted-foreground">
                Sesi Anda akan diperbarui secara otomatis untuk menjaga keamanan
              </p>
            </div>
          </div>
          <div className="flex items-start space-x-3">
            <Shield className="w-5 h-5 text-green-500 mt-0.5" />
            <div>
              <p className="font-medium">Deteksi Perangkat</p>
              <p className="text-sm text-muted-foreground">
                Kami melacak perangkat yang digunakan untuk login ke akun Anda
              </p>
            </div>
          </div>
          <div className="flex items-start space-x-3">
            <Shield className="w-5 h-5 text-green-500 mt-0.5" />
            <div>
              <p className="font-medium">Timeout Otomatis</p>
              <p className="text-sm text-muted-foreground">
                Sesi akan otomatis berakhir setelah 30 menit tidak aktif
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
