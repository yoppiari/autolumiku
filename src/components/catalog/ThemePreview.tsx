/**
 * Theme Preview Component
 * Epic 5: Story 5.8 - Multiple Themes
 */

'use client';

import React from 'react';
import { ThemeDefinition } from '@/lib/themes/theme-definitions';

interface ThemePreviewProps {
  theme: ThemeDefinition;
  isSelected?: boolean;
  onSelect?: () => void;
  onPreview?: () => void;
}

export default function ThemePreview({
  theme,
  isSelected = false,
  onSelect,
  onPreview,
}: ThemePreviewProps) {
  const colors = theme.colors.light;

  return (
    <div
      className={`relative border-2 rounded-lg overflow-hidden cursor-pointer transition-all ${
        isSelected
          ? 'border-blue-600 shadow-lg'
          : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
      }`}
      onClick={onSelect}
    >
      {/* Selected Badge */}
      {isSelected && (
        <div className="absolute top-2 right-2 z-10 bg-blue-600 text-white text-xs px-2 py-1 rounded-full font-medium">
          Aktif
        </div>
      )}

      {/* Theme Preview */}
      <div className="p-4" style={{ backgroundColor: colors.background }}>
        {/* Header Preview */}
        <div
          className="rounded-md p-3 mb-3"
          style={{ backgroundColor: colors.surface }}
        >
          <div className="flex items-center gap-2 mb-2">
            <div
              className="w-6 h-6 rounded-full"
              style={{ backgroundColor: colors.primary }}
            ></div>
            <div
              className="h-2 flex-1 rounded"
              style={{ backgroundColor: colors.primary }}
            ></div>
          </div>
          <div className="flex gap-2">
            <div
              className="h-1.5 w-16 rounded"
              style={{ backgroundColor: colors.textSecondary, opacity: 0.5 }}
            ></div>
            <div
              className="h-1.5 w-16 rounded"
              style={{ backgroundColor: colors.textSecondary, opacity: 0.5 }}
            ></div>
          </div>
        </div>

        {/* Content Preview */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div
            className="rounded-md p-2"
            style={{ backgroundColor: colors.surface }}
          >
            <div
              className="h-16 rounded mb-2"
              style={{ backgroundColor: colors.border }}
            ></div>
            <div
              className="h-1.5 rounded mb-1"
              style={{ backgroundColor: colors.text, opacity: 0.8 }}
            ></div>
            <div
              className="h-1.5 rounded w-3/4"
              style={{ backgroundColor: colors.textSecondary, opacity: 0.6 }}
            ></div>
          </div>
          <div
            className="rounded-md p-2"
            style={{ backgroundColor: colors.surface }}
          >
            <div
              className="h-16 rounded mb-2"
              style={{ backgroundColor: colors.border }}
            ></div>
            <div
              className="h-1.5 rounded mb-1"
              style={{ backgroundColor: colors.text, opacity: 0.8 }}
            ></div>
            <div
              className="h-1.5 rounded w-3/4"
              style={{ backgroundColor: colors.textSecondary, opacity: 0.6 }}
            ></div>
          </div>
        </div>

        {/* Button Preview */}
        <div className="flex gap-2">
          <div
            className="h-6 flex-1 rounded"
            style={{ backgroundColor: colors.primary }}
          ></div>
          <div
            className="h-6 w-16 rounded"
            style={{
              backgroundColor: 'transparent',
              border: `2px solid ${colors.primary}`,
            }}
          ></div>
        </div>
      </div>

      {/* Theme Info */}
      <div className="p-4 bg-white border-t">
        <h3 className="font-semibold text-gray-900 mb-1">{theme.name}</h3>
        <p className="text-sm text-gray-600 mb-3">{theme.description}</p>

        {/* Color Palette */}
        <div className="flex gap-2 mb-3">
          <div
            className="w-8 h-8 rounded-full border-2 border-white shadow"
            style={{ backgroundColor: colors.primary }}
            title="Primary"
          ></div>
          <div
            className="w-8 h-8 rounded-full border-2 border-white shadow"
            style={{ backgroundColor: colors.secondary }}
            title="Secondary"
          ></div>
          <div
            className="w-8 h-8 rounded-full border-2 border-white shadow"
            style={{ backgroundColor: colors.accent }}
            title="Accent"
          ></div>
        </div>

        {/* Actions */}
        {onPreview && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPreview();
            }}
            className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            Preview Lengkap
          </button>
        )}
      </div>
    </div>
  );
}
