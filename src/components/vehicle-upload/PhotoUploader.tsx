/**
 * Photo Uploader Component
 * Drag-and-drop interface for uploading vehicle photos
 *
 * Epic 2: AI-Powered Vehicle Upload
 * Story 2.1: Drag-and-Drop Photo Upload Interface
 */

'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface UploadedPhoto {
  id?: string; // Photo ID from backend
  file: File;
  preview: string;
  uploadProgress: number;
  status: 'pending' | 'uploading' | 'uploaded' | 'error';
  error?: string;
  key?: string; // R2 storage key
}

interface PhotoUploaderProps {
  tenantId: string;
  userId: string;
  maxPhotos?: number;
  onPhotosUploaded?: (photoIds: string[]) => void;
  onUploadComplete?: () => void;
}

export function PhotoUploader({
  tenantId,
  userId,
  maxPhotos = 20,
  onPhotosUploaded,
  onUploadComplete
}: PhotoUploaderProps) {
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uploadedPhotoIds = photos
    .filter(p => p.status === 'uploaded' && p.id)
    .map(p => p.id!);

  // Handle file drop
  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      setError(null);

      // Check photo limit
      if (photos.length + acceptedFiles.length > maxPhotos) {
        setError(`Maksimal ${maxPhotos} foto. Anda sudah upload ${photos.length} foto.`);
        return;
      }

      // Create photo previews
      const newPhotos: UploadedPhoto[] = acceptedFiles.map(file => ({
        file,
        preview: URL.createObjectURL(file),
        uploadProgress: 0,
        status: 'pending'
      }));

      setPhotos(prev => [...prev, ...newPhotos]);
      setIsUploading(true);

      // Upload photos one by one
      for (let i = 0; i < newPhotos.length; i++) {
        const photo = newPhotos[i];
        await uploadPhoto(photo, photos.length + i);
      }

      setIsUploading(false);

      // Notify parent component
      const allPhotoIds = photos
        .filter(p => p.status === 'uploaded' && p.id)
        .map(p => p.id!);

      if (onPhotosUploaded && allPhotoIds.length > 0) {
        onPhotosUploaded(allPhotoIds);
      }

      if (onUploadComplete) {
        onUploadComplete();
      }
    },
    [photos, maxPhotos, tenantId, userId, onPhotosUploaded, onUploadComplete]
  );

  const uploadPhoto = async (photo: UploadedPhoto, index: number) => {
    try {
      // Update status to uploading
      setPhotos(prev => {
        const updated = [...prev];
        updated[index] = { ...updated[index], status: 'uploading', uploadProgress: 0 };
        return updated;
      });

      // Step 1: Get signed upload URL from backend
      const uploadUrlResponse = await fetch('/api/v1/vehicles/upload-photos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: photo.file.name,
          contentType: photo.file.type,
          fileSize: photo.file.size,
          tenantId,
          userId
        })
      });

      if (!uploadUrlResponse.ok) {
        const errorData = await uploadUrlResponse.json();
        throw new Error(errorData.error || 'Gagal mendapatkan URL upload');
      }

      const { data } = await uploadUrlResponse.json();
      const { uploadUrl, photoId, key } = data;

      // Step 2: Upload directly to R2 using signed URL
      const xhr = new XMLHttpRequest();

      // Track upload progress
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const progress = Math.round((e.loaded / e.total) * 100);
          setPhotos(prev => {
            const updated = [...prev];
            updated[index] = { ...updated[index], uploadProgress: progress };
            return updated;
          });
        }
      });

      // Handle upload complete
      xhr.addEventListener('load', async () => {
        if (xhr.status === 200) {
          // Upload successful
          setPhotos(prev => {
            const updated = [...prev];
            updated[index] = {
              ...updated[index],
              status: 'uploaded',
              uploadProgress: 100,
              id: photoId,
              key
            };
            return updated;
          });

          // Trigger backend processing (optimization, validation)
          // This happens asynchronously in the background
          try {
            await fetch('/api/v1/vehicles/process-photo', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ photoId, tenantId })
            });
          } catch (err) {
            console.error('Background processing error:', err);
            // Don't fail the upload if processing fails
          }
        } else {
          throw new Error('Upload ke R2 gagal');
        }
      });

      // Handle upload error
      xhr.addEventListener('error', () => {
        setPhotos(prev => {
          const updated = [...prev];
          updated[index] = {
            ...updated[index],
            status: 'error',
            error: 'Upload gagal'
          };
          return updated;
        });
      });

      // Start upload
      xhr.open('PUT', uploadUrl);
      xhr.setRequestHeader('Content-Type', photo.file.type);
      xhr.send(photo.file);

    } catch (error) {
      console.error('Upload error:', error);
      setPhotos(prev => {
        const updated = [...prev];
        updated[index] = {
          ...updated[index],
          status: 'error',
          error: error instanceof Error ? error.message : 'Upload gagal'
        };
        return updated;
      });
    }
  };

  const removePhoto = (index: number) => {
    const photo = photos[index];

    // Revoke object URL to prevent memory leak
    if (photo.preview) {
      URL.revokeObjectURL(photo.preview);
    }

    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/webp': ['.webp']
    },
    maxSize: 10 * 1024 * 1024, // 10MB
    disabled: isUploading || photos.length >= maxPhotos
  });

  const uploadedCount = photos.filter(p => p.status === 'uploaded').length;
  const errorCount = photos.filter(p => p.status === 'error').length;

  return (
    <div className="space-y-4">
      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
          transition-colors
          ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}
          ${isUploading || photos.length >= maxPhotos ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <input {...getInputProps()} />
        <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />

        {isDragActive ? (
          <p className="text-lg font-medium text-blue-600">
            Lepaskan foto di sini...
          </p>
        ) : (
          <div>
            <p className="text-lg font-medium text-gray-900 mb-2">
              Drag foto kendaraan ke sini atau klik untuk pilih
            </p>
            <p className="text-sm text-gray-500">
              Maksimal {maxPhotos} foto (JPG, PNG, WEBP, max 10MB per file)
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {photos.length}/{maxPhotos} foto terupload
            </p>
          </div>
        )}
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Upload Summary */}
      {photos.length > 0 && (
        <div className="flex items-center justify-between text-sm">
          <div className="flex gap-4">
            <span className="text-gray-600">
              Total: <span className="font-medium">{photos.length}</span>
            </span>
            <span className="text-green-600">
              Berhasil: <span className="font-medium">{uploadedCount}</span>
            </span>
            {errorCount > 0 && (
              <span className="text-red-600">
                Gagal: <span className="font-medium">{errorCount}</span>
              </span>
            )}
          </div>
          {isUploading && (
            <div className="flex items-center gap-2 text-blue-600">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Mengupload...</span>
            </div>
          )}
        </div>
      )}

      {/* Photo Grid */}
      {photos.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {photos.map((photo, index) => (
            <div key={index} className="relative group">
              {/* Photo Preview */}
              <div className="aspect-square rounded-lg overflow-hidden bg-gray-100">
                <img
                  src={photo.preview}
                  alt={`Upload ${index + 1}`}
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Upload Progress */}
              {photo.status === 'uploading' && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-lg">
                  <div className="text-center">
                    <Loader2 className="h-8 w-8 text-white animate-spin mx-auto mb-2" />
                    <Progress value={photo.uploadProgress} className="w-20" />
                    <p className="text-white text-xs mt-1">{photo.uploadProgress}%</p>
                  </div>
                </div>
              )}

              {/* Upload Success */}
              {photo.status === 'uploaded' && (
                <div className="absolute top-2 right-2 bg-green-500 text-white rounded-full p-1">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
              )}

              {/* Upload Error */}
              {photo.status === 'error' && (
                <div className="absolute inset-0 bg-red-500/90 flex items-center justify-center rounded-lg">
                  <div className="text-center text-white p-2">
                    <AlertCircle className="h-6 w-6 mx-auto mb-1" />
                    <p className="text-xs">{photo.error || 'Gagal upload'}</p>
                  </div>
                </div>
              )}

              {/* Remove Button */}
              <button
                onClick={() => removePhoto(index)}
                className="absolute top-2 left-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                disabled={photo.status === 'uploading'}
              >
                <X className="h-4 w-4" />
              </button>

              {/* Photo Number */}
              <div className="absolute bottom-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
                #{index + 1}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
