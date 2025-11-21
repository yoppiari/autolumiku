/**
 * Command Executor
 * Epic 3: Story 3.1 - Execute parsed commands and return results
 *
 * Orchestrates command execution using registered handlers
 */

import {
  CommandExecutionRequest,
  CommandExecutionResult,
  CommandIntent,
  CommandEntity,
  EntityType,
} from './types';
import { commandRegistry } from './command-registry';

// ============================================================================
// Command Executor Service
// ============================================================================

export class CommandExecutor {
  /**
   * Execute a parsed command
   */
  async execute(request: CommandExecutionRequest): Promise<CommandExecutionResult> {
    const startTime = Date.now();

    try {
      const { parsedCommand, tenantId, userId, context } = request;

      // Check if we have a handler for this intent
      const registration = commandRegistry.getHandler(parsedCommand.intent);

      if (!registration) {
        return this.createErrorResult(
          `Command "${parsedCommand.intent}" is not yet implemented`,
          'COMMAND_NOT_IMPLEMENTED',
          Date.now() - startTime
        );
      }

      // Validate required entities
      const missingEntities = this.validateRequiredEntities(
        parsedCommand.entities,
        registration.requiredEntities || []
      );

      if (missingEntities.length > 0) {
        return this.createErrorResult(
          `Missing required information: ${missingEntities.join(', ')}`,
          'MISSING_ENTITIES',
          Date.now() - startTime,
          [`Please provide: ${missingEntities.join(', ')}`]
        );
      }

      // Check permissions
      if (registration.requiredPermissions && registration.requiredPermissions.length > 0) {
        // TODO: Implement permission checking with user roles
        // For now, assume user has permissions
      }

      // Execute the command handler
      const result = await registration.handler(parsedCommand.entities, request);

      // Add execution time
      result.executionTime = Date.now() - startTime;

      return result;

    } catch (error: any) {
      console.error('Command execution error:', error);

      return this.createErrorResult(
        'An error occurred while executing the command',
        'EXECUTION_ERROR',
        Date.now() - startTime,
        ['Please try again or contact support if the problem persists']
      );
    }
  }

  /**
   * Validate that all required entities are present
   */
  private validateRequiredEntities(
    entities: CommandEntity[],
    requiredTypes: EntityType[]
  ): string[] {
    const missingTypes: string[] = [];
    const entityTypes = new Set(entities.map(e => e.type));

    for (const requiredType of requiredTypes) {
      if (!entityTypes.has(requiredType)) {
        missingTypes.push(this.getEntityTypeFriendlyName(requiredType));
      }
    }

    return missingTypes;
  }

  /**
   * Get user-friendly name for entity type
   */
  private getEntityTypeFriendlyName(type: EntityType): string {
    const names: Record<EntityType, string> = {
      [EntityType.VEHICLE_MAKE]: 'merek mobil',
      [EntityType.VEHICLE_MODEL]: 'model mobil',
      [EntityType.VEHICLE_YEAR]: 'tahun',
      [EntityType.VEHICLE_ID]: 'ID mobil',
      [EntityType.PRICE]: 'harga',
      [EntityType.PRICE_RANGE]: 'range harga',
      [EntityType.CATEGORY]: 'kategori',
      [EntityType.STATUS]: 'status',
      [EntityType.COLOR]: 'warna',
      [EntityType.TRANSMISSION]: 'transmisi',
      [EntityType.FUEL_TYPE]: 'jenis bahan bakar',
      [EntityType.QUANTITY]: 'jumlah',
      [EntityType.DATE]: 'tanggal',
      [EntityType.DATE_RANGE]: 'range tanggal',
      [EntityType.CUSTOMER_NAME]: 'nama customer',
      [EntityType.CONTACT]: 'kontak',
      [EntityType.LOCATION]: 'lokasi',
    };

    return names[type] || type;
  }

  /**
   * Create error result
   */
  private createErrorResult(
    message: string,
    code: string,
    executionTime: number,
    recoverySuggestions: string[] = []
  ): CommandExecutionResult {
    return {
      success: false,
      message,
      executionTime,
      error: {
        code,
        message,
        recoverySuggestions,
        canRetry: code !== 'COMMAND_NOT_IMPLEMENTED',
      },
    };
  }

  /**
   * Extract entity value by type
   */
  extractEntityValue<T = any>(entities: CommandEntity[], type: EntityType): T | undefined {
    const entity = entities.find(e => e.type === type);
    return entity?.value as T | undefined;
  }

  /**
   * Extract all entities of a type
   */
  extractAllEntities<T = any>(entities: CommandEntity[], type: EntityType): T[] {
    return entities
      .filter(e => e.type === type)
      .map(e => e.value as T);
  }
}

// Export singleton instance
export const commandExecutor = new CommandExecutor();
