import React, { useState, useRef, useCallback } from 'react';
import { FileUploadResponse, ValidationError } from '../../types/branding.types';

interface FileUploadProps {
  label: string;
  accept: string;
  maxSize: number; // in bytes
  value?: string;
  onChange: (file: File) => void;
  onRemove?: () => void;
  error?: string;
  disabled?: boolean;
  preview?: boolean;
  helpText?: string;
  fileType: 'logo' | 'favicon';
}

export const FileUpload: React.FC<FileUploadProps> = ({
  label,
  accept,
  maxSize,
  value,
  onChange,
  onRemove,
  error,
  disabled = false,
  preview = true,
  helpText,
  fileType
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const validateFile = (file: File): string | null => {
    // Check file size
    if (file.size > maxSize) {
      return `Ukuran file terlalu besar. Maksimal ${formatFileSize(maxSize)}`;
    }

    // Check file type
    const allowedTypes = accept.split(',').map(type => type.trim());
    const isAllowed = allowedTypes.some(type => {
      if (type.startsWith('.')) {
        return file.name.toLowerCase().endsWith(type.toLowerCase());
      }
      return file.type.match(type.replace('*', '.*'));
    });

    if (!isAllowed) {
      return `Tipe file tidak didukung. Gunakan file: ${accept}`;
    }

    // Additional validation for SVG files (security)
    if (file.type === 'image/svg+xml') {
      // In a real implementation, you would scan SVG content for malicious scripts
      console.log('SVG security validation would be performed here');
    }

    return null;
  };

  const handleFile = useCallback((file: File) => {
    const validationError = validateFile(file);
    if (validationError) {
      return validationError;
    }

    setIsUploading(true);
    setUploadProgress(0);

    // Simulate upload progress
    const progressInterval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return 90;
        }
        return prev + 10;
      });
    }, 100);

    // Simulate upload completion
    setTimeout(() => {
      setUploadProgress(100);
      setIsUploading(false);
      clearInterval(progressInterval);
      onChange(file);
    }, 1500);

    return null;
  }, [maxSize, accept, onChange]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (disabled) return;

    const files = e.dataTransfer.files;
    if (files && files[0]) {
      handleFile(files[0]);
    }
  }, [disabled, handleFile]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files[0]) {
      handleFile(files[0]);
    }
  };

  const openFileDialog = () => {
    if (!disabled && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleRemove = () => {
    if (onRemove && !disabled) {
      onRemove();
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const getPreviewDimensions = () => {
    if (fileType === 'favicon') {
      return { width: 32, height: 32 };
    }
    return { width: 120, height: 120 };
  };

  const dimensions = getPreviewDimensions();

  return (
    <div className="space-y-4">
      {/* Label */}
      <div>
        <label className="block text-lg font-semibold text-gray-900 mb-2">
          {label}
        </label>
        {helpText && (
          <p className="text-sm text-gray-600 mb-2">{helpText}</p>
        )}
        <p className="text-xs text-gray-500">
          Maksimal ukuran file: {formatFileSize(maxSize)} | Format: {accept}
        </p>
      </div>

      {/* Current File Preview */}
      {value && preview && (
        <div className="p-4 bg-gray-50 rounded-lg border-2 border-gray-200">
          <div className="flex items-center space-x-4">
            <div className="flex-shrink-0">
              {value.toLowerCase().endsWith('.svg') ? (
                <div
                  className="border-2 border-gray-300 rounded-lg bg-white p-2"
                  style={{ width: dimensions.width + 16, height: dimensions.height + 16 }}
                >
                  <img
                    src={value}
                    alt="Preview"
                    style={{ width: dimensions.width, height: dimensions.height }}
                    className="object-contain"
                  />
                </div>
              ) : (
                <img
                  src={value}
                  alt="Preview"
                  style={{ width: dimensions.width, height: dimensions.height }}
                  className="object-cover border-2 border-gray-300 rounded-lg"
                />
              )}
            </div>
            <div className="flex-1">
              <p className="font-medium text-gray-900">File saat ini</p>
              <p className="text-sm text-gray-600 truncate max-w-xs">
                {value.split('/').pop()}
              </p>
            </div>
            {!disabled && onRemove && (
              <button
                onClick={handleRemove}
                className="px-4 py-2 text-sm font-medium text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors duration-200"
              >
                Hapus
              </button>
            )}
          </div>
        </div>
      )}

      {/* Upload Area */}
      <div
        className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors duration-200 ${
          dragActive
            ? 'border-blue-500 bg-blue-50'
            : error
            ? 'border-red-300 bg-red-50'
            : 'border-gray-300 bg-gray-50 hover:border-gray-400'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={openFileDialog}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          onChange={handleFileInput}
          disabled={disabled}
          className="hidden"
        />

        {/* Upload Icon */}
        <div className="mx-auto mb-4">
          {isUploading ? (
            <div className="relative">
              <div className="w-16 h-16 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-sm font-medium text-gray-600">
                  {uploadProgress}%
                </span>
              </div>
            </div>
          ) : (
            <div className="w-16 h-16 mx-auto flex items-center justify-center">
              {fileType === 'favicon' ? (
                <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              ) : (
                <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              )}
            </div>
          )}
        </div>

        {/* Upload Text */}
        <div className="space-y-2">
          {isUploading ? (
            <p className="text-lg font-medium text-gray-900">
              Mengupload file...
            </p>
          ) : (
            <>
              <p className="text-lg font-medium text-gray-900">
                {dragActive ? 'Lepaskan file di sini' : 'Klik untuk memilih file atau seret di sini'}
              </p>
              <p className="text-sm text-gray-600">
                Pilih file {fileType === 'favicon' ? 'favicon' : 'logo'} dari komputer Anda
              </p>
            </>
          )}
        </div>

        {/* Progress Bar */}
        {isUploading && (
          <div className="mt-4 w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center space-x-2">
            <span className="text-red-500">❌</span>
            <p className="text-sm text-red-700 font-medium">{error}</p>
          </div>
        </div>
      )}

      {/* Instructions for Senior Users */}
      <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
        <h4 className="font-semibold text-blue-900 mb-2 flex items-center">
          <span className="mr-2">💡</span>
          Petunjuk Penggunaan
        </h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Klik area di atas untuk membuka file browser</li>
          <li>• Atau seret file langsung ke area tersebut</li>
          <li>• Pastikan file memenuhi ukuran dan format yang disarankan</li>
          <li>• Logo akan otomatis disesuaikan ukurannya</li>
          {fileType === 'favicon' && (
            <li>• Favicon adalah icon kecil yang muncul di browser tab</li>
          )}
        </ul>
      </div>
    </div>
  );
};

export default FileUpload;