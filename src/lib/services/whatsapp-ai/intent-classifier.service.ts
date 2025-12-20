/**
 * Intent Classifier Service
 * Mengklasifikasi intent dari WhatsApp message:
 * - Customer inquiry (butuh AI response)
 * - Staff command (butuh command parser)
 */

import { prisma } from "@/lib/prisma";

// ==================== STAFF CACHE (OPTIMIZED) ====================
// Simple in-memory cache for staff phone numbers to reduce DB queries
interface StaffCacheEntry {
  phones: Set<string>;
  timestamp: number;
}
const staffCache = new Map<string, StaffCacheEntry>();
const STAFF_CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache

// ==================== TYPES ====================

export type MessageIntent =
  | "customer_greeting"
  | "customer_vehicle_inquiry"
  | "customer_price_inquiry"
  | "customer_test_drive"
  | "customer_general_question"
  | "staff_greeting"
  | "staff_upload_vehicle"
  | "staff_update_status"
  | "staff_check_inventory"
  | "staff_get_stats"
  | "staff_verify_identity"
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
    /^\/upload/i,                    // /upload ...
    /^upload\s+/i,                   // upload Brio..., upload mobil...
    /^upload$/i,                     // standalone "upload"
    /^mau\s+upload\b/i,              // mau upload, mau upload dong
    /^ingin\s+upload\b/i,            // ingin upload
    /^mo\s+upload\b/i,               // mo upload (informal)
    /^pengen\s+upload\b/i,           // pengen upload (informal)
    /^tambah\s+(mobil|unit|kendaraan)/i,
    /^input\s+(mobil|unit|kendaraan)/i,
    /^masukin\s+(mobil|unit|kendaraan)/i,  // masukin mobil
    /^tambah\s+data\s+(mobil|unit)/i,      // tambah data mobil
  ],
  verify_staff: [
    /^\/verify\s+/i,                 // /verify 081234567890
    /^verify\s+/i,                   // verify 081234567890
    /^verifikasi\s+/i,               // verifikasi 081234567890
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
    /\b(budget|anggaran)\b.*\b(\d+)\b/i, // budget queries
    /\b(terbaru|terlama|newest|oldest)\b/i, // newest/oldest queries
    /\b(matic|manual|automatic|mt|at)\b/i, // transmission queries
    /\b(bensin|diesel|solar|hybrid|electric)\b/i, // fuel type queries
  ],
  price_inquiry: [
    /\b(harga|price|berapa|biaya|cost)\b/i,
    /\b(kredit|cash|dp|cicilan|angsuran)\b/i,
    /\b(diskon|promo|potongan)\b/i,
    /\b(range|kisaran|sekitar)\b.*\b(\d+)\s*(jt|juta|rb|ribu)/i, // price range
  ],
  test_drive: [
    /\b(test\s*drive|tes\s*drive|coba|uji\s*coba)\b/i,
    /\b(lihat|survey|datang)\b.*\b(showroom|lokasi)\b/i,
  ],
  photo_request: [
    /\b(foto|gambar|picture|image|photo)\b/i,
    /\b(lihat|liat|kirimin|kirim|send)\b.*\b(foto|gambar)\b/i,
    /\b(ada\s+foto|punya\s+foto)\b/i,
  ],
  photo_confirmation: [
    /^(iya|ya|yup|yap|ok|oke|okay|boleh|mau|sip|siap|bisa|gas|let'?s?\s*go|kirim|send)$/i,
    /^(iya\s+boleh|ya\s+boleh|boleh\s+dong|mau\s+dong|oke\s+kirim|ya\s+kirim)$/i,
    /^(tolong|please)\s*(kirim|send)/i,
  ],
};

// Vehicle description pattern - detects natural language vehicle listings
// Matches patterns like: "Brio Satya MT 2015 KM 30.000 Rp 120JT Warna Hitam"
const VEHICLE_DESCRIPTION_PATTERN = /\b(brio|avanza|xenia|jazz|ertiga|rush|terios|innova|fortuner|pajero|alphard|civic|accord|crv|hrv|brv|mobilio|freed|city|yaris|vios|camry|corolla|raize|rocky|sigra|ayla|agya|calya|wuling|confero|almaz|cortez|xpander|livina|serena|grand|all\s*new)\b.*\b(20\d{2}|19\d{2})\b.*\b(\d+\s*(jt|juta|rb|ribu|k|km)|\d{2,3}\s*(jt|juta))/i;

// ==================== INTENT CLASSIFIER ====================

export class IntentClassifierService {
  /**
   * Classify intent dari WhatsApp message
   * @param hasMedia - Optional flag to indicate if message has media (photo)
   */
  static async classify(
    message: string,
    senderPhone: string,
    tenantId: string,
    hasMedia: boolean = false
  ): Promise<IntentClassificationResult> {
    // Normalize message
    const normalizedMessage = (message || "").trim();
    console.log(`[Intent Classifier] Message: "${normalizedMessage}", hasMedia: ${hasMedia}`);

    // 0. Check for /verify command FIRST - this allows LID users to verify themselves
    // Must be checked before isStaff check because unverified LID users need to use this
    if (STAFF_COMMAND_PATTERNS.verify_staff.some((p) => p.test(normalizedMessage))) {
      console.log(`[Intent Classifier] 🔐 Verify command detected from: ${senderPhone}`);
      return {
        intent: "staff_verify_identity",
        confidence: 0.95,
        isStaff: false, // Will be set to true after verification
        isCustomer: false,
        reason: "Staff identity verification request",
      };
    }

    // Check if sender is staff
    const isStaff = await this.isStaffMember(senderPhone, tenantId);
    console.log(`[Intent Classifier] Is staff: ${isStaff}`);

    // 1. If staff, check for commands
    if (isStaff) {
      // If staff sends photo without caption, treat as photo for upload flow
      if (hasMedia && !normalizedMessage) {
        console.log(`[Intent Classifier] Staff sent photo without caption - treating as upload photo`);
        return {
          intent: "staff_upload_vehicle",
          confidence: 0.9,
          isStaff: true,
          isCustomer: false,
          reason: "Staff photo without caption - likely for vehicle upload",
        };
      }

      const staffIntent = this.classifyStaffCommand(normalizedMessage, hasMedia);
      if (staffIntent) {
        console.log(`[Intent Classifier] Staff intent detected: ${staffIntent.intent}`);
        return {
          ...staffIntent,
          isStaff: true,
          isCustomer: false,
        };
      }
    }

    // 2. Classify customer intent
    const customerIntent = this.classifyCustomerIntent(normalizedMessage);
    console.log(`[Intent Classifier] Customer intent: ${customerIntent.intent}`);

    return {
      ...customerIntent,
      isStaff: false,
      isCustomer: true,
    };
  }

  /**
   * Normalize phone number for comparison
   * Handles various formats: +62xxx, 62xxx, 0xxx, 08xxx
   * Also handles LID format (linked devices) by extracting phone if available
   */
  private static normalizePhone(phone: string): string {
    if (!phone) return "";

    // Detect LID format (e.g., "10020343271578@lid" or "10020343271578:45@lid")
    // LID format cannot be normalized to phone - return special marker
    if (phone.includes("@lid")) {
      return `LID:${phone}`;
    }

    // Handle JID format (e.g., "6281234567890@s.whatsapp.net")
    if (phone.includes("@")) {
      phone = phone.split("@")[0];
    }

    // Remove all non-digit characters
    let digits = phone.replace(/\D/g, "");
    // Convert Indonesian formats to standard 62xxx
    if (digits.startsWith("0")) {
      digits = "62" + digits.substring(1);
    }
    // Remove leading + if present (already stripped by regex above)
    return digits;
  }

  /**
   * Check if phone/ID is in LID format (linked device)
   */
  private static isLidFormat(phone: string): boolean {
    return phone.includes("@lid");
  }

  /**
   * Check if phone number belongs to staff
   * Updated to use User table directly (staff management centralized)
   * Now with flexible phone number matching
   * Only considers ADMIN, MANAGER, SALES, STAFF roles as staff
   * UPDATED: Also handles LID format by checking conversation history
   */
  private static async isStaffMember(
    phoneNumber: string,
    tenantId: string
  ): Promise<boolean> {
    const normalizedInput = this.normalizePhone(phoneNumber);
    console.log(`[Intent Classifier] Checking staff - input: ${phoneNumber}, normalized: ${normalizedInput}, tenantId: ${tenantId}`);

    // Handle LID format (linked devices like WA Web/Desktop)
    if (this.isLidFormat(phoneNumber)) {
      console.log(`[Intent Classifier] ⚠️ LID format detected: ${phoneNumber}`);

      // Check if this LID has been previously used in a staff conversation
      const existingConversation = await prisma.whatsAppConversation.findFirst({
        where: {
          tenantId,
          customerPhone: phoneNumber,
          isStaff: true,
        },
        select: { id: true, isStaff: true },
      });

      if (existingConversation?.isStaff) {
        console.log(`[Intent Classifier] ✅ LID previously verified as staff (conv: ${existingConversation.id})`);
        return true;
      }

      // If not previously verified, check if there's a staff mapping in contextData
      const conversationWithMapping = await prisma.whatsAppConversation.findFirst({
        where: {
          tenantId,
          customerPhone: phoneNumber,
        },
        select: { id: true, contextData: true },
      });

      // Check contextData for staffPhone mapping
      const contextData = conversationWithMapping?.contextData as Record<string, any> | null;
      if (contextData?.verifiedStaffPhone) {
        // Verify the mapped phone number is actually staff
        const mappedPhoneNormalized = this.normalizePhone(contextData.verifiedStaffPhone);
        const staffCheck = await this.checkPhoneIsStaff(mappedPhoneNormalized, tenantId);
        if (staffCheck) {
          console.log(`[Intent Classifier] ✅ LID mapped to verified staff phone: ${contextData.verifiedStaffPhone}`);
          // Update conversation to mark as staff
          await prisma.whatsAppConversation.update({
            where: { id: conversationWithMapping!.id },
            data: { isStaff: true, conversationType: "staff" },
          });
          return true;
        }
      }

      console.log(`[Intent Classifier] ❌ LID not verified as staff - treating as customer`);
      console.log(`[Intent Classifier] 💡 TIP: Staff should first send a message from main phone, or use /verify command`);
      return false;
    }

    // Standard phone number check
    return this.checkPhoneIsStaff(normalizedInput, tenantId);
  }

  /**
   * Check if a normalized phone number belongs to staff
   */
  private static async checkPhoneIsStaff(
    normalizedPhone: string,
    tenantId: string
  ): Promise<boolean> {
    // Get staff users in tenant (only specific roles)
    const users = await prisma.user.findMany({
      where: {
        tenantId,
        role: { in: ["ADMIN", "MANAGER", "SALES", "STAFF"] },
      },
      select: { id: true, phone: true, firstName: true, role: true },
    });

    console.log(`[Intent Classifier] Found ${users.length} staff users in tenant`);

    // Warn about staff without phone numbers (they can't be detected via WhatsApp)
    const staffWithoutPhone = users.filter(u => !u.phone);
    if (staffWithoutPhone.length > 0) {
      console.warn(`[Intent Classifier] ⚠️ ${staffWithoutPhone.length} staff member(s) have no phone - cannot detect via WhatsApp:`);
      staffWithoutPhone.forEach(u => {
        console.warn(`[Intent Classifier]   - ${u.firstName} (${u.role})`);
      });
    }

    for (const user of users) {
      if (!user.phone) continue;
      const normalizedUserPhone = this.normalizePhone(user.phone);
      console.log(`[Intent Classifier] Comparing: ${normalizedPhone} vs ${normalizedUserPhone} (${user.firstName} - ${user.role})`);
      if (normalizedPhone === normalizedUserPhone) {
        console.log(`[Intent Classifier] ✅ Staff match found: ${user.firstName} (${user.role})`);
        return true;
      }
    }

    console.log(`[Intent Classifier] ❌ No staff match found`);
    return false;
  }

  /**
   * Classify staff command
   * @param hasMedia - If true, check for vehicle description patterns for auto-upload
   */
  private static classifyStaffCommand(
    message: string,
    hasMedia: boolean = false
  ): IntentClassificationResult | null {
    // Check upload vehicle command patterns
    if (STAFF_COMMAND_PATTERNS.upload_vehicle.some((p) => p.test(message))) {
      return {
        intent: "staff_upload_vehicle",
        confidence: 0.95,
        isStaff: true,
        isCustomer: false,
        reason: "Matched upload vehicle command pattern",
      };
    }

    // If staff sends a photo with vehicle description (no explicit "upload" command)
    // Auto-detect as vehicle upload
    if (hasMedia && VEHICLE_DESCRIPTION_PATTERN.test(message)) {
      console.log(`[Intent Classifier] Staff sent photo with vehicle description: "${message}"`);
      return {
        intent: "staff_upload_vehicle",
        confidence: 0.9,
        isStaff: true,
        isCustomer: false,
        reason: "Staff photo with vehicle description pattern detected",
      };
    }

    // Also check for vehicle description without photo but with clear vehicle data
    // Pattern: [brand/model] [year] [price in jt/juta] [km/kilometer]
    if (VEHICLE_DESCRIPTION_PATTERN.test(message)) {
      console.log(`[Intent Classifier] Vehicle description detected: "${message}"`);
      return {
        intent: "staff_upload_vehicle",
        confidence: 0.85,
        isStaff: true,
        isCustomer: false,
        reason: "Vehicle description pattern detected (brand + year + price)",
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

    // Check staff greeting (halo, hai, hello, etc.)
    // Show welcome menu with options
    const greetingPatterns = [
      /^(halo|hai|hello|hi|hey|hallo|hei)$/i,
      /^(halo|hai|hello|hi|hey|hallo|hei)\s*(kak|min|admin|bos|boss)?[.!]?$/i,
      /^(selamat\s+(pagi|siang|sore|malam))$/i,
      /^(pagi|siang|sore|malam)$/i,
      /^(assalamu.*alaikum|assalamualaikum)/i,
      /^(met\s+(pagi|siang|sore|malam))/i,
    ];

    if (greetingPatterns.some((p) => p.test(message))) {
      return {
        intent: "staff_greeting",
        confidence: 0.95,
        isStaff: true,
        isCustomer: false,
        reason: "Staff greeting - show welcome menu",
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

    // Check photo confirmation FIRST (highest priority for short responses)
    // This catches "iya", "mau", "boleh" etc. after being offered photos
    if (CUSTOMER_PATTERNS.photo_confirmation.some((p) => p.test(message.trim()))) {
      console.log('[Intent Classifier] 📸 Photo confirmation detected:', message);
      return {
        intent: "customer_vehicle_inquiry", // Route to AI to handle photo sending
        confidence: 0.95,
        isStaff: false,
        isCustomer: true,
        reason: "Photo confirmation detected - customer wants photos",
      };
    }

    // Check photo request
    if (CUSTOMER_PATTERNS.photo_request.some((p) => p.test(message))) {
      console.log('[Intent Classifier] 📷 Photo request detected:', message);
      return {
        intent: "customer_vehicle_inquiry", // Route to AI to handle photo sending
        confidence: 0.9,
        isStaff: false,
        isCustomer: true,
        reason: "Photo request detected - customer asking for photos",
      };
    }

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
