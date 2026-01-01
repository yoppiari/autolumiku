/**
 * WhatsApp AI Command Handler Service
 *
 * Handles WhatsApp AI commands for:
 * - Basic Tools (STAFF/SALES+): upload, inventory, stats, status, edit
 * - Full Access (ADMIN, OWNER, SUPER_ADMIN): All basic tools + PDF reports
 *
 * Access Categories:
 * - STAFF/SALES (Level 30): upload, inventory, stats, status, edit
 * - ADMIN+ (Level 90+): All tools + PDF reports
 */

import { prisma } from '@/lib/prisma';
import PDFDocument from 'pdfkit';
import { ROLE_LEVELS } from '@/lib/rbac';
import { generateVCardBuffer, generateVCardFilename } from './vcard-generator';
import { StorageService } from '../storage.service';
import { OnePageSalesPDF } from '@/lib/reports/one-page-sales-pdf';
import { WhatsAppCommandPDF, formatCurrency, formatNumber } from '@/lib/reports/whatsapp-command-pdf';
import {
  ComprehensiveReportPDF,
  ReportType as ComprehensiveReportType,
} from '@/lib/reports/comprehensive-report-pdf';
import { ReportDataService } from '@/lib/reports/report-data-service';
import { VehicleInventoryPDF } from '@/lib/reports/vehicle-inventory-pdf';
import * as fs from 'fs';
import * as path from 'path';

interface CommandContext {
  tenantId: string;
  userRole: string;
  userRoleLevel: number;
  phoneNumber: string;
  userId: string;
}

interface CommandResult {
  success: boolean;
  message?: string;
  pdfBuffer?: Buffer;
  filename?: string;
  vCardUrl?: string;
  vCardFilename?: string;
  contactInfo?: {
    name: string;
    phone: string;
  };
  followUp?: boolean;
  broadcastToRoles?: string[]; // Roles to broadcast the result to (e.g. ['ADMIN', 'OWNER'])
}

// Helper functions
function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

/**
 * Create PDFDocument with font configuration that works in standalone builds
 */
function createPDFDocument() {
  return new PDFDocument({
    size: 'A4',
    margin: 50,
    // Don't specify font to avoid loading .afm files
    // PDFKit will use built-in fonts
    bufferPages: true,
  });
}

/**
 * Process WhatsApp AI command
 */
export async function processCommand(
  command: string,
  context: CommandContext
): Promise<CommandResult> {
  const { tenantId, userRoleLevel } = context;

  // Normalize command
  const cmd = command.toLowerCase().trim();

  console.log(`[CommandHandler] 📥 Processing command: "${command}" -> normalized: "${cmd}"`);
  console.log(`[CommandHandler] 👤 User role level: ${userRoleLevel}, Tenant: ${tenantId}`);

  // PDF Report Commands (ADMIN+ only) - CHECK FIRST to take precedence over universal
  const isPDF = isPDFCommand(cmd);
  console.log(`[CommandHandler] 📄 isPDFCommand: ${isPDF}`);

  if (isPDF) {
    // RBAC Check
    if (userRoleLevel < ROLE_LEVELS.ADMIN) {
      console.log(`[CommandHandler] ❌ Access denied - user level ${userRoleLevel} < ADMIN ${ROLE_LEVELS.ADMIN}`);
      return {
        success: false,
        message: 'Maaf, fitur PDF Report hanya untuk Owner, Admin, dan Super Admin.',
        followUp: true,
      };
    }
    console.log(`[CommandHandler] ✅ Routing to PDF handler`);
    return await handlePDFCommand(cmd, context);
  }

  // Universal Commands (ALL roles) - CHECK SECOND
  const isUniversal = isUniversalCommand(cmd);
  console.log(`[CommandHandler] 🔧 isUniversalCommand: ${isUniversal}`);

  if (isUniversal) {
    console.log(`[CommandHandler] ✅ Routing to Universal handler`);
    return await handleUniversalCommand(cmd, context);
  }

  // Unknown command
  console.log(`[CommandHandler] ❌ Unknown command - returning help message`);
  return {
    success: false,
    message: 'Maaf, saya tidak mengerti command tersebut. Ketik "help" untuk daftar command yang tersedia.',
    followUp: true,
  };
}

/**
 * Check if command is universal (all roles)
 */
function isUniversalCommand(cmd: string): boolean {
  const universalCommands = [
    // Help commands are universal
    'help', 'bantuan', 'panduan', 'cara', 'guide', 'menu', 'fitur', 'tool', 'perintah', 'penggunaan', 'command',
    'halo', 'halo admin', 'halo owner', 'halo staff',
    'hi', 'hello',
  ];
  return universalCommands.some(c => cmd.includes(c));
}

/**
 * Check if command is PDF report command
 * Uses exact phrase matching to prevent false positives (e.g., "inventory" shouldn't match "total inventory")
 */
function isPDFCommand(cmd: string): boolean {
  const normalizedCmd = cmd.toLowerCase().trim();

  // Single word triggers (exact match)
  if (normalizedCmd === 'report' || normalizedCmd === 'pdf') {
    return true;
  }

  // Multi-word triggers - use exact phrase matching with word boundaries
  // This prevents "inventory" from matching "total inventory"
  const pdfPhrases = [
    'sales report',
    'whatsapp ai analytics',
    'whatsapp ai',
    'metrix penjualan',
    'metrix pelanggan',
    'metrix operational',
    'operational metrics',
    'operational metric',
    'tren penjualan',
    'customer metrics',
    'customer metric',
    'sales trends',
    'sales trend',
    'total penjualan showroom',
    'total penjualan',
    'total sales',
    'sales total',
    'staff performance',
    'recent sales',
    'low stock alert',
    'total revenue',
    'total inventory',
    'stock report',
    'average price',
    'sales summary',
    'report pdf',
    'pdf report',
    'kirim report',
    'kirim pdf',
    'kirim pdf nya',
    'kirim reportnya',
    'kirim pdfnya',
    'laporan penjualan',
    'laporan penjualan lengkap',
    'laporan lengkap',
    'sales report lengkap',
  ];

  // Check for exact phrase matches (with word boundaries)
  for (const phrase of pdfPhrases) {
    // Use simple includes check - phrase must appear as-is in command
    // This prevents "inventory" from matching "total inventory"
    if (normalizedCmd.includes(phrase)) {
      return true;
    }
  }

  // Additional regex patterns for variations
  return /\b(sales|penjualan)\s+(summary|report|metrics|data|analytics)\b/i.test(cmd) ||
    /\b(metrics|metrix)\s+(sales|penjualan|operational|pelanggan|customer)\b/i.test(cmd) ||
    /\b(customer|pelanggan)\s+metrics\b/i.test(cmd) ||
    /\b(total)\s+(penjualan|revenue|inventory)\b/i.test(cmd);
}

/**
 * Handle universal commands (all roles)
 */
async function handleUniversalCommand(
  cmd: string,
  context: CommandContext
): Promise<CommandResult> {
  const { tenantId, userRoleLevel } = context;

  // Get time-based greeting (Selamat pagi/siang/sore/malam)
  const now = new Date();
  const wibTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
  const hour = wibTime.getHours();
  let timeGreeting = "Selamat malam";
  if (hour >= 4 && hour < 11) timeGreeting = "Selamat pagi";
  else if (hour >= 11 && hour < 15) timeGreeting = "Selamat siang";
  else if (hour >= 15 && hour < 18) timeGreeting = "Selamat sore";

  // Get tenant info
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { name: true },
  });
  const tenantName = tenant?.name || "Prima Mobil";

  // Get active vehicle count
  const availableCount = await prisma.vehicle.count({
    where: { tenantId, status: "AVAILABLE" },
  });

  const isAdmin = userRoleLevel >= 90; // ADMIN/OWNER

  let helpMsg = `${timeGreeting}, Halo!\n\n`;
  helpMsg += `Selamat datang di showroom kami\n`;
  helpMsg += `Saya adalah Asisten virtual yang siap membantu Anda menemukan mobil impian, dan mendapatkan informasi yang Anda butuhkan.\n\n`;
  helpMsg += `Ada yang bisa kami bantu?\n\n`;
  helpMsg += `Saat ini terdapat ${availableCount} unit kendaraan tersedia di ${tenantName}.\n\n`;

  helpMsg += `Layanan yang tersedia:\n\n`;

  helpMsg += `📸 Upload Kendaraan Baru\n`;
  helpMsg += `   Ketik: upload\n`;
  helpMsg += `   Lalu kirim foto + info mobil\n`;
  helpMsg += `   Contoh: "upload Brio 2020 120jt hitam matic km 30rb"\n\n`;

  helpMsg += `📋 Cek Stok Kendaraan\n`;
  helpMsg += `   Ketik: inventory atau stok\n`;
  helpMsg += `   Filter: inventory AVAILABLE\n\n`;

  helpMsg += `📊 Lihat Statistik\n`;
  helpMsg += `   Ketik: stats atau laporan\n`;
  helpMsg += `   Period: stats today / stats week / stats month\n\n`;

  helpMsg += `🔄 Update Status Kendaraan\n`;
  helpMsg += `   Ketik: status [ID] [STATUS]\n`;
  helpMsg += `   Contoh: status PM-PST-001 SOLD\n\n`;

  helpMsg += `🚙 Edit Kendaraan\n`;
  helpMsg += `   Ketik: Edit/ Ubah/ Rubah/ Ganti [ID] [Detail kendaraan/ informasi dasar/ harga]\n`;
  helpMsg += `   Contoh: Ganti PM-PST-001 Hybrid / Ubah PM-PST-001 AT / Edit PM-PST-001 85000 km\n\n`;

  if (isAdmin) {
    helpMsg += `👮‍♂️ MENU ADMIN & OWNER (PDF REPORTS)\n`;
    helpMsg += `Terdapat 15+ Laporan Management dalam format PDF.\n`;
    helpMsg += `Ketik: "sales report", "Total Inventory", atau "staff performance"\n\n`;
  }

  helpMsg += `Silakan ketik perintah yang diinginkan. Kami siap membantu!`;

  return {
    success: true,
    message: helpMsg,
    followUp: true,
  };
}


/**
 * Handle contact commands (send staff contact to customer)
 */
async function handleContactCommand(
  cmd: string,
  context: CommandContext
): Promise<CommandResult> {
  const { tenantId } = context;

  // Parse command: "kirim kontak sales" or "kirim kontak admin" or "kirim kontak owner"
  let targetRole: string | null = null;

  if (cmd.includes('owner')) {
    targetRole = 'OWNER';
  } else if (cmd.includes('admin')) {
    targetRole = 'ADMIN';
  } else if (cmd.includes('sales') || cmd.includes('staff')) {
    targetRole = 'SALES';
  }

  if (!targetRole) {
    // List available contacts
    const tenants = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true, logoUrl: true },
    });

    return {
      success: true,
      message: `📇 *Kontak ${tenants?.name || 'Showroom'}*\n\nPilih kontak yang ingin dikirim:\n\n1. 📋 *Kirim Kontak Owner*\n   Ketik: "kirim kontak owner"\n\n2. 📋 *Kirim Kontak Admin*\n   Ketik: "kirim kontak admin"\n\n3. 📋 *Kirim Kontak Sales*\n   Ketik: "kirim kontak sales"\n\nKontak akan dikirim dalam format vCard yang bisa langsung disimpan ke HP.`,
      followUp: true,
    };
  }

  // Fetch user by role
  const user = await prisma.user.findFirst({
    where: {
      tenantId,
      role: targetRole,
      phone: { not: null },
    },
    select: {
      firstName: true,
      lastName: true,
      phone: true,
      role: true,
    },
  });

  if (!user || !user.phone) {
    return {
      success: false,
      message: `❌ Maaf, tidak ditemukan kontak untuk role ${targetRole}.\n\nSilakan hubungi admin untuk informasi lebih lanjut.`,
      followUp: true,
    };
  }

  // Generate vCard
  const vCardBuffer = generateVCardBuffer({
    firstName: user.firstName,
    lastName: user.lastName || '',
    phone: user.phone,
    role: user.role,
    organization: 'Prima Mobil',
  });

  const vCardFilename = generateVCardFilename({
    firstName: user.firstName,
    lastName: user.lastName || '',
    phone: user.phone,
    role: user.role,
  });

  // Upload vCard to storage
  const timestamp = Date.now();
  const storageKey = `contacts/${tenantId}/${timestamp}-${vCardFilename}`;
  const vCardUrl = await StorageService.uploadPhoto(
    vCardBuffer,
    storageKey,
    'text/vcard'
  );

  // Return contact info for sending
  return {
    success: true,
    message: `📇 *Kontak ${user.role}*\n\nNama: ${user.firstName} ${user.lastName || ''}\nRole: ${user.role}\n\n✅ vCard berhasil dibuat! Mengirim kontak...`,
    vCardUrl,
    vCardFilename,
    contactInfo: {
      name: `${user.firstName} ${user.lastName || ''}`.trim(),
      phone: user.phone,
    },
    followUp: true,
  };
}

/**
 * Handle PDF report commands (ADMIN+ only)
 */
export async function handlePDFCommand(
  cmd: string,
  context: CommandContext
): Promise<CommandResult> {
  // Map command to PDF generator function with multiple keyword aliases
  const pdfGenerators: Record<string, (ctx: CommandContext) => Promise<CommandResult>> = {
    // Sales & Revenue
    'sales report': generateSalesReportPDF,
    'whatsapp ai': generateWhatsAppAIPDF,
    'metrix penjualan': generateSalesMetricsPDF,
    'metrics penjualan': generateSalesMetricsPDF,
    'metrix pelanggan': generateCustomerMetricsPDF,
    'metrics pelanggan': generateCustomerMetricsPDF,
    'customer metrics': generateCustomerMetricsPDF, // Added alias
    'customer metric': generateCustomerMetricsPDF,
    'metrix operational': generateOperationalMetricsPDF,
    'metrics operational': generateOperationalMetricsPDF,
    'operational metrics': generateOperationalMetricsPDF,
    'operational metric': generateOperationalMetricsPDF,
    'tren penjualan': generateSalesTrendsPDF,
    'trends penjualan': generateSalesTrendsPDF,
    'sales trends': generateSalesTrendsPDF, // Added alias
    'sales trend': generateSalesTrendsPDF,
    'penjualan trends': generateSalesTrendsPDF,

    // Staff
    'staff performance': generateStaffPerformancePDF,
    'recent sales': generateRecentSalesPDF,

    // Inventory
    'low stock alert': generateLowStockPDF,
    'low stock': generateLowStockPDF,
    'total inventory': generateTotalInventoryPDF, // Added alias
    'stock report': generateTotalInventoryPDF,
    'total stok': generateTotalInventoryPDF,
    'stok total': generateTotalInventoryPDF,
    'inventory listing': generateVehicleInventoryListingPDF, // New format with images
    'vehicle listing': generateVehicleInventoryListingPDF, // New format with images
    'daftar kendaraan': generateVehicleInventoryListingPDF, // New format with images
    'daftar stok': generateVehicleInventoryListingPDF, // New format with images
    'inventory list': generateVehicleInventoryListingPDF, // New format with images
    'list kendaraan': generateVehicleInventoryListingPDF, // New format with images
    'average price': generateAveragePricePDF,
    'avg price': generateAveragePricePDF,
    'rata-rata harga': generateAveragePricePDF,

    // Sales & Revenue
    'total penjualan showroom': generateTotalSalesPDF,
    'total penjualan': generateTotalSalesPDF, // Added alias
    'total sales': generateTotalSalesPDF, // Added alias
    'sales total': generateTotalSalesPDF,
    'total revenue': generateTotalRevenuePDF,
    'revenue total': generateTotalRevenuePDF,
    'sales summary': generateSalesReportPDF,  // Use 1-page WhatsAppCommandPDF instead of CompactExecutivePDF
    'penjualan': generateSalesReportPDF,      // Use 1-page WhatsAppCommandPDF instead of CompactExecutivePDF
    'sales': generateSalesReportPDF,          // Use 1-page WhatsAppCommandPDF instead of CompactExecutivePDF
    'laporan penjualan': generateSalesReportPDF,
    'laporan penjualan lengkap': generateSalesReportPDF,
    'laporan lengkap': generateSalesReportPDF,
    'sales report lengkap': generateSalesReportPDF,
  };

  // Find matching generator
  console.log(`[Command Handler] 🔍 Looking for PDF generator for command: "${cmd}"`);
  for (const [keyword, generator] of Object.entries(pdfGenerators)) {
    if (cmd.includes(keyword)) {
      console.log(`[Command Handler] ✅ Found match: "${keyword}" → calling generator`);
      const result = await generator(context);

      // Auto-broadcast all PDF reports to Admins/Owners
      if (result.success && result.pdfBuffer) {
        result.broadcastToRoles = ['OWNER', 'ADMIN', 'SUPER_ADMIN'];
      }

      return result;
    }
  }
  console.log(`[Command Handler] ❌ No PDF generator match found for: "${cmd}"`);

  // Generic 'report' or 'pdf' without specific type - send list of available reports
  if (cmd.includes('report') || cmd.includes('pdf')) {
    return {
      success: true,
      message: `📊 *PDF Report Management (15+ Tipe)*

Silakan pilih report yang diinginkan:

📈 *Sales & Revenue:*
• Sales Report / Laporan Penjualan
• Total Penjualan & Revenue
• Tren Penjualan
• Sales Summary
• Metrik Penjualan

📦 *Inventory:*
• Stock Report / Total Inventory
• Low Stock Alert
• Average Price (Rata-rata Harga)

👥 *Staff & Team:*
• Staff Performance (Performa Staff)
• Recent Sales (Penjualan Terkini)

🤖 *WhatsApp AI & Engagement:*
• WhatsApp AI Analytics
• Metrik Operasional
• Customer Metrics (Metrik Pelanggan)

Ketik nama report untuk mendapatkan PDF. Contoh: "kirim sales report pdf", "total inventory", atau "staff performance"`,
      followUp: true,
    };
  }

  return {
    success: false,
    message: 'Report tidak ditemukan. Ketik "report" atau "pdf" untuk melihat daftar report yang tersedia.',
    followUp: true,
  };
}

// ============================================================================
// DATA FETCHING HELPERS
// ============================================================================

async function fetchSalesData(context: CommandContext, days: number = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const soldVehicles = await prisma.vehicle.findMany({
    where: {
      tenantId: context.tenantId,
      status: 'SOLD',
      updatedAt: { gte: startDate },
    },
    select: {
      make: true,
      model: true,
      year: true,
      price: true,
      updatedAt: true,
      createdBy: true,
    },
    orderBy: { updatedAt: 'desc' },
  });

  const totalSalesValue = soldVehicles.reduce((sum, v) => sum + Number(v.price), 0);
  const totalSalesCount = soldVehicles.length;

  // Vehicles by make
  const byMake: Record<string, { count: number; value: number }> = {};
  soldVehicles.forEach((v) => {
    const make = v.make || 'Other';
    if (!byMake[make]) byMake[make] = { count: 0, value: 0 };
    byMake[make].count++;
    byMake[make].value += Number(v.price);
  });

  // Sales trend by day
  const salesByDay: Record<string, { count: number; value: number }> = {};
  soldVehicles.forEach((v) => {
    const day = new Date(v.updatedAt).toLocaleDateString('id-ID');
    if (!salesByDay[day]) salesByDay[day] = { count: 0, value: 0 };
    salesByDay[day].count++;
    salesByDay[day].value += Number(v.price);
  });

  return {
    summary: { totalSalesCount, totalSalesValue },
    vehicles: soldVehicles.map((v) => ({ ...v, price: Number(v.price) })),
    byMake: Object.entries(byMake).map(([make, data]) => ({ make, ...data })),
    salesByDay: Object.entries(salesByDay).map(([day, data]) => ({ day, ...data })),
    avgPrice: totalSalesCount > 0 ? totalSalesValue / totalSalesCount : 0,
  };
}

async function fetchStaffPerformance(context: CommandContext, days: number = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const soldVehicles = await prisma.vehicle.findMany({
    where: {
      tenantId: context.tenantId,
      status: 'SOLD',
      updatedAt: { gte: startDate },
    },
    select: {
      make: true,
      model: true,
      price: true,
      updatedAt: true,
      createdBy: true,
    },
  });

  const salesStaff = await prisma.user.findMany({
    where: {
      tenantId: context.tenantId,
      role: { in: ['SALES', 'sales', 'STAFF', 'staff'] },
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
    },
  });

  const staffSales: Record<string, { name: string; count: number; value: number; vehicles: any[] }> = {};
  salesStaff.forEach((user) => {
    staffSales[user.id] = {
      name: `${user.firstName} ${user.lastName}`,
      count: 0,
      value: 0,
      vehicles: [],
    };
  });

  soldVehicles.forEach((v) => {
    if (v.createdBy && staffSales[v.createdBy]) {
      staffSales[v.createdBy].count++;
      staffSales[v.createdBy].value += Number(v.price);
      staffSales[v.createdBy].vehicles.push(v);
    }
  });

  const topPerformers = Object.entries(staffSales)
    .map(([id, data]) => ({ id, ...data }))
    .filter((s) => s.count > 0)
    .sort((a, b) => b.count - a.count);

  return { topPerformers, totalStaff: salesStaff.length };
}

async function fetchInventoryData(context: CommandContext) {
  const available = await prisma.vehicle.findMany({
    where: {
      tenantId: context.tenantId,
      status: 'AVAILABLE',
    },
    select: {
      displayId: true,
      make: true,
      model: true,
      year: true,
      price: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  console.log('[fetchInventoryData] Available vehicles:', available.length);
  console.log('[fetchInventoryData] Vehicle prices:', available.map(v => ({
    displayId: v.displayId,
    price: v.price,
    priceNumber: Number(v.price)
  })));

  const totalValue = available.reduce((sum, v) => sum + Number(v.price), 0);
  console.log('[fetchInventoryData] Total value calculated:', totalValue);
  console.log('[fetchInventoryData] Total value formatted:', formatCurrency(totalValue));

  const avgDaysInStock = available.length > 0
    ? available.reduce((sum, v) => {
      const days = Math.floor((new Date().getTime() - new Date(v.createdAt).getTime()) / (1000 * 60 * 60 * 24));
      return sum + days;
    }, 0) / available.length
    : 0;

  return {
    totalStock: available.length,
    totalValue,
    avgDaysInStock: Math.round(avgDaysInStock),
    vehicles: available.map((v) => ({ ...v, price: Number(v.price) })),
  };
}

async function fetchWhatsAppAIData(context: CommandContext, days: number = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  try {
    const conversations = await prisma.whatsAppConversation.findMany({
      where: {
        tenantId: context.tenantId,
        startedAt: { gte: startDate },
        status: { not: 'deleted' },
      },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          take: 50,
        },
      },
      take: 500,
      orderBy: { startedAt: 'desc' },
    });

    const totalConversations = conversations.length;
    const activeConversations = conversations.filter((c) => c.status === 'active').length;

    const customerMessages = conversations.reduce((sum, c) => {
      return sum + c.messages.filter((m) => m.direction === 'inbound').length;
    }, 0);

    const aiResponses = conversations.reduce((sum, c) => {
      return sum + c.messages.filter((m) => m.direction === 'outbound' && m.aiResponse).length;
    }, 0);

    const staffResponses = conversations.reduce((sum, c) => {
      return sum + c.messages.filter((m) => m.direction === 'outbound' && !m.aiResponse).length;
    }, 0);

    const aiResponseRate = customerMessages > 0
      ? Math.round((aiResponses / customerMessages) * 100)
      : 0;

    const escalatedConversations = conversations.filter((c) =>
      c.messages.some((m) => m.direction === 'outbound' && !m.aiResponse)
    ).length;

    const aiAccuracy = totalConversations > 0
      ? Math.round(((totalConversations - escalatedConversations) / totalConversations) * 100)
      : 0;

    const intents = { vehicle: 0, price: 0, greeting: 0, general: 0 };
    conversations.slice(0, 100).forEach((c) => {
      const firstMessage = c.messages.find((m) => m.direction === 'inbound');
      if (firstMessage) {
        const content = firstMessage.content.toLowerCase();
        if (content.includes('harga') || content.includes('price') || content.includes('berapa')) {
          intents.price++;
        } else if (content.includes('mobil') || content.includes('unit') || content.includes('stok')) {
          intents.vehicle++;
        } else if (content.includes('halo') || content.includes('hi') || content.includes('hello') || content.includes('selamat')) {
          intents.greeting++;
        } else {
          intents.general++;
        }
      }
    });

    const totalIntents = Object.values(intents).reduce((a, b) => a + b, 0);
    const intentBreakdown = Object.entries(intents).map(([intent, count]) => ({
      intent,
      count,
      percentage: totalIntents > 0 ? Math.round((count / totalIntents) * 100) : 0,
    }));

    return {
      overview: {
        totalConversations,
        activeConversations,
        customerMessages,
        aiResponses,
        staffResponses,
        aiResponseRate,
        escalatedConversations,
        aiAccuracy,
      },
      intentBreakdown,
    };
  } catch (error) {
    console.error('Error fetching WhatsApp AI data:', error);
    return null;
  }
}

// ============================================================================
// PDF GENERATORS WITH REAL DATA
// ============================================================================

// ============================================================================
// UNIFIED PDF GENERATOR
// ============================================================================

async function generateReportByType(
  type: ComprehensiveReportType,
  context: CommandContext
): Promise<CommandResult> {
  try {
    console.log(`[Report Generator] 📊 Generating ${type} for tenant ${context.tenantId}`);

    const tenant = await prisma.tenant.findUnique({
      where: { id: context.tenantId },
      select: { name: true, logoUrl: true },
    });

    // Calculate dates (last 30 days default)
    const now = new Date();
    const startDate = new Date();
    startDate.setDate(now.getDate() - 30);
    const periodLabel = '30 Hari Terakhir';

    // Gather data using shared service
    const reportData = await ReportDataService.gather(type, context.tenantId, startDate, now);

    // Map ReportData to professional WhatsAppCommandPDF config
    const generator = new WhatsAppCommandPDF();
    const metrics: any[] = [];
    let analysis: string[] = [];
    let chartData: any[] = [];

    // Basic Metrics (Common)
    if (reportData.totalSales !== undefined) {
      metrics.push({ label: 'Total Sales', value: `${reportData.totalSales}`, unit: 'Unit', color: '#1d4ed8', formula: 'COUNT(SOLD)' });
    }
    if (reportData.totalRevenue !== undefined) {
      metrics.push({ label: 'Total Revenue', value: formatNumber(reportData.totalRevenue), unit: 'IDR', color: '#16a34a', formula: 'SUM(price)' });
    }
    if (reportData.avgPrice !== undefined) {
      metrics.push({ label: 'Avg Price', value: formatNumber(reportData.avgPrice), unit: 'IDR', color: '#9333ea', formula: 'Revenue / Sales' });
    }
    if (reportData.totalInventory !== undefined) {
      metrics.push({ label: 'Stock', value: `${reportData.totalInventory}`, unit: 'Available', color: '#ea580c', formula: 'COUNT(AVAILABLE)' });
    }

    // WhatsApp Specific Metrics
    if (reportData.whatsapp) {
      const wa = reportData.whatsapp;
      metrics.push({ label: 'Conversations', value: `${wa.totalConversations}`, color: '#10b981' });
      metrics.push({ label: 'Response Rate', value: `${wa.aiResponseRate}%`, color: '#3b82f6' });
      metrics.push({ label: 'Avg Resp Time', value: `${wa.avgResponseTime}s`, color: '#f59e0b' });
      metrics.push({ label: 'Escalation', value: `${wa.escalationRate}%`, color: '#ef4444' });

      chartData = wa.intentBreakdown.map((i: any, idx: number) => ({
        label: i.intent,
        value: `${i.count}`,
        color: ['#1d4ed8', '#16a34a', '#9333ea', '#ea580c'][idx % 4]
      }));
    }

    // Chart data for Sales (Top 4 Brands)
    if (reportData.salesByBrand && chartData.length === 0) {
      chartData = reportData.salesByBrand.slice(0, 4).map((b: any, idx: number) => ({
        label: b.brand,
        value: `${b.count}`,
        color: ['#1d4ed8', '#16a34a', '#9333ea', '#ea580c'][idx % 4]
      }));
    }

    // KPIs & Insights
    if (reportData.managementInsights) {
      analysis = reportData.managementInsights.slice(0, 5).map(i => i.text);
    } else if (reportData.kpis) {
      analysis = [
        `Showroom Efficiency: ${reportData.kpis.efficiency}%`,
        `Inventory Turnover: ${reportData.kpis.inventoryTurnover}%`,
        `Staff Performance: ${reportData.kpis.salesPerEmployee}%`,
        `Customer Engagement Proxy: ${reportData.kpis.customerRetention}%`
      ];
    }

    const pdfBuffer = await generator.generate({
      title: type.toUpperCase().replace(/-/g, ' '),
      subtitle: periodLabel,
      tenantName: tenant?.name || 'Prima Mobil',
      logoUrl: tenant?.logoUrl || undefined,
      date: now,
      metrics,
      showChart: chartData.length > 0,
      chartData,
      analysis,
    });

    const filename = `${type}-${now.toISOString().split('T')[0]}.pdf`;

    return {
      success: true,
      message: `✅ Professional Report *${type.toUpperCase().replace(/-/g, ' ')}* (1-page) berhasil dibuat. Mengirim PDF...`,
      pdfBuffer,
      filename,
      followUp: true,
    };
  } catch (error) {
    console.error(`[Report Generator] ❌ Error generating ${type}:`, error);
    return {
      success: false,
      message: `Maaf, terjadi kesalahan saat membuat report: ${error instanceof Error ? error.message : 'Unknown error'}`,
      followUp: true,
    };
  }
}

// Map each specific report command to the unified generator
// Map each specific report command to the unified generator
const generateSalesReportPDF = async (ctx: CommandContext): Promise<CommandResult> => {
  const tenant = await prisma.tenant.findUnique({
    where: { id: ctx.tenantId },
    select: { name: true },
  });

  const generator = new OnePageSalesPDF();
  const pdfBuffer = await generator.generate({
    tenantName: tenant?.name || 'Prima Mobil',
    period: '30 Hari Terakhir',
  });

  return {
    success: true,
    message: '✅ Professional Sales Report (1-page) berhasil dibuat. Mengirim PDF...',
    pdfBuffer,
    filename: `sales-report-${new Date().toISOString().split('T')[0]}.pdf`,
    followUp: true,
  };
};

const generateWhatsAppAIPDF = (ctx: CommandContext) => generateReportByType('whatsapp-analytics', ctx);
const generateSalesMetricsPDF = (ctx: CommandContext) => generateReportByType('sales-metrics', ctx);
const generateCustomerMetricsPDF = (ctx: CommandContext) => generateReportByType('customer-metrics', ctx);
const generateOperationalMetricsPDF = (ctx: CommandContext) => generateReportByType('operational-metrics', ctx);
const generateSalesTrendsPDF = (ctx: CommandContext) => generateReportByType('sales-trends', ctx);
const generateStaffPerformancePDF = (ctx: CommandContext) => generateReportByType('staff-performance', ctx);
const generateRecentSalesPDF = (ctx: CommandContext) => generateReportByType('recent-sales', ctx);
const generateLowStockPDF = (ctx: CommandContext) => generateReportByType('low-stock-alert', ctx);
const generateTotalSalesPDF = (ctx: CommandContext) => generateReportByType('total-sales', ctx);
const generateTotalRevenuePDF = (ctx: CommandContext) => generateReportByType('total-revenue', ctx);
const generateTotalInventoryPDF = (ctx: CommandContext) => generateReportByType('total-inventory', ctx);
const generateAveragePricePDF = (ctx: CommandContext) => generateReportByType('average-price', ctx);
const generateSalesSummaryPDF = (ctx: CommandContext) => generateReportByType('sales-summary', ctx);

// ============================================================================
// VEHICLE INVENTORY LISTING PDF (New Format with Images Table)
// ============================================================================

async function generateVehicleInventoryListingPDF(context: CommandContext): Promise<CommandResult> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: context.tenantId },
    select: { name: true, logoUrl: true },
  });

  // Fetch vehicles for the inventory listing
  const vehicles = await prisma.vehicle.findMany({
    where: {
      tenantId: context.tenantId,
      status: { not: 'DELETED' }, // Exclude deleted vehicles
    },
    select: {
      id: true,
      displayId: true,
      make: true,
      model: true,
      year: true,
      price: true,
      status: true,
      mileage: true,
      transmissionType: true,
      fuelType: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 50, // Limit to 50 vehicles
  });

  // Fetch main photos for each vehicle
  const vehiclesWithImages = await Promise.all(
    vehicles.map(async (v) => {
      const mainPhoto = await prisma.vehiclePhoto.findFirst({
        where: {
          vehicleId: v.id,
          isMainPhoto: true,
        },
        select: {
          thumbnailUrl: true,
        },
      });

      return {
        ...v,
        imageUrl: mainPhoto?.thumbnailUrl || undefined,
        transmission: v.transmissionType,
      };
    })
  );

  // Calculate metrics
  const activeVehicles = vehiclesWithImages.filter(v => v.status === 'AVAILABLE' || v.status === 'BOOKED').length;
  const totalLeads = 0; // TODO: Integrate with leads table when available
  const followUpRequired = vehiclesWithImages.filter(v => v.status === 'BOOKED').length;

  // Set period (last 30 days)
  const periodEnd = new Date();
  const periodStart = new Date();
  periodStart.setDate(periodEnd.getDate() - 30);

  // Use NEW Vehicle Inventory PDF
  const generator = new VehicleInventoryPDF();

  const reportConfig = {
    tenantName: tenant?.name || 'Prima Mobil',
    logoUrl: tenant?.logoUrl || undefined,
    periodStart,
    periodEnd,
    vehicles: vehiclesWithImages.map(v => ({
      id: v.id,
      displayId: v.displayId || 'N/A',
      make: v.make,
      model: v.model,
      year: v.year,
      price: Number(v.price),
      status: v.status as any,
      imageUrl: v.imageUrl,
      mileage: v.mileage,
      transmission: v.transmission,
      fuelType: v.fuelType,
    })),
    metrics: {
      totalLeads,
      activeVehicles,
      followUpRequired,
    },
  };

  const pdfBuffer = await generator.generate(reportConfig);

  return {
    success: true,
    message: '✅ Vehicle Inventory Listing (format baru dengan tabel dan foto) berhasil dibuat. Mengirim PDF...',
    pdfBuffer,
    filename: `vehicle-inventory-${new Date().toISOString().split('T')[0]}.pdf`,
    followUp: true,
  };
}
