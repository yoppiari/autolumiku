'use client';

import React, { useState, useRef } from 'react';

interface ImageUploadProps {
  label: string;
  currentImageUrl?: string;
  onUpload: (file: File) => Promise<void>;
  accept?: string;
  maxSizeMB?: number;
  helpText?: string;
}

export default function ImageUpload({
  label,
  currentImageUrl,
  onUpload,
  accept = 'image/png,image/jpeg,image/svg+xml',
  maxSizeMB = 5,
  helpText = 'PNG, JPG, or SVG (max 5MB)',
}: ImageUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | undefined>(currentImageUrl);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): string | null => {
    // Check file type
    const allowedTypes = accept.split(',').map(t => t.trim());
    if (!allowedTypes.includes(file.type)) {
      return `Format file tidak didukung. Gunakan: ${allowedTypes.join(', ')}`;
    }

    // Check file size
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      return `Ukuran file terlalu besar. Maksimal ${maxSizeMB}MB`;
    }

    return null;
  };

  const handleFile = async (file: File) => {
    setError(null);

    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setIsUploading(true);

      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(file);

      // Upload file
      await onUpload(file);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal upload file');
      setPreview(currentImageUrl);
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">
        {label}
      </label>

      <div
        onClick={handleClick}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`
          relative border-2 border-dashed rounded-lg p-6 text-center cursor-pointer
          transition-all duration-200
          ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}
          ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          onChange={handleFileInput}
          disabled={isUploading}
          className="hidden"
        />

        {preview ? (
          <div className="space-y-3">
            <img
              src={preview}
              alt="Preview"
              className="max-h-32 mx-auto rounded"
            />
            <p className="text-sm text-gray-600">
              {isUploading ? 'Mengupload...' : 'Klik atau drag file untuk mengganti'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              stroke="currentColor"
              fill="none"
              viewBox="0 0 48 48"
              aria-hidden="true"
            >
              <path
                d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <div className="text-sm text-gray-600">
              <span className="font-medium text-blue-600 hover:text-blue-500">
                Upload file
              </span>
              {' atau drag and drop'}
            </div>
            <p className="text-xs text-gray-500">{helpText}</p>
          </div>
        )}

        {isUploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75 rounded-lg">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}
