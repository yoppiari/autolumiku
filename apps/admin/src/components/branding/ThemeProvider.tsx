import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { TenantTheme, BrandingConfig } from '../../types/branding.types';

interface ThemeContextType {
  theme: TenantTheme | null;
  isLoading: boolean;
  applyTheme: (brandingConfig: BrandingConfig) => void;
  resetTheme: () => void;
  updateThemeVariable: (variable: string, value: string) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
  tenantId?: string;
}

const DEFAULT_THEME: TenantTheme = {
  id: 'default',
  name: 'Default Theme',
  colors: {
    primary: '#2563eb',
    secondary: '#64748b',
    accent: '#3b82f6',
    background: '#ffffff',
    surface: '#f8fafc',
  },
  typography: {
    headingFont: 'Inter, sans-serif',
    bodyFont: 'Inter, sans-serif',
    scale: 1.0,
  },
  branding: {
    logoUrl: undefined,
    faviconUrl: undefined,
    customCSS: undefined,
  },
};

export const ThemeProvider: React.FC<ThemeProviderProps> = ({
  children,
  tenantId
}) => {
  const [theme, setTheme] = useState<TenantTheme | null>(DEFAULT_THEME);
  const [isLoading, setIsLoading] = useState(true);

  // Load theme from localStorage or API on mount
  useEffect(() => {
    loadTheme();
  }, [tenantId]);

  const loadTheme = async () => {
    setIsLoading(true);

    try {
      // Try to load from localStorage first
      if (tenantId) {
        const storedTheme = localStorage.getItem(`theme_${tenantId}`);
        if (storedTheme) {
          const parsedTheme = JSON.parse(storedTheme);
          setTheme(parsedTheme);
          applyThemeCSS(parsedTheme);
          setIsLoading(false);
          return;
        }
      }

      // Load from API (in a real implementation)
      // For now, use default theme
      setTheme(DEFAULT_THEME);
      applyThemeCSS(DEFAULT_THEME);
    } catch (error) {
      console.error('Error loading theme:', error);
      setTheme(DEFAULT_THEME);
      applyThemeCSS(DEFAULT_THEME);
    } finally {
      setIsLoading(false);
    }
  };

  const applyTheme = (brandingConfig: BrandingConfig) => {
    const tenantTheme: TenantTheme = {
      id: brandingConfig.tenantId || 'default',
      name: `${brandingConfig.companyInfo.name} Theme`,
      colors: {
        primary: brandingConfig.primaryColor,
        secondary: brandingConfig.secondaryColor,
        accent: generateAccentColor(brandingConfig.primaryColor),
        background: '#ffffff',
        surface: '#f8fafc',
      },
      typography: {
        headingFont: 'Inter, sans-serif',
        bodyFont: 'Inter, sans-serif',
        scale: 1.2, // Slightly larger for senior users
      },
      branding: {
        logoUrl: brandingConfig.logoUrl,
        faviconUrl: brandingConfig.faviconUrl,
        customCSS: generateCustomCSS(brandingConfig),
      },
    };

    setTheme(tenantTheme);
    applyThemeCSS(tenantTheme);

    // Save to localStorage
    if (tenantId) {
      localStorage.setItem(`theme_${tenantId}`, JSON.stringify(tenantTheme));
    }

    // Update favicon if provided
    if (brandingConfig.faviconUrl) {
      updateFavicon(brandingConfig.faviconUrl);
    }
  };

  const applyThemeCSS = (themeToApply: TenantTheme) => {
    const root = document.documentElement;

    // Apply CSS custom properties
    root.style.setProperty('--tenant-primary', themeToApply.colors.primary);
    root.style.setProperty('--tenant-secondary', themeToApply.colors.secondary);
    root.style.setProperty('--tenant-accent', themeToApply.colors.accent);
    root.style.setProperty('--tenant-background', themeToApply.colors.background);
    root.style.setProperty('--tenant-surface', themeToApply.colors.surface);

    // Apply typography
    root.style.setProperty('--tenant-font-heading', themeToApply.typography.headingFont);
    root.style.setProperty('--tenant-font-body', themeToApply.typography.bodyFont);
    root.style.setProperty('--tenant-font-scale', themeToApply.typography.scale.toString());

    // Apply accessible color variations
    const colors = generateAccessibleColors(themeToApply.colors.primary);
    Object.entries(colors).forEach(([key, value]) => {
      root.style.setProperty(`--tenant-${key}`, value);
    });

    // Add custom CSS if provided
    if (themeToApply.branding.customCSS) {
      let customStyleElement = document.getElementById('tenant-custom-css');
      if (!customStyleElement) {
        customStyleElement = document.createElement('style');
        customStyleElement.id = 'tenant-custom-css';
        document.head.appendChild(customStyleElement);
      }
      customStyleElement.textContent = themeToApply.branding.customCSS;
    }

    // Update page title
    if (themeToApply.name !== 'Default Theme') {
      document.title = themeToApply.name;
    }
  };

  const generateAccentColor = (primaryColor: string): string => {
    // Generate a slightly lighter/darker variation of primary color for accent
    const hex = primaryColor.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);

    // Create a lighter version for accent
    const accentR = Math.min(255, r + 30);
    const accentG = Math.min(255, g + 30);
    const accentB = Math.min(255, b + 30);

    return `#${accentR.toString(16).padStart(2, '0')}${accentG.toString(16).padStart(2, '0')}${accentB.toString(16).padStart(2, '0')}`;
  };

  const generateAccessibleColors = (primaryColor: string): Record<string, string> => {
    const hex = primaryColor.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);

    // Calculate luminance
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

    // Generate accessible text colors
    const isLight = luminance > 0.5;

    return {
      'primary-foreground': isLight ? '#000000' : '#ffffff',
      'primary-hover': isLight ? shadeColor(primaryColor, -20) : shadeColor(primaryColor, 20),
      'primary-light': shadeColor(primaryColor, 40),
      'primary-dark': shadeColor(primaryColor, -40),
      'text-primary': isLight ? '#1f2937' : '#f9fafb',
      'text-secondary': isLight ? '#6b7280' : '#d1d5db',
      'border-primary': shadeColor(primaryColor, 60),
    };
  };

  const shadeColor = (color: string, percent: number): string => {
    const hex = color.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);

    const newR = Math.min(255, Math.max(0, r + (r * percent / 100)));
    const newG = Math.min(255, Math.max(0, g + (g * percent / 100)));
    const newB = Math.min(255, Math.max(0, b + (b * percent / 100)));

    return `#${Math.round(newR).toString(16).padStart(2, '0')}${Math.round(newG).toString(16).padStart(2, '0')}${Math.round(newB).toString(16).padStart(2, '0')}`;
  };

  const generateCustomCSS = (brandingConfig: BrandingConfig): string => {
    return `
      /* Tenant-specific custom CSS */
      .tenant-${brandingConfig.tenantId} {
        --tenant-primary: ${brandingConfig.primaryColor};
        --tenant-secondary: ${brandingConfig.secondaryColor};
      }

      /* Enhanced accessibility for senior users */
      .tenant-${brandingConfig.tenantId} .btn-primary {
        min-height: 48px;
        font-size: 16px;
        font-weight: 600;
        padding: 12px 24px;
      }

      .tenant-${brandingConfig.tenantId} .form-input {
        min-height: 48px;
        font-size: 16px;
        padding: 12px 16px;
      }

      .tenant-${brandingConfig.tenantId} .card {
        border-radius: 12px;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
      }

      /* Focus indicators for keyboard navigation */
      .tenant-${brandingConfig.tenantId} *:focus {
        outline: 3px solid ${brandingConfig.primaryColor};
        outline-offset: 2px;
      }

      /* High contrast mode support */
      @media (prefers-contrast: high) {
        .tenant-${brandingConfig.tenantId} {
          --tenant-primary: ${brandingConfig.primaryColor};
          --tenant-secondary: ${brandingConfig.secondaryColor};
        }
      }
    `;
  };

  const updateFavicon = (faviconUrl: string) => {
    let link: HTMLLinkElement | null = document.querySelector("link[rel*='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = faviconUrl;
  };

  const resetTheme = () => {
    setTheme(DEFAULT_THEME);
    applyThemeCSS(DEFAULT_THEME);

    // Clear localStorage
    if (tenantId) {
      localStorage.removeItem(`theme_${tenantId}`);
    }

    // Reset favicon
    const link: HTMLLinkElement | null = document.querySelector("link[rel*='icon']");
    if (link) {
      link.href = '/favicon.ico'; // Default favicon
    }

    // Reset page title
    document.title = 'AutoLumiku Admin';
  };

  const updateThemeVariable = (variable: string, value: string) => {
    const root = document.documentElement;
    root.style.setProperty(`--${variable}`, value);

    // Update current theme state
    if (theme) {
      const updatedTheme = { ...theme };

      // Parse variable name and update corresponding theme property
      if (variable.startsWith('tenant-primary')) {
        updatedTheme.colors.primary = value;
      } else if (variable.startsWith('tenant-secondary')) {
        updatedTheme.colors.secondary = value;
      }

      setTheme(updatedTheme);

      // Save to localStorage
      if (tenantId) {
        localStorage.setItem(`theme_${tenantId}`, JSON.stringify(updatedTheme));
      }
    }
  };

  const value: ThemeContextType = {
    theme,
    isLoading,
    applyTheme,
    resetTheme,
    updateThemeVariable,
  };

  return (
    <ThemeContext.Provider value={value}>
      <div className={`tenant-${theme?.id || 'default'} transition-colors duration-300`}>
        {children}
      </div>
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

// Hook for accessing theme CSS variables
export const useThemeVariables = () => {
  const { theme } = useTheme();

  const getCSSVariable = (variable: string): string => {
    if (typeof window !== 'undefined') {
      return getComputedStyle(document.documentElement).getPropertyValue(`--${variable}`).trim();
    }
    return '';
  };

  return {
    getCSSVariable,
    theme,
  };
};

// HOC to apply theme to a component
export const withTheme = <P extends object>(Component: React.ComponentType<P>) => {
  const WrappedComponent = (props: P) => {
    const { theme, isLoading } = useTheme();

    if (isLoading) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      );
    }

    return <Component {...props} theme={theme} />;
  };

  WrappedComponent.displayName = `withTheme(${Component.displayName || Component.name})`;

  return WrappedComponent;
};