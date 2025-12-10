/**
 * Theme Provider Component
 * Applies theme CSS variables to catalog pages
 * Epic 5: Story 5.8 - Multiple Themes
 */

'use client';

import React, { useEffect, useState } from 'react';
import { ThemeProvider as NextThemesProvider, useTheme } from 'next-themes';

interface ThemeProviderProps {
  tenantId: string;
  children: React.ReactNode;
}

function ThemeVariables({ tenantId }: { tenantId: string }) {
  const { theme, resolvedTheme } = useTheme();
  const [cssVariables, setCssVariables] = useState<string>('');

  useEffect(() => {
    loadTheme();
  }, [tenantId, resolvedTheme]); // Reload when theme mode changes

  const loadTheme = async () => {
    try {
      const response = await fetch(`/api/v1/catalog/theme?tenantId=${tenantId}`);
      if (response.ok) {
        const data = await response.json();
        const mode = resolvedTheme === 'dark' ? 'dark' : 'light';
        const css = mode === 'dark' && data.data.cssDark
          ? data.data.cssDark
          : data.data.cssLight;
        setCssVariables(css);
      }
    } catch (error) {
      console.error('Failed to load theme:', error);
    }
  };

  useEffect(() => {
    if (cssVariables) {
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

  return null;
}

export default function ThemeProvider({
  tenantId,
  children,
}: ThemeProviderProps) {
  // Using 'class' attribute for tailwind dark mode
  return (
    <NextThemesProvider attribute="class" defaultTheme="system" enableSystem>
      <ThemeVariables tenantId={tenantId} />
      {children}
    </NextThemesProvider>
  );
}
