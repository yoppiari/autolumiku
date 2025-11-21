/**
 * Team Management Test Setup
 * Global test configuration and utilities for team management tests
 */

import { jest } from '@jest/globals';

// Mock console methods to reduce test noise
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/autolumiku_test';
process.env.JWT_SECRET = 'test-jwt-secret-key';
process.env.REDIS_URL = 'redis://localhost:6379/1';

// Mock Next.js headers and cookies
jest.mock('next/headers', () => ({
  headers: () => ({
    get: (name: string) => {
      const headers: Record<string, string> = {
        'authorization': 'Bearer test-token',
        'content-type': 'application/json',
        'x-tenant-id': 'test-tenant-123'
      };
      return headers[name.toLowerCase()] || null;
    }
  }),
  cookies: () => ({
    get: (name: string) => {
      const cookies: Record<string, string> = {
        'auth-token': 'test-token',
        'tenant-id': 'test-tenant-123'
      };
      return { value: cookies[name] || null };
    }
  })
}));

// Global test utilities
global.testUtils = {
  // Mock user data
  mockUser: {
    id: 'test-user-123',
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    tenantId: 'test-tenant-123'
  },

  // Mock role data
  mockRole: {
    id: 'test-role-123',
    name: 'test_role',
    displayName: 'Test Role',
    indonesianTitle: 'Peran Tes',
    description: 'A test role for testing',
    department: 'Management',
    roleLevel: 50,
    isSystem: false,
    isActive: true
  },

  // Mock team member data
  mockTeamMember: {
    id: 'test-member-123',
    userId: 'test-user-123',
    tenantId: 'test-tenant-123',
    isActive: true,
    position: 'Sales Executive',
    department: 'Sales',
    hireDate: new Date('2023-01-01')
  },

  // Mock permission data
  mockPermissions: [
    {
      id: 'perm-1',
      code: 'team.view_members',
      name: 'View Team Members',
      category: 'Team',
      description: 'Can view team member list'
    },
    {
      id: 'perm-2',
      code: 'team.manage_members',
      name: 'Manage Team Members',
      category: 'Team',
      description: 'Can manage team member accounts'
    },
    {
      id: 'perm-3',
      code: 'inventory.view',
      name: 'View Inventory',
      category: 'Inventory',
      description: 'Can view inventory listings'
    }
  ],

  // Helper to create mock request
  createMockRequest: (url: string, options: RequestInit = {}) => {
    const defaultHeaders = {
      'Authorization': 'Bearer test-token',
      'Content-Type': 'application/json',
      'X-Tenant-ID': 'test-tenant-123'
    };

    return new Request(url, {
      ...options,
      headers: { ...defaultHeaders, ...options.headers }
    });
  },

  // Helper to create mock database response
  createMockDbResponse: (data: any[], singleRow = false) => ({
    rows: data,
    rowCount: data.length,
    // Add mock methods if needed
    then: (resolve: (value: any) => any) => resolve(singleRow ? data[0] : data)
  }),

  // Helper to wait for async operations
  waitFor: (ms: number = 100) => new Promise(resolve => setTimeout(resolve, ms)),

  // Helper to generate test data
  generateTestData: {
    role: (overrides: Partial<any> = {}) => ({
      id: `role-${Math.random().toString(36).substr(2, 9)}`,
      name: `test_role_${Math.random().toString(36).substr(2, 9)}`,
      displayName: `Test Role ${Math.random().toString(36).substr(2, 9)}`,
      indonesianTitle: `Peran Tes ${Math.random().toString(36).substr(2, 9)}`,
      description: 'Generated test role',
      department: 'Management',
      roleLevel: Math.floor(Math.random() * 100) + 1,
      isSystem: false,
      isActive: true,
      ...overrides
    }),

    teamMember: (overrides: Partial<any> = {}) => ({
      id: `member-${Math.random().toString(36).substr(2, 9)}`,
      userId: `user-${Math.random().toString(36).substr(2, 9)}`,
      tenantId: 'test-tenant-123',
      isActive: true,
      position: 'Sales Executive',
      department: 'Sales',
      hireDate: new Date(),
      ...overrides
    }),

    performanceMetrics: (overrides: Partial<any> = {}) => ({
      memberId: `member-${Math.random().toString(36).substr(2, 9)}`,
      memberName: `Test User ${Math.random().toString(36).substr(2, 9)}`,
      role: 'Sales Executive',
      department: 'Sales',
      leadResponseTime: {
        average: Math.random() * 1000,
        median: Math.random() * 1000,
        best: Math.random() * 100,
        worst: Math.random() * 2000
      },
      inventoryUpdates: Math.floor(Math.random() * 20),
      customerInteractions: Math.floor(Math.random() * 50),
      appointmentsBooked: Math.floor(Math.random() * 15),
      salesClosed: Math.floor(Math.random() * 10),
      revenueGenerated: Math.random() * 100000,
      activityScore: Math.floor(Math.random() * 200),
      lastActiveTime: new Date(),
      ...overrides
    })
  }
};

// Extend global namespace with test utilities
declare global {
  var testUtils: typeof global.testUtils;
}

// Setup and teardown hooks
beforeEach(() => {
  // Clear all mocks before each test
  jest.clearAllMocks();

  // Reset mock implementations
  jest.restoreAllMocks();
});

afterEach(() => {
  // Clean up any test-specific setup
  jest.clearAllTimers();
  jest.useRealTimers();
});

// Global error handler for unhandled promise rejections in tests
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection in tests:', reason);
});

// Global timeout for all tests
jest.setTimeout(30000); // 30 seconds

// Export test utilities for use in test files
export { global.testUtils as testUtils };