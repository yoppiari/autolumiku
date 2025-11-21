/**
 * Vehicle Review Component
 * Review complete vehicle listing before publishing
 *
 * Epic 2: AI-Powered Vehicle Upload
 * Story 2.6: Vehicle Listing Review and Publishing
 */

'use client';

import { useState, useEffect } from 'react';
import { Eye, CheckCircle2, Loader2, Send } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';

interface VehicleData {
  id: string;
  make: string;
  model: string;
  year: number;
  variant?: string;
  price: number;
  descriptionId: string;
  descriptionEn: string;
  features: string[];
  photos: Array<{
    id: string;
    thumbnailUrl: string;
    isMainPhoto: boolean;
  }>;
  transmissionType?: string;
  fuelType?: string;
  color?: string;
  mileage?: number;
  condition?: string;
}

interface VehicleReviewProps {
  vehicleId: string;
  tenantId: string;
  onPublished?: (vehicle: VehicleData) => void;
}

export function VehicleReview({
  vehicleId,
  tenantId,
  onPublished
}: VehicleReviewProps) {
  const [vehicle, setVehicle] = useState<VehicleData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPublishing, setIsPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchVehicle();
  }, [vehicleId]);

  const fetchVehicle = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(
        `/api/v1/vehicles/${vehicleId}?tenantId=${tenantId}`
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Gagal mengambil data kendaraan');
      }

      const { data } = await response.json();
      setVehicle(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengambil data kendaraan');
    } finally {
      setIsLoading(false);
    }
  };

  const publishVehicle = async () => {
    try {
      setIsPublishing(true);
      setError(null);

      const response = await fetch(`/api/v1/vehicles/${vehicleId}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          userId: 'current-user-id' // Should come from auth context
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Gagal mempublikasikan kendaraan');
      }

      const { data } = await response.json();

      if (onPublished && vehicle) {
        onPublished(vehicle);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mempublikasikan kendaraan');
    } finally {
      setIsPublishing(false);
    }
  };

  const formatIDR = (cents: number) => {
    const rupiah = Math.round(cents / 100);
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(rupiah);
  };

  const canPublish = vehicle && vehicle.photos.length > 0 && vehicle.price > 0;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Loader2 className="h-12 w-12 animate-spin mx-auto text-blue-500 mb-4" />
          <p className="text-gray-600">Memuat data kendaraan...</p>
        </CardContent>
      </Card>
    );
  }

  if (error && !vehicle) {
    return (
      <Card>
        <CardContent className="py-12">
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <Button onClick={fetchVehicle} className="w-full mt-4">
            Coba Lagi
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Eye className="h-5 w-5 text-blue-500" />
          <span>Review & Publish</span>
        </CardTitle>
        <CardDescription>
          Periksa semua informasi sebelum mempublikasikan ke website
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {vehicle && (
          <>
            {/* Main Info */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-2xl font-bold text-gray-900">
                    {vehicle.make} {vehicle.model} {vehicle.year}
                  </h3>
                  {vehicle.variant && (
                    <p className="text-gray-600 mt-1">{vehicle.variant}</p>
                  )}
                  <div className="flex gap-2 mt-3">
                    {vehicle.transmissionType && (
                      <Badge variant="secondary">{vehicle.transmissionType}</Badge>
                    )}
                    {vehicle.fuelType && (
                      <Badge variant="secondary">{vehicle.fuelType}</Badge>
                    )}
                    {vehicle.color && (
                      <Badge variant="secondary">{vehicle.color}</Badge>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-600">Harga</p>
                  <p className="text-3xl font-bold text-green-600">
                    {formatIDR(vehicle.price)}
                  </p>
                </div>
              </div>
            </div>

            {/* Photos Preview */}
            <div>
              <h4 className="font-medium text-gray-900 mb-3">
                Foto ({vehicle.photos.length})
              </h4>
              <div className="grid grid-cols-4 md:grid-cols-6 gap-2">
                {vehicle.photos.map((photo) => (
                  <div key={photo.id} className="relative aspect-square rounded-lg overflow-hidden bg-gray-100">
                    <img
                      src={photo.thumbnailUrl}
                      alt="Vehicle"
                      className="w-full h-full object-cover"
                    />
                    {photo.isMainPhoto && (
                      <div className="absolute top-1 right-1">
                        <Badge className="bg-blue-500 text-xs">Main</Badge>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* Description */}
            <div>
              <h4 className="font-medium text-gray-900 mb-3">Deskripsi</h4>
              <div className="bg-gray-50 rounded-lg p-4 max-h-60 overflow-y-auto">
                <p className="text-sm text-gray-700 whitespace-pre-line">
                  {vehicle.descriptionId}
                </p>
              </div>
            </div>

            {/* Features */}
            {vehicle.features.length > 0 && (
              <div>
                <h4 className="font-medium text-gray-900 mb-3">
                  Fitur ({vehicle.features.length})
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {vehicle.features.map((feature, index) => (
                    <div key={index} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                      <span className="text-gray-700">{feature}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Separator />

            {/* Additional Details */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {vehicle.mileage && (
                <div>
                  <p className="text-sm text-gray-600">Kilometer</p>
                  <p className="text-base font-medium">{vehicle.mileage.toLocaleString()} km</p>
                </div>
              )}
              {vehicle.condition && (
                <div>
                  <p className="text-sm text-gray-600">Kondisi</p>
                  <p className="text-base font-medium capitalize">{vehicle.condition}</p>
                </div>
              )}
            </div>

            <Separator />

            {/* Publish Validation */}
            {!canPublish && (
              <Alert variant="destructive">
                <AlertDescription>
                  <strong>Tidak bisa dipublikasikan:</strong>
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    {vehicle.photos.length === 0 && (
                      <li>Minimal 1 foto harus diupload</li>
                    )}
                    {vehicle.price === 0 && (
                      <li>Harga harus diatur</li>
                    )}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {/* Publish Button */}
            <div className="space-y-4">
              {canPublish && (
                <Alert className="bg-green-50 border-green-200">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-800">
                    Listing siap dipublikasikan! Kendaraan akan muncul di website showroom Anda.
                  </AlertDescription>
                </Alert>
              )}

              <Button
                onClick={publishVehicle}
                disabled={!canPublish || isPublishing}
                className="w-full"
                size="lg"
              >
                {isPublishing ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Mempublikasikan...
                  </>
                ) : (
                  <>
                    <Send className="h-5 w-5 mr-2" />
                    Publikasikan ke Website
                  </>
                )}
              </Button>
            </div>

            {/* Error */}
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
