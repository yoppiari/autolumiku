/**
 * Invoice Create Page - Step-by-Step Wizard
 * User-friendly form for Finance/Accounting staff
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { FaArrowLeft, FaArrowRight, FaCheck, FaSearch, FaPlus, FaUser, FaCar, FaCalculator, FaCreditCard, FaFileInvoice } from 'react-icons/fa';
import { formatRupiah, PaymentMethod, PAYMENT_METHODS, SalesCustomer, LeasingPartner } from '@/types/invoice';

interface Vehicle {
  id: string;
  make: string;
  model: string;
  year: number;
  color?: string;
  plateNumber?: string;
  frameNumber?: string;
  engineNumber?: string;
  mileage?: number;
  sellingPrice: number;
  status: string;
}

interface FormData {
  // Customer
  customerId: string;
  customer: SalesCustomer | null;
  // Vehicle
  vehicleId: string;
  vehicleMake: string;
  vehicleModel: string;
  vehicleYear: number;
  vehicleColor: string;
  vehiclePlateNumber: string;
  vehicleFrameNumber: string;
  vehicleEngineNumber: string;
  vehicleMileage: number;
  // Pricing
  vehiclePrice: number;
  discountAmount: number;
  discountNote: string;
  adminFee: number;
  transferFee: number;
  otherFee: number;
  otherFeeNote: string;
  // Payment
  paymentMethod: PaymentMethod;
  dueDate: string;
  // Credit (if applicable)
  leasingPartnerId: string;
  dpAmount: number;
  tenor: number;
  interestRate: number;
  // Notes
  notes: string;
  termsConditions: string;
}

const STEPS = [
  { id: 1, name: 'Customer', icon: FaUser },
  { id: 2, name: 'Kendaraan', icon: FaCar },
  { id: 3, name: 'Harga', icon: FaCalculator },
  { id: 4, name: 'Pembayaran', icon: FaCreditCard },
  { id: 5, name: 'Review', icon: FaFileInvoice },
];

export default function CreateInvoicePage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Data sources
  const [customers, setCustomers] = useState<SalesCustomer[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [leasingPartners, setLeasingPartners] = useState<LeasingPartner[]>([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [vehicleSearch, setVehicleSearch] = useState('');
  const [showNewCustomerForm, setShowNewCustomerForm] = useState(false);

  // New customer form
  const [newCustomer, setNewCustomer] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    nik: '',
    npwp: '',
    type: 'individual' as 'individual' | 'company',
  });

  // Form data
  const [formData, setFormData] = useState<FormData>({
    customerId: '',
    customer: null,
    vehicleId: '',
    vehicleMake: '',
    vehicleModel: '',
    vehicleYear: new Date().getFullYear(),
    vehicleColor: '',
    vehiclePlateNumber: '',
    vehicleFrameNumber: '',
    vehicleEngineNumber: '',
    vehicleMileage: 0,
    vehiclePrice: 0,
    discountAmount: 0,
    discountNote: '',
    adminFee: 0,
    transferFee: 500000, // Default transfer fee
    otherFee: 0,
    otherFeeNote: '',
    paymentMethod: 'cash',
    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 7 days from now
    leasingPartnerId: '',
    dpAmount: 0,
    tenor: 12,
    interestRate: 0,
    notes: '',
    termsConditions: '',
  });

  // Load data on mount
  useEffect(() => {
    loadCustomers();
    loadVehicles();
    loadLeasingPartners();
  }, []);

  const loadCustomers = async (search?: string) => {
    try {
      const token = localStorage.getItem('authToken');
      const params = new URLSearchParams({ limit: '50' });
      if (search) params.set('search', search);

      const res = await fetch(`/api/v1/sales-customers?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setCustomers(data.data.customers || []);
      }
    } catch (err) {
      console.error('Error loading customers:', err);
    }
  };

  const loadVehicles = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const res = await fetch('/api/v1/vehicles?status=available&limit=100', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setVehicles(data.data.vehicles || data.data || []);
      }
    } catch (err) {
      console.error('Error loading vehicles:', err);
    }
  };

  const loadLeasingPartners = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const res = await fetch('/api/v1/leasing-partners', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setLeasingPartners(data.data || []);
      }
    } catch (err) {
      console.error('Error loading leasing partners:', err);
    }
  };

  const handleCustomerSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadCustomers(customerSearch);
  };

  const selectCustomer = (customer: SalesCustomer) => {
    setFormData(prev => ({
      ...prev,
      customerId: customer.id,
      customer,
    }));
  };

  const createNewCustomer = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const res = await fetch('/api/v1/sales-customers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(newCustomer),
      });
      const data = await res.json();
      if (data.success) {
        selectCustomer(data.data);
        setShowNewCustomerForm(false);
        setNewCustomer({
          name: '',
          phone: '',
          email: '',
          address: '',
          nik: '',
          npwp: '',
          type: 'individual',
        });
        loadCustomers(); // Refresh list
      } else {
        setError(data.message || 'Gagal membuat customer');
      }
    } catch (err) {
      setError('Terjadi kesalahan saat membuat customer');
    }
  };

  const selectVehicle = (vehicle: Vehicle) => {
    setFormData(prev => ({
      ...prev,
      vehicleId: vehicle.id,
      vehicleMake: vehicle.make,
      vehicleModel: vehicle.model,
      vehicleYear: vehicle.year,
      vehicleColor: vehicle.color || '',
      vehiclePlateNumber: vehicle.plateNumber || '',
      vehicleFrameNumber: vehicle.frameNumber || '',
      vehicleEngineNumber: vehicle.engineNumber || '',
      vehicleMileage: vehicle.mileage || 0,
      vehiclePrice: vehicle.sellingPrice || 0,
    }));
  };

  // Calculate totals
  const calculateTotals = () => {
    const dpp = formData.vehiclePrice - formData.discountAmount;
    const ppn = 0; // No PPN for used vehicles
    const ppnbm = 0;
    const grandTotal = dpp + ppn + ppnbm + formData.adminFee + formData.transferFee + formData.otherFee;
    return { dpp, ppn, ppnbm, grandTotal };
  };

  const { dpp, grandTotal } = calculateTotals();

  // Validation per step
  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1:
        return !!formData.customerId;
      case 2:
        return !!formData.vehicleMake && !!formData.vehicleModel && formData.vehicleYear > 0;
      case 3:
        return formData.vehiclePrice > 0;
      case 4:
        if (formData.paymentMethod === 'credit') {
          return !!formData.leasingPartnerId && formData.dpAmount > 0 && formData.tenor > 0;
        }
        return true;
      default:
        return true;
    }
  };

  const canProceed = validateStep(currentStep);

  const nextStep = () => {
    if (canProceed && currentStep < 5) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError('');

    try {
      const token = localStorage.getItem('authToken');
      const { dpp, grandTotal } = calculateTotals();

      const payload = {
        customerId: formData.customerId,
        vehicleId: formData.vehicleId || undefined,
        dueDate: formData.dueDate,
        vehicleMake: formData.vehicleMake,
        vehicleModel: formData.vehicleModel,
        vehicleYear: formData.vehicleYear,
        vehicleColor: formData.vehicleColor || undefined,
        vehiclePlateNumber: formData.vehiclePlateNumber || undefined,
        vehicleFrameNumber: formData.vehicleFrameNumber || undefined,
        vehicleEngineNumber: formData.vehicleEngineNumber || undefined,
        vehicleMileage: formData.vehicleMileage || undefined,
        vehiclePrice: formData.vehiclePrice,
        discountAmount: formData.discountAmount,
        discountNote: formData.discountNote || undefined,
        adminFee: formData.adminFee,
        transferFee: formData.transferFee,
        otherFee: formData.otherFee,
        otherFeeNote: formData.otherFeeNote || undefined,
        paymentMethod: formData.paymentMethod,
        notes: formData.notes || undefined,
        termsConditions: formData.termsConditions || undefined,
        // Credit details
        ...(formData.paymentMethod === 'credit' && {
          leasingPartnerId: formData.leasingPartnerId,
          dpAmount: formData.dpAmount,
          tenor: formData.tenor,
          interestRate: formData.interestRate,
        }),
      };

      const res = await fetch('/api/v1/sales-invoices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success) {
        router.push(`/dashboard/invoices/${data.data.id}`);
      } else {
        setError(data.message || 'Gagal membuat invoice');
      }
    } catch (err) {
      setError('Terjadi kesalahan saat membuat invoice');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter vehicles by search
  const filteredVehicles = vehicleSearch
    ? vehicles.filter(v =>
        `${v.make} ${v.model} ${v.plateNumber}`.toLowerCase().includes(vehicleSearch.toLowerCase())
      )
    : vehicles;

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/dashboard/invoices"
          className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-4"
        >
          <FaArrowLeft /> Kembali ke Invoice
        </Link>
        <h1 className="text-xl md:text-2xl font-bold text-gray-900">Buat Invoice Baru</h1>
        <p className="text-sm text-gray-500 mt-1">Ikuti langkah-langkah untuk membuat invoice penjualan</p>
      </div>

      {/* Step Indicator */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {STEPS.map((step, idx) => {
            const Icon = step.icon;
            const isActive = currentStep === step.id;
            const isCompleted = currentStep > step.id;
            return (
              <React.Fragment key={step.id}>
                <div className="flex flex-col items-center">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                      isCompleted
                        ? 'bg-green-500 text-white'
                        : isActive
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-500'
                    }`}
                  >
                    {isCompleted ? <FaCheck /> : <Icon />}
                  </div>
                  <span className={`mt-2 text-xs font-medium ${isActive ? 'text-blue-600' : 'text-gray-500'}`}>
                    {step.name}
                  </span>
                </div>
                {idx < STEPS.length - 1 && (
                  <div
                    className={`flex-1 h-1 mx-2 rounded ${
                      currentStep > step.id ? 'bg-green-500' : 'bg-gray-200'
                    }`}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Step Content */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        {/* Step 1: Customer */}
        {currentStep === 1 && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Pilih Customer</h2>

            {formData.customer ? (
              <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium text-gray-900">{formData.customer.name}</p>
                    <p className="text-sm text-gray-600">{formData.customer.phone}</p>
                    {formData.customer.address && (
                      <p className="text-sm text-gray-500 mt-1">{formData.customer.address}</p>
                    )}
                  </div>
                  <button
                    onClick={() => setFormData(prev => ({ ...prev, customerId: '', customer: null }))}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    Ganti
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Search */}
                <form onSubmit={handleCustomerSearch} className="mb-4">
                  <div className="relative">
                    <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Cari customer berdasarkan nama atau telepon..."
                      value={customerSearch}
                      onChange={(e) => setCustomerSearch(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </form>

                {/* Customer List */}
                <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-lg divide-y">
                  {customers.length === 0 ? (
                    <div className="p-4 text-center text-gray-500">
                      Tidak ada customer ditemukan
                    </div>
                  ) : (
                    customers.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => selectCustomer(c)}
                        className="w-full p-3 text-left hover:bg-gray-50 transition-colors"
                      >
                        <p className="font-medium text-gray-900">{c.name}</p>
                        <p className="text-sm text-gray-500">{c.phone}</p>
                      </button>
                    ))
                  )}
                </div>

                {/* Add New Customer */}
                <div className="mt-4">
                  {!showNewCustomerForm ? (
                    <button
                      onClick={() => setShowNewCustomerForm(true)}
                      className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800"
                    >
                      <FaPlus /> Tambah Customer Baru
                    </button>
                  ) : (
                    <div className="border border-gray-200 rounded-lg p-4">
                      <h3 className="font-medium text-gray-900 mb-3">Customer Baru</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm text-gray-600 mb-1">Nama *</label>
                          <input
                            type="text"
                            value={newCustomer.name}
                            onChange={(e) => setNewCustomer(prev => ({ ...prev, name: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-gray-600 mb-1">No. Telepon *</label>
                          <input
                            type="tel"
                            value={newCustomer.phone}
                            onChange={(e) => setNewCustomer(prev => ({ ...prev, phone: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-gray-600 mb-1">Email</label>
                          <input
                            type="email"
                            value={newCustomer.email}
                            onChange={(e) => setNewCustomer(prev => ({ ...prev, email: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-gray-600 mb-1">Tipe</label>
                          <select
                            value={newCustomer.type}
                            onChange={(e) => setNewCustomer(prev => ({ ...prev, type: e.target.value as 'individual' | 'company' }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="individual">Perorangan</option>
                            <option value="company">Perusahaan</option>
                          </select>
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-sm text-gray-600 mb-1">Alamat</label>
                          <textarea
                            value={newCustomer.address}
                            onChange={(e) => setNewCustomer(prev => ({ ...prev, address: e.target.value }))}
                            rows={2}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-gray-600 mb-1">NIK</label>
                          <input
                            type="text"
                            value={newCustomer.nik}
                            onChange={(e) => setNewCustomer(prev => ({ ...prev, nik: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-gray-600 mb-1">NPWP</label>
                          <input
                            type="text"
                            value={newCustomer.npwp}
                            onChange={(e) => setNewCustomer(prev => ({ ...prev, npwp: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2 mt-4">
                        <button
                          onClick={createNewCustomer}
                          disabled={!newCustomer.name || !newCustomer.phone}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                        >
                          Simpan Customer
                        </button>
                        <button
                          onClick={() => setShowNewCustomerForm(false)}
                          className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
                        >
                          Batal
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* Step 2: Vehicle */}
        {currentStep === 2 && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Detail Kendaraan</h2>

            {/* Vehicle Selection */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Pilih dari Inventory (Opsional)</label>
              <div className="relative mb-2">
                <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Cari kendaraan..."
                  value={vehicleSearch}
                  onChange={(e) => setVehicleSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg divide-y">
                {filteredVehicles.length === 0 ? (
                  <div className="p-3 text-center text-gray-500 text-sm">
                    Tidak ada kendaraan tersedia
                  </div>
                ) : (
                  filteredVehicles.slice(0, 10).map((v) => (
                    <button
                      key={v.id}
                      onClick={() => selectVehicle(v)}
                      className={`w-full p-3 text-left hover:bg-gray-50 transition-colors ${
                        formData.vehicleId === v.id ? 'bg-blue-50' : ''
                      }`}
                    >
                      <p className="font-medium text-gray-900">
                        {v.make} {v.model} ({v.year})
                      </p>
                      <p className="text-sm text-gray-500">
                        {v.plateNumber || 'No Plate'} - {formatRupiah(v.sellingPrice)}
                      </p>
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Manual Vehicle Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Merek *</label>
                <input
                  type="text"
                  value={formData.vehicleMake}
                  onChange={(e) => setFormData(prev => ({ ...prev, vehicleMake: e.target.value }))}
                  placeholder="Toyota, Honda, dll"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Model *</label>
                <input
                  type="text"
                  value={formData.vehicleModel}
                  onChange={(e) => setFormData(prev => ({ ...prev, vehicleModel: e.target.value }))}
                  placeholder="Avanza, Jazz, dll"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tahun *</label>
                <input
                  type="number"
                  value={formData.vehicleYear}
                  onChange={(e) => setFormData(prev => ({ ...prev, vehicleYear: parseInt(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Warna</label>
                <input
                  type="text"
                  value={formData.vehicleColor}
                  onChange={(e) => setFormData(prev => ({ ...prev, vehicleColor: e.target.value }))}
                  placeholder="Hitam, Putih, dll"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">No. Polisi</label>
                <input
                  type="text"
                  value={formData.vehiclePlateNumber}
                  onChange={(e) => setFormData(prev => ({ ...prev, vehiclePlateNumber: e.target.value }))}
                  placeholder="B 1234 ABC"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">KM</label>
                <input
                  type="number"
                  value={formData.vehicleMileage}
                  onChange={(e) => setFormData(prev => ({ ...prev, vehicleMileage: parseInt(e.target.value) || 0 }))}
                  placeholder="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">No. Rangka</label>
                <input
                  type="text"
                  value={formData.vehicleFrameNumber}
                  onChange={(e) => setFormData(prev => ({ ...prev, vehicleFrameNumber: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">No. Mesin</label>
                <input
                  type="text"
                  value={formData.vehicleEngineNumber}
                  onChange={(e) => setFormData(prev => ({ ...prev, vehicleEngineNumber: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Pricing */}
        {currentStep === 3 && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Harga & Biaya</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Harga Kendaraan *</label>
                <input
                  type="number"
                  value={formData.vehiclePrice}
                  onChange={(e) => setFormData(prev => ({ ...prev, vehiclePrice: parseInt(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">{formatRupiah(formData.vehiclePrice)}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Diskon</label>
                <input
                  type="number"
                  value={formData.discountAmount}
                  onChange={(e) => setFormData(prev => ({ ...prev, discountAmount: parseInt(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">{formatRupiah(formData.discountAmount)}</p>
              </div>
              {formData.discountAmount > 0 && (
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Catatan Diskon</label>
                  <input
                    type="text"
                    value={formData.discountNote}
                    onChange={(e) => setFormData(prev => ({ ...prev, discountNote: e.target.value }))}
                    placeholder="Alasan diskon..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Biaya Admin</label>
                <input
                  type="number"
                  value={formData.adminFee}
                  onChange={(e) => setFormData(prev => ({ ...prev, adminFee: parseInt(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Biaya Balik Nama</label>
                <input
                  type="number"
                  value={formData.transferFee}
                  onChange={(e) => setFormData(prev => ({ ...prev, transferFee: parseInt(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Biaya Lain-lain</label>
                <input
                  type="number"
                  value={formData.otherFee}
                  onChange={(e) => setFormData(prev => ({ ...prev, otherFee: parseInt(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {formData.otherFee > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Keterangan Biaya Lain</label>
                  <input
                    type="text"
                    value={formData.otherFeeNote}
                    onChange={(e) => setFormData(prev => ({ ...prev, otherFeeNote: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}
            </div>

            {/* Summary */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="font-medium text-gray-900 mb-3">Ringkasan Harga</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Harga Kendaraan</span>
                  <span>{formatRupiah(formData.vehiclePrice)}</span>
                </div>
                {formData.discountAmount > 0 && (
                  <div className="flex justify-between text-red-600">
                    <span>Diskon</span>
                    <span>-{formatRupiah(formData.discountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-600">DPP</span>
                  <span>{formatRupiah(dpp)}</span>
                </div>
                {formData.adminFee > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Biaya Admin</span>
                    <span>{formatRupiah(formData.adminFee)}</span>
                  </div>
                )}
                {formData.transferFee > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Biaya Balik Nama</span>
                    <span>{formatRupiah(formData.transferFee)}</span>
                  </div>
                )}
                {formData.otherFee > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Biaya Lain-lain</span>
                    <span>{formatRupiah(formData.otherFee)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-lg pt-2 border-t border-gray-200">
                  <span>Grand Total</span>
                  <span className="text-blue-600">{formatRupiah(grandTotal)}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Payment Method */}
        {currentStep === 4 && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Metode Pembayaran</h2>

            <div className="grid grid-cols-3 gap-3 mb-6">
              {Object.entries(PAYMENT_METHODS).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setFormData(prev => ({ ...prev, paymentMethod: key as PaymentMethod }))}
                  className={`p-4 rounded-lg border-2 text-center transition-colors ${
                    formData.paymentMethod === key
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <span className="text-2xl mb-1 block">
                    {key === 'cash' ? '💵' : key === 'transfer' ? '🏦' : '💳'}
                  </span>
                  <span className="text-sm font-medium">{label}</span>
                </button>
              ))}
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Jatuh Tempo</label>
              <input
                type="date"
                value={formData.dueDate}
                onChange={(e) => setFormData(prev => ({ ...prev, dueDate: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Credit Details */}
            {formData.paymentMethod === 'credit' && (
              <div className="bg-gray-50 rounded-lg p-4 mt-4">
                <h3 className="font-medium text-gray-900 mb-3">Detail Kredit/Leasing</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Leasing Partner *</label>
                    <select
                      value={formData.leasingPartnerId}
                      onChange={(e) => {
                        const partner = leasingPartners.find(p => p.id === e.target.value);
                        setFormData(prev => ({
                          ...prev,
                          leasingPartnerId: e.target.value,
                          interestRate: partner?.interestRateMin || 0,
                        }));
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Pilih Leasing Partner</option>
                      {leasingPartners.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.code})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">DP (Down Payment) *</label>
                    <input
                      type="number"
                      value={formData.dpAmount}
                      onChange={(e) => setFormData(prev => ({ ...prev, dpAmount: parseInt(e.target.value) || 0 }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">{formatRupiah(formData.dpAmount)}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tenor (Bulan) *</label>
                    <select
                      value={formData.tenor}
                      onChange={(e) => setFormData(prev => ({ ...prev, tenor: parseInt(e.target.value) }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      {[12, 24, 36, 48, 60].map((t) => (
                        <option key={t} value={t}>{t} Bulan</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Bunga (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={formData.interestRate}
                      onChange={(e) => setFormData(prev => ({ ...prev, interestRate: parseFloat(e.target.value) || 0 }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Notes */}
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Catatan</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                rows={3}
                placeholder="Catatan tambahan untuk invoice..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        )}

        {/* Step 5: Review */}
        {currentStep === 5 && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Review Invoice</h2>

            <div className="space-y-4">
              {/* Customer */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-medium text-gray-900 mb-2">Customer</h3>
                <p className="text-gray-700">{formData.customer?.name}</p>
                <p className="text-sm text-gray-500">{formData.customer?.phone}</p>
                {formData.customer?.address && (
                  <p className="text-sm text-gray-500">{formData.customer.address}</p>
                )}
              </div>

              {/* Vehicle */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-medium text-gray-900 mb-2">Kendaraan</h3>
                <p className="text-gray-700">
                  {formData.vehicleMake} {formData.vehicleModel} ({formData.vehicleYear})
                </p>
                <p className="text-sm text-gray-500">
                  {formData.vehiclePlateNumber || 'No Plate'} - {formData.vehicleColor || 'N/A'}
                </p>
                {formData.vehicleMileage > 0 && (
                  <p className="text-sm text-gray-500">{formData.vehicleMileage.toLocaleString()} KM</p>
                )}
              </div>

              {/* Pricing */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-medium text-gray-900 mb-2">Rincian Harga</h3>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Harga Kendaraan</span>
                    <span>{formatRupiah(formData.vehiclePrice)}</span>
                  </div>
                  {formData.discountAmount > 0 && (
                    <div className="flex justify-between text-red-600">
                      <span>Diskon</span>
                      <span>-{formatRupiah(formData.discountAmount)}</span>
                    </div>
                  )}
                  {formData.adminFee > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Biaya Admin</span>
                      <span>{formatRupiah(formData.adminFee)}</span>
                    </div>
                  )}
                  {formData.transferFee > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Biaya Balik Nama</span>
                      <span>{formatRupiah(formData.transferFee)}</span>
                    </div>
                  )}
                  {formData.otherFee > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Biaya Lain-lain</span>
                      <span>{formatRupiah(formData.otherFee)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold pt-2 border-t border-gray-200">
                    <span>Grand Total</span>
                    <span className="text-blue-600">{formatRupiah(grandTotal)}</span>
                  </div>
                </div>
              </div>

              {/* Payment */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-medium text-gray-900 mb-2">Pembayaran</h3>
                <p className="text-gray-700">{PAYMENT_METHODS[formData.paymentMethod]}</p>
                <p className="text-sm text-gray-500">Jatuh Tempo: {new Date(formData.dueDate).toLocaleDateString('id-ID')}</p>
                {formData.paymentMethod === 'credit' && (
                  <div className="mt-2 text-sm text-gray-600">
                    <p>DP: {formatRupiah(formData.dpAmount)}</p>
                    <p>Tenor: {formData.tenor} Bulan</p>
                    <p>Bunga: {formData.interestRate}%</p>
                  </div>
                )}
              </div>

              {formData.notes && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-medium text-gray-900 mb-2">Catatan</h3>
                  <p className="text-sm text-gray-600">{formData.notes}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Navigation Buttons */}
      <div className="flex justify-between mt-6">
        <button
          onClick={prevStep}
          disabled={currentStep === 1}
          className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <FaArrowLeft /> Sebelumnya
        </button>

        {currentStep < 5 ? (
          <button
            onClick={nextStep}
            disabled={!canProceed}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Selanjutnya <FaArrowRight />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Menyimpan...' : 'Buat Invoice'}
            <FaCheck />
          </button>
        )}
      </div>
    </div>
  );
}
