import React, { useState, useEffect, useCallback } from 'react';
import {
  BrandingConfig,
  BrandingFormData,
  BrandingFormErrors,
  ApiResponse
} from '../../types/branding.types';
import ColorPicker from './ColorPicker';
import FileUpload from './FileUpload';
import BrandingPreview from './BrandingPreview';

interface BrandingConfigurationFormProps {
  tenantId: string;
  initialData?: BrandingConfig;
  onSave: (data: BrandingConfig) => Promise<ApiResponse>;
  onCancel?: () => void;
  disabled?: boolean;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export const BrandingConfigurationForm: React.FC<BrandingConfigurationFormProps> = ({
  tenantId,
  initialData,
  onSave,
  onCancel,
  disabled = false
}) => {
  const [formData, setFormData] = useState<BrandingFormData>({
    primaryColor: initialData?.primaryColor || '#2563eb',
    secondaryColor: initialData?.secondaryColor || '#64748b',
    companyName: initialData?.companyInfo.name || '',
    companyAddress: initialData?.companyInfo.address || '',
    companyPhone: initialData?.companyInfo.phone || '',
    companyEmail: initialData?.companyInfo.email || '',
    companyWebsite: initialData?.companyInfo.website || '',
  });

  const [errors, setErrors] = useState<BrandingFormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [previewData, setPreviewData] = useState({
    logoUrl: initialData?.logoUrl,
    faviconUrl: initialData?.faviconUrl,
    primaryColor: initialData?.primaryColor || '#2563eb',
    secondaryColor: initialData?.secondaryColor || '#64748b',
    companyName: initialData?.companyInfo.name || '',
    companyAddress: initialData?.companyInfo.address || '',
    companyPhone: initialData?.companyInfo.phone || '',
    companyEmail: initialData?.companyInfo.email || '',
    companyWebsite: initialData?.companyInfo.website || '',
  });

  // Track changes for dirty state
  useEffect(() => {
    const originalData = {
      primaryColor: initialData?.primaryColor || '#2563eb',
      secondaryColor: initialData?.secondaryColor || '#64748b',
      companyName: initialData?.companyInfo.name || '',
      companyAddress: initialData?.companyInfo.address || '',
      companyPhone: initialData?.companyInfo.phone || '',
      companyEmail: initialData?.companyInfo.email || '',
      companyWebsite: initialData?.companyInfo.website || '',
    };

    const changed = Object.keys(formData).some(key => {
      const formValue = formData[key as keyof BrandingFormData];
      const originalValue = originalData[key as keyof typeof originalData];
      return formValue !== originalValue;
    });

    setHasChanges(changed);
  }, [formData, initialData]);

  // Update preview when form data changes
  useEffect(() => {
    setPreviewData(prev => ({
      ...prev,
      primaryColor: formData.primaryColor,
      secondaryColor: formData.secondaryColor,
      companyName: formData.companyName,
      companyAddress: formData.companyAddress,
      companyPhone: formData.companyPhone,
      companyEmail: formData.companyEmail,
      companyWebsite: formData.companyWebsite,
    }));
  }, [formData]);

  const validateField = useCallback((field: keyof BrandingFormData, value: string): string | null => {
    switch (field) {
      case 'primaryColor':
      case 'secondaryColor':
        const hexRegex = /^#[0-9A-Fa-f]{6}$/;
        if (!hexRegex.test(value)) {
          return 'Format warna tidak valid. Gunakan format HEX (misal: #FF0000)';
        }
        return null;

      case 'companyName':
        if (!value.trim()) {
          return 'Nama perusahaan wajib diisi';
        }
        if (value.length < 2) {
          return 'Nama perusahaan minimal 2 karakter';
        }
        if (value.length > 255) {
          return 'Nama perusahaan maksimal 255 karakter';
        }
        return null;

      case 'companyEmail':
        if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          return 'Format email tidak valid';
        }
        return null;

      case 'companyPhone':
        if (value && !/^[\+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,9}$/.test(value)) {
          return 'Format nomor telepon tidak valid. Gunakan format Indonesia (misal: +62 812-3456-7890)';
        }
        return null;

      case 'companyWebsite':
        if (value && !/^https?:\/\/.+/.test(value)) {
          return 'Format website tidak valid. Gunakan format http:// atau https://';
        }
        return null;

      default:
        return null;
    }
  }, []);

  const handleFieldChange = useCallback((field: keyof BrandingFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));

    // Clear error for this field when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  }, [errors]);

  const handleFileUpload = useCallback((fileType: 'logo' | 'favicon', file: File) => {
    // Create preview URL
    const previewUrl = URL.createObjectURL(file);

    setPreviewData(prev => ({
      ...prev,
      [fileType === 'logo' ? 'logoUrl' : 'faviconUrl']: previewUrl
    }));

    // In a real implementation, you would upload the file to the server
    // For now, we'll just store the file in the form data
    setFormData(prev => ({ ...prev, [`${fileType}File`]: file }));

    // Clear any existing errors
    if (errors[`${fileType}File`]) {
      setErrors(prev => ({ ...prev, [`${fileType}File`]: undefined }));
    }
  }, [errors]);

  const handleFileRemove = useCallback((fileType: 'logo' | 'favicon') => {
    setPreviewData(prev => ({
      ...prev,
      [fileType === 'logo' ? 'logoUrl' : 'faviconUrl']: undefined
    }));

    setFormData(prev => ({ ...prev, [`${fileType}File`]: undefined }));
  }, []);

  const validateForm = useCallback((): boolean => {
    const newErrors: BrandingFormErrors = {};
    let isValid = true;

    // Validate required fields
    const requiredFields: (keyof BrandingFormData)[] = ['companyName'];

    requiredFields.forEach(field => {
      if (!formData[field] || !formData[field].trim()) {
        newErrors[field] = `${field === 'companyName' ? 'Nama perusahaan' : field} wajib diisi`;
        isValid = false;
      } else {
        const error = validateField(field, formData[field]);
        if (error) {
          newErrors[field] = error;
          isValid = false;
        }
      }
    });

    // Validate optional fields if they have values
    const optionalFields: (keyof BrandingFormData)[] = [
      'primaryColor', 'secondaryColor', 'companyEmail', 'companyPhone', 'companyWebsite'
    ];

    optionalFields.forEach(field => {
      if (formData[field]) {
        const error = validateField(field, formData[field]);
        if (error) {
          newErrors[field] = error;
          isValid = false;
        }
      }
    });

    setErrors(newErrors);
    return isValid;
  }, [formData, validateField]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      // Scroll to first error
      const firstErrorField = Object.keys(errors)[0];
      const element = document.getElementById(firstErrorField);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    setIsSubmitting(true);

    try {
      const brandingConfig: BrandingConfig = {
        id: initialData?.id,
        tenantId,
        primaryColor: formData.primaryColor,
        secondaryColor: formData.secondaryColor,
        companyInfo: {
          name: formData.companyName,
          address: formData.companyAddress || undefined,
          phone: formData.companyPhone || undefined,
          email: formData.companyEmail || undefined,
          website: formData.companyWebsite || undefined,
        },
        // In a real implementation, these would be uploaded file URLs
        logoUrl: previewData.logoUrl,
        faviconUrl: previewData.faviconUrl,
      };

      const response = await onSave(brandingConfig);

      if (response.success) {
        // Success handling would be done by the parent component
        console.log('Branding configuration saved successfully');
      } else {
        // Handle server errors
        if (response.error) {
          setErrors(prev => ({
            ...prev,
            server: response.error.message
          }));
        }
      }
    } catch (error) {
      console.error('Error saving branding configuration:', error);
      setErrors(prev => ({
        ...prev,
        server: 'Terjadi kesalahan saat menyimpan konfigurasi branding. Silakan coba lagi.'
      }));
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, initialData, previewData, tenantId, validateForm, onSave]);

  const handleReset = useCallback(() => {
    if (initialData) {
      setFormData({
        primaryColor: initialData.primaryColor,
        secondaryColor: initialData.secondaryColor,
        companyName: initialData.companyInfo.name,
        companyAddress: initialData.companyInfo.address || '',
        companyPhone: initialData.companyInfo.phone || '',
        companyEmail: initialData.companyInfo.email || '',
        companyWebsite: initialData.companyInfo.website || '',
      });

      setPreviewData({
        logoUrl: initialData.logoUrl,
        faviconUrl: initialData.faviconUrl,
        primaryColor: initialData.primaryColor,
        secondaryColor: initialData.secondaryColor,
        companyName: initialData.companyInfo.name,
        companyAddress: initialData.companyInfo.address || '',
        companyPhone: initialData.companyInfo.phone || '',
        companyEmail: initialData.companyInfo.email || '',
        companyWebsite: initialData.companyInfo.website || '',
      });
    }

    setErrors({});
  }, [initialData]);

  return (
    <div className="w-full max-w-6xl mx-auto space-y-8">
      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Form Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Konfigurasi Branding Showroom
          </h1>
          <p className="text-lg text-gray-600">
            Sesuaikan tampilan showroom Anda dengan identitas perusahaan
          </p>
        </div>

        {/* Server Error */}
        {errors.server && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center space-x-2">
              <span className="text-red-500">❌</span>
              <p className="text-red-700 font-medium">{errors.server}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Form Section */}
          <div className="space-y-6">
            {/* Logo Upload */}
            <FileUpload
              label="Logo Perusahaan"
              accept="image/png,image/jpeg,image/jpg,image/svg+xml"
              maxSize={MAX_FILE_SIZE}
              value={previewData.logoUrl}
              onChange={(file) => handleFileUpload('logo', file)}
              onRemove={() => handleFileRemove('logo')}
              error={errors.logoFile}
              disabled={disabled}
              helpText="Upload logo perusahaan dalam format PNG, JPG, atau SVG. Logo akan ditampilkan di header website."
              fileType="logo"
            />

            {/* Favicon Upload */}
            <FileUpload
              label="Favicon (Icon Browser)"
              accept="image/png,image/x-icon,image/vnd.microsoft.icon,image/svg+xml"
              maxSize={MAX_FILE_SIZE}
              value={previewData.faviconUrl}
              onChange={(file) => handleFileUpload('favicon', file)}
              onRemove={() => handleFileRemove('favicon')}
              error={errors.faviconFile}
              disabled={disabled}
              helpText="Icon kecil yang muncul di browser tab. Ukuran ideal: 32x32 piksel."
              fileType="favicon"
            />

            {/* Color Pickers */}
            <ColorPicker
              label="Warna Primer"
              value={formData.primaryColor}
              onChange={(color) => handleFieldChange('primaryColor', color)}
              error={errors.primaryColor}
              disabled={disabled}
              showAccessibility={true}
            />

            <ColorPicker
              label="Warna Sekunder"
              value={formData.secondaryColor}
              onChange={(color) => handleFieldChange('secondaryColor', color)}
              error={errors.secondaryColor}
              disabled={disabled}
              showAccessibility={true}
            />

            {/* Company Information */}
            <div className="space-y-4 p-6 bg-gray-50 rounded-lg">
              <h3 className="text-xl font-bold text-gray-900 mb-4">
                Informasi Perusahaan
              </h3>

              <div>
                <label htmlFor="companyName" className="block text-lg font-semibold text-gray-900 mb-2">
                  Nama Perusahaan *
                </label>
                <input
                  id="companyName"
                  type="text"
                  value={formData.companyName}
                  onChange={(e) => handleFieldChange('companyName', e.target.value)}
                  disabled={disabled}
                  placeholder="Masukkan nama perusahaan showroom"
                  className={`w-full px-4 py-3 text-lg border-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    errors.companyName
                      ? 'border-red-500'
                      : 'border-gray-300'
                  } ${disabled ? 'bg-gray-100 text-gray-500' : 'bg-white'}`}
                />
                {errors.companyName && (
                  <p className="mt-1 text-sm text-red-600">❌ {errors.companyName}</p>
                )}
              </div>

              <div>
                <label htmlFor="companyAddress" className="block text-lg font-semibold text-gray-900 mb-2">
                  Alamat Perusahaan
                </label>
                <textarea
                  id="companyAddress"
                  value={formData.companyAddress}
                  onChange={(e) => handleFieldChange('companyAddress', e.target.value)}
                  disabled={disabled}
                  placeholder="Masukkan alamat lengkap perusahaan"
                  rows={3}
                  className={`w-full px-4 py-3 text-lg border-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    errors.companyAddress
                      ? 'border-red-500'
                      : 'border-gray-300'
                  } ${disabled ? 'bg-gray-100 text-gray-500' : 'bg-white'}`}
                />
                {errors.companyAddress && (
                  <p className="mt-1 text-sm text-red-600">❌ {errors.companyAddress}</p>
                )}
              </div>

              <div>
                <label htmlFor="companyPhone" className="block text-lg font-semibold text-gray-900 mb-2">
                  Nomor Telepon
                </label>
                <input
                  id="companyPhone"
                  type="tel"
                  value={formData.companyPhone}
                  onChange={(e) => handleFieldChange('companyPhone', e.target.value)}
                  disabled={disabled}
                  placeholder="+62 812-3456-7890"
                  className={`w-full px-4 py-3 text-lg border-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    errors.companyPhone
                      ? 'border-red-500'
                      : 'border-gray-300'
                  } ${disabled ? 'bg-gray-100 text-gray-500' : 'bg-white'}`}
                />
                {errors.companyPhone && (
                  <p className="mt-1 text-sm text-red-600">❌ {errors.companyPhone}</p>
                )}
                <p className="mt-1 text-sm text-gray-500">
                  Gunakan format Indonesia (misal: +62 812-3456-7890)
                </p>
              </div>

              <div>
                <label htmlFor="companyEmail" className="block text-lg font-semibold text-gray-900 mb-2">
                  Email Perusahaan
                </label>
                <input
                  id="companyEmail"
                  type="email"
                  value={formData.companyEmail}
                  onChange={(e) => handleFieldChange('companyEmail', e.target.value)}
                  disabled={disabled}
                  placeholder="info@showroom.com"
                  className={`w-full px-4 py-3 text-lg border-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    errors.companyEmail
                      ? 'border-red-500'
                      : 'border-gray-300'
                  } ${disabled ? 'bg-gray-100 text-gray-500' : 'bg-white'}`}
                />
                {errors.companyEmail && (
                  <p className="mt-1 text-sm text-red-600">❌ {errors.companyEmail}</p>
                )}
              </div>

              <div>
                <label htmlFor="companyWebsite" className="block text-lg font-semibold text-gray-900 mb-2">
                  Website
                </label>
                <input
                  id="companyWebsite"
                  type="url"
                  value={formData.companyWebsite}
                  onChange={(e) => handleFieldChange('companyWebsite', e.target.value)}
                  disabled={disabled}
                  placeholder="https://www.showroom.com"
                  className={`w-full px-4 py-3 text-lg border-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    errors.companyWebsite
                      ? 'border-red-500'
                      : 'border-gray-300'
                  } ${disabled ? 'bg-gray-100 text-gray-500' : 'bg-white'}`}
                />
                {errors.companyWebsite && (
                  <p className="mt-1 text-sm text-red-600">❌ {errors.companyWebsite}</p>
                )}
              </div>
            </div>
          </div>

          {/* Preview Section */}
          <div className="lg:sticky lg:top-4 h-fit">
            <BrandingPreview
              data={previewData}
              title="Preview Real-time"
            />
          </div>
        </div>

        {/* Form Actions */}
        <div className="flex items-center justify-between p-6 bg-gray-50 rounded-lg border">
          <div className="flex items-center space-x-4">
            {hasChanges && (
              <span className="text-sm text-yellow-600 font-medium">
                ⚠️ Anda memiliki perubahan yang belum disimpan
              </span>
            )}
          </div>

          <div className="flex items-center space-x-4">
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                disabled={disabled || isSubmitting}
                className="px-6 py-3 text-lg font-medium text-gray-700 bg-white border-2 border-gray-300 rounded-lg hover:bg-gray-50 focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
              >
                Batal
              </button>
            )}

            <button
              type="button"
              onClick={handleReset}
              disabled={disabled || isSubmitting || !hasChanges}
              className="px-6 py-3 text-lg font-medium text-gray-700 bg-white border-2 border-gray-300 rounded-lg hover:bg-gray-50 focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
            >
              Reset
            </button>

            <button
              type="submit"
              disabled={disabled || isSubmitting || !hasChanges}
              className="px-8 py-3 text-lg font-medium text-white bg-blue-600 border-2 border-blue-600 rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
            >
              {isSubmitting ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Menyimpan...
                </span>
              ) : (
                'Simpan Perubahan'
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default BrandingConfigurationForm;