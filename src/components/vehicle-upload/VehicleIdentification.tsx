/**
 * Vehicle Identification Component
 * Displays AI vehicle identification results with edit capability
 *
 * Epic 2: AI-Powered Vehicle Upload
 * Story 2.3: AI Vehicle Identification
 */

'use client';

import { useState, useEffect } from 'react';
import { Car, Loader2, CheckCircle2, AlertCircle, Sparkles, Edit2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface VehicleIdentificationData {
  make: string;
  model: string;
  year: number;
  variant?: string;
  transmissionType?: 'manual' | 'automatic' | 'cvt';
  fuelType?: 'bensin' | 'diesel' | 'hybrid' | 'electric';
  color?: string;
  condition?: 'excellent' | 'good' | 'fair' | 'poor';
  visibleFeatures: string[];
  bodyType?: string;
  confidence: number;
  reasoning: string;
}

interface VehicleIdentificationProps {
  photoIds: string[];
  tenantId: string;
  onIdentificationComplete?: (data: VehicleIdentificationData) => void;
  autoIdentify?: boolean;
}

export function VehicleIdentification({
  photoIds,
  tenantId,
  onIdentificationComplete,
  autoIdentify = true
}: VehicleIdentificationProps) {
  const [identification, setIdentification] = useState<VehicleIdentificationData | null>(null);
  const [isIdentifying, setIsIdentifying] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedData, setEditedData] = useState<VehicleIdentificationData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (autoIdentify && photoIds.length > 0 && !identification) {
      identifyVehicle();
    }
  }, [photoIds, autoIdentify, identification]);

  const identifyVehicle = async () => {
    try {
      setIsIdentifying(true);
      setError(null);

      const response = await fetch('/api/v1/vehicles/identify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          photoIds,
          tenantId
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Identifikasi gagal');
      }

      const { data } = await response.json();
      setIdentification(data);
      setEditedData(data);

      if (onIdentificationComplete) {
        onIdentificationComplete(data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Identifikasi gagal');
    } finally {
      setIsIdentifying(false);
    }
  };

  const handleSaveEdit = () => {
    if (editedData) {
      setIdentification(editedData);
      setIsEditing(false);

      if (onIdentificationComplete) {
        onIdentificationComplete(editedData);
      }
    }
  };

  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 80) {
      return <Badge className="bg-green-500">Confidence: {confidence}% - High</Badge>;
    } else if (confidence >= 60) {
      return <Badge className="bg-yellow-500">Confidence: {confidence}% - Medium</Badge>;
    } else {
      return <Badge className="bg-orange-500">Confidence: {confidence}% - Low</Badge>;
    }
  };

  if (photoIds.length === 0) {
    return (
      <Alert>
        <Car className="h-4 w-4" />
        <AlertDescription>
          Upload dan validasi foto terlebih dahulu untuk identifikasi kendaraan.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-blue-500" />
            <span>Identifikasi Kendaraan AI</span>
          </div>
          {identification && !isEditing && (
            <Button
              onClick={() => setIsEditing(true)}
              variant="outline"
              size="sm"
            >
              <Edit2 className="h-4 w-4 mr-2" />
              Edit
            </Button>
          )}
        </CardTitle>
        <CardDescription>
          AI menganalisis foto untuk mengidentifikasi kendaraan secara otomatis
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Error */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Loading */}
        {isIdentifying && (
          <div className="text-center py-12">
            <Loader2 className="h-16 w-16 animate-spin mx-auto text-blue-500 mb-4" />
            <p className="text-lg font-medium text-gray-900 mb-2">
              Menganalisis kendaraan...
            </p>
            <p className="text-sm text-gray-500">
              AI sedang mengidentifikasi merek, model, dan tahun kendaraan
            </p>
          </div>
        )}

        {/* Identification Results */}
        {!isIdentifying && identification && (
          <div className="space-y-4">
            {/* Confidence Badge */}
            <div className="flex items-center justify-between">
              {getConfidenceBadge(identification.confidence)}
              {isEditing ? (
                <div className="flex gap-2">
                  <Button onClick={handleSaveEdit} size="sm">
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Simpan
                  </Button>
                  <Button
                    onClick={() => {
                      setEditedData(identification);
                      setIsEditing(false);
                    }}
                    variant="outline"
                    size="sm"
                  >
                    Batal
                  </Button>
                </div>
              ) : null}
            </div>

            {/* Main Identification */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="make" className="text-sm text-gray-600">Merek</Label>
                  {isEditing ? (
                    <Input
                      id="make"
                      value={editedData?.make || ''}
                      onChange={(e) => setEditedData(prev => prev ? { ...prev, make: e.target.value } : null)}
                      className="mt-1"
                    />
                  ) : (
                    <p className="text-2xl font-bold text-gray-900 mt-1">{identification.make}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="model" className="text-sm text-gray-600">Model</Label>
                  {isEditing ? (
                    <Input
                      id="model"
                      value={editedData?.model || ''}
                      onChange={(e) => setEditedData(prev => prev ? { ...prev, model: e.target.value } : null)}
                      className="mt-1"
                    />
                  ) : (
                    <p className="text-2xl font-bold text-gray-900 mt-1">{identification.model}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="year" className="text-sm text-gray-600">Tahun</Label>
                  {isEditing ? (
                    <Input
                      id="year"
                      type="number"
                      value={editedData?.year || ''}
                      onChange={(e) => setEditedData(prev => prev ? { ...prev, year: parseInt(e.target.value) } : null)}
                      className="mt-1"
                    />
                  ) : (
                    <p className="text-2xl font-bold text-gray-900 mt-1">{identification.year}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Additional Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {identification.variant && (
                <div>
                  <Label className="text-sm text-gray-600">Varian</Label>
                  {isEditing ? (
                    <Input
                      value={editedData?.variant || ''}
                      onChange={(e) => setEditedData(prev => prev ? { ...prev, variant: e.target.value } : null)}
                      className="mt-1"
                    />
                  ) : (
                    <p className="text-base font-medium text-gray-900 mt-1">{identification.variant}</p>
                  )}
                </div>
              )}

              {identification.transmissionType && (
                <div>
                  <Label className="text-sm text-gray-600">Transmisi</Label>
                  {isEditing ? (
                    <Select
                      value={editedData?.transmissionType}
                      onValueChange={(value) => setEditedData(prev => prev ? { ...prev, transmissionType: value as any } : null)}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="manual">Manual</SelectItem>
                        <SelectItem value="automatic">Automatic</SelectItem>
                        <SelectItem value="cvt">CVT</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="text-base font-medium text-gray-900 mt-1 capitalize">{identification.transmissionType}</p>
                  )}
                </div>
              )}

              {identification.fuelType && (
                <div>
                  <Label className="text-sm text-gray-600">Bahan Bakar</Label>
                  {isEditing ? (
                    <Select
                      value={editedData?.fuelType}
                      onValueChange={(value) => setEditedData(prev => prev ? { ...prev, fuelType: value as any } : null)}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bensin">Bensin</SelectItem>
                        <SelectItem value="diesel">Diesel</SelectItem>
                        <SelectItem value="hybrid">Hybrid</SelectItem>
                        <SelectItem value="electric">Electric</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="text-base font-medium text-gray-900 mt-1 capitalize">{identification.fuelType}</p>
                  )}
                </div>
              )}

              {identification.color && (
                <div>
                  <Label className="text-sm text-gray-600">Warna</Label>
                  {isEditing ? (
                    <Input
                      value={editedData?.color || ''}
                      onChange={(e) => setEditedData(prev => prev ? { ...prev, color: e.target.value } : null)}
                      className="mt-1"
                    />
                  ) : (
                    <p className="text-base font-medium text-gray-900 mt-1">{identification.color}</p>
                  )}
                </div>
              )}
            </div>

            {/* AI Reasoning */}
            <div className="bg-gray-50 rounded-lg p-4">
              <Label className="text-sm font-medium text-gray-700 mb-2 block">
                Alasan AI:
              </Label>
              <p className="text-sm text-gray-600 leading-relaxed">
                {identification.reasoning}
              </p>
            </div>

            {/* Visible Features */}
            {identification.visibleFeatures.length > 0 && (
              <div>
                <Label className="text-sm font-medium text-gray-700 mb-2 block">
                  Fitur yang Terlihat:
                </Label>
                <div className="flex flex-wrap gap-2">
                  {identification.visibleFeatures.map((feature, index) => (
                    <Badge key={index} variant="secondary">
                      {feature}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Low Confidence Warning */}
            {identification.confidence < 60 && (
              <Alert className="bg-yellow-50 border-yellow-200">
                <AlertCircle className="h-4 w-4 text-yellow-600" />
                <AlertDescription className="text-yellow-800">
                  <strong>Confidence rendah.</strong> Silakan periksa dan edit hasil identifikasi jika ada yang tidak sesuai.
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {/* Retry Button */}
        {!isIdentifying && error && (
          <Button onClick={identifyVehicle} className="w-full">
            Coba Lagi
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
