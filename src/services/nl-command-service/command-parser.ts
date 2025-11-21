/**
 * Natural Language Command Parser
 * Epic 3: Story 3.1 - Conversational Command Input Interface
 *
 * Parses Indonesian natural language commands into structured intent and entities
 */

import {
  ParsedCommand,
  CommandIntent,
  CommandEntity,
  EntityType,
  ParseCommandRequest,
} from './types';

// ============================================================================
// Command Parser Service
// ============================================================================

export class CommandParser {
  /**
   * Parse a natural language command into structured format
   */
  async parse(request: ParseCommandRequest): Promise<ParsedCommand> {
    const { command, context } = request;

    // Normalize input
    const normalizedCommand = this.normalizeInput(command);

    // Detect intent
    const intent = this.detectIntent(normalizedCommand);

    // Extract entities
    const entities = this.extractEntities(normalizedCommand, intent);

    // Calculate confidence
    const confidence = this.calculateConfidence(intent, entities, normalizedCommand);

    // Check if clarification is needed
    const needsClarification = confidence < 60 || this.isAmbiguous(normalizedCommand, intent);

    // Generate alternatives if ambiguous
    const alternatives = needsClarification
      ? this.generateAlternatives(normalizedCommand)
      : undefined;

    // Generate clarification questions if needed
    const clarificationQuestions = needsClarification
      ? this.generateClarificationQuestions(intent, entities, normalizedCommand)
      : undefined;

    return {
      originalCommand: command,
      intent,
      confidence,
      entities,
      alternatives,
      needsClarification,
      clarificationQuestions,
    };
  }

  // ============================================================================
  // Input Normalization
  // ============================================================================

  /**
   * Normalize user input for better matching
   */
  private normalizeInput(input: string): string {
    return input
      .toLowerCase()
      .trim()
      // Remove extra whitespace
      .replace(/\s+/g, ' ')
      // Normalize common abbreviations
      .replace(/\bmbl\b/g, 'mobil')
      .replace(/\bthn\b/g, 'tahun')
      .replace(/\bharga\s?nya\b/g, 'harga')
      .replace(/\bjt\b/g, 'juta')
      .replace(/\brp\.?/gi, '')
      // Normalize numbers
      .replace(/(\d+)\s*(juta|jt)/gi, (match, num) => `${num}000000`)
      .replace(/(\d+)\s*(ribu|rb)/gi, (match, num) => `${num}000`);
  }

  // ============================================================================
  // Intent Detection
  // ============================================================================

  /**
   * Detect the primary intent from normalized command
   */
  private detectIntent(normalizedCommand: string): CommandIntent {
    // Upload vehicle patterns
    if (this.matchesPattern(normalizedCommand, [
      /upload.*mobil/,
      /tambah.*mobil/,
      /input.*mobil/,
      /masukkan.*mobil/,
    ])) {
      return CommandIntent.UPLOAD_VEHICLE;
    }

    // Update vehicle patterns
    if (this.matchesPattern(normalizedCommand, [
      /update.*mobil/,
      /ubah.*mobil/,
      /edit.*mobil/,
      /perbaiki.*mobil/,
    ])) {
      return CommandIntent.UPDATE_VEHICLE;
    }

    // Update price patterns
    if (this.matchesPattern(normalizedCommand, [
      /update.*harga/,
      /ubah.*harga/,
      /ganti.*harga/,
      /set.*harga/,
      /harga.*jadi/,
    ])) {
      return CommandIntent.UPDATE_PRICE;
    }

    // Search vehicle patterns
    if (this.matchesPattern(normalizedCommand, [
      /cari.*mobil/,
      /tampilkan.*mobil/,
      /lihat.*mobil/,
      /show.*mobil/,
      /mobil.*dengan/,
      /mobil.*harga/,
    ])) {
      return CommandIntent.SEARCH_VEHICLE;
    }

    // List vehicles patterns
    if (this.matchesPattern(normalizedCommand, [
      /semua.*mobil/,
      /daftar.*mobil/,
      /list.*mobil/,
      /mobil.*apa\s+saja/,
    ])) {
      return CommandIntent.LIST_VEHICLES;
    }

    // Mark as sold patterns
    if (this.matchesPattern(normalizedCommand, [
      /mark.*sold/,
      /tandai.*terjual/,
      /mobil.*terjual/,
      /set.*sold/,
      /sudah.*terjual/,
    ])) {
      return CommandIntent.MARK_AS_SOLD;
    }

    // Mark as booked patterns
    if (this.matchesPattern(normalizedCommand, [
      /mark.*booked/,
      /tandai.*booking/,
      /mobil.*booking/,
      /set.*booked/,
      /sudah.*booking/,
    ])) {
      return CommandIntent.MARK_AS_BOOKED;
    }

    // Mark as available patterns
    if (this.matchesPattern(normalizedCommand, [
      /mark.*available/,
      /tersedia/,
      /set.*available/,
      /buka.*booking/,
      /cancel.*booking/,
    ])) {
      return CommandIntent.MARK_AS_AVAILABLE;
    }

    // Create category patterns
    if (this.matchesPattern(normalizedCommand, [
      /buat.*kategori/,
      /create.*category/,
      /tambah.*kategori/,
      /kategori.*baru/,
    ])) {
      return CommandIntent.CREATE_CATEGORY;
    }

    // View leads patterns
    if (this.matchesPattern(normalizedCommand, [
      /lihat.*lead/,
      /tampilkan.*customer/,
      /daftar.*inquiry/,
      /customer.*yang.*tertarik/,
    ])) {
      return CommandIntent.VIEW_LEADS;
    }

    // Analytics patterns
    if (this.matchesPattern(normalizedCommand, [
      /analytics/,
      /performa/,
      /statistik/,
      /laporan/,
      /report/,
    ])) {
      return CommandIntent.SHOW_ANALYTICS;
    }

    // Help patterns
    if (this.matchesPattern(normalizedCommand, [
      /help/,
      /bantuan/,
      /gimana/,
      /bagaimana/,
      /cara/,
      /apa.*bisa/,
    ])) {
      return CommandIntent.GET_HELP;
    }

    // Default: unknown
    return CommandIntent.UNKNOWN;
  }

  /**
   * Check if normalized command matches any of the patterns
   */
  private matchesPattern(command: string, patterns: RegExp[]): boolean {
    return patterns.some(pattern => pattern.test(command));
  }

  // ============================================================================
  // Entity Extraction
  // ============================================================================

  /**
   * Extract entities from command based on intent
   */
  private extractEntities(command: string, intent: CommandIntent): CommandEntity[] {
    const entities: CommandEntity[] = [];

    // Extract based on intent type
    switch (intent) {
      case CommandIntent.UPLOAD_VEHICLE:
      case CommandIntent.SEARCH_VEHICLE:
      case CommandIntent.UPDATE_VEHICLE:
        entities.push(...this.extractVehicleEntities(command));
        break;

      case CommandIntent.UPDATE_PRICE:
        entities.push(...this.extractPriceEntities(command));
        entities.push(...this.extractVehicleIdentifiers(command));
        break;

      case CommandIntent.MARK_AS_SOLD:
      case CommandIntent.MARK_AS_BOOKED:
      case CommandIntent.MARK_AS_AVAILABLE:
        entities.push(...this.extractVehicleIdentifiers(command));
        break;

      case CommandIntent.CREATE_CATEGORY:
        entities.push(...this.extractCategoryEntity(command));
        break;

      default:
        // Try to extract common entities
        entities.push(...this.extractCommonEntities(command));
    }

    return entities;
  }

  /**
   * Extract vehicle-related entities (make, model, year, etc.)
   */
  private extractVehicleEntities(command: string): CommandEntity[] {
    const entities: CommandEntity[] = [];

    // Extract vehicle make
    const makeEntity = this.extractMake(command);
    if (makeEntity) entities.push(makeEntity);

    // Extract vehicle model
    const modelEntity = this.extractModel(command);
    if (modelEntity) entities.push(modelEntity);

    // Extract year
    const yearEntity = this.extractYear(command);
    if (yearEntity) entities.push(yearEntity);

    // Extract transmission
    const transmissionEntity = this.extractTransmission(command);
    if (transmissionEntity) entities.push(transmissionEntity);

    // Extract fuel type
    const fuelEntity = this.extractFuelType(command);
    if (fuelEntity) entities.push(fuelEntity);

    // Extract color
    const colorEntity = this.extractColor(command);
    if (colorEntity) entities.push(colorEntity);

    // Extract price range
    const priceEntities = this.extractPriceRange(command);
    entities.push(...priceEntities);

    return entities;
  }

  /**
   * Extract make entity
   */
  private extractMake(command: string): CommandEntity | null {
    const makes = [
      'toyota', 'honda', 'suzuki', 'daihatsu', 'mitsubishi', 'nissan',
      'mazda', 'isuzu', 'hino', 'mercedes', 'bmw', 'audi', 'volkswagen',
      'ford', 'chevrolet', 'hyundai', 'kia', 'wuling', 'dfsk', 'chery',
    ];

    for (const make of makes) {
      if (command.includes(make)) {
        return {
          type: EntityType.VEHICLE_MAKE,
          value: make.charAt(0).toUpperCase() + make.slice(1),
          originalText: make,
          confidence: 95,
        };
      }
    }

    return null;
  }

  /**
   * Extract model entity
   */
  private extractModel(command: string): CommandEntity | null {
    // Common Indonesian market models
    const models = [
      { name: 'avanza', make: 'Toyota' },
      { name: 'xenia', make: 'Daihatsu' },
      { name: 'brio', make: 'Honda' },
      { name: 'jazz', make: 'Honda' },
      { name: 'civic', make: 'Honda' },
      { name: 'crv', make: 'Honda' },
      { name: 'cr-v', make: 'Honda' },
      { name: 'hrv', make: 'Honda' },
      { name: 'hr-v', make: 'Honda' },
      { name: 'ertiga', make: 'Suzuki' },
      { name: 'carry', make: 'Suzuki' },
      { name: 'xpander', make: 'Mitsubishi' },
      { name: 'pajero', make: 'Mitsubishi' },
      { name: 'fortuner', make: 'Toyota' },
      { name: 'innova', make: 'Toyota' },
      { name: 'rush', make: 'Toyota' },
      { name: 'terios', make: 'Daihatsu' },
      { name: 'grand livina', make: 'Nissan' },
    ];

    for (const model of models) {
      if (command.includes(model.name)) {
        return {
          type: EntityType.VEHICLE_MODEL,
          value: model.name.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
          originalText: model.name,
          confidence: 90,
        };
      }
    }

    return null;
  }

  /**
   * Extract year entity
   */
  private extractYear(command: string): CommandEntity | null {
    // Match 4-digit year (2010-2025)
    const yearMatch = command.match(/\b(20[1-2][0-9])\b/);
    if (yearMatch) {
      return {
        type: EntityType.VEHICLE_YEAR,
        value: parseInt(yearMatch[1]),
        originalText: yearMatch[1],
        confidence: 95,
      };
    }

    // Match "tahun 2020" pattern
    const tahunMatch = command.match(/tahun\s+(\d{4})/);
    if (tahunMatch) {
      return {
        type: EntityType.VEHICLE_YEAR,
        value: parseInt(tahunMatch[1]),
        originalText: tahunMatch[0],
        confidence: 90,
      };
    }

    return null;
  }

  /**
   * Extract transmission type
   */
  private extractTransmission(command: string): CommandEntity | null {
    if (/\b(manual|manual\s+transmission)\b/.test(command)) {
      return {
        type: EntityType.TRANSMISSION,
        value: 'manual',
        originalText: 'manual',
        confidence: 95,
      };
    }

    if (/\b(matic|automatic|matik|otomatis)\b/.test(command)) {
      return {
        type: EntityType.TRANSMISSION,
        value: 'automatic',
        originalText: 'matic',
        confidence: 95,
      };
    }

    if (/\b(cvt)\b/.test(command)) {
      return {
        type: EntityType.TRANSMISSION,
        value: 'cvt',
        originalText: 'cvt',
        confidence: 95,
      };
    }

    return null;
  }

  /**
   * Extract fuel type
   */
  private extractFuelType(command: string): CommandEntity | null {
    if (/\b(bensin|gasoline|petrol)\b/.test(command)) {
      return {
        type: EntityType.FUEL_TYPE,
        value: 'bensin',
        originalText: 'bensin',
        confidence: 95,
      };
    }

    if (/\b(diesel|solar)\b/.test(command)) {
      return {
        type: EntityType.FUEL_TYPE,
        value: 'diesel',
        originalText: 'diesel',
        confidence: 95,
      };
    }

    if (/\b(hybrid)\b/.test(command)) {
      return {
        type: EntityType.FUEL_TYPE,
        value: 'hybrid',
        originalText: 'hybrid',
        confidence: 95,
      };
    }

    if (/\b(electric|listrik)\b/.test(command)) {
      return {
        type: EntityType.FUEL_TYPE,
        value: 'electric',
        originalText: 'electric',
        confidence: 95,
      };
    }

    return null;
  }

  /**
   * Extract color entity
   */
  private extractColor(command: string): CommandEntity | null {
    const colors = [
      { indonesian: 'putih', english: 'white' },
      { indonesian: 'hitam', english: 'black' },
      { indonesian: 'silver', english: 'silver' },
      { indonesian: 'merah', english: 'red' },
      { indonesian: 'biru', english: 'blue' },
      { indonesian: 'kuning', english: 'yellow' },
      { indonesian: 'hijau', english: 'green' },
      { indonesian: 'abu-abu', english: 'gray' },
      { indonesian: 'coklat', english: 'brown' },
      { indonesian: 'emas', english: 'gold' },
    ];

    for (const color of colors) {
      if (command.includes(color.indonesian) || command.includes(color.english)) {
        return {
          type: EntityType.COLOR,
          value: color.indonesian.charAt(0).toUpperCase() + color.indonesian.slice(1),
          originalText: color.indonesian,
          confidence: 90,
        };
      }
    }

    return null;
  }

  /**
   * Extract price-related entities
   */
  private extractPriceEntities(command: string): CommandEntity[] {
    const entities: CommandEntity[] = [];

    // Extract specific price (e.g., "250 juta")
    const priceMatch = command.match(/(\d+(?:\.\d+)?)\s*(juta|jt|ribu|rb)?/);
    if (priceMatch) {
      let value = parseFloat(priceMatch[1]);

      // Convert to cents
      if (priceMatch[2]?.match(/juta|jt/)) {
        value = value * 1000000 * 100; // to cents
      } else if (priceMatch[2]?.match(/ribu|rb/)) {
        value = value * 1000 * 100; // to cents
      } else {
        value = value * 100; // assume rupiah, convert to cents
      }

      entities.push({
        type: EntityType.PRICE,
        value: Math.round(value),
        originalText: priceMatch[0],
        confidence: 90,
      });
    }

    return entities;
  }

  /**
   * Extract price range
   */
  private extractPriceRange(command: string): CommandEntity[] {
    const entities: CommandEntity[] = [];

    // "di bawah 300 juta" or "< 300 juta"
    const belowMatch = command.match(/(?:di\s+bawah|kurang\s+dari|<)\s+(\d+(?:\.\d+)?)\s*(juta|jt)?/);
    if (belowMatch) {
      let value = parseFloat(belowMatch[1]);
      if (belowMatch[2]) value = value * 1000000;
      value = value * 100; // to cents

      entities.push({
        type: EntityType.PRICE_RANGE,
        value: { max: Math.round(value) },
        originalText: belowMatch[0],
        confidence: 90,
      });
    }

    // "di atas 200 juta" or "> 200 juta"
    const aboveMatch = command.match(/(?:di\s+atas|lebih\s+dari|>)\s+(\d+(?:\.\d+)?)\s*(juta|jt)?/);
    if (aboveMatch) {
      let value = parseFloat(aboveMatch[1]);
      if (aboveMatch[2]) value = value * 1000000;
      value = value * 100; // to cents

      entities.push({
        type: EntityType.PRICE_RANGE,
        value: { min: Math.round(value) },
        originalText: aboveMatch[0],
        confidence: 90,
      });
    }

    // "antara 200 sampai 300 juta"
    const rangeMatch = command.match(/antara\s+(\d+(?:\.\d+)?)\s*(?:sampai|hingga|-)\s*(\d+(?:\.\d+)?)\s*(juta|jt)?/);
    if (rangeMatch) {
      let min = parseFloat(rangeMatch[1]);
      let max = parseFloat(rangeMatch[2]);
      if (rangeMatch[3]) {
        min = min * 1000000;
        max = max * 1000000;
      }
      min = min * 100; // to cents
      max = max * 100;

      entities.push({
        type: EntityType.PRICE_RANGE,
        value: { min: Math.round(min), max: Math.round(max) },
        originalText: rangeMatch[0],
        confidence: 90,
      });
    }

    return entities;
  }

  /**
   * Extract vehicle identifiers (ID, index, etc.)
   */
  private extractVehicleIdentifiers(command: string): CommandEntity[] {
    const entities: CommandEntity[] = [];

    // Extract vehicle ID (e.g., "mobil ID-12345")
    const idMatch = command.match(/\b([a-z]{2,8})-([a-z0-9]{8,})\b/i);
    if (idMatch) {
      entities.push({
        type: EntityType.VEHICLE_ID,
        value: idMatch[0],
        originalText: idMatch[0],
        confidence: 95,
      });
    }

    return entities;
  }

  /**
   * Extract category entity
   */
  private extractCategoryEntity(command: string): CommandEntity[] {
    const entities: CommandEntity[] = [];

    // Extract category name (usually quoted or after "kategori")
    const categoryMatch = command.match(/kategori\s+(?:["'](.+?)["']|(\w+(?:\s+\w+)?))/);
    if (categoryMatch) {
      const categoryName = categoryMatch[1] || categoryMatch[2];
      entities.push({
        type: EntityType.CATEGORY,
        value: categoryName,
        originalText: categoryMatch[0],
        confidence: 85,
      });
    }

    return entities;
  }

  /**
   * Extract common entities that appear in multiple intents
   */
  private extractCommonEntities(command: string): CommandEntity[] {
    const entities: CommandEntity[] = [];

    // Extract quantity
    const quantityMatch = command.match(/\b(\d+)\s*(?:mobil|unit|vehicle)/);
    if (quantityMatch) {
      entities.push({
        type: EntityType.QUANTITY,
        value: parseInt(quantityMatch[1]),
        originalText: quantityMatch[0],
        confidence: 90,
      });
    }

    return entities;
  }

  // ============================================================================
  // Confidence Calculation
  // ============================================================================

  /**
   * Calculate confidence score for the parsed command
   */
  private calculateConfidence(
    intent: CommandIntent,
    entities: CommandEntity[],
    command: string
  ): number {
    let confidence = 0;

    // Base confidence for known intents
    if (intent !== CommandIntent.UNKNOWN) {
      confidence += 50;
    } else {
      return 20; // Very low confidence for unknown intents
    }

    // Boost for extracted entities
    if (entities.length > 0) {
      confidence += Math.min(entities.length * 10, 30);
    }

    // Boost for high-confidence entities
    const avgEntityConfidence = entities.length > 0
      ? entities.reduce((sum, e) => sum + e.confidence, 0) / entities.length
      : 0;
    confidence += avgEntityConfidence * 0.2;

    // Penalty for very short commands (< 3 words)
    const wordCount = command.split(/\s+/).length;
    if (wordCount < 3) {
      confidence -= 10;
    }

    // Cap at 100
    return Math.min(Math.round(confidence), 100);
  }

  // ============================================================================
  // Ambiguity Detection
  // ============================================================================

  /**
   * Check if command is ambiguous
   */
  private isAmbiguous(command: string, intent: CommandIntent): boolean {
    // Commands without clear entities are ambiguous
    if (intent === CommandIntent.UNKNOWN) {
      return true;
    }

    // Update/change commands without specific target
    if ([CommandIntent.UPDATE_VEHICLE, CommandIntent.UPDATE_PRICE].includes(intent)) {
      if (!command.match(/\b([a-z]{2,8})-([a-z0-9]{8,})\b/i) && // no ID
          !command.match(/toyota|honda|suzuki/i)) { // no make/model
        return true;
      }
    }

    return false;
  }

  /**
   * Generate alternative interpretations
   */
  private generateAlternatives(command: string): ParsedCommand[] {
    const alternatives: ParsedCommand[] = [];

    // This would be expanded with ML-based alternatives
    // For now, return empty array (will be enhanced in Story 3.3)

    return alternatives;
  }

  // ============================================================================
  // Clarification Questions
  // ============================================================================

  /**
   * Generate clarification questions
   */
  private generateClarificationQuestions(
    intent: CommandIntent,
    entities: CommandEntity[],
    command: string
  ): string[] {
    const questions: string[] = [];

    if (intent === CommandIntent.UNKNOWN) {
      questions.push('Maaf, saya tidak yakin apa yang Anda maksud. Apakah Anda ingin:');
      questions.push('- Upload mobil baru?');
      questions.push('- Cari mobil?');
      questions.push('- Update harga mobil?');
      return questions;
    }

    // Intent-specific clarifications
    switch (intent) {
      case CommandIntent.UPDATE_PRICE:
        if (!entities.some(e => e.type === EntityType.VEHICLE_ID)) {
          questions.push('Mobil mana yang ingin diupdate harganya?');
        }
        if (!entities.some(e => e.type === EntityType.PRICE)) {
          questions.push('Berapa harga barunya?');
        }
        break;

      case CommandIntent.SEARCH_VEHICLE:
        if (entities.length === 0) {
          questions.push('Anda ingin cari mobil dengan kriteria apa?');
          questions.push('Contoh: merek, model, harga, atau tahun?');
        }
        break;

      case CommandIntent.UPDATE_VEHICLE:
        if (!entities.some(e => e.type === EntityType.VEHICLE_ID)) {
          questions.push('Mobil mana yang ingin diupdate?');
        }
        break;
    }

    return questions;
  }
}

// Export singleton instance
export const commandParser = new CommandParser();
