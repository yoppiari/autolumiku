/**
 * Onboarding Validation Tests
 *
 * Tests for the validation service and schema validation
 */

import { ValidationService } from '../src/services/onboarding-service/validation';
import { ValidationSchema } from '../src/types/onboarding';

describe('ValidationService', () => {
  let validationService: ValidationService;

  beforeEach(() => {
    validationService = new ValidationService();
  });

  describe('validate method', () => {
    it('should validate data with all required fields present', async () => {
      const schema: ValidationSchema = {
        fields: {
          name: {
            required: true,
            type: 'string',
            minLength: 3
          },
          email: {
            required: true,
            type: 'email'
          }
        }
      };

      const data = {
        name: 'Test User',
        email: 'test@example.com'
      };

      const result = await validationService.validate(data, schema);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return errors for missing required fields', async () => {
      const schema: ValidationSchema = {
        fields: {
          name: {
            required: true,
            type: 'string',
            minLength: 3
          },
          email: {
            required: true,
            type: 'email'
          }
        }
      };

      const data = {
        name: 'Test User'
        // Missing required email
      };

      const result = await validationService.validate(data, schema);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('email is required');
    });

    it('should validate email format', async () => {
      const schema: ValidationSchema = {
        fields: {
          email: {
            required: true,
            type: 'email'
          }
        }
      };

      const invalidEmails = [
        'invalid-email',
        'test@',
        '@example.com',
        'test.example.com'
      ];

      for (const email of invalidEmails) {
        const result = await validationService.validate({ email }, schema);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('email must be a valid email address');
      }

      const validEmails = [
        'test@example.com',
        'user.name@domain.co.uk',
        'user+tag@example.org'
      ];

      for (const email of validEmails) {
        const result = await validationService.validate({ email }, schema);
        expect(result.isValid).toBe(true);
      }
    });

    it('should validate phone number format (Indonesian)', async () => {
      const schema: ValidationSchema = {
        fields: {
          phone: {
            required: true,
            type: 'phone'
          }
        }
      };

      const validPhones = [
        '+628123456789',
        '628123456789',
        '08123456789',
        '0812-3456-789'
      ];

      for (const phone of validPhones) {
        const result = await validationService.validate({ phone }, schema);
        expect(result.isValid).toBe(true);
      }

      const invalidPhones = [
        '123456789',
        '0812345678', // Too short
        '081234567891', // Too long
        '03123456789' // Invalid prefix
      ];

      for (const phone of invalidPhones) {
        const result = await validationService.validate({ phone }, schema);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('phone must be a valid phone number');
      }
    });

    it('should validate URL format', async () => {
      const schema: ValidationSchema = {
        fields: {
          website: {
            required: false,
            type: 'url'
          }
        }
      };

      const validUrls = [
        'https://example.com',
        'http://example.com',
        'https://www.example.com',
        'https://example.com/path?query=value'
      ];

      for (const url of validUrls) {
        const result = await validationService.validate({ website: url }, schema);
        expect(result.isValid).toBe(true);
      }

      const invalidUrls = [
        'example.com',
        'ftp://example.com',
        'not-a-url'
      ];

      for (const url of invalidUrls) {
        const result = await validationService.validate({ website: url }, schema);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('website must be a valid URL');
      }
    });

    it('should validate color format (hex)', async () => {
      const schema: ValidationSchema = {
        fields: {
          color: {
            required: false,
            type: 'color'
          }
        }
      };

      const validColors = [
        '#FF0000',
        '#ff0000',
        '#123ABC',
        '#123abc'
      ];

      for (const color of validColors) {
        const result = await validationService.validate({ color }, schema);
        expect(result.isValid).toBe(true);
      }

      const invalidColors = [
        'FF0000',
        '#FF000',
        '#GGGGGG',
        'red',
        'rgb(255,0,0)'
      ];

      for (const color of invalidColors) {
        const result = await validationService.validate({ color }, schema);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('color must be a valid color code');
      }
    });

    it('should validate string length constraints', async () => {
      const schema: ValidationSchema = {
        fields: {
          shortField: {
            required: true,
            type: 'string',
            minLength: 3,
            maxLength: 10
          }
        }
      };

      // Test minimum length
      const tooShortResult = await validationService.validate({ shortField: 'ab' }, schema);
      expect(tooShortResult.isValid).toBe(false);
      expect(tooShortResult.errors).toContain('shortField must be at least 3 characters long');

      // Test maximum length
      const tooLongResult = await validationService.validate({ shortField: 'this is too long' }, schema);
      expect(tooLongResult.isValid).toBe(false);
      expect(tooLongResult.errors).toContain('shortField must not exceed 10 characters');

      // Test valid length
      const validResult = await validationService.validate({ shortField: 'valid' }, schema);
      expect(validResult.isValid).toBe(true);
    });

    it('should validate pattern matching', async () => {
      const schema: ValidationSchema = {
        fields: {
          postalCode: {
            required: true,
            type: 'string',
            pattern: '^[0-9]{5}$'
          }
        }
      };

      const validPostalCodes = ['12345', '00000', '99999'];
      for (const code of validPostalCodes) {
        const result = await validationService.validate({ postalCode: code }, schema);
        expect(result.isValid).toBe(true);
      }

      const invalidPostalCodes = ['1234', '123456', 'abcde', '12a45'];
      for (const code of invalidPostalCodes) {
        const result = await validationService.validate({ postalCode: code }, schema);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('postalCode format is invalid');
      }
    });

    it('should validate against allowed options', async () => {
      const schema: ValidationSchema = {
        fields: {
          showroomType: {
            required: true,
            type: 'string',
            options: ['new_car', 'used_car', 'both']
          }
        }
      };

      const validOptions = ['new_car', 'used_car', 'both'];
      for (const option of validOptions) {
        const result = await validationService.validate({ showroomType: option }, schema);
        expect(result.isValid).toBe(true);
      }

      const invalidOptions = ['truck', 'motorcycle', ''];
      for (const option of invalidOptions) {
        const result = await validationService.validate({ showroomType: option }, schema);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('showroomType must be one of: new_car, used_car, both');
      }
    });

    it('should skip validation for optional empty fields', async () => {
      const schema: ValidationSchema = {
        fields: {
          requiredField: {
            required: true,
            type: 'string'
          },
          optionalField: {
            required: false,
            type: 'string',
            minLength: 5
          }
        }
      };

      const data = {
        requiredField: 'present',
        optionalField: '' // Empty but optional
      };

      const result = await validationService.validate(data, schema);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate custom validation functions', async () => {
      const schema: ValidationSchema = {
        fields: {
          file: {
            required: false,
            type: 'file',
            custom: (value: any) => {
              if (!value) return true; // Optional
              return value.type === 'image/png' && value.size <= 1024 * 1024; // 1MB PNG max
            }
          }
        }
      };

      // Valid file
      const validFile = {
        type: 'image/png',
        size: 500 * 1024 // 500KB
      };
      const validResult = await validationService.validate({ file: validFile }, schema);
      expect(validResult.isValid).toBe(true);

      // Invalid file type
      const invalidTypeFile = {
        type: 'application/pdf',
        size: 500 * 1024
      };
      const invalidTypeResult = await validationService.validate({ file: invalidTypeFile }, schema);
      expect(invalidTypeResult.isValid).toBe(false);

      // Invalid file size
      const invalidSizeFile = {
        type: 'image/png',
        size: 2 * 1024 * 1024 // 2MB
      };
      const invalidSizeResult = await validationService.validate({ file: invalidSizeFile }, schema);
      expect(invalidSizeResult.isValid).toBe(false);
    });
  });

  describe('complex validation scenarios', () => {
    it('should handle showroom basic info validation', async () => {
      const schema: ValidationSchema = {
        fields: {
          showroomName: {
            required: true,
            type: 'string',
            minLength: 3,
            maxLength: 100,
            pattern: '^[a-zA-Z0-9\\s\\-\\.]+$'
          },
          showroomType: {
            required: true,
            type: 'string',
            options: ['new_car', 'used_car', 'both']
          },
          contactEmail: {
            required: true,
            type: 'email'
          },
          phoneNumber: {
            required: true,
            type: 'phone'
          },
          address: {
            required: true,
            type: 'string',
            minLength: 10,
            maxLength: 500
          },
          city: {
            required: true,
            type: 'string',
            minLength: 2,
            maxLength: 50
          },
          province: {
            required: true,
            type: 'string',
            minLength: 2,
            maxLength: 50
          },
          postalCode: {
            required: true,
            type: 'string',
            pattern: '^[0-9]{5}$'
          },
          website: {
            required: false,
            type: 'url'
          }
        }
      };

      const validData = {
        showroomName: 'Test Showroom',
        showroomType: 'used_car',
        contactEmail: 'test@showroom.com',
        phoneNumber: '+628123456789',
        address: 'Jl. Test Address No. 123, Jakarta',
        city: 'Jakarta',
        province: 'DKI Jakarta',
        postalCode: '12345',
        website: 'https://testshowroom.com'
      };

      const result = await validationService.validate(validData, schema);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);

      // Test with multiple errors
      const invalidData = {
        showroomName: 'A', // Too short
        showroomType: 'invalid',
        contactEmail: 'not-an-email',
        phoneNumber: '123',
        address: 'Short',
        city: '',
        province: '',
        postalCode: '123',
        website: 'not-a-url'
      };

      const invalidResult = await validationService.validate(invalidData, schema);
      expect(invalidResult.isValid).toBe(false);
      expect(invalidResult.errors.length).toBeGreaterThan(5);
    });
  });
});