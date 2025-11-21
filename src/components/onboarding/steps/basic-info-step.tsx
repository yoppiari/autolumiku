'use client';

import React, { useState, useEffect } from 'react';
import { BasicInfoData } from '@/types/onboarding';
import { InputField } from '../shared/input-field';

interface BasicInfoStepProps {
  data: BasicInfoData;
  onChange: (data: BasicInfoData) => void;
  onNext: (data: BasicInfoData) => void;
  onPrevious: () => void;
  onSave: () => void;
  language: 'id' | 'en';
  suggestions: any[];
}

/**
 * Basic Information Step Component
 *
 * Collects essential showroom information for setup
 */
export function BasicInfoStep({
  data,
  onChange,
  onNext,
  onPrevious,
  onSave,
  language,
  suggestions
}: BasicInfoStepProps) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isValidating, setIsValidating] = useState(false);

  const content = {
    id: {
      title: 'Informasi Dasar Showroom',
      subtitle: 'Mari kumpulkan informasi penting tentang showroom Anda',
      showroomName: 'Nama Showroom',
      showroomType: 'Jenis Showroom',
      contactEmail: 'Email Kontak',
      phoneNumber: 'Nomor Telepon',
      address: 'Alamat Lengkap',
      city: 'Kota',
      province: 'Provinsi',
      postalCode: 'Kode Pos',
      website: 'Website (opsional)',
      businessLicense: 'Nomor Izin Usaha (opsional)',
      taxId: 'NPWP (opsional)',
      previous: 'Kembali',
      next: 'Lanjutkan',
      save: 'Simpan Progress'
    },
    en: {
      title: 'Basic Showroom Information',
      subtitle: 'Let\'s collect important information about your showroom',
      showroomName: 'Showroom Name',
      showroomType: 'Showroom Type',
      contactEmail: 'Contact Email',
      phoneNumber: 'Phone Number',
      address: 'Full Address',
      city: 'City',
      province: 'Province',
      postalCode: 'Postal Code',
      website: 'Website (optional)',
      businessLicense: 'Business License (optional)',
      taxId: 'Tax ID (optional)',
      previous: 'Previous',
      next: 'Continue',
      save: 'Save Progress'
    }
  };

  const t = content[language];

  const showroomTypes = [
    { value: 'new_car', label: language === 'id' ? 'Mobil Baru' : 'New Cars' },
    { value: 'used_car', label: language === 'id' ? 'Mobil Bekas' : 'Used Cars' },
    { value: 'both', label: language === 'id' ? 'Keduanya' : 'Both' }
  ];

  // Auto-save effect
  useEffect(() => {
    const timer = setTimeout(() => {
      if (Object.keys(data).length > 0) {
        onSave();
      }
    }, 3000);

    return () => clearTimeout(timer);
  }, [data]);

  const validateField = (field: string, value: any): string | null => {
    switch (field) {
      case 'showroomName':
        if (!value || value.trim().length < 3) {
          return language === 'id'
            ? 'Nama showroom minimal 3 karakter'
            : 'Showroom name must be at least 3 characters';
        }
        if (!/^[a-zA-Z0-9\s\-\.\']+$/.test(value)) {
          return language === 'id'
            ? 'Nama showroom hanya boleh mengandung huruf, angka, spasi, dan karakter standar'
            : 'Showroom name can only contain letters, numbers, spaces, and standard characters';
        }
        break;

      case 'contactEmail':
        if (!value) {
          return language === 'id' ? 'Email wajib diisi' : 'Email is required';
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          return language === 'id' ? 'Format email tidak valid' : 'Invalid email format';
        }
        break;

      case 'phoneNumber':
        if (!value) {
          return language === 'id' ? 'Nomor telepon wajib diisi' : 'Phone number is required';
        }
        // Indonesian phone format validation
        const cleanPhone = value.replace(/\D/g, '');
        if (!/^(\+62|62|0)?[8-9][0-9]{7,11}$/.test(cleanPhone)) {
          return language === 'id'
            ? 'Format nomor telepon Indonesia tidak valid'
            : 'Invalid Indonesian phone number format';
        }
        break;

      case 'address':
        if (!value || value.trim().length < 10) {
          return language === 'id'
            ? 'Alamat minimal 10 karakter'
            : 'Address must be at least 10 characters';
        }
        break;

      case 'city':
      case 'province':
        if (!value || value.trim().length < 2) {
          return language === 'id' ? 'Bidang ini wajib diisi' : 'This field is required';
        }
        break;

      case 'postalCode':
        if (!value) {
          return language === 'id' ? 'Kode pos wajib diisi' : 'Postal code is required';
        }
        if (!/^[0-9]{5}$/.test(value)) {
          return language === 'id' ? 'Kode pos harus 5 digit' : 'Postal code must be 5 digits';
        }
        break;

      case 'website':
        if (value && !/^https?:\/\/.+/.test(value)) {
          return language === 'id'
            ? 'Website harus dimulai dengan http:// atau https://'
            : 'Website must start with http:// or https://';
        }
        break;

      default:
        break;
    }

    return null;
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    let isValid = true;

    const requiredFields = [
      'showroomName',
      'showroomType',
      'contactEmail',
      'phoneNumber',
      'address',
      'city',
      'province',
      'postalCode'
    ];

    requiredFields.forEach(field => {
      const error = validateField(field, data[field as keyof BasicInfoData]);
      if (error) {
        newErrors[field] = error;
        isValid = false;
      }
    });

    setErrors(newErrors);
    return isValid;
  };

  const handleFieldChange = (field: keyof BasicInfoData, value: any) => {
    const newData = { ...data, [field]: value };
    onChange(newData);

    // Clear error for this field when user starts typing
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleNext = async () => {
    setIsValidating(true);

    if (validateForm()) {
      // Auto-generate website suggestion if showroom name is provided but website is not
      const finalData = { ...data };
      if (!finalData.website && finalData.showroomName) {
        const suggestedWebsite = `https://${finalData.showroomName.toLowerCase().replace(/\s+/g, '')}.com`;
        finalData.website = suggestedWebsite;
      }

      onNext(finalData);
    }

    setIsValidating(false);
  };

  const handlePrevious = () => {
    onPrevious();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">{t.title}</h2>
        <p className="text-gray-600 mt-1">{t.subtitle}</p>
      </div>

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex">
            <svg className="w-5 h-5 text-blue-600 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd"/>
            </svg>
            <div className="text-sm text-blue-800">
              <strong>{language === 'id' ? 'Saran:' : 'Suggestion:'}</strong> {suggestions[0]?.content}
            </div>
          </div>
        </div>
      )}

      {/* Form Fields */}
      <div className="space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
          <InputField
            label={t.showroomName}
            value={data.showroomName || ''}
            onChange={(value) => handleFieldChange('showroomName', value)}
            error={errors.showroomName}
            required
            placeholder={language === 'id' ? 'Masukkan nama showroom' : 'Enter showroom name'}
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t.showroomType} <span className="text-red-500">*</span>
            </label>
            <select
              value={data.showroomType || ''}
              onChange={(e) => handleFieldChange('showroomType', e.target.value)}
              className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.showroomType ? 'border-red-500' : ''
              }`}
            >
              <option value="">{language === 'id' ? 'Pilih jenis showroom' : 'Select showroom type'}</option>
              {showroomTypes.map(type => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
            {errors.showroomType && (
              <p className="mt-1 text-sm text-red-600">{errors.showroomType}</p>
            )}
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <InputField
            label={t.contactEmail}
            type="email"
            value={data.contactEmail || ''}
            onChange={(value) => handleFieldChange('contactEmail', value)}
            error={errors.contactEmail}
            required
            placeholder={language === 'id' ? 'email@showroom.com' : 'email@showroom.com'}
          />

          <InputField
            label={t.phoneNumber}
            type="tel"
            value={data.phoneNumber || ''}
            onChange={(value) => handleFieldChange('phoneNumber', value)}
            error={errors.phoneNumber}
            required
            placeholder={language === 'id' ? '+628123456789' : '+628123456789'}
          />
        </div>

        <InputField
          label={t.address}
          type="textarea"
          value={data.address || ''}
          onChange={(value) => handleFieldChange('address', value)}
          error={errors.address}
          required
          rows={3}
          placeholder={language === 'id' ? 'Jl. Sudirman No. 123, Kelurahan Karet, Kecamatan Setiabudi' : 'Street address, apartment, suite, etc.'}
        />

        <div className="grid md:grid-cols-3 gap-4">
          <InputField
            label={t.city}
            value={data.city || ''}
            onChange={(value) => handleFieldChange('city', value)}
            error={errors.city}
            required
            placeholder={language === 'id' ? 'Jakarta Selatan' : 'South Jakarta'}
          />

          <InputField
            label={t.province}
            value={data.province || ''}
            onChange={(value) => handleFieldChange('province', value)}
            error={errors.province}
            required
            placeholder={language === 'id' ? 'DKI Jakarta' : 'DKI Jakarta'}
          />

          <InputField
            label={t.postalCode}
            value={data.postalCode || ''}
            onChange={(value) => handleFieldChange('postalCode', value)}
            error={errors.postalCode}
            required
            placeholder={language === 'id' ? '12345' : '12345'}
          />
        </div>

        <div className="border-t pt-4">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            {language === 'id' ? 'Informasi Tambahan (Opsional)' : 'Additional Information (Optional)'}
          </h3>

          <div className="space-y-4">
            <InputField
              label={t.website}
              type="url"
              value={data.website || ''}
              onChange={(value) => handleFieldChange('website', value)}
              error={errors.website}
              placeholder="https://www.showroom.com"
            />

            <div className="grid md:grid-cols-2 gap-4">
              <InputField
                label={t.businessLicense}
                value={data.businessLicense || ''}
                onChange={(value) => handleFieldChange('businessLicense', value)}
                placeholder={language === 'id' ? 'Nomor SIUP' : 'Business license number'}
              />

              <InputField
                label={t.taxId}
                value={data.taxId || ''}
                onChange={(value) => handleFieldChange('taxId', value)}
                placeholder={language === 'id' ? 'Nomor NPWP' : 'Tax ID number'}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-between items-center pt-6 border-t">
        <button
          onClick={handlePrevious}
          className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
        >
          <svg className="w-5 h-5 mr-2 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          {t.previous}
        </button>

        <div className="flex space-x-3">
          <button
            onClick={onSave}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
          >
            {t.save}
          </button>

          <button
            onClick={handleNext}
            disabled={isValidating}
            className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isValidating ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white inline-block" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {language === 'id' ? 'Memvalidasi...' : 'Validating...'}
              </>
            ) : (
              <>
                {t.next}
                <svg className="w-5 h-5 ml-2 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}