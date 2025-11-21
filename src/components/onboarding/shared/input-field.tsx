'use client';

import React from 'react';

interface InputFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  required?: boolean;
  placeholder?: string;
  type?: 'text' | 'email' | 'tel' | 'url' | 'textarea';
  rows?: number;
  className?: string;
}

/**
 * Reusable Input Field Component
 *
 * Consistent input field with validation states and accessibility
 */
export function InputField({
  label,
  value,
  onChange,
  error,
  required = false,
  placeholder,
  type = 'text',
  rows = 1,
  className = ''
}: InputFieldProps) {
  const baseInputClasses = `w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
    error ? 'border-red-500' : 'border-gray-300'
  }`;

  const inputElement = type === 'textarea' ? (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className={`${baseInputClasses} resize-none`}
    />
  ) : (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={baseInputClasses}
    />
  );

  return (
    <div className={className}>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {inputElement}
      {error && (
        <p className="mt-1 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}