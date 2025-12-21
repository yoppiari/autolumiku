'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';

type VehicleStatus = 'DRAFT' | 'AVAILABLE' | 'BOOKED' | 'SOLD' | 'DELETED';

interface Vehicle {
  id: string;
  displayId?: string;
  make: string;
  model: string;
  year: number;
  variant?: string;
  descriptionId?: string;
  price: number;
  aiSuggestedPrice?: number | null;
  mileage?: number;
  transmissionType?: string;
  fuelType?: string;
  color?: string;
  licensePlate?: string;
  engineCapacity?: string;
  condition?: string;
  status: VehicleStatus;
  photos: Array<{
    id: string;
    originalUrl: string;
    thumbnailUrl: string;
    displayOrder: number;
  }>;
}

interface UploadedPhoto {
  id: string;
  file: File;
  preview: string;
  base64?: string;
}

export default function EditVehiclePage() {
  const router = useRouter();
  const params = useParams();
  const vehicleId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);

  // Photo upload state
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const MAX_PHOTOS = 15;
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

  // Form state
  const [formData, setFormData] = useState({
    make: '',
    model: '',
    year: new Date().getFullYear(),
    variant: '',
    descriptionId: '',
    price: 0,
    mileage: 0,
    transmissionType: '',
    fuelType: '',
    color: '',
    licensePlate: '',
    engineCapacity: '',
    condition: '',
    status: 'DRAFT' as VehicleStatus,
  });

  // Helper to get auth headers - defined before useEffect
  const getAuthHeaders = () => {
    const token = localStorage.getItem('authToken');
    console.log('[Edit Page] Auth token exists:', !!token);
    return {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
    };
  };

  const fetchVehicle = async () => {
    console.log('[Edit Page] Fetching vehicle:', vehicleId);
    try {
      const headers = getAuthHeaders();
      console.log('[Edit Page] Request headers:', Object.keys(headers));

      const response = await fetch(`/api/v1/vehicles/${vehicleId}`, {
        headers,
      });

      console.log('[Edit Page] Response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        const v = data.data;
        console.log('[Edit Page] Vehicle loaded:', v?.make, v?.model);
        setVehicle(v);

        // Populate form
        setFormData({
          make: v.make || '',
          model: v.model || '',
          year: v.year || new Date().getFullYear(),
          variant: v.variant || '',
          descriptionId: v.descriptionId || '',
          price: v.price / 100000000 || 0, // Convert cents to juta
          mileage: v.mileage || 0,
          transmissionType: v.transmissionType || '',
          fuelType: v.fuelType || '',
          color: v.color || '',
          licensePlate: v.licensePlate || '',
          engineCapacity: v.engineCapacity || '',
          condition: v.condition || '',
          status: v.status || 'DRAFT',
        });
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('[Edit Page] API Error:', response.status, errorData);
        const errorMessage = errorData.error || errorData.message || 'Gagal memuat data kendaraan';

        // Check for token expiry and redirect to login
        if (errorMessage.toLowerCase().includes('token') ||
            errorMessage.toLowerCase().includes('unauthorized') ||
            errorMessage.toLowerCase().includes('expired') ||
            response.status === 401) {
          console.log('[Edit Page] Token expired, redirecting to login');
          localStorage.removeItem('authToken');
          localStorage.removeItem('user');
          alert('Sesi login Anda telah berakhir. Silakan login kembali.');
          router.push('/login');
          return;
        }

        setError(errorMessage);
      }
    } catch (err) {
      console.error('[Edit Page] Fetch error:', err);
      setError('Gagal memuat data kendaraan - koneksi error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (vehicleId) {
      fetchVehicle();
    }
  }, [vehicleId]);

  // Convert file to base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  // Handle photo selection
  const handlePhotoSelect = async (files: FileList | null) => {
    if (!files) return;

    const newPhotos: UploadedPhoto[] = [];
    const filesArray = Array.from(files);

    // Validate total count
    const existingPhotosCount = vehicle?.photos?.length || 0;
    if (existingPhotosCount + photos.length + filesArray.length > MAX_PHOTOS) {
      setError(`Maksimal ${MAX_PHOTOS} foto. Anda sudah punya ${existingPhotosCount + photos.length} foto.`);
      return;
    }

    for (const file of filesArray) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setError(`File ${file.name} bukan image`);
        continue;
      }

      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        setError(`File ${file.name} terlalu besar (max 10MB)`);
        continue;
      }

      // Create preview and base64
      const preview = URL.createObjectURL(file);
      const base64 = await fileToBase64(file);

      newPhotos.push({
        id: `${Date.now()}-${Math.random()}`,
        file,
        preview,
        base64,
      });
    }

    setPhotos([...photos, ...newPhotos]);
    setError(null);
  };

  // Handle drag and drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handlePhotoSelect(e.dataTransfer.files);
  };

  // Remove photo
  const handleRemovePhoto = (id: string) => {
    const photo = photos.find((p) => p.id === id);
    if (photo) {
      URL.revokeObjectURL(photo.preview);
    }
    setPhotos(photos.filter((p) => p.id !== id));
  };

  // Reorder photos - drag and drop
  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragEnter = (index: number) => {
    if (draggedIndex === null || draggedIndex === index) return;

    const newPhotos = [...photos];
    const draggedPhoto = newPhotos[draggedIndex];

    // Remove from old position
    newPhotos.splice(draggedIndex, 1);
    // Insert at new position
    newPhotos.splice(index, 0, draggedPhoto);

    setPhotos(newPhotos);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  // Set as main photo (move to first position)
  const handleSetMainPhoto = (index: number) => {
    if (index === 0) return;

    const newPhotos = [...photos];
    const selectedPhoto = newPhotos[index];

    // Remove from current position
    newPhotos.splice(index, 1);
    // Insert at beginning
    newPhotos.unshift(selectedPhoto);

    setPhotos(newPhotos);
  };

  // Cleanup previews on unmount
  useEffect(() => {
    return () => {
      photos.forEach((photo) => URL.revokeObjectURL(photo.preview));
    };
  }, [photos]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      // TODO: Get user from auth
      const user = JSON.parse(localStorage.getItem('user') || '{}');

      const updateData = {
        ...formData,
        year: parseInt(String(formData.year), 10), // Ensure year is integer
        price: Math.round(formData.price * 100000000), // Convert juta to cents
        mileage: formData.mileage ? parseInt(String(formData.mileage), 10) : null, // Ensure mileage is integer
        userId: user.id,
      };

      const response = await fetch(`/api/v1/vehicles/${vehicleId}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        const data = await response.json();
        console.error('❌ Vehicle update failed:', data);
        setError(`Gagal menyimpan: ${data.message || data.error || 'Unknown error'}`);
        setSaving(false);
        return;
      }

      // Success - now upload photos if any
      if (photos.length > 0) {
          console.log(`📸 Uploading ${photos.length} photos for vehicle ${vehicleId}...`);

          const photoData = photos.map((photo) => ({
            base64: photo.base64,
          }));

          try {
            const photoResponse = await fetch(`/api/v1/vehicles/${vehicleId}/photos`, {
              method: 'POST',
              headers: getAuthHeaders(),
              body: JSON.stringify({ photos: photoData }),
            });

            const photoResult = await photoResponse.json();

            if (!photoResponse.ok) {
              console.error('❌ Photo upload failed:', photoResult);
              setError(`Data berhasil disimpan, tapi gagal upload foto: ${photoResult.message || photoResult.error}`);
              setSaving(false);
              return;
            }

            console.log('✅ Photos uploaded successfully:', photoResult);
          } catch (photoError) {
            console.error('❌ Photo upload error:', photoError);
            setError(`Data berhasil disimpan, tapi gagal upload foto: ${photoError instanceof Error ? photoError.message : 'Unknown error'}`);
            setSaving(false);
            return;
          }
        }

      // Success! Redirect to list
      router.push('/dashboard/vehicles');
    } catch (err) {
      console.error('Failed to update vehicle:', err);
      setError('Gagal menyimpan perubahan');
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (error && !vehicle) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
        <Link href="/dashboard/vehicles" className="mt-4 inline-block text-blue-600 hover:underline">
          ← Kembali ke Daftar Kendaraan
        </Link>
      </div>
    );
  }

  const existingPhotosCount = vehicle?.photos?.length || 0;
  const totalPhotos = existingPhotosCount + photos.length;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link href="/dashboard/vehicles" className="text-blue-600 hover:underline mb-2 inline-block">
          ← Kembali ke Daftar Kendaraan
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Edit Kendaraan</h1>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-sm font-semibold text-gray-700 bg-gray-100 px-2 py-1 rounded">
            {vehicle?.displayId || `ID: ${vehicleId.slice(0, 8)}...`}
          </span>
          {vehicle?.licensePlate && (
            <span className="text-sm text-blue-600 font-semibold bg-blue-50 px-2 py-1 rounded border border-blue-200">
              🔒 {vehicle.licensePlate}
            </span>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Quick Status Actions */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Status Kendaraan</h2>

        {/* Current Status Display */}
        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-600 mb-1">Status Saat Ini:</p>
          <span className={`inline-block px-4 py-2 rounded-full font-bold text-lg ${
            formData.status === 'AVAILABLE' ? 'bg-green-100 text-green-800 border-2 border-green-400' :
            formData.status === 'BOOKED' ? 'bg-yellow-100 text-yellow-800 border-2 border-yellow-400' :
            formData.status === 'SOLD' ? 'bg-red-100 text-red-800 border-2 border-red-400' :
            'bg-gray-100 text-gray-800 border-2 border-gray-400'
          }`}>
            {formData.status === 'AVAILABLE' ? '✅ Ready / Tersedia' :
             formData.status === 'BOOKED' ? '📋 Booking / DP' :
             formData.status === 'SOLD' ? '🎉 Sold / Terjual' :
             '📝 Draft'}
          </span>
        </div>

        {/* Status Action Buttons */}
        <div className="flex flex-wrap gap-3">
          {/* Ready Button */}
          <button
            type="button"
            onClick={async () => {
              if (confirm('Ubah status menjadi READY (Tersedia)?')) {
                try {
                  const user = JSON.parse(localStorage.getItem('user') || '{}');
                  const token = localStorage.getItem('authToken');
                  const response = await fetch(`/api/v1/vehicles/${vehicleId}`, {
                    method: 'PUT',
                    headers: {
                      'Content-Type': 'application/json',
                      ...(token && { 'Authorization': `Bearer ${token}` }),
                    },
                    body: JSON.stringify({ status: 'AVAILABLE', userId: user.id }),
                  });
                  if (response.ok) {
                    setFormData(prev => ({ ...prev, status: 'AVAILABLE' }));
                    alert('✅ Status berhasil diubah ke READY');
                  } else {
                    alert('Gagal mengubah status');
                  }
                } catch (err) {
                  alert('Terjadi kesalahan');
                }
              }
            }}
            disabled={formData.status === 'AVAILABLE'}
            className={`px-6 py-3 rounded-lg font-bold text-lg flex items-center gap-2 transition-all ${
              formData.status === 'AVAILABLE'
                ? 'bg-green-200 text-green-600 cursor-not-allowed'
                : 'bg-green-500 text-white hover:bg-green-600 shadow-md hover:shadow-lg'
            }`}
          >
            ✅ Ready
          </button>

          {/* Booking Button */}
          <button
            type="button"
            onClick={async () => {
              if (confirm('Ubah status menjadi BOOKING (sudah DP)?')) {
                try {
                  const user = JSON.parse(localStorage.getItem('user') || '{}');
                  const token = localStorage.getItem('authToken');
                  const response = await fetch(`/api/v1/vehicles/${vehicleId}`, {
                    method: 'PUT',
                    headers: {
                      'Content-Type': 'application/json',
                      ...(token && { 'Authorization': `Bearer ${token}` }),
                    },
                    body: JSON.stringify({ status: 'BOOKED', userId: user.id }),
                  });
                  if (response.ok) {
                    setFormData(prev => ({ ...prev, status: 'BOOKED' }));
                    alert('📋 Status berhasil diubah ke BOOKING');
                  } else {
                    alert('Gagal mengubah status');
                  }
                } catch (err) {
                  alert('Terjadi kesalahan');
                }
              }
            }}
            disabled={formData.status === 'BOOKED'}
            className={`px-6 py-3 rounded-lg font-bold text-lg flex items-center gap-2 transition-all ${
              formData.status === 'BOOKED'
                ? 'bg-yellow-200 text-yellow-600 cursor-not-allowed'
                : 'bg-yellow-500 text-white hover:bg-yellow-600 shadow-md hover:shadow-lg'
            }`}
          >
            📋 Booking
          </button>

          {/* Sold Button */}
          <button
            type="button"
            onClick={async () => {
              if (confirm('🎉 Konfirmasi kendaraan ini SOLD (Terjual)?\n\nAnda akan tercatat sebagai sales yang closing unit ini.')) {
                try {
                  const user = JSON.parse(localStorage.getItem('user') || '{}');
                  const salesName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Unknown';

                  // Update status + record sales info
                  const token = localStorage.getItem('authToken');
                  const response = await fetch(`/api/v1/vehicles/${vehicleId}`, {
                    method: 'PUT',
                    headers: {
                      'Content-Type': 'application/json',
                      ...(token && { 'Authorization': `Bearer ${token}` }),
                    },
                    body: JSON.stringify({
                      status: 'SOLD',
                      userId: user.id,
                    }),
                  });

                  if (response.ok) {
                    // Also update soldBy via raw query (assignment columns)
                    try {
                      await fetch(`/api/v1/vehicles?slug=primamobil-id&action=mark-sold&vehicleId=${vehicleId}&salesId=${user.id}&salesName=${encodeURIComponent(salesName)}`);
                    } catch (e) {
                      // Assignment columns might not exist - OK
                    }

                    setFormData(prev => ({ ...prev, status: 'SOLD' }));
                    alert(`🎉 Selamat! Unit berhasil SOLD!\n\nClosing oleh: ${salesName}`);
                  } else {
                    alert('Gagal mengubah status');
                  }
                } catch (err) {
                  alert('Terjadi kesalahan');
                }
              }
            }}
            disabled={formData.status === 'SOLD'}
            className={`px-6 py-3 rounded-lg font-bold text-lg flex items-center gap-2 transition-all ${
              formData.status === 'SOLD'
                ? 'bg-red-200 text-red-600 cursor-not-allowed'
                : 'bg-red-500 text-white hover:bg-red-600 shadow-md hover:shadow-lg'
            }`}
          >
            🎉 Sold
          </button>
        </div>

        {/* Status Info */}
        <div className="mt-4 text-sm text-gray-500">
          <p>• <strong>Ready:</strong> Kendaraan siap dijual, tampil di katalog</p>
          <p>• <strong>Booking:</strong> Customer sudah DP, unit reserved</p>
          <p>• <strong>Sold:</strong> Unit terjual, Anda tercatat sebagai sales closing</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Photos Section */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Foto Kendaraan</h2>

          {/* Existing Photos */}
          {existingPhotosCount > 0 && (
            <div className="mb-6">
              <p className="text-sm font-medium text-gray-700 mb-3">
                Foto Saat Ini ({existingPhotosCount})
                <span className="ml-2 text-xs text-gray-500">• Klik foto untuk manage</span>
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {vehicle?.photos.map((photo: any, index: number) => (
                  <div
                    key={photo.id}
                    className="relative group cursor-pointer transition-all hover:scale-105"
                  >
                    {/* Photo Image */}
                    <img
                      src={photo.thumbnailUrl || photo.originalUrl}
                      alt={`Photo ${index + 1}`}
                      className="w-full h-32 object-cover rounded-lg border-2 border-gray-200 group-hover:border-blue-400"
                    />

                    {/* Main Photo Badge */}
                    {photo.isMainPhoto && (
                      <div className="absolute top-2 left-2 bg-blue-600 text-white text-xs px-2 py-1 rounded font-semibold flex items-center gap-1">
                        ⭐ Utama
                      </div>
                    )}

                    {/* Quality Score Badge */}
                    {photo.qualityScore && (
                      <div className={`absolute top-2 right-2 text-xs px-2 py-1 rounded font-semibold ${
                        photo.validationStatus === 'VALID' ? 'bg-green-100 text-green-800' :
                        photo.validationStatus === 'LOW_QUALITY' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {photo.qualityScore}
                      </div>
                    )}

                    {/* Photo Number */}
                    <div className="absolute bottom-2 left-2 bg-gray-800 bg-opacity-75 text-white text-xs px-2 py-0.5 rounded">
                      #{index + 1}
                    </div>

                    {/* Action Buttons (show on hover) */}
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 rounded-lg transition-all flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                      {/* Set as Main Button */}
                      {!photo.isMainPhoto && (
                        <button
                          type="button"
                          onClick={async () => {
                            if (confirm('Jadikan foto ini sebagai foto utama?')) {
                              try {
                                const token = localStorage.getItem('authToken');
                                const response = await fetch(`/api/v1/vehicles/${vehicleId}/photos/${photo.id}/main`, {
                                  method: 'PUT',
                                  headers: {
                                    ...(token && { 'Authorization': `Bearer ${token}` }),
                                  },
                                });
                                if (response.ok) {
                                  fetchVehicle();
                                } else {
                                  alert('Gagal mengubah foto utama');
                                }
                              } catch (err) {
                                alert('Terjadi kesalahan');
                              }
                            }
                          }}
                          className="p-2 bg-green-600 text-white rounded-full hover:bg-green-700 shadow-lg"
                          title="Set as main photo"
                        >
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                          </svg>
                        </button>
                      )}

                      {/* Delete Button */}
                      <button
                        type="button"
                        onClick={async () => {
                          if (confirm('Hapus foto ini? Tindakan ini tidak dapat dibatalkan.')) {
                            try {
                              const token = localStorage.getItem('authToken');
                              const response = await fetch(`/api/v1/vehicles/${vehicleId}/photos/${photo.id}`, {
                                method: 'DELETE',
                                headers: {
                                  ...(token && { 'Authorization': `Bearer ${token}` }),
                                },
                              });
                              if (response.ok) {
                                fetchVehicle();
                              } else {
                                alert('Gagal menghapus foto');
                              }
                            } catch (err) {
                              alert('Terjadi kesalahan');
                            }
                          }
                        }}
                        className="p-2 bg-red-600 text-white rounded-full hover:bg-red-700 shadow-lg"
                        title="Delete photo"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Quality Summary */}
              {vehicle?.photos.some((p: any) => p.qualityScore) && (
                <div className="mt-3 p-2 bg-gray-50 rounded-md">
                  <p className="text-xs text-gray-600">
                    💡 <strong>Kualitas Foto:</strong> Hijau = Baik (70+), Kuning = Cukup (50-69), Merah = Kurang (&lt;50)
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Upload New Photos */}
          <div>
            <p className="text-sm text-gray-600 mb-2">
              Upload Foto Baru {totalPhotos > 0 && `(${photos.length} foto baru, total: ${totalPhotos}/${MAX_PHOTOS})`}
            </p>

            {/* Drop Zone */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                isDragging
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
            >
              <svg
                className="w-12 h-12 text-gray-400 mx-auto mb-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
              <p className="text-gray-600 mb-2">
                Drag & drop foto di sini, atau{' '}
                <label className="text-blue-600 hover:underline cursor-pointer">
                  pilih file
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={(e) => handlePhotoSelect(e.target.files)}
                    className="hidden"
                  />
                </label>
              </p>
              <p className="text-sm text-gray-500">
                Max {MAX_PHOTOS} foto • Max 10MB per foto
              </p>
            </div>

            {/* New Photos Preview */}
            {photos.length > 0 && (
              <div className="mt-4">
                {/* Instructions */}
                <div className="mb-3 p-2 bg-blue-50 rounded-md">
                  <p className="text-xs text-blue-800">
                    💡 <strong>Drag foto</strong> untuk mengatur urutan. Foto pertama akan jadi foto utama.
                  </p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {photos.map((photo, index) => (
                    <div
                      key={photo.id}
                      draggable
                      onDragStart={() => handleDragStart(index)}
                      onDragEnter={() => handleDragEnter(index)}
                      onDragEnd={handleDragEnd}
                      onDragOver={(e) => e.preventDefault()}
                      className={`relative group cursor-move transition-all ${
                        draggedIndex === index ? 'opacity-50 scale-95' : ''
                      }`}
                    >
                      {/* Drag Handle */}
                      <div className="absolute top-1 left-1 bg-gray-800 bg-opacity-75 text-white rounded px-1.5 py-0.5 flex items-center gap-1 z-10">
                        <svg
                          className="w-3 h-3"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path d="M9 3h2v2H9V3zm4 0h2v2h-2V3zM9 7h2v2H9V7zm4 0h2v2h-2V7zm-4 4h2v2H9v-2zm4 0h2v2h-2v-2zm-4 4h2v2H9v-2zm4 0h2v2h-2v-2zm-4 4h2v2H9v-2zm4 0h2v2h-2v-2z" />
                        </svg>
                        <span className="text-xs font-semibold">#{index + 1}</span>
                      </div>

                      <img
                        src={photo.preview}
                        alt={`Preview ${index + 1}`}
                        className="w-full h-32 object-cover rounded-lg border-2 border-green-200"
                      />

                      {/* Main Photo Badge */}
                      {index === 0 && (
                        <div className="absolute bottom-1 left-1 bg-green-600 text-white text-xs px-2 py-0.5 rounded font-semibold">
                          ⭐ MAIN
                        </div>
                      )}

                      {/* New Badge */}
                      {index !== 0 && (
                        <div className="absolute bottom-1 left-1 bg-green-600 text-white text-xs px-2 py-0.5 rounded">
                          Baru #{index + 1}
                        </div>
                      )}

                      {/* Action Buttons (show on hover) */}
                      <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {/* Set as Main button */}
                        {index !== 0 && (
                          <button
                            type="button"
                            onClick={() => handleSetMainPhoto(index)}
                            className="bg-green-600 text-white rounded-full p-1 hover:bg-green-700"
                            title="Set as main photo"
                          >
                            <svg
                              className="w-4 h-4"
                              fill="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                            </svg>
                          </button>
                        )}

                        {/* Delete button */}
                        <button
                          type="button"
                          onClick={() => handleRemovePhoto(photo.id)}
                          className="bg-red-600 text-white rounded-full p-1 hover:bg-red-700"
                          title="Delete photo"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {photos.length > 0 && (
            <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-sm text-yellow-800">
                ⚠️ <strong>Note:</strong> Foto baru belum tersimpan. Klik "Simpan Perubahan" untuk mengupload foto.
              </p>
            </div>
          )}
        </div>

        {/* Basic Information */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Informasi Dasar</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Make <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="make"
                value={formData.make}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Honda"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Model <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="model"
                value={formData.model}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="BR-V"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tahun <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                name="year"
                value={formData.year}
                onChange={handleChange}
                required
                min="1900"
                max={new Date().getFullYear() + 1}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Variant
              </label>
              <input
                type="text"
                name="variant"
                value={formData.variant}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Prestige"
              />
            </div>
          </div>
        </div>

        {/* Pricing */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Harga</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Harga (dalam juta rupiah) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                name="price"
                value={formData.price}
                onChange={handleChange}
                required
                min="0"
                step="0.1"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="225"
              />
              <p className="text-xs text-gray-500 mt-1">
                Contoh: 225 = Rp 225 juta
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status <span className="text-red-500">*</span>
              </label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="DRAFT">Draft</option>
                <option value="AVAILABLE">Tersedia</option>
                <option value="BOOKED">Booking</option>
                <option value="SOLD">Terjual</option>
              </select>
            </div>
          </div>
        </div>

        {/* Vehicle Details */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Detail Kendaraan</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Kilometer
              </label>
              <input
                type="number"
                name="mileage"
                value={formData.mileage}
                onChange={handleChange}
                min="0"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="15000"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Transmisi
              </label>
              <select
                name="transmissionType"
                value={formData.transmissionType}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Pilih Transmisi</option>
                <option value="manual">Manual</option>
                <option value="automatic">Automatic</option>
                <option value="cvt">CVT</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Bahan Bakar
              </label>
              <select
                name="fuelType"
                value={formData.fuelType}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Pilih Bahan Bakar</option>
                <option value="bensin">Bensin</option>
                <option value="diesel">Diesel</option>
                <option value="hybrid">Hybrid</option>
                <option value="electric">Electric</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Warna
              </label>
              <input
                type="text"
                name="color"
                value={formData.color}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Hitam"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Kapasitas Mesin
              </label>
              <input
                type="text"
                name="engineCapacity"
                value={formData.engineCapacity}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="1500cc"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Kondisi
              </label>
              <select
                name="condition"
                value={formData.condition}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Pilih Kondisi</option>
                <option value="excellent">Excellent</option>
                <option value="good">Good</option>
                <option value="fair">Fair</option>
                <option value="poor">Poor</option>
              </select>
            </div>
          </div>
        </div>

        {/* Admin Only - License Plate */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg shadow p-6">
          <div className="flex items-start gap-3 mb-4">
            <svg className="w-5 h-5 text-blue-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
            </svg>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-gray-900">Informasi Admin (Tidak Publik)</h2>
              <p className="text-sm text-gray-600 mt-1">
                Informasi ini hanya terlihat di dashboard admin, tidak ditampilkan di katalog publik
              </p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nomor Plat Kendaraan
            </label>
            <input
              type="text"
              name="licensePlate"
              value={formData.licensePlate}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
              placeholder="B 1234 XYZ"
            />
            <p className="text-xs text-gray-500 mt-1">
              🔒 Informasi ini hanya untuk keperluan internal admin
            </p>
          </div>
        </div>

        {/* Description */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Deskripsi</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Deskripsi (Bahasa Indonesia)
            </label>
            <textarea
              name="descriptionId"
              value={formData.descriptionId}
              onChange={handleChange}
              rows={6}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Deskripsi detail kendaraan..."
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {saving ? (
              <>
                <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Menyimpan...
              </>
            ) : (
              'Simpan Perubahan'
            )}
          </button>

          <Link
            href="/dashboard/vehicles"
            className="px-6 py-3 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
          >
            Batal
          </Link>
        </div>
      </form>
    </div>
  );
}
