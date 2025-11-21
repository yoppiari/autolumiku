/**
 * Jest Configuration for Team Management Tests
 * Extended configuration for comprehensive testing coverage
 */

const baseConfig = require('./jest.config.js');

module.exports = {
  ...baseConfig,
  displayName: 'team-management',
  testMatch: [
    '<rootDir>/src/tests/unit/team-management/**/*.test.ts',
    '<rootDir>/src/tests/integration/team-management/**/*.test.ts',
    '<rootDir>/src/tests/security/**/*.test.ts'
  ],
  collectCoverageFrom: [
    'src/services/team-management-service/**/*.{js,ts,jsx,tsx}',
    'src/services/rbac-service/**/*.{js,ts,jsx,tsx}',
    'src/services/team-analytics-service/**/*.{js,ts,jsx,tsx}',
    'src/services/invitation-service/**/*.{js,ts,jsx,tsx}',
    'src/app/api/team/**/*.{js,ts,jsx,tsx}',
    'src/components/team/**/*.{js,ts,jsx,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.stories.{js,ts,jsx,tsx}',
    '!src/**/index.ts'
  ],
  coverageThreshold: {
    global: {
      branches: 85,
      functions: 90,
      lines: 90,
      statements: 90
    },
    './src/services/team-management-service/': {
      branches: 90,
      functions: 95,
      lines: 95,
      statements: 95
    },
    './src/services/rbac-service/': {
      branches: 90,
      functions: 95,
      lines: 95,
      statements: 95
    },
    './src/app/api/team/': {
      branches: 80,
      functions: 85,
      lines: 85,
      statements: 85
    }
  },
  setupFilesAfterEnv: [
    '<rootDir>/src/tests/setup/team-test-setup.ts'
  ],
  testEnvironment: 'node',
  transformIgnorePatterns: [
    'node_modules/(?!(.*\\.mjs$))'
  ],
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },
  testTimeout: 30000, // 30 seconds for integration tests
  maxWorkers: 4, // Limit parallel workers for database tests
  reporters: [
    'default',
    [
      'jest-junit',
      {
        outputDirectory: 'test-results',
        outputName: 'team-management-junit.xml',
        classNameTemplate: '{classname}',
        titleTemplate: '{title}',
        ancestorSeparator: ' › ',
        usePathForSuiteName: true
      }
    ],
    [
      'jest-html-reporters',
      {
        publicPath: './test-results',
        filename: 'team-management-report.html',
        expand: true
      }
    ]
  ]
};