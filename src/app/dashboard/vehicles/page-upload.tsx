'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { VehicleAIResult } from '@/lib/ai/vehicle-ai-service';

type UploadStep = 'input' | 'generating' | 'review';

interface UploadedPhoto {
  id: string;
  file: File;
  preview: string;
  base64?: string;
}

export default function VehiclesPage() {
  const router = useRouter();
  const [step, setStep] = useState<UploadStep>('input');
  const [user, setUser] = useState<any>(null);
  const [userDescription, setUserDescription] = useState('');
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiResult, setAIResult] = useState<VehicleAIResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form state for editing AI results
  const [editedData, setEditedData] = useState<Partial<VehicleAIResult>>({});

  const MAX_PHOTOS = 30;
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
  }, []);

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

  const handleGenerate = async () => {
    if (!userDescription.trim()) {
      setError('Mohon masukkan deskripsi kendaraan');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setStep('generating');

    try {
      // Text-based AI identification only (vision removed)
      const response = await fetch('/api/v1/vehicles/ai-identify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userDescription,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to generate');
      }

      const result = await response.json();
      setAIResult(result.data);
      setEditedData(result.data);
      setStep('review');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan');
      setStep('input');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!aiResult || !user) return;

    try {
      const response = await fetch('/api/v1/vehicles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...editedData,
          tenantId: user.tenantId,
          userId: user.id,
          status: 'DRAFT',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save vehicle');
      }

      // Redirect to vehicles list
      alert('Kendaraan berhasil disimpan sebagai draft!');
      router.push('/dashboard/vehicles');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan');
    }
  };

  const formatPrice = (cents: number) => {
    const rupiah = cents / 100000000;
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
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
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
      <div className="p-6 max-w-6xl mx-auto">
        <div className="mb-6">
          <div className="flex items-center gap-4 mb-2">
            <Link
              href="/dashboard/vehicles"
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span className="text-sm font-medium">Kembali ke Daftar Kendaraan</span>
            </Link>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Review Data Kendaraan</h1>
          <p className="text-gray-600">Periksa dan edit hasil AI sebelum menyimpan</p>
        </div>

        {/* Price Analysis Alert */}
        <div
          className={`mb-6 p-4 rounded-lg ${
            priceColor === 'green'
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
              <h3
                className={`text-sm font-medium ${
                  priceColor === 'green'
                    ? 'text-green-800'
                    : priceColor === 'red'
                    ? 'text-red-800'
                    : 'text-orange-800'
                }`}
              >
                Analisis Harga
              </h3>
              <div className="mt-2 text-sm">
                <p className="font-semibold">
                  Harga Anda: {formatPrice(aiResult.price)}
                  {priceDiff !== 0 && (
                    <span
                      className={`ml-2 ${
                        priceDiff > 0 ? 'text-red-600' : 'text-green-600'
                      }`}
                    >
                      ({priceDiff > 0 ? '+' : ''}
                      {priceDiff.toFixed(1)}%)
                    </span>
                  )}
                </p>
                <p className="mt-1">
                  Harga AI Recommended: {formatPrice(aiResult.aiSuggestedPrice)}
                  <span className="ml-2 text-gray-600">
                    (Confidence: {aiResult.priceConfidence}%)
                  </span>
                </p>
                <p className="mt-1 text-gray-600">
                  Market Range: {formatPrice(aiResult.priceAnalysis.marketRange.min)} -{' '}
                  {formatPrice(aiResult.priceAnalysis.marketRange.max)}
                </p>
                <div className="mt-3 p-3 bg-white rounded border border-gray-200">
                  <p className="font-medium text-gray-900">Recommendation:</p>
                  <p className="mt-1 text-gray-700">
                    {aiResult.priceAnalysis.recommendation}
                  </p>
                  <div className="mt-2">
                    <p className="text-xs font-medium text-gray-700">Factors:</p>
                    <ul className="mt-1 list-disc list-inside text-xs text-gray-600">
                      {aiResult.priceAnalysis.factors.map((factor, idx) => (
                        <li key={idx}>{factor}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column - Basic Info */}
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4">Informasi Dasar</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Make / Merek
                  </label>
                  <input
                    type="text"
                    value={editedData.make || ''}
                    onChange={(e) =>
                      setEditedData({ ...editedData, make: e.target.value })
                    }
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Model
                  </label>
                  <input
                    type="text"
                    value={editedData.model || ''}
                    onChange={(e) =>
                      setEditedData({ ...editedData, model: e.target.value })
                    }
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Tahun
                    </label>
                    <input
                      type="number"
                      value={editedData.year || ''}
                      onChange={(e) =>
                        setEditedData({
                          ...editedData,
                          year: parseInt(e.target.value, 10),
                        })
                      }
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Kilometer
                    </label>
                    <input
                      type="number"
                      value={editedData.mileage || ''}
                      onChange={(e) =>
                        setEditedData({
                          ...editedData,
                          mileage: parseInt(e.target.value, 10),
                        })
                      }
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Varian
                  </label>
                  <input
                    type="text"
                    value={editedData.variant || ''}
                    onChange={(e) =>
                      setEditedData({ ...editedData, variant: e.target.value })
                    }
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Transmisi
                    </label>
                    <select
                      value={editedData.transmissionType || ''}
                      onChange={(e) =>
                        setEditedData({
                          ...editedData,
                          transmissionType: e.target.value,
                        })
                      }
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    >
                      <option value="manual">Manual</option>
                      <option value="automatic">Automatic</option>
                      <option value="cvt">CVT</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Bahan Bakar
                    </label>
                    <select
                      value={editedData.fuelType || ''}
                      onChange={(e) =>
                        setEditedData({ ...editedData, fuelType: e.target.value })
                      }
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    >
                      <option value="bensin">Bensin</option>
                      <option value="diesel">Diesel</option>
                      <option value="hybrid">Hybrid</option>
                      <option value="electric">Electric</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Warna</label>
                  <input
                    type="text"
                    value={editedData.color || ''}
                    onChange={(e) =>
                      setEditedData({ ...editedData, color: e.target.value })
                    }
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Harga (Rp)
                  </label>
                  <input
                    type="number"
                    value={(editedData.price || 0) / 100000000}
                    onChange={(e) =>
                      setEditedData({
                        ...editedData,
                        price: parseFloat(e.target.value) * 100000000,
                      })
                    }
                    placeholder="Dalam jutaan (contoh: 130 untuk Rp 130jt)"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Masukkan dalam jutaan rupiah (contoh: 130 untuk Rp 130 juta)
                  </p>
                </div>
              </div>
            </div>

            {/* Features */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4">Fitur Kendaraan</h2>
              <div className="flex flex-wrap gap-2">
                {(editedData.features || []).map((feature, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800"
                  >
                    {feature}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column - Descriptions */}
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4">Deskripsi Indonesia</h2>
              <textarea
                value={editedData.descriptionId || ''}
                onChange={(e) =>
                  setEditedData({ ...editedData, descriptionId: e.target.value })
                }
                rows={8}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4">Deskripsi English</h2>
              <textarea
                value={editedData.descriptionEn || ''}
                onChange={(e) =>
                  setEditedData({ ...editedData, descriptionEn: e.target.value })
                }
                rows={8}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>

            {/* AI Confidence */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4">AI Analysis</h2>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-600">AI Confidence</p>
                  <div className="mt-1 flex items-center">
                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full"
                        style={{ width: `${aiResult.aiConfidence}%` }}
                      ></div>
                    </div>
                    <span className="ml-3 text-sm font-medium text-gray-900">
                      {aiResult.aiConfidence}%
                    </span>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">AI Reasoning:</p>
                  <p className="mt-1 text-sm text-gray-600">{aiResult.aiReasoning}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex justify-between">
          <button
            onClick={() => router.push('/dashboard/vehicles')}
            className="px-6 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            Batal
          </button>
          <button
            onClick={handleSave}
            className="px-6 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
          >
            Simpan sebagai Draft
          </button>
        </div>
      </div>
    );
  }

  // Input step
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-2">
          <Link
            href="/dashboard/vehicles"
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span className="text-sm font-medium">Kembali ke Daftar Kendaraan</span>
          </Link>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Upload Kendaraan Baru</h1>
        <p className="text-gray-600">
          Masukkan deskripsi singkat kendaraan, AI akan membantu melengkapi detailnya
        </p>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        {/* Photo Upload Section */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Upload Foto Kendaraan (Opsional)
          </label>
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-lg p-6 text-center ${
              isDragging
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-300 hover:border-gray-400'
            }`}
          >
            <input
              type="file"
              id="photo-upload"
              multiple
              accept="image/*"
              onChange={(e) => handlePhotoSelect(e.target.files)}
              className="hidden"
            />
            <label
              htmlFor="photo-upload"
              className="cursor-pointer flex flex-col items-center"
            >
              <svg
                className="w-12 h-12 text-gray-400 mb-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <span className="text-sm text-gray-600">
                <span className="font-semibold text-blue-600">Click to upload</span> or
                drag and drop
              </span>
              <span className="text-xs text-gray-500 mt-1">
                PNG, JPG, WEBP (max 10MB per file, max 30 photos)
              </span>
            </label>
          </div>

          {/* Photo Preview Grid */}
          {photos.length > 0 && (
            <div className="mt-4">
              <div className="flex justify-between items-center mb-3">
                <p className="text-sm font-medium text-gray-700">
                  {photos.length} / {MAX_PHOTOS} foto
                  {photos.length > 5 && (
                    <span className="ml-2 text-xs text-gray-500">
                      (AI akan analisis 5 foto pertama)
                    </span>
                  )}
                </p>
                <button
                  onClick={() => setPhotos([])}
                  className="text-sm text-red-600 hover:text-red-700"
                >
                  Hapus Semua
                </button>
              </div>

              {/* Instructions */}
              <div className="mb-3 p-2 bg-blue-50 rounded-md">
                <p className="text-xs text-blue-800">
                  💡 <strong>Drag foto</strong> untuk mengatur urutan. Foto pertama akan jadi foto utama di catalog.
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
                      className="w-full h-32 object-cover rounded-lg border-2 border-gray-200"
                    />

                    {/* Main Photo Badge */}
                    {index === 0 && (
                      <div className="absolute bottom-1 left-1 bg-green-600 text-white text-xs px-2 py-0.5 rounded font-semibold">
                        ⭐ MAIN
                      </div>
                    )}

                    {/* AI Badge */}
                    {index < 5 && index !== 0 && (
                      <div className="absolute bottom-1 left-1 bg-blue-600 text-white text-xs px-2 py-0.5 rounded">
                        AI #{index + 1}
                      </div>
                    )}

                    {/* Action Buttons (show on hover) */}
                    <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {/* Set as Main button */}
                      {index !== 0 && (
                        <button
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

        {/* Description Input */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Deskripsi Kendaraan
          </label>
          <textarea
            value={userDescription}
            onChange={(e) => setUserDescription(e.target.value)}
            placeholder="Contoh: Avanza 2020 AT, KM 20.000, Hitam, Rp 130jt"
            rows={4}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          />
          <p className="mt-2 text-sm text-gray-500">
            Tip: Upload foto untuk hasil AI lebih akurat, atau masukkan deskripsi lengkap
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        <div className="mb-6">
          <p className="text-sm font-medium text-gray-700 mb-2">Contoh input yang baik:</p>
          <div className="space-y-2">
            <div className="p-3 bg-gray-50 rounded-md text-sm">
              "Avanza 2020 AT, KM 20.000, Hitam, Rp 130jt"
            </div>
            <div className="p-3 bg-gray-50 rounded-md text-sm">
              "Honda CRV 2018 Turbo, kilometer 45rb, Putih Mutiara, harga 350 juta"
            </div>
            <div className="p-3 bg-gray-50 rounded-md text-sm">
              "Xenia 2021 R Deluxe MT, 15.000 km, Silver, Rp 180jt"
            </div>
          </div>
        </div>

        <button
          onClick={handleGenerate}
          disabled={isGenerating || !userDescription.trim()}
          className="w-full px-6 py-3 border border-transparent rounded-md shadow-sm text-base font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {isGenerating ? 'Generating...' : '🤖 Generate dengan AI'}
        </button>
      </div>

      {/* How it works */}
      <div className="mt-8 bg-blue-50 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-3">
          Bagaimana AI bekerja?
        </h3>
        <ol className="space-y-2 text-sm text-blue-800">
          <li className="flex items-start">
            <span className="font-bold mr-2">1.</span>
            <span>
              <strong>Upload foto (opsional)</strong> - Maksimal 30 foto, AI akan
              analisis 5 foto pertama untuk identifikasi lebih akurat
            </span>
          </li>
          <li className="flex items-start">
            <span className="font-bold mr-2">2.</span>
            <span>AI akan mengidentifikasi make, model, tahun, dan varian kendaraan</span>
          </li>
          <li className="flex items-start">
            <span className="font-bold mr-2">3.</span>
            <span>
              Generate deskripsi menarik dalam Bahasa Indonesia dan English
            </span>
          </li>
          <li className="flex items-start">
            <span className="font-bold mr-2">4.</span>
            <span>
              Extract fitur-fitur standar kendaraan berdasarkan model dan varian
            </span>
          </li>
          <li className="flex items-start">
            <span className="font-bold mr-2">5.</span>
            <span className="font-semibold">
              Analisis harga berdasarkan market price Indonesia dan memberikan
              recommendation
            </span>
          </li>
          <li className="flex items-start">
            <span className="font-bold mr-2">6.</span>
            <span>Anda dapat review dan edit sebelum menyimpan</span>
          </li>
        </ol>

        <div className="mt-4 pt-4 border-t border-blue-200">
          <p className="text-sm font-medium text-blue-900 mb-2">Tips:</p>
          <ul className="space-y-1 text-xs text-blue-700">
            <li>📸 Upload foto eksterior, interior, dan detail kendaraan</li>
            <li>
              📝 Jika tanpa foto, masukkan deskripsi se-lengkap mungkin (make, model,
              tahun, transmisi, km, warna, harga)
            </li>
            <li>💰 AI akan membandingkan harga Anda dengan market price Indonesia</li>
            <li>⏱️ Proses AI membutuhkan 20-30 detik</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
