/**
 * WhatsApp AI Vehicle Edit Service
 *
 * Handles vehicle editing from WhatsApp with:
 * - Natural language field/value extraction
 * - Multi-field edit support
 * - Last uploaded vehicle context tracking
 * - Authorization checks (uploader or admin/manager)
 * - Validation of new values
 * - VehicleHistory audit trail
 */

import { prisma } from "@/lib/prisma";
import { UploadNotificationService } from "./upload-notification.service";
import { generateVehicleUrl } from "@/lib/utils/vehicle-slug";

// ==================== TYPES ====================

export interface VehicleEditField {
  field: string;
  oldValue?: string;
  newValue: string;
}

export interface VehicleEditRequest {
  vehicleId?: string; // displayId or UUID (optional if using context)
  vehicleName?: string; // For vehicle-name-based search (e.g., "innova reborn")
  vehicleYear?: number; // For filtering by year when using vehicleName
  fields: VehicleEditField[]; // Support multiple field edits
  staffPhone: string; // For authorization
  tenantId: string;
  conversationId?: string; // Optional - for context lookup of lastUploadedVehicleId
}

export interface VehicleEditResult {
  success: boolean;
  message: string;
  vehicleId?: string;
  displayId?: string;
  changes?: Array<{
    field: string;
    fieldLabel: string;
    oldValue: any;
    newValue: any;
  }>;
  error?: string;
}

// Field mapping from Indonesian to database fields
const FIELD_MAP: Record<string, string> = {
  // Year
  tahun: "year",
  year: "year",
  // Price
  harga: "price",
  price: "price",
  // Mileage
  km: "mileage",
  kilometer: "mileage",
  mileage: "mileage",
  odometer: "mileage",
  // Color
  warna: "color",
  color: "color",
  // Transmission
  transmisi: "transmissionType",
  transmission: "transmissionType",
  // Fuel type
  bensin: "fuelType",
  solar: "fuelType",
  diesel: "fuelType",
  bahan_bakar: "fuelType",
  bahanbakar: "fuelType",
  fuel: "fuelType",
  fueltype: "fuelType",
  // Make
  merek: "make",
  merk: "make",
  brand: "make",
  make: "make",
  // Model
  tipe: "model",
  type: "model",
  model: "model",
  // Variant
  varian: "variant",
  variant: "variant",
  // Engine capacity
  cc: "engineCapacity",
  kapasitas: "engineCapacity",
  mesin: "engineCapacity",
  enginecapacity: "engineCapacity",
  // Condition
  kondisi: "condition",
  condition: "condition",
};

// Fuel type mapping
const FUEL_MAP: Record<string, string> = {
  bensin: "bensin",
  premium: "bensin",
  pertalite: "bensin",
  pertamax: "bensin",
  diesel: "diesel",
  solar: "diesel",
  hybrid: "hybrid",
  electric: "electric",
  listrik: "electric",
  ev: "electric",
};

// Transmission mapping
const TRANSMISSION_MAP: Record<string, string> = {
  manual: "manual",
  mt: "manual",
  matic: "automatic",
  matik: "automatic",
  automatic: "automatic",
  at: "automatic",
  cvt: "cvt",
};

// Field labels for display
const FIELD_LABELS: Record<string, string> = {
  year: "Tahun",
  price: "Harga",
  mileage: "Kilometer",
  color: "Warna",
  transmissionType: "Transmisi",
  fuelType: "Bahan Bakar",
  make: "Merek",
  model: "Model",
  variant: "Varian",
  engineCapacity: "Kapasitas Mesin",
  condition: "Kondisi",
};

// ==================== SERVICE ====================

export class VehicleEditService {
  /**
   * Edit vehicle from WhatsApp with multi-field support
   * Now supports vehicle name + year search
   */
  static async editVehicle(request: VehicleEditRequest): Promise<VehicleEditResult> {
    console.log("[Vehicle Edit] Starting edit request:", JSON.stringify(request, null, 2));

    try {
      // 1. Find target vehicle
      const vehicle = await this.findTargetVehicle(
        request.vehicleId,
        request.staffPhone,
        request.tenantId,
        request.conversationId,
        request.vehicleName,
        request.vehicleYear
      );

      if (!vehicle) {
        const searchInfo = request.vehicleName
          ? `"${request.vehicleName}${request.vehicleYear ? ` ${request.vehicleYear}` : ''}"`
          : (request.vehicleId || 'context');
        return {
          success: false,
          message:
            `Kendaraan ${searchInfo} tidak ditemukan.\n\n` +
            `Pastikan nama/ID kendaraan benar atau upload kendaraan terlebih dahulu.\n` +
            `Contoh: edit PM-PST-001 tahun 2020\nAtau: ubah innova 2019 jadi bensin`,
          error: "Vehicle not found",
        };
      }

      // 2. Check authorization
      const authResult = await this.checkAuthorization(vehicle, request.staffPhone, request.tenantId);

      if (!authResult.authorized) {
        return {
          success: false,
          message: authResult.message,
          error: "Unauthorized",
        };
      }

      // 3. Check if vehicle can be edited (not SOLD/DELETED)
      if (vehicle.status === "SOLD" || vehicle.status === "DELETED") {
        return {
          success: false,
          message:
            `Kendaraan ${vehicle.displayId || vehicle.id} tidak dapat diedit.\n\n` +
            `Status: ${vehicle.status}\n` +
            `Kendaraan SOLD/DELETED tidak bisa diubah.`,
          error: "Vehicle not editable",
        };
      }

      // 4. Process each field edit
      const updateData: Record<string, any> = {
        updatedBy: authResult.staffId,
        manuallyEdited: true,
      };
      const changes: VehicleEditResult["changes"] = [];
      const errors: string[] = [];

      for (const fieldEdit of request.fields) {
        // Normalize field name
        const dbField = this.normalizeField(fieldEdit.field);
        if (!dbField) {
          errors.push(`Field "${fieldEdit.field}" tidak dikenali`);
          continue;
        }

        // Validate and normalize value
        const validation = this.validateAndNormalizeValue(dbField, fieldEdit.newValue);
        if (!validation.valid) {
          errors.push(validation.message || `Nilai tidak valid untuk ${fieldEdit.field}`);
          continue;
        }

        // Get old value
        const oldValue = (vehicle as any)[dbField];

        // Special handling for price (store in full IDR, NOT cents)
        if (dbField === "price") {
          updateData.price = BigInt(Math.round(validation.value));
        } else {
          updateData[dbField] = validation.value;
        }

        changes.push({
          field: dbField,
          fieldLabel: FIELD_LABELS[dbField] || dbField,
          oldValue,
          newValue: validation.value,
        });
      }

      // If all fields failed validation
      if (changes.length === 0 && errors.length > 0) {
        return {
          success: false,
          message:
            `Gagal update kendaraan.\n\n` +
            `Error:\n${errors.map((e) => `• ${e}`).join("\n")}\n\n` +
            `*Field yang valid:*\n` +
            `tahun, harga, km, warna, transmisi, bensin/diesel, merek, tipe, varian, cc, kondisi`,
          error: errors.join("; "),
        };
      }

      // 5. Update vehicle
      await prisma.vehicle.update({
        where: { id: vehicle.id },
        data: updateData,
      });

      // 6. Create history record
      await prisma.vehicleHistory.create({
        data: {
          vehicleId: vehicle.id,
          tenantId: request.tenantId,
          version: 1,
          action: "UPDATE",
          snapshot: {},
          changedFields: changes.map((c) => c.field),
          previousValues: Object.fromEntries(changes.map((c) => [c.field, c.oldValue])),
          newValues: Object.fromEntries(changes.map((c) => [c.field, c.newValue])),
          changedBy: request.staffPhone,
          changedByName: authResult.staffName,
          changeReason: `Edited via WhatsApp: ${changes.map((c) => c.fieldLabel).join(", ")}`,
        },
      });

      // 7. Format success message
      const vehicleName = `${vehicle.make} ${vehicle.model} ${vehicle.year}`;
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://primamobil.id';
      const vehicleParams = {
        make: vehicle.make,
        model: vehicle.model,
        year: vehicle.year,
        displayId: vehicle.displayId || vehicle.id.substring(0, 8),
      };
      const vehicleUrl = generateVehicleUrl(vehicleParams, baseUrl);
      let message: string;

      if (changes.length === 1) {
        // Single field change
        const change = changes[0];
        const formattedOld = this.formatValue(change.field, change.oldValue);
        const formattedNew = this.formatValue(change.field, change.newValue);
        message =
          `✅ Berhasil update ${vehicleName}!\n\n` +
          `${change.fieldLabel}: ${formattedOld} → ${formattedNew}\n` +
          `ID: ${vehicle.displayId || vehicle.id}\n\n` +
          `🌐 Website:\n${vehicleUrl}\n\n` +
          `📊 Dashboard:\n${baseUrl}/dashboard/vehicles/${vehicle.id}`;
      } else {
        // Multi-field changes
        const changeLines = changes.map((c) => {
          const formattedOld = this.formatValue(c.field, c.oldValue);
          const formattedNew = this.formatValue(c.field, c.newValue);
          return `• ${c.fieldLabel}: ${formattedOld} → ${formattedNew}`;
        });
        message =
          `✅ Berhasil update ${vehicleName}!\n\n` +
          `Perubahan:\n${changeLines.join("\n")}\n\n` +
          `ID: ${vehicle.displayId || vehicle.id}\n\n` +
          `🌐 Website:\n${vehicleUrl}\n\n` +
          `📊 Dashboard:\n${baseUrl}/dashboard/vehicles/${vehicle.id}`;
      }

      // Add partial error info if some fields failed
      if (errors.length > 0) {
        message += `\n\n⚠️ Beberapa field gagal:\n${errors.map((e) => `• ${e}`).join("\n")}`;
      }

      // 8. Notify all other staff about the edit
      // Use registered phone from database (authResult.staffPhone) instead of incoming message phone
      UploadNotificationService.notifyEditSuccess(
        request.tenantId,
        authResult.staffPhone || request.staffPhone,
        {
          vehicleId: vehicle.id,
          displayId: vehicle.displayId || undefined,
          vehicleName,
          changes: changes.map(c => ({
            fieldLabel: c.fieldLabel,
            oldValue: this.formatValue(c.field, c.oldValue),
            newValue: this.formatValue(c.field, c.newValue),
          })),
        },
        authResult.staffName
      ).catch(err => console.error('[Vehicle Edit] Notification error:', err.message));

      return {
        success: true,
        message,
        vehicleId: vehicle.id,
        displayId: vehicle.displayId || undefined,
        changes,
      };
    } catch (error: any) {
      console.error("[Vehicle Edit] Error:", error);
      return {
        success: false,
        message: `Gagal update kendaraan.\n\n${error.message}`,
        error: error.message,
      };
    }
  }

  /**
   * Parse edit command to extract fields and values
   * Supports multi-field: "tahun 2018, warna hitam, km 50000"
   */
  static parseEditFields(message: string): { vehicleId?: string; fields: VehicleEditField[] } {
    console.log(`[Vehicle Edit] Parsing edit message: "${message}"`);

    // Remove command prefix
    let cleanMessage = message
      .replace(/^\/edit\s+/i, "")
      .replace(/^edit\s+/i, "")
      .replace(/^(rubah|ganti|ubah|update|koreksi|perbaiki)\s+/i, "")
      .trim();

    // Check for vehicle ID at start (PM-XXX-NNN format or UUID)
    let vehicleId: string | undefined;
    const idMatch = cleanMessage.match(/^(PM-\w+-\d+|[a-f0-9-]{36})\s+/i);
    if (idMatch) {
      vehicleId = idMatch[1];
      cleanMessage = cleanMessage.substring(idMatch[0].length).trim();
    }

    const fields: VehicleEditField[] = [];

    // Split by comma for multi-field
    const parts = cleanMessage.split(/,\s*/);

    for (const part of parts) {
      const trimmedPart = part.trim();
      if (!trimmedPart) continue;

      // Pattern 1: "field old_value (jadi|ke) new_value" (e.g., "bensin jadi diesel")
      const changePattern = /^(\w+)\s+(.+?)\s+(jadi|ke|menjadi)\s+(.+)$/i;
      const changeMatch = trimmedPart.match(changePattern);

      if (changeMatch) {
        fields.push({
          field: changeMatch[1],
          oldValue: changeMatch[2],
          newValue: changeMatch[4],
        });
        continue;
      }

      // Pattern 2: "field new_value" (e.g., "harga 150jt", "tahun 2020")
      const simplePattern = /^(\w+)\s+(.+)$/i;
      const simpleMatch = trimmedPart.match(simplePattern);

      if (simpleMatch) {
        fields.push({
          field: simpleMatch[1],
          newValue: simpleMatch[2],
        });
        continue;
      }

      // Pattern 3: Single word might be a value without field (e.g., "diesel" after "bensin jadi")
      // Skip for now - requires more context
    }

    console.log(`[Vehicle Edit] Parsed: vehicleId=${vehicleId}, fields=`, fields);
    return { vehicleId, fields };
  }

  /**
   * Normalize field name from Indonesian to database field
   */
  private static normalizeField(field: string): string | null {
    const normalized = field.toLowerCase().trim().replace(/[_-]/g, "");
    return FIELD_MAP[normalized] || null;
  }

  /**
   * Find target vehicle by ID, name + year, or from recent uploads / conversation context
   * Now supports vehicle name search (e.g., "innova reborn 2019")
   */
  private static async findTargetVehicle(
    vehicleId: string | undefined,
    staffPhone: string,
    tenantId: string,
    conversationId?: string,
    vehicleName?: string,
    vehicleYear?: number
  ) {
    const selectFields = {
      id: true,
      displayId: true,
      make: true,
      model: true,
      year: true,
      status: true,
      createdBy: true,
      price: true,
      mileage: true,
      color: true,
      transmissionType: true,
      fuelType: true,
      variant: true,
      engineCapacity: true,
      condition: true,
    };

    // If vehicleId provided, search by displayId or UUID
    if (vehicleId) {
      return await prisma.vehicle.findFirst({
        where: {
          tenantId,
          OR: [{ id: vehicleId }, { displayId: vehicleId }],
        },
        select: selectFields,
      });
    }

    // NEW: If vehicleName provided, search by name + optional year
    if (vehicleName) {
      console.log(`[Vehicle Edit] Searching by vehicle name: "${vehicleName}", year: ${vehicleYear}`);

      // Split vehicle name into search terms
      const searchTerms = vehicleName.toLowerCase().split(/\s+/).filter(t => t.length > 1);
      console.log(`[Vehicle Edit] Search terms: ${searchTerms.join(', ')}`);

      // Build search conditions - each term must match make, model, or variant
      const termConditions = searchTerms.map(term => ({
        OR: [
          { make: { contains: term, mode: 'insensitive' as const } },
          { model: { contains: term, mode: 'insensitive' as const } },
          { variant: { contains: term, mode: 'insensitive' as const } },
        ]
      }));

      const vehicle = await prisma.vehicle.findFirst({
        where: {
          tenantId,
          status: { not: 'DELETED' },
          AND: termConditions,
          ...(vehicleYear && { year: vehicleYear }),
        },
        orderBy: { createdAt: 'desc' }, // Most recent first
        select: selectFields,
      });

      if (vehicle) {
        console.log(`[Vehicle Edit] Found vehicle by name: ${vehicle.make} ${vehicle.model} ${vehicle.year} (${vehicle.id})`);
        return vehicle;
      }

      console.log(`[Vehicle Edit] No vehicle found matching name: "${vehicleName}"`);
      return null;
    }

    // Check conversation context for lastUploadedVehicleId
    if (conversationId) {
      const conversation = await prisma.whatsAppConversation.findUnique({
        where: { id: conversationId },
        select: { contextData: true },
      });

      const contextData = (conversation?.contextData as Record<string, any>) || {};
      if (contextData.lastUploadedVehicleId) {
        console.log(`[Vehicle Edit] Found lastUploadedVehicleId in context: ${contextData.lastUploadedVehicleId}`);
        const vehicle = await prisma.vehicle.findUnique({
          where: { id: contextData.lastUploadedVehicleId },
          select: selectFields,
        });
        if (vehicle) {
          return vehicle;
        }
      }
    }

    // Fallback: Find most recent vehicle uploaded by this staff (within last 24 hours)
    const staff = await this.findStaffByPhone(tenantId, staffPhone);

    if (staff) {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      return await prisma.vehicle.findFirst({
        where: {
          tenantId,
          createdBy: staff.id,
          status: { notIn: ["DELETED"] },
          createdAt: { gte: oneDayAgo },
        },
        orderBy: { createdAt: "desc" },
        select: selectFields,
      });
    }

    return null;
  }

  /**
   * Check if staff is authorized to edit this vehicle
   * All registered staff can edit any vehicle from the same tenant
   */
  private static async checkAuthorization(
    vehicle: any,
    staffPhone: string,
    tenantId: string
  ): Promise<{ authorized: boolean; message: string; staffId?: string; staffName?: string; staffPhone?: string }> {
    const staff = await this.findStaffByPhone(tenantId, staffPhone);

    if (!staff) {
      return {
        authorized: false,
        message: "Nomor WhatsApp Anda belum terdaftar sebagai staff.",
      };
    }

    const staffName = `${staff.firstName || ""} ${staff.lastName || ""}`.trim();

    // All registered staff can edit any vehicle from the same tenant
    // Return the registered phone from database (not the incoming message phone)
    return { authorized: true, message: "", staffId: staff.id, staffName, staffPhone: staff.phone || undefined };
  }

  /**
   * Validate and normalize value based on field type
   */
  private static validateAndNormalizeValue(
    field: string,
    value: string
  ): { valid: boolean; value?: any; message?: string } {
    const normalized = value.toLowerCase().trim();

    switch (field) {
      case "year":
        const year = parseInt(value, 10);
        const currentYear = new Date().getFullYear();
        if (isNaN(year) || year < 1980 || year > currentYear + 1) {
          return {
            valid: false,
            message: `Tahun tidak valid. Harus antara 1980-${currentYear + 1}.`,
          };
        }
        return { valid: true, value: year };

      case "price":
        const price = this.parsePrice(value);
        if (!price || price <= 0 || price > 100000000000) {
          return {
            valid: false,
            message: "Harga tidak valid. Contoh: 120jt, 150000000",
          };
        }
        return { valid: true, value: price };

      case "mileage":
        const km = this.parseMileage(value);
        if (km === null || km < 0 || km > 1000000) {
          return {
            valid: false,
            message: "Kilometer tidak valid. Harus antara 0-1.000.000 km.",
          };
        }
        return { valid: true, value: km };

      case "transmissionType":
        const transmission = TRANSMISSION_MAP[normalized];
        if (!transmission) {
          return {
            valid: false,
            message: "Transmisi tidak valid. Pilihan: manual, matic, cvt",
          };
        }
        return { valid: true, value: transmission };

      case "fuelType":
        const fuel = FUEL_MAP[normalized];
        if (!fuel) {
          return {
            valid: false,
            message: "Bahan bakar tidak valid. Pilihan: bensin, diesel, hybrid, electric",
          };
        }
        return { valid: true, value: fuel };

      case "color":
      case "make":
      case "model":
      case "variant":
      case "engineCapacity":
      case "condition":
        // String fields - capitalize first letter of each word
        const capitalizedValue = value
          .split(" ")
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
          .join(" ");
        return { valid: true, value: capitalizedValue };

      default:
        return { valid: true, value };
    }
  }

  /**
   * Parse Indonesian price format
   */
  private static parsePrice(value: string): number | null {
    const cleaned = value.replace(/[.,\s]/g, "").toLowerCase();

    // Handle "jt" or "juta" suffix
    const jtMatch = cleaned.match(/^(\d+)(jt|juta)$/);
    if (jtMatch) {
      return parseInt(jtMatch[1], 10) * 1000000;
    }

    // Handle decimal juta (e.g., "1.5jt" = 1,500,000)
    const decimalJtMatch = value.match(/^(\d+)[.,](\d+)\s*(jt|juta)$/i);
    if (decimalJtMatch) {
      const whole = parseInt(decimalJtMatch[1], 10);
      const decimal = parseInt(decimalJtMatch[2], 10);
      const decimalPlaces = decimalJtMatch[2].length;
      return (whole + decimal / Math.pow(10, decimalPlaces)) * 1000000;
    }

    // Handle "rb" or "ribu" suffix
    const rbMatch = cleaned.match(/^(\d+)(rb|ribu)$/);
    if (rbMatch) {
      return parseInt(rbMatch[1], 10) * 1000;
    }

    // Handle plain number
    const num = parseInt(cleaned, 10);
    return isNaN(num) ? null : num;
  }

  /**
   * Parse Indonesian mileage format
   */
  private static parseMileage(value: string): number | null {
    const cleaned = value.replace(/[.,\s]/g, "").toLowerCase();

    // Handle "rb" or "ribu" suffix
    const rbMatch = cleaned.match(/^(\d+)(rb|ribu|k)$/);
    if (rbMatch) {
      return parseInt(rbMatch[1], 10) * 1000;
    }

    // Handle plain number
    const num = parseInt(cleaned, 10);
    return isNaN(num) ? null : num;
  }

  /**
   * Format value for display
   */
  private static formatValue(field: string, value: any): string {
    if (value === null || value === undefined) return "-";

    switch (field) {
      case "price":
        const priceNum = typeof value === "bigint" ? Number(value) / 100 : value;
        return `Rp ${new Intl.NumberFormat("id-ID").format(priceNum)}`;
      case "mileage":
        return `${new Intl.NumberFormat("id-ID").format(value)} km`;
      default:
        return String(value);
    }
  }

  /**
   * Normalize phone number
   */
  private static normalizePhone(phone: string): string {
    if (!phone) return "";
    let digits = phone.replace(/\D/g, "");
    if (digits.startsWith("0")) {
      digits = "62" + digits.substring(1);
    }
    return digits;
  }

  /**
   * Find staff by phone number
   */
  private static async findStaffByPhone(tenantId: string, staffPhone: string) {
    const normalizedInput = this.normalizePhone(staffPhone);
    const users = await prisma.user.findMany({
      where: { tenantId },
      select: { id: true, phone: true, firstName: true, lastName: true, role: true },
    });

    for (const user of users) {
      if (!user.phone) continue;
      const normalizedUserPhone = this.normalizePhone(user.phone);
      if (normalizedInput === normalizedUserPhone) {
        return user;
      }
    }
    return null;
  }
}

export default VehicleEditService;
