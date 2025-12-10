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
  forcedTheme?: 'light' | 'dark' | null;
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
      // Apply CSS variables to body instead of :root to avoid conflict with globals.css @layer base
      // This allows theme switching while maintaining proper CSS specificity
      const styleId = 'theme-variables';
      let styleElement = document.getElementById(styleId) as HTMLStyleElement;

      if (!styleElement) {
        styleElement = document.createElement('style');
        styleElement.id = styleId;
        document.head.appendChild(styleElement);
      }

      // Use body selector with higher specificity to override :root defaults
      styleElement.textContent = `body { ${cssVariables} }`;
    }
  }, [cssVariables]);

  return null;
}

export default function ThemeProvider({
  tenantId,
  children,
  forcedTheme = null,
}: ThemeProviderProps) {
  // Using 'class' attribute for tailwind dark mode
  // If forcedTheme is set, use it and disable system detection
  const themeProps = forcedTheme
    ? { attribute: "class" as const, forcedTheme, enableSystem: false }
    : { attribute: "class" as const, defaultTheme: "system", enableSystem: true };

  return (
    <NextThemesProvider {...themeProps}>
      <ThemeVariables tenantId={tenantId} />
      {children}
    </NextThemesProvider>
  );
}
