import { ValidationSchema, FieldValidation } from '../../types/onboarding';

/**
 * Onboarding Validation Service
 *
 * Provides validation functionality for onboarding step data
 */
export class ValidationService {
  /**
   * Validate data against validation schema
   */
  async validate(data: any, schema: ValidationSchema): Promise<{ isValid: boolean; errors: string[] }> {
    const errors: string[] = [];

    for (const [fieldName, fieldValidation] of Object.entries(schema.fields)) {
      const fieldErrors = await this.validateField(data[fieldName], fieldValidation, fieldName, data);
      errors.push(...fieldErrors);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate a single field
   */
  private async validateField(value: any, validation: FieldValidation, fieldName: string, context: any): Promise<string[]> {
    const errors: string[] = [];

    // Check if field is required
    if (validation.required && (value === undefined || value === null || value === '')) {
      errors.push(`${fieldName} is required`);
      return errors;
    }

    // If field is not required and empty, skip other validations
    if (!validation.required && (value === undefined || value === null || value === '')) {
      return errors;
    }

    // Type validation
    if (validation.type) {
      const typeError = this.validateType(value, validation.type, fieldName);
      if (typeError) {
        errors.push(typeError);
      }
    }

    // Length validation for strings
    if (typeof value === 'string') {
      if (validation.minLength !== undefined && value.length < validation.minLength) {
        errors.push(`${fieldName} must be at least ${validation.minLength} characters long`);
      }

      if (validation.maxLength !== undefined && value.length > validation.maxLength) {
        errors.push(`${fieldName} must not exceed ${validation.maxLength} characters`);
      }
    }

    // Pattern validation
    if (validation.pattern && typeof value === 'string') {
      const pattern = new RegExp(validation.pattern);
      if (!pattern.test(value)) {
        errors.push(`${fieldName} format is invalid`);
      }
    }

    // Options validation
    if (validation.options && Array.isArray(validation.options)) {
      if (!validation.options.includes(value)) {
        errors.push(`${fieldName} must be one of: ${validation.options.join(', ')}`);
      }
    }

    // Custom validation
    if (validation.custom && typeof validation.custom === 'function') {
      const customResult = validation.custom(value);
      if (customResult !== true) {
        errors.push(typeof customResult === 'string' ? customResult : `${fieldName} is invalid`);
      }
    }

    return errors;
  }

  /**
   * Validate field type
   */
  private validateType(value: any, type: string, fieldName: string): string | null {
    switch (type) {
      case 'string':
        if (typeof value !== 'string') {
          return `${fieldName} must be a string`;
        }
        break;

      case 'email':
        if (typeof value !== 'string' || !this.isValidEmail(value)) {
          return `${fieldName} must be a valid email address`;
        }
        break;

      case 'phone':
        if (typeof value !== 'string' || !this.isValidPhone(value)) {
          return `${fieldName} must be a valid phone number`;
        }
        break;

      case 'url':
        if (typeof value !== 'string' || !this.isValidUrl(value)) {
          return `${fieldName} must be a valid URL`;
        }
        break;

      case 'color':
        if (typeof value !== 'string' || !this.isValidColor(value)) {
          return `${fieldName} must be a valid color code`;
        }
        break;

      case 'file':
        if (typeof value !== 'object' || !value.type || !value.size) {
          return `${fieldName} must be a valid file`;
        }
        break;

      case 'array':
        if (!Array.isArray(value)) {
          return `${fieldName} must be an array`;
        }
        break;

      default:
        // Unknown type, skip validation
        break;
    }

    return null;
  }

  /**
   * Validate email format
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate phone number (Indonesian format)
   */
  private isValidPhone(phone: string): boolean {
    // Remove all non-digit characters
    const cleanPhone = phone.replace(/\D/g, '');

    // Check Indonesian phone number patterns
    const phoneRegex = /^(\+62|62|0)?[8-9][0-9]{7,11}$/;
    return phoneRegex.test(cleanPhone);
  }

  /**
   * Validate URL format
   */
  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate color code (hex format)
   */
  private isValidColor(color: string): boolean {
    const colorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
    return colorRegex.test(color);
  }
}

// Export singleton instance
export const validationService = new ValidationService();