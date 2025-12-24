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
  | "customer_photo_confirmation"  // New: explicit photo confirmation
  | "customer_follow_up"           // New: follow-up/continuation
  | "customer_negative"            // New: rejection/negative response
  | "customer_closing"             // New: closing/thanks
  | "staff_greeting"
  | "staff_upload_vehicle"
  | "staff_update_status"
  | "staff_check_inventory"
  | "staff_get_stats"
  | "staff_verify_identity"
  | "staff_edit_vehicle"
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
// NOTE: "/" prefix is OPTIONAL - commands work with or without it
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
    /^upload\s+(kendaraan|mobil|unit)/i,   // upload kendaraan, upload mobil
    /^upload\s+(kendaraan|mobil|unit)\s+baru/i, // upload kendaraan baru, upload unit baru
  ],
  verify_staff: [
    /^\/verify\s+/i,                 // /verify 081234567890
    /^verify\s+/i,                   // verify 081234567890
    /^verifikasi\s+/i,               // verifikasi 081234567890
  ],
  update_status: [
    /^\/status\s+/i,                 // /status PM-PST-001 SOLD
    /^status\s+\S+\s+(AVAILABLE|BOOKED|SOLD|DELETED)/i, // status PM-PST-001 SOLD (without /)
    /^status\s+(PM-|[A-Z]{2,3}-)/i,  // status PM-PST-001 (ID only, will show error for missing status)
    /^update\s+status/i,             // update status
    /^ubah\s+status/i,               // ubah status
    /^ganti\s+status/i,              // ganti status
  ],
  check_inventory: [
    /^\/inventory/i,                 // /inventory
    /^\/stock/i,                     // /stock
    /^\/stok/i,                      // /stok
    /^inventory\b/i,                 // inventory, inventory AVAILABLE
    /^stok\b/i,                      // stok, stok AVAILABLE
    /^stock\b/i,                     // stock, stock AVAILABLE
    /^cek\s*stok/i,                  // "cek stok" or "cekstok"
    /^check\s*stok/i,                // "check stok" (English spelling)
    /^(mau|pengen|ingin)\s*(cek|check|lihat)\s*stok/i, // "mau cek stok", "pengen lihat stok"
    /^lihat\s+(inventory|stok|stock)/i, // "lihat inventory" or "lihat stok"
    /^daftar\s+mobil/i,
    /^(list|daftar)\s+(unit|mobil|kendaraan)/i,
    /^berapa\s+(stok|stock|unit)/i,  // "berapa stok", "berapa unit"
    /^ada\s+berapa\s+(unit|mobil)/i, // "ada berapa unit"
  ],
  get_stats: [
    /^\/stats/i,                     // /stats
    /^\/report/i,                    // /report
    /^stats\b/i,                     // stats, stats today, stats week
    /^laporan/i,                     // laporan
    /^statistik/i,                   // statistik
    /^report\b/i,                    // report, report today
  ],
  edit_vehicle: [
    /^\/edit/i,                      // /edit PM-PST-001 km 50000
    /^edit\s+/i,                     // edit km 50000
    /^rubah\s+/i,                    // rubah km 50000, rubah bensin jadi diesel
    /^ganti\s+/i,                    // ganti tahun ke 2018
    /^ubah\s+/i,                     // ubah transmisi ke matic
    /^update\s+(km|harga|tahun|warna|transmisi|bensin|diesel|cc)/i, // update km 50000
    /^koreksi\s+/i,                  // koreksi data
    /^perbaiki\s+/i,                 // perbaiki km
  ],
};

// Customer inquiry patterns
const CUSTOMER_PATTERNS = {
  greeting: [
    /^(halo|helo|hai|hello|hi|hey|hallo|hei|haloha|halohaa?|pagi|siang|sore|malam)/i,
    /^assalam/i,
    /selamat\s+(pagi|siang|sore|malam)/i,
    /^(yo|yoo|woi|woii|hoi|hoii)$/i,
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
    // Single word confirmations
    /^(iya|ya|yup|yap|ok|oke|okay|okey|boleh|mau|sip|siap|bisa|gas|tentu|pasti|betul|benar)$/i,
    /^(let'?s?\s*go|kirim|send|tampilkan|tunjukkan|kasih|berikan|lanjut|next)$/i,
    // Compound confirmations
    /^(iya\s+boleh|ya\s+boleh|boleh\s+dong|mau\s+dong|oke\s+kirim|ya\s+kirim)$/i,
    /^(ok\s+kirim|sip\s+kirim|gas\s+kirim|oke\s+dong|boleh\s+aja)$/i,
    /^(silahkan|silakan|monggo|mangga)\s*(kirim)?/i,
    /^(tolong|please|coba)\s*(kirim|send|lihat)/i,
    // Waiting phrases
    /^(ditunggu|saya\s+tunggu|tunggu\s+ya|ok\s+ditunggu|sip\s+ditunggu)$/i,
    /^(kirim\s+aja|kirim\s+dong|kirim\s+ya|kirim\s+deh)$/i,
    // Short affirmative
    /^(yoi|yess?|yup|yap|yep|oks?|okee?y?|sippp?)$/i,
  ],
  // New: Follow-up/continuation patterns
  follow_up: [
    /^(terus|lalu|kemudian|selanjutnya|lanjut)$/i,
    /^(gimana|bagaimana)\s*(itu|nya)?$/i,
    /^(yang\s+tadi|tadi\s+itu|itu\s+tadi)$/i,
    /^(maksudnya|maksud\s+saya)$/i,
    /^(jadi|so|nah)$/i,
  ],
  // New: Negative/rejection patterns
  negative_response: [
    /^(tidak|nggak|gak|ga|enggak|engga|no|nope|jangan|skip|lewat)$/i,
    /^(tidak\s+jadi|ga\s+jadi|gajadi|nggak\s+deh|gak\s+usah)$/i,
    /^(nanti\s+aja|nanti\s+dulu|belum|kapan-kapan)$/i,
  ],
  // New: Closing/thanks patterns
  closing: [
    /^(makasih|terima\s*kasih|thanks|thank\s*you|tq|thx|tengkyu)$/i,
    /^(cukup|sudah|udah|selesai|done|ok\s+cukup|sip\s+cukup)$/i,
    /^(tidak\s+ada|ga\s+ada|gak\s+ada|cuma\s+itu)$/i,
    /^(sampai\s+jumpa|bye|dadah|see\s+you)$/i,
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
   * @param conversationIsStaff - Optional flag from conversation to skip redundant staff check
   */
  static async classify(
    message: string,
    senderPhone: string,
    tenantId: string,
    hasMedia: boolean = false,
    conversationIsStaff: boolean = false
  ): Promise<IntentClassificationResult> {
    // Normalize message
    const normalizedMessage = (message || "").trim();
    console.log(`[Intent Classifier] Message: "${normalizedMessage}", hasMedia: ${hasMedia}, conversationIsStaff: ${conversationIsStaff}`);

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
    // IMPORTANT: Trust conversationIsStaff flag to avoid redundant DB queries
    // This also fixes LID format issues where phone matching fails
    const isStaff = conversationIsStaff || await this.isStaffMember(senderPhone, tenantId);
    console.log(`[Intent Classifier] Is staff: ${isStaff} (from conversation: ${conversationIsStaff})`);

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
   * Handles various formats: +62xxx, 62xxx, 0xxx, 08xxx, with spaces/dashes
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

    // Handle device suffix (e.g., "6281234567890:17")
    if (phone.includes(":")) {
      phone = phone.split(":")[0];
    }

    // Remove all non-digit characters (spaces, dashes, parentheses, +)
    let digits = phone.replace(/\D/g, "");

    // Convert Indonesian formats to standard 62xxx
    if (digits.startsWith("0")) {
      digits = "62" + digits.substring(1);
    }

    // Handle +62 format (digits would be 62xxx after removing +)
    // This is already handled by the regex above

    // Handle case where someone enters just 8xxx (missing country code)
    if (digits.startsWith("8") && digits.length >= 9 && digits.length <= 12) {
      digits = "62" + digits;
    }

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
   * Uses cache for performance but always verifies against DB
   */
  private static async checkPhoneIsStaff(
    normalizedPhone: string,
    tenantId: string
  ): Promise<boolean> {
    console.log(`[Intent Classifier] 🔍 Checking if ${normalizedPhone} is staff in tenant ${tenantId}`);

    // Check cache first for quick lookup
    const cacheKey = tenantId;
    const cached = staffCache.get(cacheKey);
    const now = Date.now();

    if (cached && now - cached.timestamp < STAFF_CACHE_TTL) {
      const isStaffCached = cached.phones.has(normalizedPhone);
      console.log(`[Intent Classifier] 📦 Cache hit: ${normalizedPhone} isStaff=${isStaffCached}`);
      if (isStaffCached) return true;
      // If not in cache, still check DB (staff might have been added recently)
    }

    // Get staff users in tenant (only specific roles)
    const users = await prisma.user.findMany({
      where: {
        tenantId,
        role: { in: ["ADMIN", "MANAGER", "SALES", "STAFF"] },
      },
      select: { id: true, phone: true, firstName: true, lastName: true, role: true },
    });

    console.log(`[Intent Classifier] 👥 Found ${users.length} staff users in tenant`);

    // Build cache and check for match
    const staffPhones = new Set<string>();
    let matchedUser: typeof users[0] | null = null;

    for (const user of users) {
      if (!user.phone) {
        console.log(`[Intent Classifier] ⚠️ Staff ${user.firstName} ${user.lastName} (${user.role}) has no phone registered`);
        continue;
      }

      const normalizedUserPhone = this.normalizePhone(user.phone);
      staffPhones.add(normalizedUserPhone);

      console.log(`[Intent Classifier] 📞 Staff: ${user.firstName} ${user.lastName} (${user.role})`);
      console.log(`[Intent Classifier]    DB phone: "${user.phone}" → normalized: "${normalizedUserPhone}"`);
      console.log(`[Intent Classifier]    Incoming: "${normalizedPhone}" === "${normalizedUserPhone}" ? ${normalizedPhone === normalizedUserPhone}`);

      if (normalizedPhone === normalizedUserPhone) {
        matchedUser = user;
      }
    }

    // Update cache
    staffCache.set(cacheKey, { phones: staffPhones, timestamp: now });

    if (matchedUser) {
      console.log(`[Intent Classifier] ✅ STAFF MATCH: ${matchedUser.firstName} ${matchedUser.lastName} (${matchedUser.role})`);
      return true;
    }

    console.log(`[Intent Classifier] ❌ No staff match found for ${normalizedPhone}`);
    console.log(`[Intent Classifier] 💡 Registered staff phones: ${Array.from(staffPhones).join(', ')}`);
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

    // Check edit vehicle (rubah km, ganti bensin, ubah tahun, etc.)
    if (STAFF_COMMAND_PATTERNS.edit_vehicle.some((p) => p.test(message))) {
      console.log(`[Intent Classifier] ✏️ Edit vehicle command detected: "${message}"`);
      return {
        intent: "staff_edit_vehicle",
        confidence: 0.95,
        isStaff: true,
        isCustomer: false,
        reason: "Matched edit vehicle command pattern (rubah/ganti/ubah)",
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
      /^(halo|helo|hai|hello|hi|hey|hallo|hei|haloha|halohaa?)$/i,
      /^(halo|helo|hai|hello|hi|hey|hallo|hei|haloha)\s*(kak|min|admin|bos|boss)?[.!?]?$/i,
      /^(selamat\s+(pagi|siang|sore|malam))$/i,
      /^(pagi|siang|sore|malam)$/i,
      /^(assalamu.*alaikum|assalamualaikum)/i,
      /^(met\s+(pagi|siang|sore|malam))/i,
      /^(yo|yoo|woi|woii|hoi|hoii)$/i,             // informal greetings
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
   * Enhanced to recognize more behavior patterns for natural conversation flow
   */
  private static classifyCustomerIntent(
    message: string
  ): IntentClassificationResult {
    const trimmedMessage = message.trim();
    let maxConfidence = 0;
    let detectedIntent: MessageIntent = "customer_general_question";
    let reason = "Default customer inquiry";

    // 1. Check photo confirmation FIRST (highest priority for short responses)
    // This catches "iya", "mau", "boleh", "ditunggu" etc. after being offered photos
    if (CUSTOMER_PATTERNS.photo_confirmation.some((p) => p.test(trimmedMessage))) {
      console.log('[Intent Classifier] 📸 Photo confirmation detected:', message);
      return {
        intent: "customer_photo_confirmation",
        confidence: 0.98,
        isStaff: false,
        isCustomer: true,
        reason: "Photo confirmation detected - customer confirming to see photos/info",
      };
    }

    // 2. Check closing/thanks patterns (customer ending conversation)
    if (CUSTOMER_PATTERNS.closing.some((p) => p.test(trimmedMessage))) {
      console.log('[Intent Classifier] 👋 Closing/thanks detected:', message);
      return {
        intent: "customer_closing",
        confidence: 0.95,
        isStaff: false,
        isCustomer: true,
        reason: "Closing/thanks detected - customer ending conversation",
      };
    }

    // 3. Check negative response (customer rejecting offer)
    if (CUSTOMER_PATTERNS.negative_response.some((p) => p.test(trimmedMessage))) {
      console.log('[Intent Classifier] ❌ Negative response detected:', message);
      return {
        intent: "customer_negative",
        confidence: 0.95,
        isStaff: false,
        isCustomer: true,
        reason: "Negative response detected - customer declining",
      };
    }

    // 4. Check follow-up patterns
    if (CUSTOMER_PATTERNS.follow_up.some((p) => p.test(trimmedMessage))) {
      console.log('[Intent Classifier] 🔄 Follow-up detected:', message);
      return {
        intent: "customer_follow_up",
        confidence: 0.9,
        isStaff: false,
        isCustomer: true,
        reason: "Follow-up detected - customer continuing conversation",
      };
    }

    // 5. Check photo request
    if (CUSTOMER_PATTERNS.photo_request.some((p) => p.test(message))) {
      console.log('[Intent Classifier] 📷 Photo request detected:', message);
      return {
        intent: "customer_vehicle_inquiry",
        confidence: 0.9,
        isStaff: false,
        isCustomer: true,
        reason: "Photo request detected - customer asking for photos",
      };
    }

    // 6. Check greeting
    if (CUSTOMER_PATTERNS.greeting.some((p) => p.test(message))) {
      maxConfidence = Math.max(maxConfidence, 0.9);
      if (maxConfidence === 0.9) {
        detectedIntent = "customer_greeting";
        reason = "Detected greeting pattern";
      }
    }

    // 7. Check vehicle inquiry
    if (CUSTOMER_PATTERNS.vehicle_inquiry.some((p) => p.test(message))) {
      maxConfidence = Math.max(maxConfidence, 0.85);
      if (maxConfidence === 0.85) {
        detectedIntent = "customer_vehicle_inquiry";
        reason = "Detected vehicle inquiry keywords";
      }
    }

    // 8. Check price inquiry
    if (CUSTOMER_PATTERNS.price_inquiry.some((p) => p.test(message))) {
      maxConfidence = Math.max(maxConfidence, 0.85);
      if (maxConfidence === 0.85) {
        detectedIntent = "customer_price_inquiry";
        reason = "Detected price inquiry keywords";
      }
    }

    // 9. Check test drive
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
