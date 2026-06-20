/**
 * WhatsApp AI Tool Registry ("Falcon-lite")
 * -------------------------------------------------------------
 * Single source of truth for the WhatsApp AI agent's function-calling tools.
 *
 * Adopts MotoVax/Falcon's ideas WITHOUT the script-execution engine:
 *   - a clean `domain.action` taxonomy for every tool
 *   - per-role RBAC (which scope may see/call which tool)
 *
 * The agent's tool list sent to the LLM is filtered by the caller's scope, so
 * customers never receive staff-only tools (upload/edit/send-message), and the
 * dispatcher can reject a tool call that the sender is not allowed to make.
 *
 * FASE 2 of docs/GAP_ANALYSIS_AND_ROADMAP.md.
 */

import { ROLE_LEVELS } from '@/lib/rbac';

export type ToolScope = 'customer' | 'staff' | 'admin';

export interface WaToolDefinition {
  /** Falcon-style taxonomy name, e.g. "unit.query". For organization/telemetry. */
  taxonomy: string;
  /** The function name the LLM calls (kept stable for dispatch compatibility). */
  name: string;
  /** Which scopes may use this tool. 'admin' implies staff-level access too. */
  allow: ToolScope[];
  /** OpenAI-compatible function schema. */
  schema: {
    type: 'function';
    function: {
      name: string;
      description: string;
      parameters: Record<string, any>;
    };
  };
}

/**
 * Resolve a sender's tool scope from staff status + role level.
 */
export function resolveToolScope(isStaff: boolean | undefined, roleLevel?: number | null): ToolScope {
  if (!isStaff) return 'customer';
  if (roleLevel != null && roleLevel >= ROLE_LEVELS.ADMIN) return 'admin';
  return 'staff';
}

/** True if a scope is allowed to use a tool (admin inherits staff tools). */
function scopeAllowed(allow: ToolScope[], scope: ToolScope): boolean {
  if (allow.includes(scope)) return true;
  // admin inherits anything a staff member may do
  if (scope === 'admin' && allow.includes('staff')) return true;
  return false;
}

// ==================== TOOL DEFINITIONS ====================

export const WA_TOOLS: WaToolDefinition[] = [
  {
    taxonomy: 'photo.send',
    name: 'send_vehicle_images',
    allow: ['customer', 'staff', 'admin'],
    schema: {
      type: 'function',
      function: {
        name: 'send_vehicle_images',
        description:
          "Kirim foto kendaraan. Panggil saat customer confirm mau lihat foto (iya/boleh/mau/kirim) atau minta foto eksplisit. JANGAN panggil jika customer tanya detail verbal (interior/mesin/surat) tanpa minta foto secara eksplisit.",
        parameters: {
          type: 'object',
          properties: {
            search_query: {
              type: 'string',
              description: "Nama mobil dari konteks chat. Contoh: 'Brio', 'Avanza', 'PM-PST-001'.",
            },
          },
          required: ['search_query'],
        },
      },
    },
  },
  {
    taxonomy: 'unit.query',
    name: 'search_vehicles',
    allow: ['customer', 'staff', 'admin'],
    schema: {
      type: 'function',
      function: {
        name: 'search_vehicles',
        description:
          'Cari mobil berdasarkan kriteria (budget, merk, transmisi, dll). Gunakan untuk menjawab pertanyaan ketersediaan stok.',
        parameters: {
          type: 'object',
          properties: {
            min_price: { type: 'number', description: 'Harga min (Rupiah). Contoh: 100jt → 100000000' },
            max_price: { type: 'number', description: 'Harga max (Rupiah). Contoh: 150jt → 150000000' },
            make: { type: 'string', description: "Merk/Model/ID. Contoh: 'Toyota', 'Avanza', 'PM-PST-001'" },
            transmission: {
              type: 'string',
              enum: ['manual', 'automatic', 'matic', 'at', 'mt'],
              description: 'Transmisi: manual/mt atau automatic/matic/at',
            },
            min_year: { type: 'integer', description: 'Tahun min' },
            max_year: { type: 'integer', description: 'Tahun max' },
            fuel_type: {
              type: 'string',
              enum: ['bensin', 'diesel', 'hybrid', 'electric'],
              description: 'Jenis bahan bakar',
            },
            sort_by: {
              type: 'string',
              enum: ['newest', 'oldest', 'price_low', 'price_high', 'mileage_low'],
              description: 'Urutan sort',
            },
            limit: { type: 'integer', description: 'Max hasil (default 5)' },
          },
        },
      },
    },
  },
  {
    taxonomy: 'finance.simulate',
    name: 'calculate_kkb_simulation',
    allow: ['customer', 'staff', 'admin'],
    schema: {
      type: 'function',
      function: {
        name: 'calculate_kkb_simulation',
        description:
          "Menghitung simulasi kredit mobil (KKB). Panggil saat user tanya 'cicilan' atau simulasi. PENTING: Jangan panggil jika user hanya tanya 'syarat' atau dokumen tanpa minta hitungan baru.",
        parameters: {
          type: 'object',
          properties: {
            vehicle_price: { type: 'number', description: 'Harga kendaraan (Rupiah). Contoh: 150000000' },
            dp_amount: { type: 'number', description: 'Jumlah DP (Rupiah). Opsional.' },
            dp_percentage: {
              type: 'string',
              description: "Persen DP (e.g. '20' atau '20,30'). Gunakan koma jika user minta lebih dari satu. Default 30. Opsional.",
            },
            tenor_years: {
              type: 'string',
              description: "Tenor dalam tahun (1-5). Gunakan koma jika user minta lebih dari satu (e.g. '2,3,4,5'). Opsional.",
            },
            vehicle_year: { type: 'integer', description: 'Tahun kendaraan (e.g. 2020). Penting untuk akurasi bunga.' },
          },
          required: ['vehicle_price'],
        },
      },
    },
  },
  {
    taxonomy: 'lead.create',
    name: 'create_lead',
    allow: ['customer', 'staff', 'admin'],
    schema: {
      type: 'function',
      function: {
        name: 'create_lead',
        description:
          "Simpan data lead/prospeK ke CRM. PENTING: Tool ini HANYA BOLEH dipanggil SETELAH customer memberikan konfirmasi 'Ya' atau setuju saat ditanya apakah data ingin diteruskan ke tim Sales untuk closing/follow up manual.",
        parameters: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Nama customer' },
            phone: { type: 'string', description: 'Nomor HP/WA customer' },
            interest: { type: 'string', description: "Unit yang diminati (e.g. 'Honda City 2006')" },
            location: { type: 'string', description: "Lokasi customer (e.g. 'Jakarta Timur')" },
            budget: {
              type: 'string',
              description: "Range budget (e.g. '100-150 juta'). WAJIB DIISI jika user pernah menyebutkan angka budget di chat history.",
            },
            vehicle_id: { type: 'string', description: 'ID kendaraan jika spesifik (PM-PST-XXX)' },
            urgency: {
              type: 'string',
              enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
              description: 'Tingkat urgensi/prioritas (LOW=santai, MEDIUM=standar, HIGH=serius/butuh cepat, URGENT=sangat mendesak)',
            },
            source: {
              type: 'string',
              enum: ['whatsapp', 'website', 'phone'],
              description: 'Sumber lead (default: whatsapp)',
            },
          },
          required: ['name', 'phone'],
        },
      },
    },
  },
  {
    taxonomy: 'unit.create',
    name: 'upload_vehicle',
    allow: ['staff', 'admin'],
    schema: {
      type: 'function',
      function: {
        name: 'upload_vehicle',
        description: 'Upload vehicle baru. Panggil saat staff memberi info mobil baru untuk ditambahkan ke katalog.',
        parameters: {
          type: 'object',
          properties: {
            make: { type: 'string', description: 'Merk (e.g. Toyota)' },
            model: { type: 'string', description: 'Model (e.g. Avanza)' },
            year: { type: 'integer', description: 'Tahun (e.g. 2021)' },
            price: { type: 'number', description: 'Harga (Rupiah full number)' },
            mileage: { type: 'number', description: 'KM (number)' },
            color: { type: 'string', description: 'Warna' },
            transmission: { type: 'string', enum: ['Manual', 'Automatic', 'CVT'], description: 'Transmisi' },
          },
          required: ['make', 'model', 'year', 'price'],
        },
      },
    },
  },
  {
    taxonomy: 'unit.update',
    name: 'edit_vehicle',
    allow: ['staff', 'admin'],
    schema: {
      type: 'function',
      function: {
        name: 'edit_vehicle',
        description: "Edit data kendaraan. Panggil saat staff ingin ubah info (misal: 'ganti harga', 'rubah km', 'koreksi tahun').",
        parameters: {
          type: 'object',
          properties: {
            vehicle_id: { type: 'string', description: 'DisplayId (PM-PST-XXX) atau UUID' },
            field: {
              type: 'string',
              enum: ['year', 'price', 'mileage', 'color', 'transmission', 'fuelType', 'make', 'model', 'variant', 'engineCapacity', 'condition'],
              description: 'Field target (e.g. price, mileage, color)',
            },
            old_value: { type: 'string', description: 'Nilai lama (opsional)' },
            new_value: { type: 'string', description: 'Nilai baru' },
          },
          required: ['field', 'new_value'],
        },
      },
    },
  },
  {
    taxonomy: 'system.send_message',
    name: 'send_whatsapp_message',
    allow: ['staff', 'admin'],
    schema: {
      type: 'function',
      function: {
        name: 'send_whatsapp_message',
        description:
          'Kirim pesan WhatsApp ke nomor tertentu. Gunakan ini untuk membalas chat customer yang pending atau mengirim info ke customer saat berbicara dengan staff/admin.',
        parameters: {
          type: 'object',
          properties: {
            to: { type: 'string', description: 'Nomor WhatsApp tujuan (format 62xxx).' },
            message: { type: 'string', description: 'Isi pesan yang ingin dikirim.' },
          },
          required: ['to', 'message'],
        },
      },
    },
  },
];

// ==================== PUBLIC HELPERS ====================

/** OpenAI-compatible tool schemas visible to the given scope. */
export function getToolSchemasForScope(scope: ToolScope) {
  return WA_TOOLS.filter((t) => scopeAllowed(t.allow, scope)).map((t) => t.schema);
}

/** All tool schemas (no filtering) — used as a backward-compatible default. */
export function getAllToolSchemas() {
  return WA_TOOLS.map((t) => t.schema);
}

/** Dispatch-time RBAC check: may this scope call this tool name? */
export function canScopeCallTool(toolName: string, scope: ToolScope): boolean {
  const tool = WA_TOOLS.find((t) => t.name === toolName);
  if (!tool) return false; // unknown tool → deny
  return scopeAllowed(tool.allow, scope);
}

/** Taxonomy name for a tool (for logging/telemetry). */
export function taxonomyFor(toolName: string): string | undefined {
  return WA_TOOLS.find((t) => t.name === toolName)?.taxonomy;
}
