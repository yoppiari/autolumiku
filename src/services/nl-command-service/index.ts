/**
 * Natural Language Command Service - Main Export
 * Epic 3: Story 3.1 - Central export for all NL command services
 *
 * This file exports all services and initializes the command registry.
 */

// Core Services
export { commandParser } from './command-parser';
export { intentRecognizer } from './intent-recognizer';
export { commandExecutor } from './command-executor';
export { commandRegistry } from './command-registry';
export { helpSystem } from './help-system';
export { learningEngine } from './learning-engine';

// Command Handlers
export { registerInventoryCommands } from './commands/inventory-commands';
export { registerVehicleSearchCommands } from './commands/vehicle-search-commands';
export { registerPricingCommands } from './commands/pricing-commands';
export { registerCategoryCommands } from './commands/category-commands';
export { registerAnalyticsCommands } from './commands/analytics-commands';

// Types
export * from './types';

// Automotive Terms
export * from './indonesian-automotive-terms';

/**
 * Initialize all command handlers
 * Call this once during application startup
 */
export function initializeCommandHandlers() {
  const { registerInventoryCommands } = require('./commands/inventory-commands');
  const { registerVehicleSearchCommands } = require('./commands/vehicle-search-commands');
  const { registerPricingCommands } = require('./commands/pricing-commands');
  const { registerCategoryCommands } = require('./commands/category-commands');
  const { registerAnalyticsCommands } = require('./commands/analytics-commands');

  // Register all command handlers
  registerInventoryCommands();
  registerVehicleSearchCommands();
  registerPricingCommands();
  registerCategoryCommands();
  registerAnalyticsCommands();

  console.log('✅ All command handlers initialized');
}

// Auto-initialize if in Node.js environment (not during build)
if (typeof window === 'undefined' && process.env.NODE_ENV !== 'test') {
  // Run initialization in a try-catch to prevent build failures
  try {
    initializeCommandHandlers();
  } catch (error) {
    console.error('Failed to initialize command handlers:', error);
  }
}
