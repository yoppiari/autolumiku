/**
 * Intent Recognizer using GLM-4.6
 * Epic 3: Story 3.1 & 3.3 - AI-powered intent recognition for Indonesian commands
 *
 * Uses z.ai GLM-4.6 for advanced natural language understanding
 */

import OpenAI from 'openai';
import { CommandIntent, ParsedCommand } from './types';

// ============================================================================
// GLM Client Configuration
// ============================================================================

const glm = new OpenAI({
  apiKey: process.env.ZAI_API_KEY || '',
  baseURL: process.env.ZAI_BASE_URL || 'https://api.z.ai/api/coding/paas/v4/',
  timeout: parseInt(process.env.API_TIMEOUT_MS || '30000')
});

// ============================================================================
// Intent Recognizer Service
// ============================================================================

export class IntentRecognizer {
  /**
   * Use GLM-4.6 to recognize intent with high accuracy
   * Fallback to rule-based parser if GLM fails
   */
  async recognizeIntent(
    command: string,
    fallbackIntent: CommandIntent,
    context?: { recentCommands?: string[] }
  ): Promise<{
    intent: CommandIntent;
    confidence: number;
    reasoning: string;
  }> {
    try {
      // Build context-aware prompt
      const systemPrompt = this.buildSystemPrompt();
      const userPrompt = this.buildUserPrompt(command, context);

      // Call GLM-4.6
      const response = await glm.chat.completions.create({
        model: process.env.ZAI_TEXT_MODEL || 'glm-4.6',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3,
        max_tokens: 500,
      });

      const rawResponse = response.choices[0]?.message?.content || '{}';

      // Parse JSON response
      const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No valid JSON in GLM response');
      }

      const result = JSON.parse(jsonMatch[0]);

      // Validate and map to our CommandIntent enum
      const mappedIntent = this.mapIntentString(result.intent);

      return {
        intent: mappedIntent || fallbackIntent,
        confidence: result.confidence || 70,
        reasoning: result.reasoning || 'Intent detected by GLM-4.6'
      };

    } catch (error: any) {
      console.error('GLM intent recognition failed:', error.message);

      // Fallback to rule-based parser
      return {
        intent: fallbackIntent,
        confidence: 60,
        reasoning: 'Fallback to rule-based parsing'
      };
    }
  }

  /**
   * Build system prompt for GLM
   */
  private buildSystemPrompt(): string {
    return `Anda adalah AI assistant untuk sistem manajemen showroom mobil di Indonesia.

Tugas Anda: Identifikasi intent (niat) dari perintah pengguna dalam Bahasa Indonesia.

Daftar Intent yang Tersedia:
1. "upload_vehicle" - Upload/tambah mobil baru
2. "update_vehicle" - Update informasi mobil
3. "delete_vehicle" - Hapus mobil
4. "search_vehicle" - Cari mobil dengan kriteria tertentu
5. "list_vehicles" - Tampilkan daftar mobil
6. "update_price" - Update harga mobil
7. "set_discount" - Set diskon/promosi
8. "mark_as_sold" - Tandai mobil sudah terjual
9. "mark_as_booked" - Tandai mobil sudah dibooking
10. "mark_as_available" - Tandai mobil tersedia lagi
11. "create_category" - Buat kategori baru
12. "assign_category" - Assign mobil ke kategori
13. "view_leads" - Lihat customer leads/inquiry
14. "show_analytics" - Tampilkan analytics/statistik
15. "get_help" - Minta bantuan
16. "unknown" - Tidak jelas/tidak dikenali

Konteks Automotive Indonesia:
- "mobil" = kendaraan/vehicle
- "matic" / "matik" = automatic transmission
- "manual" = manual transmission
- "juta" = million (rupiah)
- "terjual" = sold
- "booking" = booked/reserved
- "showroom" / "dealer" = dealership

Response Format (JSON only):
{
  "intent": "intent_name",
  "confidence": 85,
  "reasoning": "Penjelasan singkat kenapa intent ini dipilih"
}`;
  }

  /**
   * Build user prompt with context
   */
  private buildUserPrompt(command: string, context?: { recentCommands?: string[] }): string {
    let prompt = `Identifikasi intent dari perintah berikut:\n\n"${command}"\n\n`;

    if (context?.recentCommands && context.recentCommands.length > 0) {
      prompt += `Konteks perintah sebelumnya:\n`;
      context.recentCommands.forEach((cmd, i) => {
        prompt += `${i + 1}. "${cmd}"\n`;
      });
      prompt += '\n';
    }

    prompt += 'Berikan response dalam format JSON.';

    return prompt;
  }

  /**
   * Map intent string from GLM to CommandIntent enum
   */
  private mapIntentString(intentStr: string): CommandIntent | null {
    const intentMap: Record<string, CommandIntent> = {
      'upload_vehicle': CommandIntent.UPLOAD_VEHICLE,
      'update_vehicle': CommandIntent.UPDATE_VEHICLE,
      'delete_vehicle': CommandIntent.DELETE_VEHICLE,
      'search_vehicle': CommandIntent.SEARCH_VEHICLE,
      'list_vehicles': CommandIntent.LIST_VEHICLES,
      'view_vehicle': CommandIntent.VIEW_VEHICLE,
      'update_price': CommandIntent.UPDATE_PRICE,
      'set_discount': CommandIntent.SET_DISCOUNT,
      'compare_prices': CommandIntent.COMPARE_PRICES,
      'create_category': CommandIntent.CREATE_CATEGORY,
      'assign_category': CommandIntent.ASSIGN_CATEGORY,
      'list_categories': CommandIntent.LIST_CATEGORIES,
      'mark_as_sold': CommandIntent.MARK_AS_SOLD,
      'mark_as_booked': CommandIntent.MARK_AS_BOOKED,
      'mark_as_available': CommandIntent.MARK_AS_AVAILABLE,
      'set_featured': CommandIntent.SET_FEATURED,
      'bulk_update': CommandIntent.BULK_UPDATE,
      'bulk_delete': CommandIntent.BULK_DELETE,
      'view_leads': CommandIntent.VIEW_LEADS,
      'contact_customer': CommandIntent.CONTACT_CUSTOMER,
      'show_analytics': CommandIntent.SHOW_ANALYTICS,
      'generate_report': CommandIntent.GENERATE_REPORT,
      'get_help': CommandIntent.GET_HELP,
      'show_examples': CommandIntent.SHOW_EXAMPLES,
      'navigate_to': CommandIntent.NAVIGATE_TO,
      'unknown': CommandIntent.UNKNOWN,
    };

    return intentMap[intentStr] || null;
  }

  /**
   * Enhance parsed command with GLM insights
   */
  async enhanceParsedCommand(
    parsedCommand: ParsedCommand,
    context?: { recentCommands?: string[] }
  ): Promise<ParsedCommand> {
    // If confidence is already high, no need to enhance
    if (parsedCommand.confidence >= 85) {
      return parsedCommand;
    }

    // Use GLM to get better understanding
    const glmResult = await this.recognizeIntent(
      parsedCommand.originalCommand,
      parsedCommand.intent,
      context
    );

    // If GLM has higher confidence, use its result
    if (glmResult.confidence > parsedCommand.confidence) {
      return {
        ...parsedCommand,
        intent: glmResult.intent,
        confidence: glmResult.confidence,
      };
    }

    return parsedCommand;
  }
}

// Export singleton instance
export const intentRecognizer = new IntentRecognizer();
