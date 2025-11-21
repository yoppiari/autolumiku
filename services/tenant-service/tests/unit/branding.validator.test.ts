/**
 * Unit Tests for Branding Validator
 *
 * Tests the validation functions for tenant branding data
 */

import {
  BrandingValidator,
  CreateBrandingRequest,
  DEFAULT_PRIMARY_COLOR,
  DEFAULT_SECONDARY_COLOR
} from '../../src/models/tenant-branding.model';

describe('BrandingValidator', () => {
  describe('isValidHexColor', () => {
    it('should validate correct hex colors', () => {
      expect(BrandingValidator.isValidHexColor('#FF0000')).toBe(true);
      expect(BrandingValidator.isValidHexColor('#00FF00')).toBe(true);
      expect(BrandingValidator.isValidHexColor('#0000FF')).toBe(true);
      expect(BrandingValidator.isValidHexColor('#123ABC')).toBe(true);
      expect(BrandingValidator.isValidHexColor('#abcdef')).toBe(true);
    });

    it('should reject invalid hex colors', () => {
      expect(BrandingValidator.isValidHexColor('FF0000')).toBe(false); // Missing #
      expect(BrandingValidator.isValidHexColor('#FF000')).toBe(false); // Too short
      expect(BrandingValidator.isValidHexColor('#FF00000')).toBe(false); // Too long
      expect(BrandingValidator.isValidHexColor('#GG0000')).toBe(false); // Invalid hex
      expect(BrandingValidator.isValidHexColor('#F0000')).toBe(false); // Too short
    });
  });

  describe('isValidPhoneNumber', () => {
    it('should validate correct phone numbers', () => {
      expect(BrandingValidator.isValidPhoneNumber('+628123456789')).toBe(true);
      expect(BrandingValidator.isValidPhoneNumber('08123456789')).toBe(true);
      expect(BrandingValidator.isValidPhoneNumber('(021) 123-4567')).toBe(true);
      expect(BrandingValidator.isValidPhoneNumber('+1 (555) 123-4567')).toBe(true);
    });

    it('should reject invalid phone numbers', () => {
      expect(BrandingValidator.isValidPhoneNumber('123')).toBe(false); // Too short
      expect(BrandingValidator.isValidPhoneNumber('abc')).toBe(false); // Non-numeric
      expect(BrandingValidator.isValidPhoneNumber('')).toBe(false); // Empty
    });
  });

  describe('isValidEmail', () => {
    it('should validate correct email addresses', () => {
      expect(BrandingValidator.isValidEmail('test@example.com')).toBe(true);
      expect(BrandingValidator.isValidEmail('user.name+tag@domain.co.uk')).toBe(true);
      expect(BrandingValidator.isValidEmail('user123@sub.domain.com')).toBe(true);
    });

    it('should reject invalid email addresses', () => {
      expect(BrandingValidator.isValidEmail('test@')).toBe(false); // Missing domain
      expect(BrandingValidator.isValidEmail('@example.com')).toBe(false); // Missing user
      expect(BrandingValidator.isValidEmail('test.example.com')).toBe(false); // Missing @
      expect(BrandingValidator.isValidEmail('')).toBe(false); // Empty
    });
  });

  describe('isValidWebsite', () => {
    it('should validate correct website URLs', () => {
      expect(BrandingValidator.isValidWebsite('https://example.com')).toBe(true);
      expect(BrandingValidator.isValidWebsite('http://www.example.com')).toBe(true);
      expect(BrandingValidator.isValidWebsite('https://sub.domain.co.uk')).toBe(true);
    });

    it('should reject invalid website URLs', () => {
      expect(BrandingValidator.isValidWebsite('example.com')).toBe(false); // Missing protocol
      expect(BrandingValidator.isValidWebsite('ftp://example.com')).toBe(false); // Invalid protocol
      expect(BrandingValidator.isValidWebsite('')).toBe(false); // Empty
    });
  });

  describe('validateColorContrast', () => {
    it('should detect good contrast ratios', () => {
      const result = BrandingValidator.validateColorContrast('#FFFFFF', '#000000');
      expect(result.isAccessible).toBe(true);
      expect(result.ratio).toBeGreaterThan(7); // High contrast
    });

    it('should detect poor contrast ratios', () => {
      const result = BrandingValidator.validateColorContrast('#CCCCCC', '#DDDDDD');
      expect(result.isAccessible).toBe(false);
      expect(result.ratio).toBeLessThan(4.5);
      expect(result.recommendation).toBeDefined();
    });

    it('should provide recommendation for poor contrast', () => {
      const result = BrandingValidator.validateColorContrast('#FF0000', '#CC0000');
      expect(result.isAccessible).toBe(false);
      expect(result.recommendation).toContain('higher contrast');
    });
  });

  describe('validateBrandingRequest', () => {
    it('should validate a correct branding request', () => {
      const validRequest: CreateBrandingRequest = {
        tenantId: 'tenant-123',
        primaryColor: '#FF0000',
        secondaryColor: '#00FF00',
        companyInfo: {
          name: 'Test Company',
          address: '123 Test St',
          phone: '+628123456789',
          email: 'test@example.com',
          website: 'https://example.com'
        }
      };

      const result = BrandingValidator.validateBrandingRequest(validRequest);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject request with missing required fields', () => {
      const invalidRequest: CreateBrandingRequest = {
        tenantId: '',
        companyInfo: {
          name: ''
        }
      };

      const result = BrandingValidator.validateBrandingRequest(invalidRequest);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors).toContain('Tenant ID is required');
      expect(result.errors).toContain('Company name is required');
    });

    it('should reject request with invalid colors', () => {
      const invalidRequest: CreateBrandingRequest = {
        tenantId: 'tenant-123',
        primaryColor: 'invalid-color',
        secondaryColor: 'also-invalid',
        companyInfo: {
          name: 'Test Company'
        }
      };

      const result = BrandingValidator.validateBrandingRequest(invalidRequest);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Primary color must be a valid hex color (#RRGGBB)');
      expect(result.errors).toContain('Secondary color must be a valid hex color (#RRGGBB)');
    });

    it('should reject request with invalid contact information', () => {
      const invalidRequest: CreateBrandingRequest = {
        tenantId: 'tenant-123',
        companyInfo: {
          name: 'Test Company',
          phone: 'invalid-phone',
          email: 'invalid-email',
          website: 'invalid-website'
        }
      };

      const result = BrandingValidator.validateBrandingRequest(invalidRequest);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid phone number format');
      expect(result.errors).toContain('Invalid email format');
      expect(result.errors).toContain('Invalid website URL format');
    });

    it('should accept partial updates with valid data', () => {
      const partialRequest: CreateBrandingRequest = {
        tenantId: 'tenant-123',
        companyInfo: {
          name: 'Test Company'
        }
      };

      const result = BrandingValidator.validateBrandingRequest(partialRequest);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle empty optional fields correctly', () => {
      const requestWithEmptyOptionals: CreateBrandingRequest = {
        tenantId: 'tenant-123',
        companyInfo: {
          name: 'Test Company',
          address: '',
          phone: '',
          email: '',
          website: ''
        }
      };

      const result = BrandingValidator.validateBrandingRequest(requestWithEmptyOptionals);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });
});