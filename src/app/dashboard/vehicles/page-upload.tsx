'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { VehicleAIResult } from '@/lib/ai/vehicle-ai-service';

type UploadStep = 'input' | 'generating' | 'review';

interface UploadedPhoto {
  id: string;
  file: File;
  preview: string;
  base64?: string;
  filename: string;
}

// Parse vehicle info from filename
function parseFilename(filename: string): string {
  // Remove extension
  const name = filename.replace(/\.(jpg|jpeg|png|webp|heic)$/i, '');

  // Common patterns to extract
  const parts: string[] = [];

  // Extract year (4 digits starting with 19 or 20)
  const yearMatch = name.match(/\b(19|20)\d{2}\b/);

  // Extract KM/kilometer
  const kmMatch = name.match(/KM\s*[\d.,]+/i) || name.match(/[\d.,]+\s*KM/i) || name.match(/kilometer\s*[\d.,]+/i);

  // Extract price (Rp, jt, juta, etc)
  const priceMatch = name.match(/Rp\s*[\d.,]+\s*(jt|juta)?/i) || name.match(/[\d.,]+\s*(jt|juta)/i);

  // Extract transmission
  const transMatch = name.match(/\b(MT|AT|CVT|manual|matic|automatic|matik)\b/i);

  // Extract color (Warna X or common colors)
  const colorMatch = name.match(/warna\s+(\w+)/i) ||
    name.match(/\b(hitam|putih|silver|merah|biru|abu|grey|gray|gold|kuning|hijau|coklat|orange|cream|white|black|red|blue)\b/i);

  // Clean up the name - remove underscores, multiple spaces
  let cleaned = name
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // If filename has useful info, use it
  if (cleaned.length > 5 && (yearMatch || kmMatch || priceMatch)) {
    return cleaned;
  }

  return '';
}

export default function VehiclesPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<UploadStep>('input');
  const [user, setUser] = useState<any>(null);
  const [userDescription, setUserDescription] = useState('');
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [aiResult, setAIResult] = useState<VehicleAIResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasTriggeredGenerate, setHasTriggeredGenerate] = useState(false);

  // Form state for editing AI results
  const [editedData, setEditedData] = useState<Partial<VehicleAIResult>>({});

  const MAX_PHOTOS = 50;
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
  }, []);

  // Auto-generate AI when both photos AND description are ready (only once)
  useEffect(() => {
    // Only trigger if:
    // 1. We have photos
    // 2. We have description
    // 3. Haven't triggered yet
    // 4. Not currently generating
    // 5. Still on input step
    if (
      photos.length > 0 &&
      userDescription.trim() &&
      !hasTriggeredGenerate &&
      !isGenerating &&
      step === 'input'
    ) {
      console.log('[Upload] Auto-triggering AI generation...');
      setHasTriggeredGenerate(true);
      handleGenerate();
    }
  }, [photos.length, userDescription, hasTriggeredGenerate, isGenerating, step]);

  // Helper to get auth headers
  const getAuthHeaders = () => {
    const token = localStorage.getItem('authToken');
    return {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
    };
  };

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
    const extractedDescriptions: string[] = [];

    // Validate total count
    if (photos.length + filesArray.length > MAX_PHOTOS) {
      setError(`Maksimal ${MAX_PHOTOS} foto. Anda sudah upload ${photos.length} foto.`);
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

      // Parse filename for vehicle info
      const parsedInfo = parseFilename(file.name);
      if (parsedInfo) {
        extractedDescriptions.push(parsedInfo);
      }

      // Create preview and base64
      const preview = URL.createObjectURL(file);
      const base64 = await fileToBase64(file);

      newPhotos.push({
        id: `${Date.now()}-${Math.random()}`,
        file,
        preview,
        base64,
        filename: file.name,
      });
    }

    setPhotos([...photos, ...newPhotos]);
    setError(null);

    // Auto-fill description from filename if empty
    if (!userDescription.trim() && extractedDescriptions.length > 0) {
      setUserDescription(extractedDescriptions[0]);
    }
    // Note: AI generation is now manual only - user must click "Generate dengan AI" button
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
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

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

  const handleGenerate = async (descriptionOverride?: string) => {
    const description = descriptionOverride || userDescription;

    if (!description.trim()) {
      setError('Mohon masukkan deskripsi kendaraan terlebih dahulu');
      return;
    }

    if (photos.length === 0) {
      setError('Mohon upload minimal 1 foto kendaraan terlebih dahulu');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setStep('generating');

    try {
      // Text-based AI identification only (vision removed)
      const response = await fetch('/api/v1/vehicles/ai-identify', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          userDescription: description,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || errorData.message || 'Failed to generate');
      }

      const result = await response.json();
      setAIResult(result.data);
      setEditedData(result.data);
      setStep('review');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Terjadi kesalahan';

      // Check for token expiry and redirect to login
      if (errorMessage.toLowerCase().includes('token') ||
        errorMessage.toLowerCase().includes('unauthorized') ||
        errorMessage.toLowerCase().includes('expired')) {
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
        alert('Sesi login Anda telah berakhir. Silakan login kembali.');
        router.push('/login');
        return;
      }

      setError(errorMessage);
      setStep('input');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async (status: 'DRAFT' | 'AVAILABLE') => {
    if (!aiResult || !user) {
      setError('Data tidak lengkap. Silakan generate ulang.');
      return;
    }

    if (!user.tenantId) {
      setError('User tidak memiliki tenant. Silakan login ulang.');
      return;
    }

    if (!editedData.make || !editedData.model || !editedData.year || !editedData.price) {
      setError('Data kendaraan tidak lengkap. Pastikan Merk, Model, Tahun, dan Harga terisi.');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      // Format data to match Vehicle schema
      const vehicleData = {
        // Basic Information
        make: editedData.make,
        model: editedData.model,
        year: editedData.year,
        variant: editedData.variant,

        // AI-Generated Content
        descriptionId: editedData.descriptionId,
        features: editedData.features || [],
        specifications: editedData.specifications || {},

        // AI Metadata
        aiConfidence: editedData.aiConfidence,
        aiReasoning: editedData.aiReasoning,

        // Pricing
        price: editedData.price,
        aiSuggestedPrice: editedData.aiSuggestedPrice,
        priceConfidence: editedData.priceConfidence,
        priceAnalysis: editedData.priceAnalysis || {},

        // Vehicle Details
        mileage: editedData.mileage,
        transmissionType: editedData.transmissionType,
        fuelType: editedData.fuelType,
        color: editedData.color,

        // Status
        status,

        // Metadata
        tenantId: user.tenantId,
        userId: user.id,
      };

      const response = await fetch('/api/v1/vehicles', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(vehicleData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || errorData.message || 'Failed to save vehicle');
      }

      const vehicleResult = await response.json();
      const vehicleId = vehicleResult.data.id;

      // Upload photos if any
      if (photos.length > 0) {
        console.log(`Uploading ${photos.length} photos for vehicle ${vehicleId}...`);

        const photosData = photos.map((photo) => ({
          base64: photo.base64,
        }));

        try {
          const photoResponse = await fetch(`/api/v1/vehicles/${vehicleId}/photos`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ photos: photosData }),
          });

          const photoResult = await photoResponse.json();

          if (!photoResponse.ok) {
            console.error('Photo upload failed:', photoResult);
            alert(`Kendaraan tersimpan, tetapi foto gagal diupload: ${photoResult.message || photoResult.error}`);
          } else {
            console.log('Photos uploaded successfully:', photoResult);
          }
        } catch (photoError) {
          console.error('Photo upload error:', photoError);
          alert(`Kendaraan tersimpan, tetapi foto gagal diupload: ${photoError instanceof Error ? photoError.message : 'Unknown error'}`);
        }
      }

      // Redirect to vehicles list
      const message = status === 'DRAFT'
        ? 'Kendaraan berhasil disimpan sebagai draft!'
        : 'Kendaraan berhasil dipublish dan tersedia untuk dijual!';
      alert(message);
      router.push('/dashboard/vehicles');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Gagal menyimpan';
      console.error('Save error:', err);

      // Check for token expiry and redirect to login
      if (errorMessage.toLowerCase().includes('token') ||
        errorMessage.toLowerCase().includes('unauthorized') ||
        errorMessage.toLowerCase().includes('expired')) {
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
        alert('Sesi login Anda telah berakhir. Silakan login kembali.');
        router.push('/login');
        return;
      }

      setError(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  const formatPrice = (cents: number) => {
    const rupiah = cents / 1000000;
    return `Rp ${rupiah.toFixed(0)} juta`;
  };

  const getPriceAnalysisColor = () => {
    if (!aiResult) return 'gray';
    const userPrice = aiResult.price;
    const suggestedPrice = aiResult.aiSuggestedPrice;
    const diff = ((userPrice - suggestedPrice) / suggestedPrice) * 100;

    if (Math.abs(diff) < 10) return 'green'; // Within 10%
    if (diff < -10) return 'red'; // User price too low
    return 'orange'; // User price too high
  };

  if (step === 'generating') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-lg text-gray-700">AI sedang menganalisis kendaraan...</p>
          <p className="mt-2 text-sm text-gray-500">Mohon tunggu sekitar 20-30 detik</p>
        </div>
      </div>
    );
  }

  if (step === 'review' && aiResult) {
    const priceColor = getPriceAnalysisColor();
    const priceDiff =
      ((aiResult.price - aiResult.aiSuggestedPrice) / aiResult.aiSuggestedPrice) * 100;

    return (
      <div className="p-4 sm:p-6 max-w-6xl mx-auto">
        <div className="mb-6">
          <div className="flex items-center gap-4 mb-2">
            <Link
              href="/dashboard/vehicles"
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span className="text-sm font-medium">Kembali</span>
            </Link>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Review Data Kendaraan</h1>
          <p className="text-gray-600 text-sm">Periksa dan edit hasil AI sebelum menyimpan</p>
        </div>

        {/* Price Analysis Alert */}
        <div
          className={`mb-6 p-4 rounded-lg ${priceColor === 'green'
            ? 'bg-green-50 border border-green-200'
            : priceColor === 'red'
              ? 'bg-red-50 border border-red-200'
              : 'bg-orange-50 border border-orange-200'
            }`}
        >
          <div className="flex items-start">
            <div className="flex-shrink-0">
              {priceColor === 'green' && <span className="text-2xl">✅</span>}
              {priceColor === 'red' && <span className="text-2xl">⚠️</span>}
              {priceColor === 'orange' && <span className="text-2xl">💰</span>}
            </div>
            <div className="ml-3 flex-1">
              <h3 className={`text-sm font-medium ${priceColor === 'green' ? 'text-green-800' : priceColor === 'red' ? 'text-red-800' : 'text-orange-800'}`}>
                Analisis Harga
              </h3>
              <div className="mt-2 text-sm">
                <p className="font-semibold">
                  Harga Anda: {formatPrice(aiResult.price)}
                  {priceDiff !== 0 && (
                    <span className={`ml-2 ${priceDiff > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      ({priceDiff > 0 ? '+' : ''}{priceDiff.toFixed(1)}%)
                    </span>
                  )}
                </p>
                <p className="mt-1">
                  AI Recommended: {formatPrice(aiResult.aiSuggestedPrice)}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column - Basic Info */}
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-4 sm:p-6">
              <h2 className="text-lg font-semibold mb-4">Informasi Dasar</h2>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Merek</label>
                    <input
                      type="text"
                      value={editedData.make || ''}
                      onChange={(e) => setEditedData({ ...editedData, make: e.target.value })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-base"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Model</label>
                    <input
                      type="text"
                      value={editedData.model || ''}
                      onChange={(e) => setEditedData({ ...editedData, model: e.target.value })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-base"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Tahun</label>
                    <input
                      type="number"
                      value={editedData.year || ''}
                      onChange={(e) => setEditedData({ ...editedData, year: parseInt(e.target.value, 10) })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-base"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">KM</label>
                    <input
                      type="number"
                      value={editedData.mileage || ''}
                      onChange={(e) => setEditedData({ ...editedData, mileage: parseInt(e.target.value, 10) })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-base"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Varian</label>
                  <input
                    type="text"
                    value={editedData.variant || ''}
                    onChange={(e) => setEditedData({ ...editedData, variant: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-base"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Transmisi</label>
                    <select
                      value={editedData.transmissionType || ''}
                      onChange={(e) => setEditedData({ ...editedData, transmissionType: e.target.value })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-base"
                    >
                      <option value="manual">Manual</option>
                      <option value="automatic">Automatic</option>
                      <option value="cvt">CVT</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Warna</label>
                    <input
                      type="text"
                      value={editedData.color || ''}
                      onChange={(e) => setEditedData({ ...editedData, color: e.target.value })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-base"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Harga (Juta Rupiah)</label>
                  <input
                    type="number"
                    value={(editedData.price || 0) / 1000000}
                    onChange={(e) => setEditedData({ ...editedData, price: parseFloat(e.target.value) * 1000000 })}
                    placeholder="130"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-base"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Descriptions */}
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-4 sm:p-6">
              <h2 className="text-lg font-semibold mb-4">Deskripsi</h2>
              <textarea
                value={editedData.descriptionId || ''}
                onChange={(e) => setEditedData({ ...editedData, descriptionId: e.target.value })}
                rows={8}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-base"
              />
            </div>

            {/* Features */}
            <div className="bg-white rounded-lg shadow p-4 sm:p-6">
              <h2 className="text-lg font-semibold mb-4">Fitur</h2>
              <div className="flex flex-wrap gap-2">
                {(editedData.features || []).map((feature, idx) => (
                  <span key={idx} className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800">
                    {feature}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Action Buttons - Fixed at bottom on mobile */}
        <div className="mt-6 flex flex-col sm:flex-row justify-between gap-3 sticky bottom-0 bg-gray-50 py-4 -mx-4 px-4 sm:static sm:bg-transparent sm:py-0 sm:mx-0 sm:px-0">
          <button
            onClick={() => setStep('input')}
            disabled={isSaving}
            className="px-6 py-3 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 order-3 sm:order-1 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Kembali Edit
          </button>
          <div className="flex gap-3 order-1 sm:order-2">
            <button
              onClick={() => handleSave('DRAFT')}
              disabled={isSaving}
              className="flex-1 sm:flex-none px-6 py-3 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-gray-600 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? 'Menyimpan...' : 'Simpan Draft'}
            </button>
            <button
              onClick={() => handleSave('AVAILABLE')}
              disabled={isSaving}
              className="flex-1 sm:flex-none px-6 py-3 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? 'Menyimpan...' : 'Publish'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Input step - Mobile-first design
  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-2">
          <Link
            href="/dashboard/vehicles"
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span className="text-sm font-medium">Kembali</span>
          </Link>
        </div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Upload Kendaraan</h1>
        <p className="text-gray-600 text-sm">Upload foto atau masukkan deskripsi, AI akan melengkapi data</p>
      </div>

      {/* Main Upload Card */}
      <div className="bg-white rounded-lg shadow p-4 sm:p-6">
        {/* Quick Action Buttons - Large for mobile */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          {/* Camera Button */}
          <button
            onClick={() => cameraInputRef.current?.click()}
            className="flex flex-col items-center justify-center p-6 bg-blue-600 text-white rounded-xl hover:bg-blue-700 active:bg-blue-800 transition-colors"
          >
            <svg className="w-10 h-10 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="font-semibold">Ambil Foto</span>
            <span className="text-xs opacity-80">Buka Kamera</span>
          </button>
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => handlePhotoSelect(e.target.files)}
            className="hidden"
          />

          {/* Gallery Button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center justify-center p-6 bg-green-600 text-white rounded-xl hover:bg-green-700 active:bg-green-800 transition-colors"
          >
            <svg className="w-10 h-10 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="font-semibold">Pilih Galeri</span>
            <span className="text-xs opacity-80">Max {MAX_PHOTOS} foto</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*"
            onChange={(e) => handlePhotoSelect(e.target.files)}
            className="hidden"
          />
        </div>

        {/* Drag & Drop Area (Desktop) */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`hidden sm:block border-2 border-dashed rounded-lg p-6 text-center mb-6 ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
            }`}
        >
          <p className="text-sm text-gray-600">
            Atau <span className="font-semibold text-blue-600">drag & drop</span> foto di sini
          </p>
        </div>

        {/* Photo Preview Grid */}
        {photos.length > 0 && (
          <div className="mb-6">
            <div className="flex justify-between items-center mb-3">
              <p className="text-sm font-medium text-gray-700">
                {photos.length} foto dipilih
              </p>
              <button
                onClick={() => setPhotos([])}
                className="text-sm text-red-600 hover:text-red-700"
              >
                Hapus Semua
              </button>
            </div>

            <p className="text-xs text-gray-500 mb-2 hidden sm:block">
              💡 Drag foto untuk mengatur urutan. Foto pertama akan jadi foto utama.
            </p>
            <p className="text-xs text-gray-500 mb-2 sm:hidden">
              💡 Gunakan tombol ↑↓ untuk mengatur urutan. Foto pertama akan jadi foto utama.
            </p>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
              {photos.map((photo, index) => (
                <div
                  key={photo.id}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragEnter={() => handleDragEnter(index)}
                  onDragEnd={handleDragEnd}
                  onDragOver={(e) => e.preventDefault()}
                  className={`relative aspect-square group cursor-move ${draggedIndex === index ? 'opacity-50 scale-95' : ''
                    } transition-all duration-150`}
                >
                  <img
                    src={photo.preview}
                    alt={`Preview ${index + 1}`}
                    className="w-full h-full object-cover rounded-lg border-2 border-transparent hover:border-blue-400"
                    onClick={() => handleSetMainPhoto(index)}
                  />
                  {/* Main Photo Badge - Desktop */}
                  {index === 0 && (
                    <div className="absolute bottom-1 left-1 bg-green-600 text-white text-xs px-1.5 py-0.5 rounded font-medium flex items-center gap-1">
                      <span className="hidden sm:inline">★</span> MAIN
                    </div>
                  )}
                  {/* Photo Number with Mobile Reorder - Non-main photos */}
                  {index > 0 && (
                    <div className="absolute bottom-1 left-1 flex items-center gap-1">
                      {/* Drag handle icon - Desktop only */}
                      <div className="hidden sm:flex bg-gray-800/70 text-white text-xs px-1 py-0.5 rounded items-center gap-0.5">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z" />
                        </svg>
                        #{index + 1}
                      </div>
                      {/* Mobile reorder buttons */}
                      <div className="flex sm:hidden gap-0.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (index === 0) return;
                            const newPhotos = [...photos];
                            [newPhotos[index - 1], newPhotos[index]] = [newPhotos[index], newPhotos[index - 1]];
                            setPhotos(newPhotos);
                          }}
                          disabled={index === 0}
                          className={`p-1 rounded ${index === 0 ? 'bg-gray-400' : 'bg-blue-600 active:bg-blue-700'} text-white`}
                          title="Pindah ke atas"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 15l7-7 7 7" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (index === photos.length - 1) return;
                            const newPhotos = [...photos];
                            [newPhotos[index], newPhotos[index + 1]] = [newPhotos[index + 1], newPhotos[index]];
                            setPhotos(newPhotos);
                          }}
                          disabled={index === photos.length - 1}
                          className={`p-1 rounded ${index === photos.length - 1 ? 'bg-gray-400' : 'bg-blue-600 active:bg-blue-700'} text-white`}
                          title="Pindah ke bawah"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        <span className="bg-green-600 text-white text-xs px-1 py-0.5 rounded font-medium">
                          Baru #{index + 1}
                        </span>
                      </div>
                    </div>
                  )}
                  {/* Set as Main Button (on hover for non-main photos) */}
                  {index > 0 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSetMainPhoto(index);
                      }}
                      className="absolute bottom-1 right-1 bg-blue-600 text-white text-xs px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Jadikan Foto Utama"
                    >
                      ★
                    </button>
                  )}
                  {/* Remove Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemovePhoto(photo.id);
                    }}
                    className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 sm:opacity-100 transition-opacity"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                  {/* Photo Number Badge - Top left for all photos on mobile */}
                  <div className="absolute top-1 left-1 sm:hidden bg-gray-900/70 text-white text-xs font-bold px-1.5 py-0.5 rounded">
                    #{index + 1}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Description Input */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Deskripsi Kendaraan
          </label>
          <textarea
            value={userDescription}
            onChange={(e) => setUserDescription(e.target.value)}
            placeholder="Contoh: Brio Satya MT 2015 KM 30.000 Rp 120JT Warna Hitam"
            rows={3}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-base"
          />
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Auto-generate checkbox and Generate button */}
        <div className="mt-4 p-4 rounded-xl border border-gray-200 bg-gray-50">
          <p className="text-xs text-gray-500 mb-2">
            Tip: Nama file foto akan otomatis digunakan sebagai deskripsi jika kosong
          </p>

          <label className="flex items-center gap-2 mb-4 cursor-pointer">
            <input
              type="checkbox"
              checked={!hasTriggeredGenerate}
              onChange={(e) => setHasTriggeredGenerate(!e.target.checked)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">Auto-generate AI setelah upload foto</span>
          </label>

          {/* Manual Generate Button */}
          <button
            onClick={() => handleGenerate()}
            disabled={isGenerating || !photos.length || !userDescription.trim()}
            className={`w-full py-3 px-4 rounded-lg font-medium text-white transition-colors ${isGenerating || !photos.length || !userDescription.trim()
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800'
              }`}
          >
            {isGenerating ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Generating...
              </span>
            ) : (
              'Generate dengan AI'
            )}
          </button>
        </div>
      </div>

      {/* Quick Examples */}
      <div className="mt-6 bg-gray-50 rounded-lg p-4">
        <p className="text-sm font-medium text-gray-700 mb-2">Contoh format nama file:</p>
        <div className="space-y-2 text-xs">
          <div className="p-2 bg-white rounded border text-gray-600">
            Brio Satya MT 2015 KM 30.000 Rp 120JT Warna Hitam.jpg
          </div>
          <div className="p-2 bg-white rounded border text-gray-600">
            Avanza 2020 AT KM 20rb Hitam 130jt.jpg
          </div>
        </div>
      </div>
    </div>
  );
}
