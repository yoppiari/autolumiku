/**
 * Jest Test Setup
 *
 * Global configuration for unit tests
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error'; // Reduce log noise during tests

// Mock console methods for cleaner test output
global.console = {
  ...console,
  // Uncomment to ignore console.log during tests
  // log: jest.fn(),
  // debug: jest.fn(),
  // info: jest.fn(),
  // warn: jest.fn(),
  // error: jest.fn(),
};

// Add custom matchers if needed
expect.extend({
  toBeValidHexColor(received: string) {
    const hexColorRegex = /^#[0-9A-Fa-f]{6}$/;
    const pass = hexColorRegex.test(received);

    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid hex color`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid hex color (#RRGGBB)`,
        pass: false,
      };
    }
  },
});

// Extend Jest matchers type
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidHexColor(): R;
    }
  }
}