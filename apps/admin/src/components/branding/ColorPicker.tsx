import React, { useState, useEffect } from 'react';
import { ColorPreset, ValidationError } from '../../types/branding.types';

interface ColorPickerProps {
  label: string;
  value: string;
  onChange: (color: string) => void;
  error?: string;
  presets?: ColorPreset[];
  disabled?: boolean;
  showAccessibility?: boolean;
}

const DEFAULT_PRESETS: ColorPreset[] = [
  {
    name: 'Biru Profesional',
    primary: '#2563eb',
    secondary: '#64748b',
    description: 'Kombinasi biru dan abu-abu yang profesional',
    accessible: true
  },
  {
    name: 'Hijau Segar',
    primary: '#059669',
    secondary: '#6b7280',
    description: 'Nuansa hijau yang segar dan modern',
    accessible: true
  },
  {
    name: 'Merah Berani',
    primary: '#dc2626',
    secondary: '#7f1d1d',
    description: 'Warna merah yang berani dan menarik',
    accessible: true
  },
  {
    name: 'Ungu Elegan',
    primary: '#7c3aed',
    secondary: '#581c87',
    description: 'Kombinasi ungu yang elegan dan sophisticated',
    accessible: true
  },
  {
    name: 'Oranye Ceria',
    primary: '#ea580c',
    secondary: '#c2410c',
    description: 'Warna oranye yang ceria dan energik',
    accessible: true
  },
  {
    name: 'Abu-abu Netral',
    primary: '#374151',
    secondary: '#6b7280',
    description: 'Palet abu-abu yang netral dan timeless',
    accessible: true
  }
];

export const ColorPicker: React.FC<ColorPickerProps> = ({
  label,
  value,
  onChange,
  error,
  presets = DEFAULT_PRESETS,
  disabled = false,
  showAccessibility = true
}) => {
  const [isValidHex, setIsValidHex] = useState(true);
  const [contrastRatio, setContrastRatio] = useState<number | null>(null);
  const [wcagCompliant, setWcagCompliant] = useState<boolean | null>(null);

  // Validate hex color
  useEffect(() => {
    const hexRegex = /^#[0-9A-Fa-f]{6}$/;
    const valid = hexRegex.test(value);
    setIsValidHex(valid);

    if (valid && showAccessibility) {
      calculateAccessibility(value);
    }
  }, [value, showAccessibility]);

  const calculateAccessibility = (color: string) => {
    // Convert hex to RGB
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);

    // Calculate luminance
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

    // Calculate contrast with white (typical background)
    const whiteLuminance = 1.0;
    const ratio = (whiteLuminance + 0.05) / (luminance + 0.05);
    setContrastRatio(Math.round(ratio * 100) / 100);

    // WCAG AA requires contrast ratio of at least 4.5:1 for normal text
    const compliant = ratio >= 4.5;
    setWcagCompliant(compliant);
  };

  const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value.toUpperCase();
    onChange(newValue);
  };

  const handlePresetClick = (preset: ColorPreset) => {
    onChange(preset.primary);
  };

  const handleCustomColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      // In a real implementation, you would extract the dominant color from the image
      // For now, we'll just log it
      console.log('Color extraction from image would be implemented here');
    }
  };

  return (
    <div className="space-y-4">
      {/* Label */}
      <div>
        <label className="block text-lg font-semibold text-gray-900 mb-2">
          {label}
        </label>
        {showAccessibility && (
          <p className="text-sm text-gray-600 mb-2">
            Pilih warna yang sesuai dengan identitas showroom Anda
          </p>
        )}
      </div>

      {/* Color Input */}
      <div className="flex items-center space-x-4">
        <div className="relative">
          <input
            type="color"
            value={value}
            onChange={handleColorChange}
            disabled={disabled}
            className={`w-20 h-20 rounded-lg border-2 cursor-pointer ${
              error
                ? 'border-red-500'
                : isValidHex
                ? 'border-gray-300'
                : 'border-yellow-500'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          />
          {disabled && (
            <div className="absolute inset-0 bg-gray-100 bg-opacity-50 rounded-lg flex items-center justify-center">
              <span className="text-gray-500 text-xs">Dinonaktifkan</span>
            </div>
          )}
        </div>

        <div className="flex-1">
          <input
            type="text"
            value={value}
            onChange={handleColorChange}
            disabled={disabled}
            placeholder="#000000"
            className={`w-full px-4 py-3 text-lg border-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
              error
                ? 'border-red-500'
                : isValidHex
                ? 'border-gray-300'
                : 'border-yellow-500'
            } ${disabled ? 'bg-gray-100 text-gray-500' : 'bg-white'}`}
          />
          {!isValidHex && (
            <p className="mt-1 text-sm text-yellow-600">
              ⚠️ Format warna tidak valid. Gunakan format HEX (misal: #FF0000)
            </p>
          )}
          {error && (
            <p className="mt-1 text-sm text-red-600">
              ❌ {error}
            </p>
          )}
        </div>
      </div>

      {/* Accessibility Information */}
      {showAccessibility && isValidHex && contrastRatio !== null && (
        <div className={`p-4 rounded-lg border-2 ${
          wcagCompliant
            ? 'bg-green-50 border-green-200'
            : 'bg-yellow-50 border-yellow-200'
        }`}>
          <div className="flex items-center space-x-2">
            <span className={`text-2xl ${
              wcagCompliant ? 'text-green-600' : 'text-yellow-600'
            }`}>
              {wcagCompliant ? '✅' : '⚠️'}
            </span>
            <div>
              <p className="font-semibold text-gray-900">
                {wcagCompliant ? 'Aksesibilitas Baik' : 'Perlu Diperhatikan'}
              </p>
              <p className="text-sm text-gray-600">
                Kontras warna: {contrastRatio}:1
                {wcagCompliant
                  ? ' (Memenuhi standar WCAG AA)'
                  : ' (Tidak memenuhi standar WCAG AA - pertimbangkan warna lain)'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Color Presets */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-3">
          Palet Warna Siap Pakai
        </h3>
        <p className="text-sm text-gray-600 mb-4">
          Pilih dari koleksi warna yang telah dioptimalkan untuk aksesibilitas
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {presets.map((preset) => (
            <button
              key={preset.name}
              onClick={() => handlePresetClick(preset)}
              disabled={disabled}
              className={`p-4 rounded-lg border-2 transition-all duration-200 hover:shadow-md ${
                preset.primary === value
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <div className="flex items-center space-x-3">
                <div className="flex space-x-1">
                  <div
                    className="w-8 h-8 rounded-full border-2 border-gray-300"
                    style={{ backgroundColor: preset.primary }}
                  />
                  <div
                    className="w-8 h-8 rounded-full border-2 border-gray-300"
                    style={{ backgroundColor: preset.secondary }}
                  />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-gray-900 text-sm">
                    {preset.name}
                  </p>
                  <p className="text-xs text-gray-600">
                    {preset.description}
                  </p>
                  {preset.accessible && (
                    <span className="inline-flex items-center text-xs text-green-600 mt-1">
                      <span className="mr-1">♿</span>
                      Aksesibel
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Color from Image (Future Feature) */}
      <div className="p-4 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
        <p className="text-sm text-gray-600 text-center">
          💡 <strong>Fitur masa depan:</strong> Ekstrak warna dominan dari logo yang diunggah
        </p>
      </div>
    </div>
  );
};

export default ColorPicker;