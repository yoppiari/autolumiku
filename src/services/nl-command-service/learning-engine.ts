/**
 * Learning Engine
 * Epic 3: Story 3.5 - Learn user patterns and provide personalized suggestions
 *
 * Tracks command usage, analyzes patterns, and adapts suggestions
 * based on user behavior and context.
 */

import { PrismaClient } from '@prisma/client';
import {
  CommandIntent,
  EntityType,
  CommandEntity,
  ParsedCommand,
} from './types';

const prisma = new PrismaClient();

export interface CommandUsagePattern {
  intent: CommandIntent;
  frequency: number;
  lastUsed: Date;
  avgExecutionTime: number;
  successRate: number;
  commonEntities: Array<{
    type: EntityType;
    value: string;
    frequency: number;
  }>;
}

export interface UserPreference {
  userId: string;
  tenantId: string;
  preferredCommands: CommandIntent[];
  timeOfDayPatterns: Array<{
    hour: number;
    commands: CommandIntent[];
  }>;
  contextualPatterns: Array<{
    context: string;
    commands: CommandIntent[];
  }>;
}

export interface PersonalizedSuggestion {
  command: string;
  intent: CommandIntent;
  confidence: number;
  reason: 'frequent' | 'time_based' | 'context_based' | 'popular';
  description: string;
}

export class LearningEngine {
  /**
   * Track command execution for learning
   */
  async trackCommandExecution(
    tenantId: string,
    userId: string,
    command: ParsedCommand,
    success: boolean,
    executionTimeMs: number,
    context?: Record<string, any>
  ): Promise<void> {
    try {
      await prisma.commandHistory.create({
        data: {
          tenantId,
          userId,
          originalCommand: command.originalCommand,
          intent: command.intent,
          confidence: command.confidence,
          entities: JSON.stringify(command.entities),
          success,
          executionTimeMs,
          context: context ? JSON.stringify(context) : null,
          timestamp: new Date(),
        },
      });

      // Update user preferences asynchronously
      this.updateUserPreferences(tenantId, userId, command).catch(err => {
        console.error('Failed to update user preferences:', err);
      });
    } catch (error) {
      console.error('Failed to track command execution:', error);
      // Don't throw - tracking shouldn't break the main flow
    }
  }

  /**
   * Get personalized command suggestions for a user
   */
  async getPersonalizedSuggestions(
    tenantId: string,
    userId: string,
    limit: number = 10,
    context?: {
      timeOfDay?: Date;
      currentPage?: string;
      recentActions?: string[];
    }
  ): Promise<PersonalizedSuggestion[]> {
    const suggestions: PersonalizedSuggestion[] = [];

    // Get user patterns
    const patterns = await this.getUserPatterns(tenantId, userId);

    // Get popular commands in tenant
    const popularCommands = await this.getPopularCommands(tenantId, 10);

    // 1. Frequent commands (highest priority)
    const frequentSuggestions = this.getFrequentCommandSuggestions(
      patterns,
      3
    );
    suggestions.push(...frequentSuggestions);

    // 2. Time-based suggestions
    if (context?.timeOfDay) {
      const timeBased = await this.getTimeBasedSuggestions(
        tenantId,
        userId,
        context.timeOfDay,
        2
      );
      suggestions.push(...timeBased);
    }

    // 3. Context-based suggestions
    if (context?.currentPage || context?.recentActions) {
      const contextBased = await this.getContextBasedSuggestions(
        tenantId,
        userId,
        context,
        2
      );
      suggestions.push(...contextBased);
    }

    // 4. Popular commands (lower priority)
    const popularSuggestions = this.getPopularCommandSuggestions(
      popularCommands,
      3
    );
    suggestions.push(...popularSuggestions);

    // Remove duplicates and sort by confidence
    const uniqueSuggestions = this.deduplicateSuggestions(suggestions);

    return uniqueSuggestions
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, limit);
  }

  /**
   * Get usage patterns for a specific user
   */
  async getUserPatterns(
    tenantId: string,
    userId: string
  ): Promise<CommandUsagePattern[]> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const history = await prisma.commandHistory.findMany({
      where: {
        tenantId,
        userId,
        timestamp: { gte: thirtyDaysAgo },
      },
      orderBy: { timestamp: 'desc' },
    });

    // Group by intent
    const intentMap = new Map<CommandIntent, any[]>();

    history.forEach(record => {
      const intent = record.intent as CommandIntent;
      if (!intentMap.has(intent)) {
        intentMap.set(intent, []);
      }
      intentMap.get(intent)!.push(record);
    });

    // Calculate patterns
    const patterns: CommandUsagePattern[] = [];

    intentMap.forEach((records, intent) => {
      const frequency = records.length;
      const lastUsed = new Date(records[0].timestamp);

      const successCount = records.filter(r => r.success).length;
      const successRate = successCount / frequency;

      const avgExecutionTime = records.reduce(
        (sum, r) => sum + (r.executionTimeMs || 0),
        0
      ) / frequency;

      // Extract common entities
      const entityMap = new Map<string, Map<string, number>>();

      records.forEach(record => {
        try {
          const entities = JSON.parse(record.entities || '[]') as CommandEntity[];
          entities.forEach(entity => {
            if (!entityMap.has(entity.type)) {
              entityMap.set(entity.type, new Map());
            }
            const valueMap = entityMap.get(entity.type)!;
            const currentCount = valueMap.get(entity.value) || 0;
            valueMap.set(entity.value, currentCount + 1);
          });
        } catch (err) {
          // Skip invalid JSON
        }
      });

      const commonEntities: Array<{
        type: EntityType;
        value: string;
        frequency: number;
      }> = [];

      entityMap.forEach((valueMap, type) => {
        valueMap.forEach((freq, value) => {
          commonEntities.push({
            type: type as EntityType,
            value,
            frequency: freq,
          });
        });
      });

      // Sort by frequency and take top 5
      commonEntities.sort((a, b) => b.frequency - a.frequency);
      commonEntities.splice(5);

      patterns.push({
        intent,
        frequency,
        lastUsed,
        avgExecutionTime,
        successRate,
        commonEntities,
      });
    });

    // Sort by frequency
    patterns.sort((a, b) => b.frequency - a.frequency);

    return patterns;
  }

  /**
   * Get popular commands across entire tenant
   */
  async getPopularCommands(
    tenantId: string,
    limit: number = 10
  ): Promise<Array<{ intent: CommandIntent; count: number }>> {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const history = await prisma.commandHistory.findMany({
      where: {
        tenantId,
        timestamp: { gte: sevenDaysAgo },
        success: true,
      },
      select: {
        intent: true,
      },
    });

    // Count by intent
    const intentCounts = new Map<CommandIntent, number>();

    history.forEach(record => {
      const intent = record.intent as CommandIntent;
      intentCounts.set(intent, (intentCounts.get(intent) || 0) + 1);
    });

    // Convert to array and sort
    const popular = Array.from(intentCounts.entries())
      .map(([intent, count]) => ({ intent, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);

    return popular;
  }

  /**
   * Predict next likely command based on recent history
   */
  async predictNextCommand(
    tenantId: string,
    userId: string,
    recentCommands: CommandIntent[]
  ): Promise<CommandIntent | null> {
    if (recentCommands.length === 0) return null;

    // Get command sequences from history
    const history = await prisma.commandHistory.findMany({
      where: {
        tenantId,
        userId,
        success: true,
      },
      orderBy: { timestamp: 'desc' },
      take: 100,
      select: {
        intent: true,
        timestamp: true,
      },
    });

    if (history.length < 10) return null; // Not enough data

    // Build sequence map: current intent -> next intent frequency
    const sequenceMap = new Map<CommandIntent, Map<CommandIntent, number>>();

    for (let i = 0; i < history.length - 1; i++) {
      const current = history[i].intent as CommandIntent;
      const next = history[i + 1].intent as CommandIntent;

      if (!sequenceMap.has(current)) {
        sequenceMap.set(current, new Map());
      }

      const nextMap = sequenceMap.get(current)!;
      nextMap.set(next, (nextMap.get(next) || 0) + 1);
    }

    // Find most likely next command based on most recent command
    const lastCommand = recentCommands[recentCommands.length - 1];
    const nextCandidates = sequenceMap.get(lastCommand);

    if (!nextCandidates || nextCandidates.size === 0) return null;

    // Get highest frequency next command
    let maxCount = 0;
    let predictedNext: CommandIntent | null = null;

    nextCandidates.forEach((count, intent) => {
      if (count > maxCount) {
        maxCount = count;
        predictedNext = intent;
      }
    });

    return predictedNext;
  }

  /**
   * Update user preferences based on command execution
   */
  private async updateUserPreferences(
    tenantId: string,
    userId: string,
    command: ParsedCommand
  ): Promise<void> {
    const now = new Date();
    const hour = now.getHours();

    await prisma.userCommandPreference.upsert({
      where: {
        userId_tenantId_intent: {
          userId,
          tenantId,
          intent: command.intent,
        },
      },
      update: {
        frequency: { increment: 1 },
        lastUsed: now,
      },
      create: {
        userId,
        tenantId,
        intent: command.intent,
        frequency: 1,
        lastUsed: now,
        timeOfDayPattern: JSON.stringify({ [hour]: 1 }),
      },
    });
  }

  /**
   * Get suggestions based on frequent commands
   */
  private getFrequentCommandSuggestions(
    patterns: CommandUsagePattern[],
    limit: number
  ): PersonalizedSuggestion[] {
    return patterns
      .slice(0, limit)
      .map(pattern => ({
        command: this.generateCommandExample(pattern),
        intent: pattern.intent,
        confidence: Math.min(0.95, pattern.successRate * 0.9 + 0.05),
        reason: 'frequent' as const,
        description: `Anda sering menggunakan perintah ini (${pattern.frequency}x)`,
      }));
  }

  /**
   * Get time-based suggestions
   */
  private async getTimeBasedSuggestions(
    tenantId: string,
    userId: string,
    timeOfDay: Date,
    limit: number
  ): Promise<PersonalizedSuggestion[]> {
    const hour = timeOfDay.getHours();
    const hourWindow = 2; // Look at +/- 2 hours

    const preferences = await prisma.userCommandPreference.findMany({
      where: {
        tenantId,
        userId,
      },
      orderBy: { frequency: 'desc' },
    });

    const suggestions: PersonalizedSuggestion[] = [];

    for (const pref of preferences) {
      try {
        const timePattern = JSON.parse(pref.timeOfDayPattern || '{}');

        // Check if this command is frequently used around this time
        let frequencyAtTime = 0;
        for (let h = hour - hourWindow; h <= hour + hourWindow; h++) {
          const normalizedHour = ((h % 24) + 24) % 24;
          frequencyAtTime += timePattern[normalizedHour] || 0;
        }

        if (frequencyAtTime > 0) {
          suggestions.push({
            command: this.generateCommandExampleForIntent(pref.intent as CommandIntent),
            intent: pref.intent as CommandIntent,
            confidence: Math.min(0.85, frequencyAtTime / pref.frequency),
            reason: 'time_based',
            description: `Biasanya Anda gunakan sekitar jam ${hour}:00`,
          });
        }
      } catch (err) {
        // Skip invalid JSON
      }
    }

    return suggestions.slice(0, limit);
  }

  /**
   * Get context-based suggestions
   */
  private async getContextBasedSuggestions(
    tenantId: string,
    userId: string,
    context: {
      currentPage?: string;
      recentActions?: string[];
    },
    limit: number
  ): Promise<PersonalizedSuggestion[]> {
    const suggestions: PersonalizedSuggestion[] = [];

    // Page-specific suggestions
    if (context.currentPage === 'inventory') {
      suggestions.push({
        command: 'Tampilkan semua mobil',
        intent: CommandIntent.LIST_VEHICLES,
        confidence: 0.75,
        reason: 'context_based',
        description: 'Relevan dengan halaman inventory',
      });
    } else if (context.currentPage === 'analytics') {
      suggestions.push({
        command: 'Tampilkan analytics',
        intent: CommandIntent.VIEW_ANALYTICS,
        confidence: 0.75,
        reason: 'context_based',
        description: 'Relevan dengan halaman analytics',
      });
    }

    // Recent action predictions
    if (context.recentActions && context.recentActions.length > 0) {
      const recentIntents = context.recentActions
        .map(action => this.actionToIntent(action))
        .filter(intent => intent !== null) as CommandIntent[];

      if (recentIntents.length > 0) {
        const predicted = await this.predictNextCommand(
          tenantId,
          userId,
          recentIntents
        );

        if (predicted) {
          suggestions.push({
            command: this.generateCommandExampleForIntent(predicted),
            intent: predicted,
            confidence: 0.70,
            reason: 'context_based',
            description: 'Biasanya Anda lakukan setelah aksi sebelumnya',
          });
        }
      }
    }

    return suggestions.slice(0, limit);
  }

  /**
   * Get suggestions from popular commands
   */
  private getPopularCommandSuggestions(
    popularCommands: Array<{ intent: CommandIntent; count: number }>,
    limit: number
  ): PersonalizedSuggestion[] {
    const maxCount = popularCommands[0]?.count || 1;

    return popularCommands
      .slice(0, limit)
      .map(({ intent, count }) => ({
        command: this.generateCommandExampleForIntent(intent),
        intent,
        confidence: Math.min(0.65, (count / maxCount) * 0.6 + 0.05),
        reason: 'popular' as const,
        description: `Populer di tim Anda (${count} pengguna)`,
      }));
  }

  /**
   * Remove duplicate suggestions
   */
  private deduplicateSuggestions(
    suggestions: PersonalizedSuggestion[]
  ): PersonalizedSuggestion[] {
    const seen = new Set<CommandIntent>();
    const unique: PersonalizedSuggestion[] = [];

    for (const suggestion of suggestions) {
      if (!seen.has(suggestion.intent)) {
        seen.add(suggestion.intent);
        unique.push(suggestion);
      }
    }

    return unique;
  }

  /**
   * Generate example command from pattern
   */
  private generateCommandExample(pattern: CommandUsagePattern): string {
    // Use most common entities if available
    const baseCommand = this.getIntentBaseCommand(pattern.intent);

    if (pattern.commonEntities.length > 0) {
      const entity = pattern.commonEntities[0];
      return `${baseCommand} ${entity.value}`;
    }

    return baseCommand;
  }

  /**
   * Generate example command for intent
   */
  private generateCommandExampleForIntent(intent: CommandIntent): string {
    return this.getIntentBaseCommand(intent);
  }

  /**
   * Get base command text for intent
   */
  private getIntentBaseCommand(intent: CommandIntent): string {
    const commandMap: Record<CommandIntent, string> = {
      [CommandIntent.LIST_VEHICLES]: 'Tampilkan semua mobil',
      [CommandIntent.SEARCH_VEHICLE]: 'Cari mobil',
      [CommandIntent.VIEW_VEHICLE]: 'Lihat detail mobil',
      [CommandIntent.UPLOAD_VEHICLE]: 'Upload mobil baru',
      [CommandIntent.UPDATE_VEHICLE]: 'Update informasi mobil',
      [CommandIntent.DELETE_VEHICLE]: 'Hapus mobil',
      [CommandIntent.UPDATE_PRICE]: 'Update harga mobil',
      [CommandIntent.MARK_AS_SOLD]: 'Tandai mobil sebagai terjual',
      [CommandIntent.MARK_AS_BOOKED]: 'Tandai mobil sebagai booking',
      [CommandIntent.MARK_AS_AVAILABLE]: 'Tandai mobil tersedia',
      [CommandIntent.VIEW_ANALYTICS]: 'Tampilkan analytics',
      [CommandIntent.GENERATE_REPORT]: 'Generate laporan',
      [CommandIntent.EXPORT_DATA]: 'Export data',
      [CommandIntent.VIEW_CUSTOMER_LEADS]: 'Lihat customer leads',
      [CommandIntent.VIEW_SALES_HISTORY]: 'Lihat riwayat penjualan',
      [CommandIntent.CALCULATE_COMMISSION]: 'Hitung komisi',
      [CommandIntent.VIEW_INVENTORY_VALUE]: 'Lihat nilai inventory',
      [CommandIntent.VIEW_TOP_SELLING]: 'Lihat mobil terlaris',
      [CommandIntent.COMPARE_VEHICLES]: 'Bandingkan mobil',
      [CommandIntent.GET_HELP]: 'Bantuan',
      [CommandIntent.SHOW_EXAMPLES]: 'Tampilkan contoh perintah',
    };

    return commandMap[intent] || 'Perintah';
  }

  /**
   * Convert action string to intent
   */
  private actionToIntent(action: string): CommandIntent | null {
    const actionMap: Record<string, CommandIntent> = {
      'view_vehicle': CommandIntent.VIEW_VEHICLE,
      'search': CommandIntent.SEARCH_VEHICLE,
      'update_price': CommandIntent.UPDATE_PRICE,
      'upload': CommandIntent.UPLOAD_VEHICLE,
      'view_analytics': CommandIntent.VIEW_ANALYTICS,
    };

    return actionMap[action] || null;
  }
}

export const learningEngine = new LearningEngine();
