/**
 * Branding Configuration Step
 * Allows users to upload logo and customize colors
 */

'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Upload, Image as ImageIcon, Palette, Eye } from 'lucide-react';

interface BrandingStepProps {
  onNext: (data: BrandingData) => void;
  onBack: () => void;
  initialData?: Partial<BrandingData>;
}

export interface BrandingData {
  logo?: File | string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  theme: 'light' | 'dark' | 'auto';
}

export function BrandingStep({ onNext, onBack, initialData }: BrandingStepProps) {
  const [formData, setFormData] = useState<BrandingData>({
    primaryColor: initialData?.primaryColor || '#1a56db',
    secondaryColor: initialData?.secondaryColor || '#7c3aed',
    accentColor: initialData?.accentColor || '#0891b2',
    theme: initialData?.theme || 'light'
  });

  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFormData({ ...formData, logo: file });
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onNext(formData);
  };

  const presetColors = [
    { name: 'Biru', value: '#1a56db' },
    { name: 'Ungu', value: '#7c3aed' },
    { name: 'Hijau', value: '#059669' },
    { name: 'Merah', value: '#dc2626' },
    { name: 'Orange', value: '#ea580c' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Konfigurasi Branding</h2>
        <p className="text-gray-600 mt-2">
          Personalisasi tampilan showroom Anda dengan logo dan warna brand
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Logo Upload */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5" />
              Logo Showroom
            </CardTitle>
            <CardDescription>
              Upload logo showroom Anda (PNG, JPG, max 2MB)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="w-24 h-24 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center bg-gray-50">
                {logoPreview ? (
                  <img src={logoPreview} alt="Logo preview" className="w-full h-full object-contain rounded-lg" />
                ) : (
                  <Upload className="h-8 w-8 text-gray-400" />
                )}
              </div>
              <div className="flex-1">
                <input
                  type="file"
                  id="logo"
                  accept="image/png,image/jpeg,image/jpg"
                  onChange={handleLogoUpload}
                  className="hidden"
                />
                <Label htmlFor="logo" className="cursor-pointer">
                  <Button type="button" variant="outline" asChild>
                    <span>Pilih Logo</span>
                  </Button>
                </Label>
                <p className="text-sm text-gray-500 mt-2">
                  Rekomendasi: 512x512px, format PNG dengan background transparan
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Color Customization */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              Warna Brand
            </CardTitle>
            <CardDescription>
              Pilih warna yang merepresentasikan brand showroom Anda
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Primary Color */}
            <div>
              <Label>Warna Utama</Label>
              <div className="flex items-center gap-2 mt-2">
                <input
                  type="color"
                  value={formData.primaryColor}
                  onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                  className="h-10 w-20 rounded border cursor-pointer"
                />
                <input
                  type="text"
                  value={formData.primaryColor}
                  onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                  className="flex-1 px-3 py-2 border rounded-md"
                  placeholder="#1a56db"
                />
              </div>

              {/* Preset colors */}
              <div className="flex gap-2 mt-2">
                {presetColors.map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => setFormData({ ...formData, primaryColor: preset.value })}
                    className="w-8 h-8 rounded-full border-2 border-gray-300 hover:scale-110 transition-transform"
                    style={{ backgroundColor: preset.value }}
                    title={preset.name}
                  />
                ))}
              </div>
            </div>

            {/* Secondary Color */}
            <div>
              <Label>Warna Sekunder</Label>
              <div className="flex items-center gap-2 mt-2">
                <input
                  type="color"
                  value={formData.secondaryColor}
                  onChange={(e) => setFormData({ ...formData, secondaryColor: e.target.value })}
                  className="h-10 w-20 rounded border cursor-pointer"
                />
                <input
                  type="text"
                  value={formData.secondaryColor}
                  onChange={(e) => setFormData({ ...formData, secondaryColor: e.target.value })}
                  className="flex-1 px-3 py-2 border rounded-md"
                />
              </div>
            </div>

            {/* Theme Selection */}
            <div>
              <Label>Mode Tampilan</Label>
              <div className="grid grid-cols-3 gap-2 mt-2">
                {(['light', 'dark', 'auto'] as const).map((theme) => (
                  <button
                    key={theme}
                    type="button"
                    onClick={() => setFormData({ ...formData, theme })}
                    className={`px-4 py-2 border rounded-md text-sm font-medium transition-colors ${
                      formData.theme === theme
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {theme === 'light' ? 'Terang' : theme === 'dark' ? 'Gelap' : 'Otomatis'}
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Preview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Preview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg p-4" style={{ backgroundColor: `${formData.primaryColor}10` }}>
              <div className="flex items-center gap-4">
                {logoPreview && (
                  <img src={logoPreview} alt="Logo" className="h-12 w-12 object-contain" />
                )}
                <div>
                  <h3 className="font-semibold" style={{ color: formData.primaryColor }}>
                    Nama Showroom Anda
                  </h3>
                  <p className="text-sm" style={{ color: formData.secondaryColor }}>
                    Tagline atau slogan showroom
                  </p>
                </div>
              </div>
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
