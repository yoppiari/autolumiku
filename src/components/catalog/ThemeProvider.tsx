/**
 * Theme Provider Component
 * Applies theme CSS variables to catalog pages
 * Epic 5: Story 5.8 - Multiple Themes
 */

'use client';

import React, { useEffect, useState } from 'react';

interface ThemeProviderProps {
  tenantId: string;
  children: React.ReactNode;
  mode?: 'light' | 'dark';
}

export default function ThemeProvider({
  tenantId,
  children,
  mode = 'light',
}: ThemeProviderProps) {
  const [cssVariables, setCssVariables] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTheme();
  }, [tenantId, mode]);

  const loadTheme = async () => {
    try {
      const response = await fetch(`/api/v1/catalog/theme?tenantId=${tenantId}`);
      if (response.ok) {
        const data = await response.json();
        const css = mode === 'dark' && data.data.cssDark
          ? data.data.cssDark
          : data.data.cssLight;
        setCssVariables(css);
      }
    } catch (error) {
      console.error('Failed to load theme:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (cssVariables) {
      // Apply CSS variables to root
      const styleId = 'theme-variables';
      let styleElement = document.getElementById(styleId) as HTMLStyleElement;

      if (!styleElement) {
        styleElement = document.createElement('style');
        styleElement.id = styleId;
        document.head.appendChild(styleElement);
      }

      styleElement.textContent = `:root { ${cssVariables} }`;
    }
  }, [cssVariables]);

  if (loading) {
    return <>{children}</>;
  }

  return <>{children}</>;
}
