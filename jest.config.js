/** @type {import('jest').Config} */
const config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  // Only look for tests in src directory
  roots: ['<rootDir>/src'],
  testMatch: [
    '<rootDir>/src/**/*.test.ts',
    '<rootDir>/src/**/*.spec.ts',
  ],
  // Exclude standalone script files that aren't Jest tests
  testPathIgnorePatterns: [
    '/node_modules/',
    '/.next/',
    // Exclude standalone scripts in whatsapp-ai/__tests__ (these are manual test scripts, not Jest tests)
    '__tests__/monitoring-production\\.test\\.ts',
    '__tests__/load-stress\\.test\\.ts',
    '__tests__/terminal-prompt-history\\.test\\.ts',
    '__tests__/aimeow-comprehensive\\.test\\.ts',
    '__tests__/edge-cases\\.test\\.ts',
  ],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        module: 'commonjs',
        esModuleInterop: true,
        moduleResolution: 'node',
        strict: true,
        skipLibCheck: true,
      },
    }],
  },
  // Pass with no tests found (project uses manual test scripts)
  passWithNoTests: true,
};

module.exports = config;
