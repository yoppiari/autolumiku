/**
 * Tenant Branding Model
 *
 * Defines the data structure and validation rules for tenant branding configuration.
 * This model handles visual identity settings including logos, colors, and company information.
 */

export interface TenantBranding {
  id: string;
  tenantId: string;
  logoUrl?: string;
  faviconUrl?: string;
  primaryColor: string;
  secondaryColor: string;
  companyInfo: CompanyInfo;
  createdAt: Date;
  updatedAt: Date;
}

export interface CompanyInfo {
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
}

export interface CreateBrandingRequest {
  tenantId: string;
  logoUrl?: string;
  faviconUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
  companyInfo: CompanyInfo;
}

export interface UpdateBrandingRequest {
  logoUrl?: string;
  faviconUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
  companyInfo?: Partial<CompanyInfo>;
}

export interface BrandingPreview {
  logoUrl?: string;
  faviconUrl?: string;
  primaryColor: string;
  secondaryColor: string;
  companyInfo: CompanyInfo;
  cssVariables: CSSVariables;
  previewHtml: string;
}

export interface CSSVariables {
  '--tenant-primary': string;
  '--tenant-secondary': string;
  '--tenant-logo': string;
  '--tenant-favicon': string;
}

// Validation schemas
export const ColorValidationRegex = /^#[0-9A-Fa-f]{6}$/;
export const PhoneValidationRegex = /^[\+]?[0-9\s\-\(\)]{10,20}$/;
export const EmailValidationRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
export const WebsiteValidationRegex = /^https?:\/\/[^\s/$.?#].[^\s]*$/;

// Default values
export const DEFAULT_PRIMARY_COLOR = '#3B82F6'; // Blue
export const DEFAULT_SECONDARY_COLOR = '#64748B'; // Gray

// Validation functions
export class BrandingValidator {
  static isValidHexColor(color: string): boolean {
    return ColorValidationRegex.test(color);
  }

  static isValidPhoneNumber(phone: string): boolean {
    return PhoneValidationRegex.test(phone);
  }

  static isValidEmail(email: string): boolean {
    return EmailValidationRegex.test(email);
  }

  static isValidWebsite(website: string): boolean {
    return WebsiteValidationRegex.test(website);
  }

  static validateColorContrast(primary: string, secondary: string): {
    isAccessible: boolean;
    ratio: number;
    recommendation?: string;
  } {
    // Simplified contrast ratio calculation
    const getLuminance = (hex: string): number => {
      const rgb = parseInt(hex.slice(1), 16);
      const r = (rgb >> 16) & 0xff;
      const g = (rgb >> 8) & 0xff;
      const b = rgb & 0xff;

      const [rs, gs, bs] = [r, g, b].map(c => {
        c = c / 255;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
      });

      return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
    };

    const l1 = getLuminance(primary);
    const l2 = getLuminance(secondary);
    const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);

    return {
      isAccessible: ratio >= 4.5, // WCAG AA standard
      ratio: Math.round(ratio * 100) / 100,
      recommendation: ratio < 4.5 ? 'Consider using colors with higher contrast for better accessibility' : undefined
    };
  }

  static validateBrandingRequest(data: CreateBrandingRequest): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Validate tenant ID
    if (!data.tenantId) {
      errors.push('Tenant ID is required');
    }

    // Validate colors
    if (data.primaryColor && !this.isValidHexColor(data.primaryColor)) {
      errors.push('Primary color must be a valid hex color (#RRGGBB)');
    }

    if (data.secondaryColor && !this.isValidHexColor(data.secondaryColor)) {
      errors.push('Secondary color must be a valid hex color (#RRGGBB)');
    }

    // Validate company info
    if (!data.companyInfo.name || data.companyInfo.name.trim().length === 0) {
      errors.push('Company name is required');
    }

    if (data.companyInfo.phone && !this.isValidPhoneNumber(data.companyInfo.phone)) {
      errors.push('Invalid phone number format');
    }

    if (data.companyInfo.email && !this.isValidEmail(data.companyInfo.email)) {
      errors.push('Invalid email format');
    }

    if (data.companyInfo.website && !this.isValidWebsite(data.companyInfo.website)) {
      errors.push('Invalid website URL format');
    }

    // Validate URLs
    if (data.logoUrl && !this.isValidWebsite(data.logoUrl)) {
      errors.push('Invalid logo URL format');
    }

    if (data.faviconUrl && !this.isValidWebsite(data.faviconUrl)) {
      errors.push('Invalid favicon URL format');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

// Database row interface
export interface TenantBrandingRow {
  id: string;
  tenant_id: string;
  logo_url?: string;
  favicon_url?: string;
  primary_color: string;
  secondary_color: string;
  company_name: string;
  company_address?: string;
  company_phone?: string;
  company_email?: string;
  company_website?: string;
  created_at: Date;
  updated_at: Date;
}

// Database mapper functions
export class TenantBrandingMapper {
  static fromRow(row: TenantBrandingRow): TenantBranding {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      logoUrl: row.logo_url,
      faviconUrl: row.favicon_url,
      primaryColor: row.primary_color,
      secondaryColor: row.secondary_color,
      companyInfo: {
        name: row.company_name,
        address: row.company_address,
        phone: row.company_phone,
        email: row.company_email,
        website: row.company_website
      },
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  static toRow(branding: CreateBrandingRequest | UpdateBrandingRequest): Partial<TenantBrandingRow> {
    const row: Partial<TenantBrandingRow> = {};

    if ('tenantId' in branding) row.tenant_id = branding.tenantId;
    if (branding.logoUrl !== undefined) row.logo_url = branding.logoUrl;
    if (branding.faviconUrl !== undefined) row.favicon_url = branding.faviconUrl;
    if (branding.primaryColor !== undefined) row.primary_color = branding.primaryColor;
    if (branding.secondaryColor !== undefined) row.secondary_color = branding.secondaryColor;

    if (branding.companyInfo) {
      if (branding.companyInfo.name !== undefined) row.company_name = branding.companyInfo.name;
      if (branding.companyInfo.address !== undefined) row.company_address = branding.companyInfo.address;
      if (branding.companyInfo.phone !== undefined) row.company_phone = branding.companyInfo.phone;
      if (branding.companyInfo.email !== undefined) row.company_email = branding.companyInfo.email;
      if (branding.companyInfo.website !== undefined) row.company_website = branding.companyInfo.website;
    }

    return row;
  }
}