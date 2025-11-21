/**
 * Help System & Error Recovery
 * Epic 3: Story 3.4 - Contextual help and command suggestions
 *
 * Provides intelligent help based on context and user needs
 */

import { HelpRequest, HelpResponse, HelpExample, CommandSuggestion, CommandIntent } from './types';
import { commandRegistry } from './command-registry';

// ============================================================================
// Help System Service
// ============================================================================

export class HelpSystem {
  /**
   * Get help based on request
   */
  async getHelp(request: HelpRequest): Promise<HelpResponse> {
    const { topic, context } = request;

    if (topic) {
      // Specific topic help
      return this.getTopicHelp(topic);
    }

    // General help
    return this.getGeneralHelp(context);
  }

  /**
   * Get general help with all available commands
   */
  private getGeneralHelp(context?: HelpRequest['context']): HelpResponse {
    const categories = commandRegistry.getCategories();
    const allExamples = commandRegistry.getAllExamples();

    const content = `
# Bantuan Command Center AutoLumiKu

Anda dapat mengontrol showroom Anda menggunakan perintah dalam Bahasa Indonesia.

## Kategori Perintah:

${categories.map(cat => `- **${this.getCategoryName(cat)}**`).join('\n')}

## Cara Menggunakan:

1. Ketik perintah dalam Bahasa Indonesia secara natural
2. Atau gunakan tombol microphone untuk voice command
3. Sistem akan memahami intent Anda dan mengeksekusi perintah

## Contoh Perintah Umum:

${this.getTopExamples(10).map(e => `- ${e.command}`).join('\n')}

Ketik "help [kategori]" untuk melihat perintah dalam kategori tertentu.
Contoh: "help upload", "help search", "help pricing"
    `.trim();

    return {
      content,
      relatedCommands: this.getPopularCommands(),
      examples: this.getTopExamples(20),
      categories,
    };
  }

  /**
   * Get help for specific topic
   */
  private getTopicHelp(topic: string): HelpResponse {
    const normalizedTopic = topic.toLowerCase();

    // Map topic to category or intent
    const categoryMap: Record<string, string> = {
      'upload': 'Vehicle Management',
      'search': 'Vehicle Management',
      'cari': 'Vehicle Management',
      'price': 'Pricing',
      'harga': 'Pricing',
      'pricing': 'Pricing',
      'category': 'Organization',
      'kategori': 'Organization',
      'lead': 'Customer Management',
      'customer': 'Customer Management',
      'analytics': 'Analytics',
      'laporan': 'Analytics',
    };

    const category = categoryMap[normalizedTopic];

    if (category) {
      return this.getCategoryHelp(category);
    }

    // Fallback to general help
    return this.getGeneralHelp();
  }

  /**
   * Get help for specific category
   */
  private getCategoryHelp(category: string): HelpResponse {
    const handlers = commandRegistry.getHandlersByCategory(category);

    const examples: HelpExample[] = [];
    handlers.forEach(handler => {
      handler.examples.forEach(ex => {
        examples.push({
          command: ex,
          description: handler.description,
          category: handler.category,
        });
      });
    });

    const content = `
# ${this.getCategoryName(category)}

${handlers.map(h => `
## ${h.description}

**Contoh:**
${h.examples.map(ex => `- ${ex}`).join('\n')}
`).join('\n')}
    `.trim();

    return {
      content,
      relatedCommands: this.getRelatedCommands(category),
      examples,
    };
  }

  /**
   * Get popular/frequently used commands
   */
  private getPopularCommands(): CommandSuggestion[] {
    const popularIntents = [
      CommandIntent.UPLOAD_VEHICLE,
      CommandIntent.SEARCH_VEHICLE,
      CommandIntent.UPDATE_PRICE,
      CommandIntent.LIST_VEHICLES,
      CommandIntent.VIEW_LEADS,
      CommandIntent.SHOW_ANALYTICS,
    ];

    const suggestions: CommandSuggestion[] = [];

    popularIntents.forEach(intent => {
      const handler = commandRegistry.getHandler(intent);
      if (handler && handler.examples.length > 0) {
        suggestions.push({
          command: handler.examples[0],
          category: handler.category,
          description: handler.description,
          example: handler.examples[0],
          relevance: 100,
          isFrequent: true,
        });
      }
    });

    return suggestions;
  }

  /**
   * Get top example commands
   */
  private getTopExamples(limit: number = 10): HelpExample[] {
    const allHandlers = commandRegistry.getAllHandlers();
    const examples: HelpExample[] = [];

    allHandlers.forEach(handler => {
      handler.examples.forEach(ex => {
        examples.push({
          command: ex,
          description: handler.description,
          category: handler.category,
        });
      });
    });

    // Sort by relevance (for now, just take first N)
    return examples.slice(0, limit);
  }

  /**
   * Get related commands for a category
   */
  private getRelatedCommands(category: string): CommandSuggestion[] {
    const handlers = commandRegistry.getHandlersByCategory(category);

    return handlers.map(handler => ({
      command: handler.examples[0] || '',
      category: handler.category,
      description: handler.description,
      example: handler.examples[0],
      relevance: 90,
    }));
  }

  /**
   * Get user-friendly category name
   */
  private getCategoryName(category: string): string {
    const names: Record<string, string> = {
      'Vehicle Management': 'Manajemen Kendaraan',
      'Pricing': 'Manajemen Harga',
      'Organization': 'Organisasi & Kategori',
      'Customer Management': 'Manajemen Customer',
      'Analytics': 'Analytics & Laporan',
      'Help': 'Bantuan',
    };

    return names[category] || category;
  }

  /**
   * Generate error recovery suggestions
   */
  generateRecoverySuggestions(errorCode: string, context?: any): string[] {
    const suggestions: Record<string, string[]> = {
      'COMMAND_NOT_IMPLEMENTED': [
        'Coba gunakan perintah yang lebih sederhana',
        'Ketik "help" untuk melihat daftar perintah yang tersedia',
        'Contoh: "tampilkan semua mobil" atau "cari mobil Toyota"',
      ],
      'MISSING_ENTITIES': [
        'Mohon lengkapi informasi yang diperlukan',
        'Contoh: sebutkan merek, model, atau ID mobil',
      ],
      'VEHICLE_NOT_FOUND': [
        'Periksa ID atau nama mobil yang Anda masukkan',
        'Gunakan "tampilkan semua mobil" untuk melihat daftar lengkap',
      ],
      'PERMISSION_DENIED': [
        'Anda tidak memiliki izin untuk perintah ini',
        'Hubungi administrator showroom untuk akses',
      ],
      'EXECUTION_ERROR': [
        'Coba ulangi perintah Anda',
        'Jika masalah berlanjut, hubungi support',
      ],
    };

    return suggestions[errorCode] || [
      'Coba ulangi perintah dengan format yang berbeda',
      'Ketik "help" untuk bantuan',
    ];
  }

  /**
   * Get command suggestions based on partial input
   */
  async getSuggestions(
    partialInput: string,
    context?: any,
    limit: number = 5
  ): Promise<CommandSuggestion[]> {
    const normalizedInput = partialInput.toLowerCase();
    const allHandlers = commandRegistry.getAllHandlers();

    const suggestions: Array<CommandSuggestion & { score: number }> = [];

    allHandlers.forEach(handler => {
      handler.examples.forEach(example => {
        const score = this.calculateRelevanceScore(normalizedInput, example.toLowerCase());

        if (score > 0) {
          suggestions.push({
            command: example,
            category: handler.category,
            description: handler.description,
            example,
            relevance: score,
            score,
          });
        }
      });
    });

    // Sort by relevance and limit
    return suggestions
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ score, ...suggestion }) => suggestion);
  }

  /**
   * Calculate relevance score for suggestion
   */
  private calculateRelevanceScore(input: string, example: string): number {
    if (!input) return 0;

    let score = 0;

    // Exact match
    if (example === input) {
      return 100;
    }

    // Starts with input
    if (example.startsWith(input)) {
      score += 80;
    }

    // Contains input
    if (example.includes(input)) {
      score += 60;
    }

    // Word match
    const inputWords = input.split(/\s+/);
    const exampleWords = example.split(/\s+/);

    let matchedWords = 0;
    inputWords.forEach(word => {
      if (exampleWords.some(w => w.includes(word) || word.includes(w))) {
        matchedWords++;
      }
    });

    score += (matchedWords / inputWords.length) * 40;

    return Math.min(Math.round(score), 100);
  }

  /**
   * Detect if user needs help
   */
  needsHelp(command: string): boolean {
    const helpPatterns = [
      /\b(help|bantuan|gimana|bagaimana|cara)\b/i,
      /\b(apa.*bisa|bisa.*apa)\b/i,
      /\?$/,
    ];

    return helpPatterns.some(pattern => pattern.test(command));
  }

  /**
   * Generate clarification for ambiguous command
   */
  generateClarification(command: string, possibleIntents: CommandIntent[]): string {
    if (possibleIntents.length === 0) {
      return 'Maaf, saya tidak mengerti perintah Anda. Ketik "help" untuk bantuan.';
    }

    const intentDescriptions: Record<CommandIntent, string> = {
      [CommandIntent.UPLOAD_VEHICLE]: 'Upload mobil baru',
      [CommandIntent.UPDATE_VEHICLE]: 'Update informasi mobil',
      [CommandIntent.SEARCH_VEHICLE]: 'Cari mobil',
      [CommandIntent.UPDATE_PRICE]: 'Update harga mobil',
      [CommandIntent.LIST_VEHICLES]: 'Tampilkan daftar mobil',
      // Add more as needed
    } as any;

    const options = possibleIntents
      .map((intent, i) => `${i + 1}. ${intentDescriptions[intent] || intent}`)
      .join('\n');

    return `Perintah Anda bisa berarti beberapa hal. Apakah Anda ingin:\n\n${options}\n\nMohon sebutkan dengan lebih spesifik.`;
  }
}

// Export singleton instance
export const helpSystem = new HelpSystem();
