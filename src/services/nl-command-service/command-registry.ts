/**
 * Command Registry
 * Epic 3: Story 3.1 - Register and manage command handlers
 *
 * Central registry for all available commands and their handlers
 */

import { CommandIntent, CommandRegistration } from './types';

// ============================================================================
// Command Registry Service
// ============================================================================

export class CommandRegistry {
  private handlers: Map<CommandIntent, CommandRegistration> = new Map();

  /**
   * Register a command handler
   */
  register(registration: CommandRegistration): void {
    this.handlers.set(registration.intent, registration);
  }

  /**
   * Register multiple handlers at once
   */
  registerMultiple(registrations: CommandRegistration[]): void {
    registrations.forEach(reg => this.register(reg));
  }

  /**
   * Get handler for an intent
   */
  getHandler(intent: CommandIntent): CommandRegistration | undefined {
    return this.handlers.get(intent);
  }

  /**
   * Get all registered handlers
   */
  getAllHandlers(): CommandRegistration[] {
    return Array.from(this.handlers.values());
  }

  /**
   * Get handlers by category
   */
  getHandlersByCategory(category: string): CommandRegistration[] {
    return this.getAllHandlers().filter(h => h.category === category);
  }

  /**
   * Get all available categories
   */
  getCategories(): string[] {
    const categories = new Set(this.getAllHandlers().map(h => h.category));
    return Array.from(categories);
  }

  /**
   * Check if intent is registered
   */
  has(intent: CommandIntent): boolean {
    return this.handlers.has(intent);
  }

  /**
   * Get all example commands
   */
  getAllExamples(): Array<{ category: string; examples: string[] }> {
    const categorizedExamples = new Map<string, Set<string>>();

    this.getAllHandlers().forEach(handler => {
      if (!categorizedExamples.has(handler.category)) {
        categorizedExamples.set(handler.category, new Set());
      }

      handler.examples.forEach(example => {
        categorizedExamples.get(handler.category)!.add(example);
      });
    });

    return Array.from(categorizedExamples.entries()).map(([category, examples]) => ({
      category,
      examples: Array.from(examples),
    }));
  }
}

// Export singleton instance
export const commandRegistry = new CommandRegistry();

// ============================================================================
// Initialize Built-in Command Handlers
// ============================================================================

// This will be populated by individual command files
// See: commands/inventory-commands.ts, commands/vehicle-search-commands.ts, etc.
