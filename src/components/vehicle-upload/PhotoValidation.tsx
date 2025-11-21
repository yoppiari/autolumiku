/**
 * Photo Validation Component
 * Displays photo quality analysis and validation status
 *
 * Epic 2: AI-Powered Vehicle Upload
 * Story 2.2: Real-Time Photo Validation
 */

'use client';

import { useState, useEffect } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Loader2, Info } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

interface PhotoValidationResult {
  photoId: string;
  status: 'PENDING' | 'VALID' | 'LOW_QUALITY' | 'REJECTED';
  qualityScore: number;
  message: string;
}

interface PhotoValidationProps {
  photoIds: string[];
  tenantId: string;
  onValidationComplete?: (validPhotos: string[]) => void;
  autoValidate?: boolean;
}

export function PhotoValidation({
  photoIds,
  tenantId,
  onValidationComplete,
  autoValidate = true
}: PhotoValidationProps) {
  const [validationResults, setValidationResults] = useState<PhotoValidationResult[]>([]);
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (autoValidate && photoIds.length > 0) {
      validatePhotos();
    }
  }, [photoIds, autoValidate]);

  const validatePhotos = async () => {
    try {
      setIsValidating(true);
      setError(null);

      const response = await fetch('/api/v1/vehicles/validate-photos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          photoIds,
          tenantId
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Validasi gagal');
      }

      const { data } = await response.json();
      setValidationResults(data.photos);

      // Notify parent with valid photos only
      if (onValidationComplete) {
        const validPhotoIds = data.photos
          .filter((p: PhotoValidationResult) => p.status === 'VALID')
          .map((p: PhotoValidationResult) => p.photoId);
        onValidationComplete(validPhotoIds);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Validasi gagal');
    } finally {
      setIsValidating(false);
    }
  };

  const getStatusBadge = (status: PhotoValidationResult['status']) => {
    switch (status) {
      case 'VALID':
        return (
          <Badge variant="default" className="bg-green-500">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Valid
          </Badge>
        );
      case 'LOW_QUALITY':
        return (
          <Badge variant="default" className="bg-yellow-500">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Kualitas Rendah
          </Badge>
        );
      case 'REJECTED':
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            Ditolak
          </Badge>
        );
      case 'PENDING':
        return (
          <Badge variant="secondary">
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            Menunggu
          </Badge>
        );
    }
  };

  const getQualityColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    if (score >= 40) return 'text-orange-600';
    return 'text-red-600';
  };

  const getQualityLabel = (score: number) => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Fair';
    return 'Poor';
  };

  const validCount = validationResults.filter(r => r.status === 'VALID').length;
  const lowQualityCount = validationResults.filter(r => r.status === 'LOW_QUALITY').length;
  const rejectedCount = validationResults.filter(r => r.status === 'REJECTED').length;
  const averageQuality = validationResults.length > 0
    ? Math.round(validationResults.reduce((sum, r) => sum + r.qualityScore, 0) / validationResults.length)
    : 0;

  if (photoIds.length === 0) {
    return (
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Upload foto terlebih dahulu untuk memulai validasi.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Validasi Kualitas Foto</span>
          {!autoValidate && (
            <Button
              onClick={validatePhotos}
              disabled={isValidating}
              size="sm"
            >
              {isValidating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Memvalidasi...
                </>
              ) : (
                'Validasi Foto'
              )}
            </Button>
          )}
        </CardTitle>
        <CardDescription>
          Sistem memeriksa kualitas, resolusi, dan ketajaman foto
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Error */}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Loading State */}
        {isValidating && (
          <div className="text-center py-8">
            <Loader2 className="h-12 w-12 animate-spin mx-auto text-blue-500 mb-4" />
            <p className="text-gray-600">Menganalisis kualitas foto...</p>
          </div>
        )}

        {/* Summary */}
        {!isValidating && validationResults.length > 0 && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-1">Total Foto</p>
                <p className="text-2xl font-bold">{validationResults.length}</p>
              </div>
              <div className="bg-green-50 rounded-lg p-4">
                <p className="text-sm text-green-600 mb-1">Valid</p>
                <p className="text-2xl font-bold text-green-600">{validCount}</p>
              </div>
              <div className="bg-yellow-50 rounded-lg p-4">
                <p className="text-sm text-yellow-600 mb-1">Kualitas Rendah</p>
                <p className="text-2xl font-bold text-yellow-600">{lowQualityCount}</p>
              </div>
              <div className="bg-red-50 rounded-lg p-4">
                <p className="text-sm text-red-600 mb-1">Ditolak</p>
                <p className="text-2xl font-bold text-red-600">{rejectedCount}</p>
              </div>
            </div>

            {/* Average Quality */}
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-blue-900">
                  Kualitas Rata-rata
                </span>
                <span className={`text-lg font-bold ${getQualityColor(averageQuality)}`}>
                  {averageQuality}/100 - {getQualityLabel(averageQuality)}
                </span>
              </div>
              <Progress value={averageQuality} className="h-2" />
            </div>

            {/* Individual Photo Results */}
            <div className="space-y-2">
              <h4 className="font-medium text-sm text-gray-700">Detail Per Foto:</h4>
              {validationResults.map((result, index) => (
                <div
                  key={result.photoId}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-gray-600">
                      Foto #{index + 1}
                    </span>
                    {getStatusBadge(result.status)}
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className={`text-sm font-medium ${getQualityColor(result.qualityScore)}`}>
                        {result.qualityScore}/100
                      </p>
                      <p className="text-xs text-gray-500">{result.message}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Recommendations */}
            {(lowQualityCount > 0 || rejectedCount > 0) && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Rekomendasi:</strong>
                  <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                    {lowQualityCount > 0 && (
                      <li>
                        {lowQualityCount} foto memiliki kualitas rendah. Pertimbangkan untuk mengupload ulang dengan resolusi lebih tinggi.
                      </li>
                    )}
                    {rejectedCount > 0 && (
                      <li>
                        {rejectedCount} foto ditolak karena tidak memenuhi standar minimum. Upload foto baru dengan kualitas lebih baik.
                      </li>
                    )}
                    <li>
                      Gunakan resolusi minimal 1280x720 untuk hasil terbaik.
                    </li>
                    <li>
                      Pastikan foto tajam dan fokus pada kendaraan.
                    </li>
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {/* Success Message */}
            {validCount === validationResults.length && (
              <Alert className="bg-green-50 border-green-200">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">
                  Semua foto valid dan berkualitas baik! Anda siap melanjutkan ke identifikasi kendaraan.
                </AlertDescription>
              </Alert>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
