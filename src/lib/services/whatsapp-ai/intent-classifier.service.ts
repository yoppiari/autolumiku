/**
 * Intent Classifier Service
 * Mengklasifikasi intent dari WhatsApp message:
 * - Customer inquiry (butuh AI response)
 * - Staff command (butuh command parser)
 */

import { prisma } from "@/lib/prisma";

// ==================== TYPES ====================

export type MessageIntent =
  | "customer_greeting"
  | "customer_vehicle_inquiry"
  | "customer_price_inquiry"
  | "customer_test_drive"
  | "customer_general_question"
  | "staff_upload_vehicle"
  | "staff_update_status"
  | "staff_check_inventory"
  | "staff_get_stats"
  | "unknown";

export interface IntentClassificationResult {
  intent: MessageIntent;
  confidence: number; // 0-1
  isStaff: boolean;
  isCustomer: boolean;
  entities?: Record<string, any>;
  reason?: string;
}

// ==================== CONSTANTS ====================

// Staff command patterns (case-insensitive)
const STAFF_COMMAND_PATTERNS = {
  upload_vehicle: [
    /^\/upload/i,
    /^upload\s+mobil/i,
    /^tambah\s+mobil/i,
    /^daftar\s+mobil/i,
  ],
  update_status: [
    /^\/status/i,
    /^update\s+status/i,
    /^ubah\s+status/i,
    /^ganti\s+status/i,
  ],
  check_inventory: [
    /^\/inventory/i,
    /^\/stock/i,
    /^cek\s+stok/i,
    /^lihat\s+inventory/i,
    /^daftar\s+mobil/i,
  ],
  get_stats: [
    /^\/stats/i,
    /^\/report/i,
    /^laporan/i,
    /^statistik/i,
  ],
};

// Customer inquiry patterns
const CUSTOMER_PATTERNS = {
  greeting: [
    /^(halo|hai|hello|hi|pagi|siang|sore|malam)/i,
    /^assalam/i,
    /selamat\s+(pagi|siang|sore|malam)/i,
  ],
  vehicle_inquiry: [
    /\b(mobil|motor|kendaraan|unit)\b/i,
    /\b(toyota|honda|suzuki|daihatsu|mitsubishi|nissan|mazda|bmw|mercy|audi)\b/i,
    /\b(avanza|xenia|brio|jazz|ertiga|terios|rush|innova|fortuner|pajero)\b/i,
    /\b(ready|tersedia|ada|punya|jual)\b.*\b(mobil|unit)\b/i,
  ],
  price_inquiry: [
    /\b(harga|price|berapa|biaya|cost)\b/i,
    /\b(kredit|cash|dp|cicilan|angsuran)\b/i,
    /\b(diskon|promo|potongan)\b/i,
  ],
  test_drive: [
    /\b(test\s*drive|tes\s*drive|coba|uji\s*coba)\b/i,
    /\b(lihat|survey|datang)\b.*\b(showroom|lokasi)\b/i,
  ],
};

// ==================== INTENT CLASSIFIER ====================

export class IntentClassifierService {
  /**
   * Classify intent dari WhatsApp message
   */
  static async classify(
    message: string,
    senderPhone: string,
    tenantId: string
  ): Promise<IntentClassificationResult> {
    // Normalize message
    const normalizedMessage = message.trim();

    // Check if sender is staff
    const isStaff = await this.isStaffMember(senderPhone, tenantId);

    // 1. If staff, check for commands
    if (isStaff) {
      const staffIntent = this.classifyStaffCommand(normalizedMessage);
      if (staffIntent) {
        return {
          ...staffIntent,
          isStaff: true,
          isCustomer: false,
        };
      }
    }

    // 2. Classify customer intent
    const customerIntent = this.classifyCustomerIntent(normalizedMessage);

    return {
      ...customerIntent,
      isStaff: false,
      isCustomer: true,
    };
  }

  /**
   * Check if phone number belongs to staff
   */
  private static async isStaffMember(
    phoneNumber: string,
    tenantId: string
  ): Promise<boolean> {
    const staff = await prisma.staffWhatsAppAuth.findFirst({
      where: {
        phoneNumber,
        tenantId,
        isActive: true,
      },
    });

    return !!staff;
  }

  /**
   * Classify staff command
   */
  private static classifyStaffCommand(
    message: string
  ): IntentClassificationResult | null {
    // Check upload vehicle
    if (STAFF_COMMAND_PATTERNS.upload_vehicle.some((p) => p.test(message))) {
      return {
        intent: "staff_upload_vehicle",
        confidence: 0.95,
        isStaff: true,
        isCustomer: false,
        reason: "Matched upload vehicle command pattern",
      };
    }

    // Check update status
    if (STAFF_COMMAND_PATTERNS.update_status.some((p) => p.test(message))) {
      return {
        intent: "staff_update_status",
        confidence: 0.95,
        isStaff: true,
        isCustomer: false,
        reason: "Matched update status command pattern",
      };
    }

    // Check inventory
    if (STAFF_COMMAND_PATTERNS.check_inventory.some((p) => p.test(message))) {
      return {
        intent: "staff_check_inventory",
        confidence: 0.95,
        isStaff: true,
        isCustomer: false,
        reason: "Matched check inventory command pattern",
      };
    }

    // Check stats
    if (STAFF_COMMAND_PATTERNS.get_stats.some((p) => p.test(message))) {
      return {
        intent: "staff_get_stats",
        confidence: 0.95,
        isStaff: true,
        isCustomer: false,
        reason: "Matched get stats command pattern",
      };
    }

    return null;
  }

  /**
   * Classify customer intent
   */
  private static classifyCustomerIntent(
    message: string
  ): IntentClassificationResult {
    let maxConfidence = 0;
    let detectedIntent: MessageIntent = "customer_general_question";
    let reason = "Default customer inquiry";

    // Check greeting
    if (CUSTOMER_PATTERNS.greeting.some((p) => p.test(message))) {
      maxConfidence = Math.max(maxConfidence, 0.9);
      if (maxConfidence === 0.9) {
        detectedIntent = "customer_greeting";
        reason = "Detected greeting pattern";
      }
    }

    // Check vehicle inquiry
    if (CUSTOMER_PATTERNS.vehicle_inquiry.some((p) => p.test(message))) {
      maxConfidence = Math.max(maxConfidence, 0.85);
      if (maxConfidence === 0.85) {
        detectedIntent = "customer_vehicle_inquiry";
        reason = "Detected vehicle inquiry keywords";
      }
    }

    // Check price inquiry
    if (CUSTOMER_PATTERNS.price_inquiry.some((p) => p.test(message))) {
      maxConfidence = Math.max(maxConfidence, 0.85);
      if (maxConfidence === 0.85) {
        detectedIntent = "customer_price_inquiry";
        reason = "Detected price inquiry keywords";
      }
    }

    // Check test drive
    if (CUSTOMER_PATTERNS.test_drive.some((p) => p.test(message))) {
      maxConfidence = Math.max(maxConfidence, 0.85);
      if (maxConfidence === 0.85) {
        detectedIntent = "customer_test_drive";
        reason = "Detected test drive intent";
      }
    }

    return {
      intent: detectedIntent,
      confidence: maxConfidence || 0.6,
      isStaff: false,
      isCustomer: true,
      reason,
    };
  }

  /**
   * Extract entities dari message (helper untuk future enhancements)
   */
  static extractEntities(message: string, intent: MessageIntent): Record<string, any> {
    const entities: Record<string, any> = {};

    // Extract vehicle brands
    const brands = [
      "toyota",
      "honda",
      "suzuki",
      "daihatsu",
      "mitsubishi",
      "nissan",
      "mazda",
    ];
    const detectedBrand = brands.find((brand) =>
      new RegExp(`\\b${brand}\\b`, "i").test(message)
    );
    if (detectedBrand) {
      entities.brand = detectedBrand;
    }

    // Extract price mentions
    const priceMatch = message.match(/(\d{2,3})\s*(juta|jt)/i);
    if (priceMatch) {
      entities.price = parseInt(priceMatch[1]) * 1000000;
    }

    return entities;
  }
}

export default IntentClassifierService;
