export interface BrandingConfig {
  id?: string;
  tenantId: string;
  logoUrl?: string;
  faviconUrl?: string;
  primaryColor: string;
  secondaryColor: string;
  companyInfo: {
    name: string;
    address?: string;
    phone?: string;
    email?: string;
    website?: string;
  };
  createdAt?: string;
  updatedAt?: string;
}

export interface BrandingFormData {
  logoFile?: File;
  faviconFile?: File;
  primaryColor: string;
  secondaryColor: string;
  companyName: string;
  companyAddress: string;
  companyPhone: string;
  companyEmail: string;
  companyWebsite: string;
}

export interface BrandingPreview {
  logoUrl?: string;
  faviconUrl?: string;
  primaryColor: string;
  secondaryColor: string;
  companyName: string;
  companyAddress: string;
  companyPhone: string;
  companyEmail: string;
  companyWebsite: string;
}

export interface ColorPreset {
  name: string;
  primary: string;
  secondary: string;
  description: string;
  accessible: boolean; // WCAG AA compliant
}

export interface FileUploadResponse {
  url: string;
  filename: string;
  size: number;
  mimetype: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    requestId: string;
    timestamp: string;
  };
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface BrandingFormErrors {
  logoFile?: string;
  faviconFile?: string;
  primaryColor?: string;
  secondaryColor?: string;
  companyName?: string;
  companyAddress?: string;
  companyPhone?: string;
  companyEmail?: string;
  companyWebsite?: string;
}

export type ThemeMode = 'light' | 'dark';

export interface TenantTheme {
  id: string;
  name: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    surface: string;
  };
  typography: {
    headingFont: string;
    bodyFont: string;
    scale: number; // For accessibility (1.0 - 1.5)
  };
  branding: {
    logoUrl?: string;
    faviconUrl?: string;
    customCSS?: string;
  };
}