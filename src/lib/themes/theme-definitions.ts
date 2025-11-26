/**
 * Theme Definitions for Catalog Customization
 * Epic 5: Story 5.8 - Multiple Themes
 */

export interface ThemeColors {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  text: string;
  textSecondary: string;
  border: string;
  success: string;
  warning: string;
  error: string;
}

export interface ThemeTypography {
  fontFamily: string;
  headingFont: string;
  fontSize: {
    xs: string;
    sm: string;
    base: string;
    lg: string;
    xl: string;
    '2xl': string;
    '3xl': string;
  };
  fontWeight: {
    normal: number;
    medium: number;
    semibold: number;
    bold: number;
  };
}

export interface ThemeSpacing {
  unit: number; // Base spacing unit (e.g., 4px)
  scale: number[]; // Spacing scale multipliers
}

export interface ThemeDefinition {
  id: string;
  name: string;
  description: string;
  preview: string; // Preview image URL
  colors: {
    light: ThemeColors;
    dark?: ThemeColors;
  };
  typography: ThemeTypography;
  spacing: ThemeSpacing;
  borderRadius: {
    sm: string;
    md: string;
    lg: string;
    xl: string;
  };
  shadows: {
    sm: string;
    md: string;
    lg: string;
    xl: string;
  };
}

// ============================================================================
// THEME 1: MODERN (Default)
// ============================================================================

export const modernTheme: ThemeDefinition = {
  id: 'modern',
  name: 'Modern',
  description: 'Clean, contemporary design with vibrant colors',
  preview: '/themes/modern-preview.png',
  colors: {
    light: {
      primary: '#1a56db',
      secondary: '#7c3aed',
      accent: '#f59e0b',
      background: '#f9fafb',
      surface: '#ffffff',
      text: '#111827',
      textSecondary: '#6b7280',
      border: '#e5e7eb',
      success: '#10b981',
      warning: '#f59e0b',
      error: '#ef4444',
    },
    dark: {
      primary: '#3b82f6',
      secondary: '#8b5cf6',
      accent: '#fbbf24',
      background: '#111827',
      surface: '#1f2937',
      text: '#f9fafb',
      textSecondary: '#9ca3af',
      border: '#374151',
      success: '#34d399',
      warning: '#fbbf24',
      error: '#f87171',
    },
  },
  typography: {
    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    headingFont: '"Inter", sans-serif',
    fontSize: {
      xs: '0.75rem',
      sm: '0.875rem',
      base: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
      '2xl': '1.5rem',
      '3xl': '1.875rem',
    },
    fontWeight: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
  },
  spacing: {
    unit: 4,
    scale: [0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24, 32, 40, 48, 56, 64],
  },
  borderRadius: {
    sm: '0.375rem',
    md: '0.5rem',
    lg: '0.75rem',
    xl: '1rem',
  },
  shadows: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
  },
};

// ============================================================================
// THEME 2: CLASSIC
// ============================================================================

export const classicTheme: ThemeDefinition = {
  id: 'classic',
  name: 'Classic',
  description: 'Timeless, elegant design with traditional styling',
  preview: '/themes/classic-preview.png',
  colors: {
    light: {
      primary: '#1e40af',
      secondary: '#92400e',
      accent: '#b45309',
      background: '#fefce8',
      surface: '#fffbeb',
      text: '#1c1917',
      textSecondary: '#57534e',
      border: '#d6d3d1',
      success: '#15803d',
      warning: '#b45309',
      error: '#b91c1c',
    },
  },
  typography: {
    fontFamily: '"Merriweather", Georgia, serif',
    headingFont: '"Playfair Display", serif',
    fontSize: {
      xs: '0.75rem',
      sm: '0.875rem',
      base: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
      '2xl': '1.5rem',
      '3xl': '2rem',
    },
    fontWeight: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
  },
  spacing: {
    unit: 4,
    scale: [0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24, 32, 40, 48, 56, 64],
  },
  borderRadius: {
    sm: '0.25rem',
    md: '0.375rem',
    lg: '0.5rem',
    xl: '0.75rem',
  },
  shadows: {
    sm: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
  },
};

// ============================================================================
// THEME 3: LUXURY
// ============================================================================

export const luxuryTheme: ThemeDefinition = {
  id: 'luxury',
  name: 'Luxury',
  description: 'Premium, sophisticated design with gold accents',
  preview: '/themes/luxury-preview.png',
  colors: {
    light: {
      primary: '#0f172a',
      secondary: '#713f12',
      accent: '#ca8a04',
      background: '#fafaf9',
      surface: '#ffffff',
      text: '#0f172a',
      textSecondary: '#475569',
      border: '#e2e8f0',
      success: '#166534',
      warning: '#ca8a04',
      error: '#991b1b',
    },
    dark: {
      primary: '#f8fafc',
      secondary: '#fbbf24',
      accent: '#fcd34d',
      background: '#0f172a',
      surface: '#1e293b',
      text: '#f8fafc',
      textSecondary: '#cbd5e1',
      border: '#334155',
      success: '#22c55e',
      warning: '#fbbf24',
      error: '#ef4444',
    },
  },
  typography: {
    fontFamily: '"Lora", Georgia, serif',
    headingFont: '"Cinzel", serif',
    fontSize: {
      xs: '0.75rem',
      sm: '0.875rem',
      base: '1rem',
      lg: '1.125rem',
      xl: '1.375rem',
      '2xl': '1.75rem',
      '3xl': '2.25rem',
    },
    fontWeight: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
  },
  spacing: {
    unit: 4,
    scale: [0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24, 32, 40, 48, 56, 64],
  },
  borderRadius: {
    sm: '0.125rem',
    md: '0.25rem',
    lg: '0.375rem',
    xl: '0.5rem',
  },
  shadows: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.15)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.2)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.25)',
  },
};

// ============================================================================
// THEME 4: MINIMAL
// ============================================================================

export const minimalTheme: ThemeDefinition = {
  id: 'minimal',
  name: 'Minimal',
  description: 'Clean, minimalist design with maximum whitespace',
  preview: '/themes/minimal-preview.png',
  colors: {
    light: {
      primary: '#18181b',
      secondary: '#52525b',
      accent: '#3f3f46',
      background: '#ffffff',
      surface: '#fafafa',
      text: '#09090b',
      textSecondary: '#71717a',
      border: '#e4e4e7',
      success: '#22c55e',
      warning: '#eab308',
      error: '#ef4444',
    },
    dark: {
      primary: '#fafafa',
      secondary: '#a1a1aa',
      accent: '#d4d4d8',
      background: '#09090b',
      surface: '#18181b',
      text: '#fafafa',
      textSecondary: '#a1a1aa',
      border: '#27272a',
      success: '#22c55e',
      warning: '#eab308',
      error: '#ef4444',
    },
  },
  typography: {
    fontFamily: '"Helvetica Neue", Arial, sans-serif',
    headingFont: '"Helvetica Neue", Arial, sans-serif',
    fontSize: {
      xs: '0.75rem',
      sm: '0.875rem',
      base: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
      '2xl': '1.5rem',
      '3xl': '1.875rem',
    },
    fontWeight: {
      normal: 300,
      medium: 400,
      semibold: 500,
      bold: 600,
    },
  },
  spacing: {
    unit: 8,
    scale: [0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24, 32, 40, 48, 56, 64],
  },
  borderRadius: {
    sm: '0',
    md: '0',
    lg: '0.125rem',
    xl: '0.25rem',
  },
  shadows: {
    sm: 'none',
    md: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
    lg: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
    xl: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
  },
};

// ============================================================================
// THEME REGISTRY
// ============================================================================

export const themes: Record<string, ThemeDefinition> = {
  modern: modernTheme,
  classic: classicTheme,
  luxury: luxuryTheme,
  minimal: minimalTheme,
};

export function getTheme(themeId: string): ThemeDefinition {
  return themes[themeId] || modernTheme;
}

export function getAllThemes(): ThemeDefinition[] {
  return Object.values(themes);
}

export function generateCSSVariables(theme: ThemeDefinition, mode: 'light' | 'dark' = 'light'): string {
  const colors = mode === 'dark' && theme.colors.dark ? theme.colors.dark : theme.colors.light;

  return `
    --color-primary: ${colors.primary};
    --color-secondary: ${colors.secondary};
    --color-accent: ${colors.accent};
    --color-background: ${colors.background};
    --color-surface: ${colors.surface};
    --color-text: ${colors.text};
    --color-text-secondary: ${colors.textSecondary};
    --color-border: ${colors.border};
    --color-success: ${colors.success};
    --color-warning: ${colors.warning};
    --color-error: ${colors.error};

    --font-family: ${theme.typography.fontFamily};
    --font-heading: ${theme.typography.headingFont};

    --border-radius-sm: ${theme.borderRadius.sm};
    --border-radius-md: ${theme.borderRadius.md};
    --border-radius-lg: ${theme.borderRadius.lg};
    --border-radius-xl: ${theme.borderRadius.xl};

    --shadow-sm: ${theme.shadows.sm};
    --shadow-md: ${theme.shadows.md};
    --shadow-lg: ${theme.shadows.lg};
    --shadow-xl: ${theme.shadows.xl};
  `.trim();
}
