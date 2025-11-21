'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Types
interface Role {
  id: string;
  name: string;
  description: string;
  color?: string;
  permissions: string[];
  isSystem: boolean;
}

interface InvitationForm {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  department: string;
  position: string;
  roles: string[];
  customMessage: string;
  sendInvitation: boolean;
}

interface InvitationPreview {
  email: string;
  subject: string;
  message: string;
  senderName: string;
  companyName: string;
  joinLink: string;
}

const availableRoles: Role[] = [
  {
    id: 'showroom-manager',
    name: 'Showroom Manager',
    description: 'Akses penuh ke manajemen tim, billing, dan operasional showroom',
    color: 'purple',
    permissions: ['team:admin', 'inventory:write', 'billing:read', 'analytics:read'],
    isSystem: true
  },
  {
    id: 'sales-manager',
    name: 'Sales Manager',
    description: 'Kelola tim sales, inventaris, dan analitik penjualan',
    color: 'blue',
    permissions: ['team:write', 'inventory:write', 'analytics:read', 'leads:read'],
    isSystem: true
  },
  {
    id: 'sales-executive',
    name: 'Sales Executive',
    description: 'Kelola inventaris dan tanggapi pertanyaan pelanggan',
    color: 'green',
    permissions: ['inventory:write', 'leads:write', 'customers:read'],
    isSystem: true
  },
  {
    id: 'finance-manager',
    name: 'Finance Manager',
    description: 'Akses billing, laporan keuangan, dan manajemen berlangganan',
    color: 'orange',
    permissions: ['billing:admin', 'reports:read', 'subscription:write'],
    isSystem: true
  },
  {
    id: 'service-advisor',
    name: 'Service Advisor',
    description: 'Kelola layanan purnajual dan koordinasi servis',
    color: 'indigo',
    permissions: ['service:write', 'customers:write', 'inventory:read'],
    isSystem: true
  },
  {
    id: 'marketing-coordinator',
    name: 'Marketing Coordinator',
    description: 'Kelola promosi dan keterlibatan pelanggan',
    color: 'pink',
    permissions: ['marketing:write', 'customers:read', 'analytics:read'],
    isSystem: true
  },
  {
    id: 'inventory-manager',
    name: 'Inventory Manager',
    description: 'Kelola stok dan daftar kendaraan',
    color: 'teal',
    permissions: ['inventory:admin', 'reports:read'],
    isSystem: true
  },
  {
    id: 'read-only',
    name: 'Read-only Staff',
    description: 'Akses terbatas untuk melihat laporan saja',
    color: 'gray',
    permissions: ['reports:read'],
    isSystem: true
  }
];

const departments = [
  'Sales',
  'Finance',
  'Service',
  'Marketing',
  'Inventory',
  'Management',
  'Admin'
];

const positions = [
  'Manager',
  'Supervisor',
  'Staff',
  'Executive',
  'Coordinator',
  'Advisor',
  'Specialist'
];

export default function TeamInvitation() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPreview, setShowPreview] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [formData, setFormData] = useState<InvitationForm>({
    email: '',
    firstName: '',
    lastName: '',
    phone: '',
    department: '',
    position: '',
    roles: [],
    customMessage: '',
    sendInvitation: true
  });

  const [previewData, setPreviewData] = useState<InvitationPreview>({
    email: '',
    subject: 'Undangan Bergabung dengan Tim Showroom',
    message: '',
    senderName: 'Showroom Manager',
    companyName: 'Showroom Anda',
    joinLink: ''
  });

  const getRoleColor = (role: Role) => {
    const colorMap: Record<string, string> = {
      purple: 'bg-purple-100 border-purple-300 text-purple-800',
      blue: 'bg-blue-100 border-blue-300 text-blue-800',
      green: 'bg-green-100 border-green-300 text-green-800',
      orange: 'bg-orange-100 border-orange-300 text-orange-800',
      indigo: 'bg-indigo-100 border-indigo-300 text-indigo-800',
      pink: 'bg-pink-100 border-pink-300 text-pink-800',
      teal: 'bg-teal-100 border-teal-300 text-teal-800',
      gray: 'bg-gray-100 border-gray-300 text-gray-800'
    };
    return colorMap[role.color || 'gray'] || colorMap.gray;
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Validate email
    if (!formData.email.trim()) {
      newErrors.email = 'Email wajib diisi';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Format email tidak valid';
    }

    // Validate name
    if (!formData.firstName.trim()) {
      newErrors.firstName = 'Nama depan wajib diisi';
    }

    if (!formData.lastName.trim()) {
      newErrors.lastName = 'Nama belakang wajib diisi';
    }

    // Validate roles
    if (formData.roles.length === 0) {
      newErrors.roles = 'Pilih minimal satu peran';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (field: keyof InvitationForm, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleRoleToggle = (roleId: string) => {
    setFormData(prev => ({
      ...prev,
      roles: prev.roles.includes(roleId)
        ? prev.roles.filter(id => id !== roleId)
        : [...prev.roles, roleId]
    }));
    if (errors.roles) {
      setErrors(prev => ({ ...prev, roles: '' }));
    }
  };

  const generatePreview = () => {
    const selectedRoles = availableRoles.filter(role => formData.roles.includes(role.id));
    const roleNames = selectedRoles.map(role => role.name).join(', ');

    const defaultMessage = `
Hai ${formData.firstName} ${formData.lastName},

Kami dengan senang hati mengundang Anda untuk bergabung dengan tim showroom kami.

${formData.customMessage ? `\nPesan dari kami:\n${formData.customMessage}\n` : ''}

Peran yang ditugaskan: ${roleNames}

Klik link di bawah ini untuk menerima undangan dan membuat akun Anda:
[Link Undangan Akan Dikirim via Email]

Kami sangat bersemangat untuk menyambut Anda di tim kami!

Salam,
Tim Showroom
    `.trim();

    setPreviewData({
      email: formData.email,
      subject: 'Undangan Bergabung dengan Tim Showroom',
      message: defaultMessage,
      senderName: 'Showroom Manager',
      companyName: 'Showroom Anda',
      joinLink: '#'
    });
  };

  const handleSubmit = async (sendNow: boolean = true) => {
    if (!validateForm()) return;

    setIsLoading(true);
    setErrors({});

    try {
      const submitData = {
        ...formData,
        sendInvitation: sendNow
      };

      const response = await fetch('/api/team/invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(submitData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send invitation');
      }

      const result = await response.json();

      if (sendNow) {
        setSuccessMessage('Undangan berhasil dikirim ke ' + formData.email);
        // Reset form after successful submission
        setFormData({
          email: '',
          firstName: '',
          lastName: '',
          phone: '',
          department: '',
          position: '',
          roles: [],
          customMessage: '',
          sendInvitation: true
        });
        setCurrentStep(1);
      } else {
        setSuccessMessage('Anggota berhasil ditambahkan tanpa mengirim undangan');
      }

    } catch (err) {
      setErrors({
        submit: err instanceof Error ? err.message : 'Failed to send invitation'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const renderStep1 = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Informasi Dasar</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email *
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                errors.email ? 'border-red-300' : 'border-gray-300'
              }`}
              placeholder="nama@example.com"
            />
            {errors.email && (
              <p className="mt-1 text-sm text-red-600">{errors.email}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Telepon (Opsional)
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => handleInputChange('phone', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="+62 812-3456-7890"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nama Deppan *
            </label>
            <input
              type="text"
              value={formData.firstName}
              onChange={(e) => handleInputChange('firstName', e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                errors.firstName ? 'border-red-300' : 'border-gray-300'
              }`}
              placeholder="Budi"
            />
            {errors.firstName && (
              <p className="mt-1 text-sm text-red-600">{errors.firstName}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nama Belakang *
            </label>
            <input
              type="text"
              value={formData.lastName}
              onChange={(e) => handleInputChange('lastName', e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                errors.lastName ? 'border-red-300' : 'border-gray-300'
              }`}
              placeholder="Santoso"
            />
            {errors.lastName && (
              <p className="mt-1 text-sm text-red-600">{errors.lastName}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Departemen
            </label>
            <select
              value={formData.department}
              onChange={(e) => handleInputChange('department', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Pilih Departemen</option>
              {departments.map(dept => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Posisi
            </label>
            <select
              value={formData.position}
              onChange={(e) => handleInputChange('position', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Pilih Posisi</option>
              {positions.map(pos => (
                <option key={pos} value={pos}>{pos}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={() => setCurrentStep(2)}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Lanjut ke Peran →
        </button>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Pilih Peran</h2>
        <p className="text-gray-600 mb-6">Pilih satu atau lebih peran yang sesuai untuk anggota tim baru</p>

        {errors.roles && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{errors.roles}</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {availableRoles.map((role) => (
            <div
              key={role.id}
              className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                formData.roles.includes(role.id)
                  ? `${getRoleColor(role)} border-2`
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => handleRoleToggle(role.id)}
            >
              <div className="flex items-start">
                <input
                  type="checkbox"
                  checked={formData.roles.includes(role.id)}
                  onChange={() => handleRoleToggle(role.id)}
                  className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <div className="ml-3 flex-1">
                  <h3 className="font-medium text-gray-900">{role.name}</h3>
                  <p className="text-sm text-gray-600 mt-1">{role.description}</p>
                  {role.isSystem && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 mt-2">
                      Peran Sistem
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-between">
        <button
          onClick={() => setCurrentStep(1)}
          className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          ← Kembali
        </button>
        <button
          onClick={() => setCurrentStep(3)}
          disabled={formData.roles.length === 0}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Lanjut ke Pesan →
        </button>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Personalisasi Undangan</h2>
        <p className="text-gray-600 mb-6">Tambahkan pesan personal untuk undangan (opsional)</p>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Pesan Personal (Opsional)
          </label>
          <textarea
            value={formData.customMessage}
            onChange={(e) => handleInputChange('customMessage', e.target.value)}
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Kami sangat bersemangat untuk menyambut Anda ke tim sales kami..."
          />
        </div>

        <div className="mt-6">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={formData.sendInvitation}
              onChange={(e) => handleInputChange('sendInvitation', e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <span className="ml-2 text-sm text-gray-700">
              Kirim undangan email sekarang
            </span>
          </label>
        </div>
      </div>

      {/* Preview Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">Preview Undangan</h3>
          <button
            onClick={() => {
              generatePreview();
              setShowPreview(!showPreview);
            }}
            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
          >
            {showPreview ? 'Sembunyikan' : 'Tampilkan'} Preview
          </button>
        </div>

        {showPreview && (
          <div className="bg-gray-50 rounded-lg p-6 border">
            <div className="bg-white rounded-lg p-6 shadow-sm">
              <h4 className="font-semibold text-gray-900 mb-2">{previewData.subject}</h4>
              <div className="text-sm text-gray-600 whitespace-pre-line">
                {previewData.message}
              </div>
            </div>
          </div>
        )}
      </div>

      {errors.submit && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{errors.submit}</p>
        </div>
      )}

      <div className="flex justify-between">
        <button
          onClick={() => setCurrentStep(2)}
          className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          ← Kembali
        </button>
        <div className="space-x-3">
          <button
            onClick={() => handleSubmit(false)}
            disabled={isLoading}
            className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            {isLoading ? 'Menyimpan...' : 'Simpan Tanpa Kirim'}
          </button>
          <button
            onClick={() => handleSubmit(true)}
            disabled={isLoading || !formData.sendInvitation}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Mengirim...' : 'Kirim Undangan'}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Undang Anggota Tim</h1>
              <p className="text-gray-600">Tambah anggota baru ke tim showroom Anda</p>
            </div>
            <button
              onClick={() => router.push('/team')}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              ← Kembali
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {[1, 2, 3].map((step) => (
              <div key={step} className="flex items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                    currentStep >= step
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-600'
                  }`}
                >
                  {step}
                </div>
                {step < 3 && (
                  <div
                    className={`flex-1 h-1 mx-4 ${
                      currentStep > step ? 'bg-blue-600' : 'bg-gray-200'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-2">
            <span className={`text-sm ${currentStep >= 1 ? 'text-blue-600 font-medium' : 'text-gray-600'}`}>
              Informasi Dasar
            </span>
            <span className={`text-sm ${currentStep >= 2 ? 'text-blue-600 font-medium' : 'text-gray-600'}`}>
              Pilih Peran
            </span>
            <span className={`text-sm ${currentStep >= 3 ? 'text-blue-600 font-medium' : 'text-gray-600'}`}>
              Personalisasi
            </span>
          </div>
        </div>

        {/* Success Message */}
        {successMessage && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center">
              <div className="text-green-600 text-xl mr-3">✅</div>
              <p className="text-green-800">{successMessage}</p>
            </div>
          </div>
        )}

        {/* Form Content */}
        <div className="bg-white rounded-lg shadow p-6">
          {currentStep === 1 && renderStep1()}
          {currentStep === 2 && renderStep2()}
          {currentStep === 3 && renderStep3()}
        </div>
      </div>
    </div>
  );
}