/**
 * Preferences Step
 * Configuration for notifications, regional settings, etc.
 */

'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Bell, Globe, Shield, Zap } from 'lucide-react';

interface PreferencesStepProps {
  onNext: (data: PreferencesData) => void;
  onBack: () => void;
  initialData?: Partial<PreferencesData>;
}

export interface PreferencesData {
  notifications: {
    email: boolean;
    sms: boolean;
    whatsapp: boolean;
    push: boolean;
  };
  language: 'id' | 'en';
  timezone: string;
  currency: string;
  features: {
    aiSuggestions: boolean;
    autoBackup: boolean;
    twoFactorAuth: boolean;
  };
}

export function PreferencesStep({ onNext, onBack, initialData }: PreferencesStepProps) {
  const [formData, setFormData] = useState<PreferencesData>({
    notifications: {
      email: initialData?.notifications?.email ?? true,
      sms: initialData?.notifications?.sms ?? false,
      whatsapp: initialData?.notifications?.whatsapp ?? true,
      push: initialData?.notifications?.push ?? true,
    },
    language: initialData?.language || 'id',
    timezone: initialData?.timezone || 'Asia/Jakarta',
    currency: initialData?.currency || 'IDR',
    features: {
      aiSuggestions: initialData?.features?.aiSuggestions ?? true,
      autoBackup: initialData?.features?.autoBackup ?? true,
      twoFactorAuth: initialData?.features?.twoFactorAuth ?? false,
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onNext(formData);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Preferensi & Pengaturan</h2>
        <p className="text-gray-600 mt-2">
          Sesuaikan pengaturan sesuai kebutuhan Anda
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Notifications */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notifikasi
            </CardTitle>
            <CardDescription>
              Pilih cara Anda ingin menerima notifikasi
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Email</Label>
                <p className="text-sm text-gray-500">Terima notifikasi melalui email</p>
              </div>
              <Switch
                checked={formData.notifications.email}
                onCheckedChange={(checked) =>
                  setFormData({
                    ...formData,
                    notifications: { ...formData.notifications, email: checked }
                  })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>WhatsApp</Label>
                <p className="text-sm text-gray-500">Terima notifikasi melalui WhatsApp</p>
              </div>
              <Switch
                checked={formData.notifications.whatsapp}
                onCheckedChange={(checked) =>
                  setFormData({
                    ...formData,
                    notifications: { ...formData.notifications, whatsapp: checked }
                  })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>SMS</Label>
                <p className="text-sm text-gray-500">Terima notifikasi melalui SMS</p>
              </div>
              <Switch
                checked={formData.notifications.sms}
                onCheckedChange={(checked) =>
                  setFormData({
                    ...formData,
                    notifications: { ...formData.notifications, sms: checked }
                  })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Push Notification</Label>
                <p className="text-sm text-gray-500">Notifikasi langsung ke perangkat</p>
              </div>
              <Switch
                checked={formData.notifications.push}
                onCheckedChange={(checked) =>
                  setFormData({
                    ...formData,
                    notifications: { ...formData.notifications, push: checked }
                  })
                }
              />
            </div>
          </CardContent>
        </Card>

        {/* Regional Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Pengaturan Regional
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Bahasa</Label>
              <Select
                value={formData.language}
                onValueChange={(value: 'id' | 'en') => setFormData({ ...formData, language: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="id">Bahasa Indonesia</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Zona Waktu</Label>
              <Select
                value={formData.timezone}
                onValueChange={(value) => setFormData({ ...formData, timezone: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Asia/Jakarta">WIB - Jakarta</SelectItem>
                  <SelectItem value="Asia/Makassar">WITA - Makassar</SelectItem>
                  <SelectItem value="Asia/Jayapura">WIT - Jayapura</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Mata Uang</Label>
              <Select
                value={formData.currency}
                onValueChange={(value) => setFormData({ ...formData, currency: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="IDR">Rupiah (IDR)</SelectItem>
                  <SelectItem value="USD">US Dollar (USD)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Features */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Fitur
            </CardTitle>
            <CardDescription>
              Aktifkan fitur tambahan yang tersedia
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Saran AI</Label>
                <p className="text-sm text-gray-500">Dapatkan rekomendasi cerdas dari AI</p>
              </div>
              <Switch
                checked={formData.features.aiSuggestions}
                onCheckedChange={(checked) =>
                  setFormData({
                    ...formData,
                    features: { ...formData.features, aiSuggestions: checked }
                  })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Backup Otomatis</Label>
                <p className="text-sm text-gray-500">Backup data secara otomatis setiap hari</p>
              </div>
              <Switch
                checked={formData.features.autoBackup}
                onCheckedChange={(checked) =>
                  setFormData({
                    ...formData,
                    features: { ...formData.features, autoBackup: checked }
                  })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Two-Factor Authentication</Label>
                <p className="text-sm text-gray-500">Keamanan ekstra untuk akun Anda</p>
              </div>
              <Switch
                checked={formData.features.twoFactorAuth}
                onCheckedChange={(checked) =>
                  setFormData({
                    ...formData,
                    features: { ...formData.features, twoFactorAuth: checked }
                  })
                }
              />
            </div>
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="flex justify-between pt-4">
          <Button type="button" variant="outline" onClick={onBack}>
            Kembali
          </Button>
          <Button type="submit">
            Lanjutkan
          </Button>
        </div>
      </form>
    </div>
  );
}
