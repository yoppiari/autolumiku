'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';

type VehicleStatus = 'DRAFT' | 'AVAILABLE' | 'BOOKED' | 'SOLD' | 'DELETED';

interface Vehicle {
  id: string;
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
  photos: any[];
}

export default function EditVehiclePage() {
  const router = useRouter();
  const params = useParams();
  const vehicleId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);

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

  useEffect(() => {
    if (vehicleId) {
      fetchVehicle();
    }
  }, [vehicleId]);

  const fetchVehicle = async () => {
    try {
      const response = await fetch(`/api/v1/vehicles/${vehicleId}`);
      if (response.ok) {
        const data = await response.json();
        const v = data.data;
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
        setError('Gagal memuat data kendaraan');
      }
    } catch (err) {
      console.error('Failed to fetch vehicle:', err);
      setError('Gagal memuat data kendaraan');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      // TODO: Get user from auth
      const user = JSON.parse(localStorage.getItem('user') || '{}');

      const updateData = {
        ...formData,
        price: Math.round(formData.price * 100000000), // Convert juta to cents
        userId: user.id,
      };

      const response = await fetch(`/api/v1/vehicles/${vehicleId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });

      if (response.ok) {
        router.push('/dashboard/vehicles');
      } else {
        const data = await response.json();
        setError(data.error || 'Gagal menyimpan perubahan');
      }
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

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link href="/dashboard/vehicles" className="text-blue-600 hover:underline mb-2 inline-block">
          ← Kembali ke Daftar Kendaraan
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Edit Kendaraan</h1>
        <p className="text-gray-600">
          ID: <span className="font-mono text-sm">{vehicleId.slice(0, 8)}...</span>
        </p>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
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
