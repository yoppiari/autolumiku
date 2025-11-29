/**
 * Minimal Jest Setup
 * Mocks disabled to avoid Next.js environment issues
 * Add mocks back when writing actual component/integration tests
 */

// Global test timeout
jest.setTimeout(10000)

// Setup test environment
beforeEach(() => {
  // Clear all mocks before each test
  jest.clearAllMocks()
})