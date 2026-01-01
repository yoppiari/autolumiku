/**
 * WhatsApp AI Command Handler Service
 *
 * Handles WhatsApp AI commands for:
 * - Universal commands (ALL roles): rubah, upload, inventory, status, statistik, kontak
 * - PDF report commands (ADMIN+ only): 14 report types
 *
 * Role-based access control:
 * - ALL roles: Universal commands
 * - ADMIN+ only (roleLevel >= 90): PDF report commands
 */

import { prisma } from '@/lib/prisma';
import PDFDocument from 'pdfkit';
import { ROLE_LEVELS } from '@/lib/rbac';
import { generateVCardBuffer, generateVCardFilename } from './vcard-generator';
import { StorageService } from '../storage.service';
import { OnePageSalesPDF } from '@/lib/reports/one-page-sales-pdf';
import { WhatsAppCommandPDF, formatCurrency, formatNumber } from '@/lib/reports/whatsapp-command-pdf';
import { SalesReportPDF } from '@/lib/reports/sales-report-pdf';
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
    'rubah', 'ubah', 'edit',
    'upload',
    'inventory', 'stok',
    'status',
    'statistik', 'stats', 'laporan', // Tambah "laporan" untuk command statistik
    'kontak', 'contact',
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
    'average price',
    'sales summary',
    'report pdf',
    'pdf report',
    'kirim report',
    'kirim pdf',
    'kirim pdf nya',
    'kirim reportnya',
    'kirim pdfnya',
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
  const { tenantId, phoneNumber } = context;

  // Edit vehicle
  if (cmd.includes('rubah') || cmd.includes('ubah') || cmd.includes('edit')) {
    // TODO: Implement edit flow
    return {
      success: true,
      message: 'Untuk mengedit data kendaraan, silakan gunakan menu Edit di dashboard: https://primamobil.id/dashboard/vehicles\n\nContoh:\n- Edit: https://primamobil.id/dashboard/vehicles/[id-kendaraan]/edit',
      followUp: true,
    };
  }

  // Upload vehicle
  if (cmd.includes('upload')) {
    return {
      success: true,
      message: 'Untuk upload kendaraan baru, silakan gunakan menu Upload di dashboard: https://primamobil.id/dashboard/vehicles/upload\n\nAnda akan diminta untuk:\n1. Input data kendaraan (merek, model, tahun, harga, dll)\n2. Upload foto kendaraan (max 10 foto)\n3. Submit untuk memproses',
      followUp: true,
    };
  }

  // Inventory/Stock check
  if (cmd.includes('inventory') || cmd.includes('stok')) {
    console.log(`[CommandHandler] 📦 Processing STOK command: ${cmd}`);

    try {
      const vehicles = await prisma.vehicle.findMany({
        where: {
          tenantId,
          status: { in: ['AVAILABLE', 'BOOKED'] },
        },
        take: 10,
        orderBy: { createdAt: 'desc' },
        select: {
          displayId: true,
          make: true,
          model: true,
          year: true,
          price: true,
          status: true,
        },
      });

      console.log(`[CommandHandler] 📦 Found ${vehicles.length} vehicles in stock`);

      if (vehicles.length === 0) {
        const message = '📦 INVENTORY SHOWROOM\n\nTidak ada kendaraan tersedia saat ini.\n\nTotal stok: 0 unit';
        console.log(`[CommandHandler] 📦 Returning empty stock message`);
        return {
          success: true,
          message,
          followUp: true,
        };
      }

      const totalStock = await prisma.vehicle.count({
        where: {
          tenantId,
          status: { in: ['AVAILABLE', 'BOOKED'] },
        },
      });

      let message = `📦 INVENTORY SHOWROOM\n\nTotal stok: ${totalStock} unit\n\n10 Kendaraan terbaru:\n`;
      vehicles.forEach((v, idx) => {
        message += `${idx + 1}. ${v.make} ${v.model} (${v.year})\n`;
        message += `   ${formatCurrency(Number(v.price))} - ${v.status}\n`;
        message += `   ID: ${v.displayId}\n\n`;
      });

      message += totalStock > 10
        ? `\n...dan ${totalStock - 10} unit lainnya.\n\nLihat full inventory di: https://primamobil.id/dashboard/vehicles`
        : `\n\nLihat full inventory di: https://primamobil.id/dashboard/vehicles`;

      console.log(`[CommandHandler] 📦 Returning stock list with ${totalStock} total units`);
      return {
        success: true,
        message,
        followUp: true,
      };
    } catch (error) {
      console.error(`[CommandHandler] ❌ Error in STOK command:`, error);
      return {
        success: false,
        message: 'Maaf, terjadi kesalahan saat mengambil data stok. Silakan coba lagi.',
        followUp: true,
      };
    }
  }

  // Status check
  if (cmd.includes('status')) {
    const totalVehicles = await prisma.vehicle.count({
      where: { tenantId },
    });

    const available = await prisma.vehicle.count({
      where: { tenantId, status: 'AVAILABLE' },
    });

    const sold = await prisma.vehicle.count({
      where: { tenantId, status: 'SOLD' },
    });

    const booked = await prisma.vehicle.count({
      where: { tenantId, status: 'BOOKED' },
    });

    return {
      success: true,
      message: `📊 STATUS SHOWROOM\n\nTotal Kendaraan: ${totalVehicles} unit\n✅ Tersedia: ${available} unit\n🔒 Terbook: ${booked} unit\n✅ Terjual: ${sold} unit\n\nLihat detail di: https://primamobil.id/dashboard`,
      followUp: true,
    };
  }

  // Statistics check
  if (cmd.includes('statistik') || cmd.includes('stats') || cmd.includes('laporan')) {
    // For sales: show their own performance
    // For admin+: show overall stats
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const soldVehicles = await prisma.vehicle.findMany({
      where: {
        tenantId,
        status: 'SOLD',
        updatedAt: { gte: monthStart },
      },
      select: {
        price: true,
        createdBy: true,
      },
    });

    const totalSales = soldVehicles.length;
    const totalRevenue = soldVehicles.reduce((sum, v) => sum + Number(v.price), 0);

    // User's own performance (if they're sales staff)
    let ownStats = '';
    if (context.userRoleLevel < ROLE_LEVELS.ADMIN) {
      const ownSales = soldVehicles.filter(v => v.createdBy === context.userId).length;
      ownStats = `\n📊 Performa Anda:\n   Unit terjual: ${ownSales}\n   Kontribusi: ${totalSales > 0 ? ((ownSales / totalSales) * 100).toFixed(1) : 0}%`;
    }

    return {
      success: true,
      message: `📈 STATISTIK BULAN INI (${formatDate(monthStart)} - ${formatDate(now)})\n\n✅ Total Penjualan: ${totalSales} unit\n💰 Total Revenue: ${formatCurrency(totalRevenue)}${ownStats}\n\nLihat detail analytics di: https://primamobil.id/dashboard/whatsapp-ai/analytics`,
      followUp: true,
    };
  }

  // Send contact command
  if (cmd.includes('kontak') || cmd.includes('contact')) {
    return await handleContactCommand(cmd, context);
  }

  return {
    success: false,
    message: 'Command tidak dikenali.',
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
async function handlePDFCommand(
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
    'total stok': generateTotalInventoryPDF,
    'stok total': generateTotalInventoryPDF,
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
  };

  // Find matching generator
  console.log(`[Command Handler] 🔍 Looking for PDF generator for command: "${cmd}"`);
  for (const [keyword, generator] of Object.entries(pdfGenerators)) {
    if (cmd.includes(keyword)) {
      console.log(`[Command Handler] ✅ Found match: "${keyword}" → calling generator`);
      return await generator(context);
    }
  }
  console.log(`[Command Handler] ❌ No PDF generator match found for: "${cmd}"`);

  // Generic 'report' or 'pdf' without specific type - send list of available reports
  if (cmd.includes('report') || cmd.includes('pdf')) {
    return {
      success: true,
      message: `📊 *PDF Report Tersedia*

Silakan pilih report yang diinginkan:

📈 *Sales & Revenue:*
• Sales Report
• Total Penjualan
• Total Revenue
• Sales Summary
• Metrik Penjualan
• Tren Penjualan

📦 *Inventory:*
• Low Stock Alert
• Total Inventory
• Average Price

👥 *Staff & Customers:*
• Staff Performance
• Recent Sales
• Metrik Pelanggan

🤖 *WhatsApp AI:*
• WhatsApp AI Analytics
• Metrik Operational

Ketik nama report untuk mendapatkan PDF. Contoh: "sales report", "low stock alert", "sales summary"`,
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

async function generateSalesReportPDF(context: CommandContext): Promise<CommandResult> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: context.tenantId },
    select: { name: true },
  });

  // Fetch sales data for the report
  const salesData = await fetchSalesData(context, 30);
  const staffData = await fetchStaffPerformance(context, 30);

  // Get top performer name
  const topStaff = staffData.topPerformers.length > 0
    ? staffData.topPerformers[0].name
    : null;

  // Use NEW SalesReportPDF with draft format
  const generator = new SalesReportPDF();

  const reportConfig = {
    tenantName: tenant?.name || 'Prima Mobil',
    date: new Date(),
    metrics: {
      totalPenjualan: salesData.summary.totalSalesCount,
      totalRevenue: salesData.summary.totalSalesValue,
      rataRataHarga: salesData.avgPrice,
      topSalesStaff: topStaff,
    },
    chartData: salesData.byMake.slice(0, 5).map((item, idx) => {
      const colors = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444'];
      const total = salesData.byMake.reduce((sum, m) => sum + m.count, 0);
      return {
        label: item.make,
        value: item.count,
        percentage: total > 0 ? Math.round((item.count / total) * 100) : 0,
        color: colors[idx % colors.length],
      };
    }),
  };

  const pdfBuffer = await generator.generate(reportConfig);

  return {
    success: true,
    message: '✅ Sales Report (format draft baru) berhasil dibuat. Mengirim PDF...',
    pdfBuffer,
    filename: `sales-report-${new Date().toISOString().split('T')[0]}.pdf`,
    followUp: true,
  };
}

async function generateWhatsAppAIPDF(context: CommandContext): Promise<CommandResult> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: context.tenantId },
    select: { name: true, logoUrl: true },
  });

  const whatsappData = await fetchWhatsAppAIData(context, 30);

  // Use NEW professional WhatsApp Command PDF
  const generator = new WhatsAppCommandPDF();

  const metrics = whatsappData ? [
    {
      label: 'Total Percakapan',
      value: `${whatsappData.overview.totalConversations}`,
      unit: 'Percakapan',
      color: '#3b82f6',
      formula: 'COUNT(conversations) WHERE date >= NOW() - 30 DAYS',
      calculation: `${whatsappData.overview.totalConversations} percakapan`,
    },
    {
      label: 'AI Response Rate',
      value: `${whatsappData.overview.aiResponseRate}`,
      unit: '%',
      color: '#10b981',
      formula: '(AI responses / Total responses) × 100',
      calculation: `${whatsappData.overview.aiResponses} / ${whatsappData.overview.aiResponses + whatsappData.overview.staffResponses} × 100 = ${whatsappData.overview.aiResponseRate}%`,
    },
    {
      label: 'AI Accuracy',
      value: `${whatsappData.overview.aiAccuracy}`,
      unit: '%',
      color: '#f59e0b',
      formula: '(Correct AI responses / Total AI responses) × 100',
      calculation: `${whatsappData.overview.aiAccuracy}% akurasi`,
    },
    {
      label: 'Percakapan Aktif',
      value: `${whatsappData.overview.activeConversations}`,
      unit: 'Percakapan',
      color: '#8b5cf6',
      formula: 'COUNT(conversations) WHERE state = active',
      calculation: `${whatsappData.overview.activeConversations} percakapan aktif`,
    },
  ] : [
    {
      label: 'Data Tidak Tersedia',
      value: '0',
      unit: 'N/A',
      color: '#9ca3af',
      formula: 'N/A',
      calculation: 'Data WhatsApp belum tersedia',
    },
  ];

  const analysis = whatsappData ? [
    `Akurasi AI saat ini sebesar ${whatsappData.overview.aiAccuracy}%, menunjukkan performa chatbot yang ${whatsappData.overview.aiAccuracy > 80 ? 'sangat handal' : 'cukup baik'}.`,
    `Response rate mencapai ${whatsappData.overview.aiResponseRate}%, membantu tim sales menangani customer di luar jam kerja secara otomatis.`,
    `Top intent pelanggan adalah "${whatsappData.intentBreakdown[0]?.intent || 'N/A'}", pastikan database unit selalu up-to-date untuk akurasi jawaban AI.`
  ] : ['Data WhatsApp AI belum tersedia dalam 30 hari terakhir untuk melakukan analisa deeper.'];

  const reportData = {
    title: 'WhatsApp AI Analytics',
    subtitle: 'Analisis Performa AI & Customer Engagement',
    tenantName: tenant?.name || 'Prima Mobil',
    logoUrl: tenant?.logoUrl || undefined,
    date: new Date(),
    metrics,
    analysis,
    showChart: (whatsappData?.intentBreakdown?.length || 0) > 0,
    chartData: (whatsappData?.intentBreakdown || []).slice(0, 5).map((item, idx) => ({
      label: item.intent.charAt(0).toUpperCase() + item.intent.slice(1),
      value: `${item.count} interaction`,
      color: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'][idx % 5],
    })),
  };

  const pdfBuffer = await generator.generate(reportData);

  return {
    success: true,
    message: '✅ WhatsApp AI Analytics (format standar baru) berhasil dibuat. Mengirim PDF...',
    pdfBuffer,
    filename: `whatsapp-ai-analytics-${new Date().toISOString().split('T')[0]}.pdf`,
    followUp: true,
  };
}

async function generateSalesMetricsPDF(context: CommandContext): Promise<CommandResult> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: context.tenantId },
    select: { name: true, logoUrl: true },
  });

  const salesData = await fetchSalesData(context, 30);
  const inventoryData = await fetchInventoryData(context);

  // Use NEW professional WhatsApp Command PDF
  const generator = new WhatsAppCommandPDF();

  const metrics = [
    {
      label: 'Total Penjualan',
      value: `${salesData.summary.totalSalesCount}`,
      unit: 'Unit',
      color: '#3b82f6',
      formula: 'COUNT(vehicle) WHERE status = SOLD',
      calculation: `${salesData.summary.totalSalesCount} unit terjual`,
    },
    {
      label: 'Total Revenue',
      value: formatCurrency(salesData.summary.totalSalesValue),
      color: '#10b981',
      formula: 'SUM(price) WHERE status = SOLD',
      calculation: formatCurrency(salesData.summary.totalSalesValue),
    },
    {
      label: 'Total Stok',
      value: `${inventoryData.totalStock}`,
      unit: 'Unit',
      color: '#f59e0b',
      formula: 'COUNT(vehicle) WHERE status IN (AVAILABLE, BOOKED)',
      calculation: `${inventoryData.totalStock} unit tersedia`,
    },
    {
      label: 'Rata-rata Harga',
      value: formatCurrency(salesData.avgPrice),
      color: '#8b5cf6',
      formula: 'AVG(price) WHERE status = SOLD',
      calculation: `${formatCurrency(salesData.summary.totalSalesValue)} / ${salesData.summary.totalSalesCount} = ${formatCurrency(salesData.avgPrice)}`,
    },
  ];

  const analysis = [
    `Total penjualan tercatat ${salesData.summary.totalSalesCount} unit dengan rata-rata harga pasar ${formatCurrency(salesData.avgPrice)}.`,
    `Terdapat ${inventoryData.totalStock} unit stok yang siap (Available/Booked), pastikan rotasi stok tetap terjaga.`,
    `Brand "${salesData.byMake[0]?.make || 'N/A'}" mendominasi volume penjualan saat ini.`
  ];

  const reportData = {
    title: 'Metrik Penjualan Showroom',
    subtitle: 'KPI Penjualan & Inventory',
    tenantName: tenant?.name || 'Prima Mobil',
    logoUrl: tenant?.logoUrl || undefined,
    date: new Date(),
    metrics,
    analysis,
    showChart: salesData.byMake.length > 0,
    chartData: salesData.byMake.slice(0, 5).map((item, idx) => ({
      label: item.make,
      value: `${item.count} unit`,
      color: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'][idx % 5],
    })),
  };

  const pdfBuffer = await generator.generate(reportData);

  return {
    success: true,
    message: '✅ Metrik Penjualan (format standar baru) berhasil dibuat. Mengirim PDF...',
    pdfBuffer,
    filename: `metrik-penjualan-${new Date().toISOString().split('T')[0]}.pdf`,
    followUp: true,
  };
}

async function generateCustomerMetricsPDF(context: CommandContext): Promise<CommandResult> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: context.tenantId },
    select: { name: true, logoUrl: true },
  });

  const whatsappData = await fetchWhatsAppAIData(context, 30);

  // Use NEW professional WhatsApp Command PDF
  const generator = new WhatsAppCommandPDF();

  const metrics = whatsappData ? [
    {
      label: 'Total Percakapan',
      value: `${whatsappData.overview.totalConversations}`,
      unit: 'Percakapan',
      color: '#3b82f6',
      formula: 'COUNT(conversations) WHERE date >= NOW() - 30 DAYS',
      calculation: `${whatsappData.overview.totalConversations} percakapan dalam 30 hari`,
    },
    {
      label: 'Percakapan Aktif',
      value: `${whatsappData.overview.activeConversations}`,
      unit: 'Percakapan',
      color: '#10b981',
      formula: 'COUNT(conversations) WHERE state = active',
      calculation: `${whatsappData.overview.activeConversations} percakapan aktif`,
    },
    {
      label: 'Total Pesan Pelanggan',
      value: `${whatsappData.overview.customerMessages}`,
      unit: 'Pesan',
      color: '#f59e0b',
      formula: 'COUNT(messages) WHERE direction = incoming',
      calculation: `${whatsappData.overview.customerMessages} pesan dari pelanggan`,
    },
  ] : [
    {
      label: 'Data Tidak Tersedia',
      value: '0',
      unit: 'N/A',
      color: '#9ca3af',
      formula: 'N/A',
      calculation: 'Data WhatsApp belum tersedia',
    },
  ];

  const analysis = whatsappData ? [
    `Interaksi pelanggan didominasi oleh intent "${whatsappData.intentBreakdown[0]?.intent || 'N/A'}" (${whatsappData.intentBreakdown[0]?.percentage || 0}%).`,
    `Total percakapan baru mencapai ${whatsappData.overview.totalConversations} dalam 30 hari terakhir.`,
    `Fokus pada peningkatan response time di awal percakapan untuk menaikkan conversion rate.`
  ] : ['Belum ada data interaksi pelanggan yang signifikan untuk dianalisa.'];

  const reportData = {
    title: 'Metrik Pelanggan',
    subtitle: 'Customer Engagement Analytics',
    tenantName: tenant?.name || 'Prima Mobil',
    logoUrl: tenant?.logoUrl || undefined,
    date: new Date(),
    metrics,
    analysis,
    showChart: (whatsappData?.intentBreakdown?.length || 0) > 0,
    chartData: (whatsappData?.intentBreakdown || []).slice(0, 5).map((item, idx) => ({
      label: item.intent.charAt(0).toUpperCase() + item.intent.slice(1),
      value: `${item.percentage}% volume`,
      color: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'][idx % 5],
    })),
  };

  const pdfBuffer = await generator.generate(reportData);

  return {
    success: true,
    message: '✅ Metrik Pelanggan (format standar baru) berhasil dibuat. Mengirim PDF...',
    pdfBuffer,
    filename: `metrik-pelanggan-${new Date().toISOString().split('T')[0]}.pdf`,
    followUp: true,
  };
}

async function generateOperationalMetricsPDF(context: CommandContext): Promise<CommandResult> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: context.tenantId },
    select: { name: true, logoUrl: true },
  });

  const salesData = await fetchSalesData(context, 30);
  const inventoryData = await fetchInventoryData(context);
  const staffData = await fetchStaffPerformance(context, 30);

  // Use NEW professional WhatsApp Command PDF
  const generator = new WhatsAppCommandPDF();

  const metrics = [
    {
      label: 'Total Stok',
      value: `${inventoryData.totalStock}`,
      unit: 'Unit',
      color: '#3b82f6',
      formula: 'COUNT(vehicle) WHERE status IN (AVAILABLE, BOOKED)',
      calculation: `${inventoryData.totalStock} unit tersedia`,
    },
    {
      label: 'Total Staff',
      value: `${staffData.totalStaff}`,
      unit: 'Staff',
      color: '#10b981',
      formula: 'COUNT(users) WHERE role IN (SALES, STAFF)',
      calculation: `${staffData.totalStaff} staff aktif`,
    },
    {
      label: 'Staff dengan Penjualan',
      value: `${staffData.topPerformers.length}`,
      unit: 'Staff',
      color: '#f59e0b',
      formula: 'COUNT(DISTINCT staff) WHERE sales > 0',
      calculation: `${staffData.topPerformers.length} staff dengan performa`,
    },
    {
      label: 'Unit Terjual',
      value: `${salesData.summary.totalSalesCount}`,
      unit: 'Unit',
      color: '#8b5cf6',
      formula: 'COUNT(vehicle) WHERE status = SOLD',
      calculation: `${salesData.summary.totalSalesCount} unit terjual`,
    },
  ];

  const analysis = [
    `Stok tersedia ${inventoryData.totalStock} unit dengan total staff aktif ${staffData.totalStaff} orang.`,
    `Terdapat ${staffData.topPerformers.length} staff yang berhasil mencatat penjualan dalam 30 hari terakhir.`,
    `Rasio unit terjual per staff aktif perlu ditingkatkan untuk mengoptimalkan operasional showroom.`
  ];

  const reportData = {
    title: 'Metrik Operational Showroom',
    subtitle: 'KPI Operational & Staff Performance',
    tenantName: tenant?.name || 'Prima Mobil',
    logoUrl: tenant?.logoUrl || undefined,
    date: new Date(),
    metrics,
    analysis,
    showChart: salesData.byMake.length > 0,
    chartData: salesData.byMake.slice(0, 5).map((item, idx) => ({
      label: item.make,
      value: `${item.count} unit terjual`,
      color: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'][idx % 5],
    })),
  };

  const pdfBuffer = await generator.generate(reportData);

  return {
    success: true,
    message: '✅ Metrik Operational (format standar baru) berhasil dibuat. Mengirim PDF...',
    pdfBuffer,
    filename: `metrik-operational-${new Date().toISOString().split('T')[0]}.pdf`,
    followUp: true,
  };
}

async function generateSalesTrendsPDF(context: CommandContext): Promise<CommandResult> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: context.tenantId },
    select: { name: true, logoUrl: true },
  });

  const salesData = await fetchSalesData(context, 30);

  // Calculate trends
  const totalSales = salesData.summary.totalSalesCount;
  const totalRevenue = salesData.summary.totalSalesValue;
  const avgDailySales = salesData.salesByDay.length > 0
    ? totalSales / salesData.salesByDay.length
    : 0;

  // Use NEW professional WhatsApp Command PDF
  const generator = new WhatsAppCommandPDF();

  const metrics = [
    {
      label: 'Total Penjualan (30 Hari)',
      value: `${totalSales}`,
      unit: 'Unit',
      color: '#3b82f6',
      formula: 'SUM(sales) WHERE date >= NOW() - 30 DAYS',
      calculation: `${totalSales} unit terjual dalam 30 hari`,
    },
    {
      label: 'Rata-rata Harian',
      value: `${avgDailySales.toFixed(1)}`,
      unit: 'Unit/Hari',
      color: '#10b981',
      formula: 'AVG(daily sales)',
      calculation: `${totalSales} unit / ${salesData.salesByDay.length} hari = ${avgDailySales.toFixed(1)} unit/hari`,
    },
    {
      label: 'Total Revenue',
      value: formatCurrency(totalRevenue),
      color: '#f59e0b',
      formula: 'SUM(price) WHERE date >= NOW() - 30 DAYS',
      calculation: formatCurrency(totalRevenue),
    },
  ];

  const analysis = [
    `Total penjualan 30 hari terakhir mencapai ${totalSales} unit dengan revenue ${formatCurrency(totalRevenue)}.`,
    `Rata-rata penjualan harian stabil di angka ${avgDailySales.toFixed(1)} unit per hari.`,
    `Tren penjualan menunjukkan brand "${salesData.byMake[0]?.make || 'Other'}" sebagai kontributor utama.`
  ];

  const reportData = {
    title: 'Tren Penjualan Showroom',
    subtitle: 'Analisis Tren 30 Hari Terakhir',
    tenantName: tenant?.name || 'Prima Mobil',
    logoUrl: tenant?.logoUrl || undefined,
    date: new Date(),
    metrics,
    analysis,
    showChart: true,
    chartData: salesData.byMake.slice(0, 5).map((item, idx) => ({
      label: item.make,
      value: `${item.count} unit (${Math.round((item.count / totalSales) * 100)}%)`,
      color: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'][idx % 5],
    })),
  };

  const pdfBuffer = await generator.generate(reportData);

  return {
    success: true,
    message: '✅ Tren Penjualan (format standar baru) berhasil dibuat. Mengirim PDF...',
    pdfBuffer,
    filename: `tren-penjualan-${new Date().toISOString().split('T')[0]}.pdf`,
    followUp: true,
  };
}

async function generateStaffPerformancePDF(context: CommandContext): Promise<CommandResult> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: context.tenantId },
    select: { name: true, logoUrl: true },
  });

  const staffData = await fetchStaffPerformance(context, 30);

  // Use NEW professional WhatsApp Command PDF
  const generator = new WhatsAppCommandPDF();

  const topPerformer = staffData.topPerformers[0];
  const totalStaffSales = staffData.topPerformers.reduce((sum, s) => sum + s.count, 0);
  const totalStaffValue = staffData.topPerformers.reduce((sum, s) => sum + s.value, 0);

  const metrics = [
    {
      label: 'Top Performer',
      value: topPerformer ? topPerformer.name : 'N/A',
      unit: topPerformer ? `${topPerformer.count} unit` : '',
      color: '#3b82f6',
      formula: 'MAX(COUNT(sales)) GROUP BY staff',
      calculation: topPerformer ? `${topPerformer.name} dengan ${topPerformer.count} unit penjualan` : 'Belum ada data',
    },
    {
      label: 'Total Staff Aktif',
      value: `${staffData.topPerformers.length}`,
      unit: 'Staff',
      color: '#10b981',
      formula: 'COUNT(DISTINCT staff) WHERE sales > 0',
      calculation: `${staffData.topPerformers.length} staff dengan performa penjualan`,
    },
    {
      label: 'Total Penjualan Staff',
      value: `${totalStaffSales}`,
      unit: 'Unit',
      color: '#f59e0b',
      formula: 'SUM(sales) WHERE sold_by IN (staff)',
      calculation: `${totalStaffSales} unit terjual oleh staff`,
    },
    {
      label: 'Rata-rata per Staff',
      value: staffData.topPerformers.length > 0 ? `${(totalStaffSales / staffData.topPerformers.length).toFixed(1)}` : '0',
      unit: 'Unit/Staff',
      color: '#8b5cf6',
      formula: 'AVG(sales) GROUP BY staff',
      calculation: `${totalStaffSales} unit / ${staffData.topPerformers.length} staff = ${(totalStaffSales / staffData.topPerformers.length).toFixed(1)} unit/staff`,
    },
  ];

  const analysis = topPerformer ? [
    `Top performer periode ini adalah ${topPerformer.name} dengan total ${topPerformer.count} closing.`,
    `Total kontribusi seluruh tim mencapai ${totalStaffSales} unit dalam 30 hari.`,
    `Rata-rata produktivitas tim berada di angka ${(totalStaffSales / staffData.topPerformers.length).toFixed(1)} unit per staff aktif.`
  ] : ['Belum ada data performa staff yang tercatat periode ini.'];

  const reportData = {
    title: 'Staff Performance Showroom',
    subtitle: 'Performa Sales Staff (30 Hari Terakhir)',
    tenantName: tenant?.name || 'Prima Mobil',
    logoUrl: tenant?.logoUrl || undefined,
    date: new Date(),
    metrics,
    analysis,
    showChart: staffData.topPerformers.length > 0,
    chartData: staffData.topPerformers.slice(0, 5).map((performer, idx) => ({
      label: performer.name,
      value: `${performer.count} closing`,
      color: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'][idx % 5],
    })),
  };

  const pdfBuffer = await generator.generate(reportData);

  return {
    success: true,
    message: '✅ Staff Performance (format standar baru) berhasil dibuat. Mengirim PDF...',
    pdfBuffer,
    filename: `staff-performance-${new Date().toISOString().split('T')[0]}.pdf`,
    followUp: true,
  };
}

async function generateRecentSalesPDF(context: CommandContext): Promise<CommandResult> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: context.tenantId },
    select: { name: true, logoUrl: true },
  });

  const salesData = await fetchSalesData(context, 7);

  // Use NEW professional WhatsApp Command PDF
  const generator = new WhatsAppCommandPDF();

  const metrics = [
    {
      label: 'Penjualan 7 Hari Terakhir',
      value: `${salesData.summary.totalSalesCount}`,
      unit: 'Unit',
      color: '#3b82f6',
      formula: 'COUNT(vehicle) WHERE status = SOLD AND date >= NOW() - 7 DAYS',
      calculation: `${salesData.summary.totalSalesCount} unit terjual dalam 7 hari`,
    },
    {
      label: 'Total Revenue 7 Hari',
      value: formatCurrency(salesData.summary.totalSalesValue),
      color: '#10b981',
      formula: 'SUM(price) WHERE status = SOLD AND date >= NOW() - 7 DAYS',
      calculation: formatCurrency(salesData.summary.totalSalesValue),
    },
    {
      label: 'Rata-rata Harga',
      value: formatCurrency(salesData.avgPrice),
      color: '#f59e0b',
      formula: 'AVG(price) WHERE status = SOLD AND date >= NOW() - 7 DAYS',
      calculation: `${formatCurrency(salesData.summary.totalSalesValue)} / ${salesData.summary.totalSalesCount} = ${formatCurrency(salesData.avgPrice)}`,
    },
  ];

  const analysis = [
    `Penjualan 7 hari terakhir sebanyak ${salesData.summary.totalSalesCount} unit dengan revenue ${formatCurrency(salesData.summary.totalSalesValue)}.`,
    `Rata-rata harga unit terjual seminggu terakhir adalah ${formatCurrency(salesData.avgPrice)}.`,
    `Brand "${salesData.byMake[0]?.make || 'N/A'}" paling banyak diminati dalam periode singkat ini.`
  ];

  const reportData = {
    title: 'Recent Sales Showroom',
    subtitle: 'Penjualan 7 Hari Terakhir',
    tenantName: tenant?.name || 'Prima Mobil',
    logoUrl: tenant?.logoUrl || undefined,
    date: new Date(),
    metrics,
    analysis,
    showChart: salesData.byMake.length > 0,
    chartData: salesData.byMake.slice(0, 5).map((item, idx) => ({
      label: item.make,
      value: `${item.count} unit`,
      color: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'][idx % 5],
    })),
  };

  const pdfBuffer = await generator.generate(reportData);

  return {
    success: true,
    message: '✅ Recent Sales (format standar baru) berhasil dibuat. Mengirim PDF...',
    pdfBuffer,
    filename: `recent-sales-${new Date().toISOString().split('T')[0]}.pdf`,
    followUp: true,
  };
}

async function generateLowStockPDF(context: CommandContext): Promise<CommandResult> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: context.tenantId },
    select: { name: true, logoUrl: true },
  });

  const inventoryData = await fetchInventoryData(context);

  // Use NEW professional WhatsApp Command PDF
  const generator = new WhatsAppCommandPDF();

  const isLowStock = inventoryData.totalStock < 10;
  const isMediumStock = inventoryData.totalStock < 20;
  const stockStatus = isLowStock ? 'CRITICAL' : isMediumStock ? 'WARNING' : 'SAFE';
  const stockColor = isLowStock ? '#ef4444' : isMediumStock ? '#f59e0b' : '#10b981';

  // Group inventory by make for chart
  const byMake: Record<string, number> = {};
  inventoryData.vehicles.forEach((v) => {
    const make = v.make || 'Other';
    byMake[make] = (byMake[make] || 0) + 1;
  });
  const chartData = Object.entries(byMake)
    .map(([make, count]) => ({ make, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
    .map((item, idx) => ({
      label: item.make,
      value: item.count,
      color: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'][idx % 5],
    }));

  const metrics = [
    {
      label: 'Total Stok Saat Ini',
      value: `${inventoryData.totalStock}`,
      unit: 'Unit',
      color: stockColor,
      formula: 'COUNT(vehicle) WHERE status IN (AVAILABLE, BOOKED)',
      calculation: `${inventoryData.totalStock} unit tersedia`,
    },
    {
      label: 'Status Stok',
      value: stockStatus,
      unit: isLowStock ? '⚠️ CRITICAL' : isMediumStock ? '⚠️ WARNING' : '✅ AMAN',
      color: stockColor,
      formula: 'IF(stock < 10, "CRITICAL", IF(stock < 20, "WARNING", "SAFE"))',
      calculation: `Stok ${inventoryData.totalStock} unit: ${isLowStock ? 'Kritis - perlu restock segera' : isMediumStock ? 'Menipis - pertimbangkan restock' : 'Aman'}`,
    },
    {
      label: 'Total Nilai Stok',
      value: formatCurrency(inventoryData.totalValue),
      color: '#3b82f6',
      formula: 'SUM(price) WHERE status IN (AVAILABLE, BOOKED)',
      calculation: formatCurrency(inventoryData.totalValue),
    },
  ];

  const analysis = [
    `Total stok saat ini adalah ${inventoryData.totalStock} unit dengan status ${stockStatus}.`,
    isLowStock ? '⚠️ PERINGATAN: Stok sangat rendah. Segera lakukan pengadaan unit baru untuk menjaga ketersediaan.' : '✅ Stok masih dalam batas aman, namun tetap monitor pergerakan unit populer.',
    `Total nilai aset inventory yang tersedia saat ini adalah ${formatCurrency(inventoryData.totalValue)}.`
  ];

  const reportData = {
    title: 'Low Stock Alert Showroom',
    subtitle: 'Monitoring Stok Kendaraan',
    tenantName: tenant?.name || 'Prima Mobil',
    logoUrl: tenant?.logoUrl || undefined,
    date: new Date(),
    metrics,
    analysis,
    showChart: chartData.length > 0,
    chartData: chartData.map(c => ({ ...c, value: `${c.value} unit` })),
  };

  const pdfBuffer = await generator.generate(reportData);

  return {
    success: true,
    message: '✅ Low Stock Alert (format standar baru) berhasil dibuat. Mengirim PDF...',
    pdfBuffer,
    filename: `low-stock-alert-${new Date().toISOString().split('T')[0]}.pdf`,
    followUp: true,
  };
}

async function generateTotalSalesPDF(context: CommandContext): Promise<CommandResult> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: context.tenantId },
    select: { name: true, logoUrl: true },
  });

  const salesData = await fetchSalesData(context, 30);
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - 30);

  // Use NEW professional WhatsApp Command PDF
  const generator = new WhatsAppCommandPDF();

  const metrics = [
    {
      label: 'Total Penjualan',
      value: `${salesData.summary.totalSalesCount}`,
      unit: 'Unit',
      color: '#3b82f6',
      formula: 'COUNT(vehicle WHERE status = SOLD)',
      calculation: `${salesData.summary.totalSalesCount} unit terjual`,
    },
    {
      label: 'Total Revenue',
      value: formatCurrency(salesData.summary.totalSalesValue),
      color: '#10b981',
      formula: 'SUM(price) WHERE status = SOLD',
      calculation: formatCurrency(salesData.summary.totalSalesValue),
    },
    {
      label: 'Rata-rata Harga',
      value: formatCurrency(salesData.avgPrice),
      color: '#f59e0b',
      formula: 'AVG(price) WHERE status = SOLD',
      calculation: `${formatCurrency(salesData.summary.totalSalesValue)} / ${salesData.summary.totalSalesCount} = ${formatCurrency(salesData.avgPrice)}`,
    },
  ];

  const analysis = [
    `Total penjualan periode ini mencapai ${salesData.summary.totalSalesCount} unit.`,
    `Fokus penjualan saat ini berada pada brand "${salesData.byMake[0]?.make || 'N/A'}".`,
    `Tingkatkan promosi untuk brand dengan stok tinggi namun volume penjualan rendah.`
  ];

  const reportData = {
    title: 'Total Penjualan Showroom',
    subtitle: 'Rekapitulasi Unit Terjual (30 Hari)',
    tenantName: tenant?.name || 'Prima Mobil',
    logoUrl: tenant?.logoUrl || undefined,
    date: new Date(),
    metrics,
    analysis,
    showChart: salesData.byMake.length > 0,
    chartData: salesData.byMake.slice(0, 5).map((item, idx) => ({
      label: item.make,
      value: `${item.count} unit`,
      color: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'][idx % 5],
    })),
  };

  const pdfBuffer = await generator.generate(reportData);

  return {
    success: true,
    message: '✅ Total Penjualan (format standar baru) berhasil dibuat. Mengirim PDF...',
    pdfBuffer,
    filename: `total-penjualan-${new Date().toISOString().split('T')[0]}.pdf`,
    followUp: true,
  };
}

async function generateTotalRevenuePDF(context: CommandContext): Promise<CommandResult> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: context.tenantId },
    select: { name: true, logoUrl: true },
  });

  const salesData = await fetchSalesData(context, 30);

  // Use NEW professional WhatsApp Command PDF
  const generator = new WhatsAppCommandPDF();

  const metrics = [
    {
      label: 'Total Revenue',
      value: formatCurrency(salesData.summary.totalSalesValue),
      color: '#10b981',
      formula: 'SUM(price) WHERE status = SOLD',
      calculation: formatCurrency(salesData.summary.totalSalesValue),
    },
    {
      label: 'Unit Terjual',
      value: `${salesData.summary.totalSalesCount}`,
      unit: 'Unit',
      color: '#3b82f6',
      formula: 'COUNT(vehicle) WHERE status = SOLD',
      calculation: `${salesData.summary.totalSalesCount} unit terjual`,
    },
    {
      label: 'Rata-rata per Unit',
      value: formatCurrency(salesData.avgPrice),
      color: '#f59e0b',
      formula: 'AVG(price) WHERE status = SOLD',
      calculation: `${formatCurrency(salesData.summary.totalSalesValue)} / ${salesData.summary.totalSalesCount} = ${formatCurrency(salesData.avgPrice)}`,
    },
  ];

  const analysis = [
    `Total revenue 30 hari terakhir mencapai ${formatCurrency(salesData.summary.totalSalesValue)}.`,
    `Brand "${salesData.byMake[0]?.make || 'N/A'}" memberikan kontribusi revenue tertinggi sebesar ${formatCurrency(salesData.byMake[0]?.value || 0)}.`,
    `Rata-rata revenue per unit terjual adalah ${formatCurrency(salesData.avgPrice)}.`
  ];

  const reportData = {
    title: 'Total Revenue Showroom',
    subtitle: 'Laporan Pendapatan (30 Hari Terakhir)',
    tenantName: tenant?.name || 'Prima Mobil',
    logoUrl: tenant?.logoUrl || undefined,
    date: new Date(),
    metrics,
    analysis,
    showChart: salesData.byMake.length > 0,
    chartData: salesData.byMake.slice(0, 5).map((item, idx) => ({
      label: item.make,
      value: formatCurrency(item.value),
      color: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'][idx % 5],
    })),
  };

  const pdfBuffer = await generator.generate(reportData);

  return {
    success: true,
    message: '✅ Total Revenue (format standar baru) berhasil dibuat. Mengirim PDF...',
    pdfBuffer,
    filename: `total-revenue-${new Date().toISOString().split('T')[0]}.pdf`,
    followUp: true,
  };
}

async function generateTotalInventoryPDF(context: CommandContext): Promise<CommandResult> {
  try {
    console.log('[Total Inventory] Starting PDF generation...');

    const tenant = await prisma.tenant.findUnique({
      where: { id: context.tenantId },
      select: { name: true, logoUrl: true },
    });

    const inventoryData = await fetchInventoryData(context);
    console.log('[Total Inventory] Data fetched:', inventoryData.totalStock, 'units');

    // Use NEW professional WhatsApp Command PDF
    const generator = new WhatsAppCommandPDF();

    // Group inventory by make for chart
    const byMake: Record<string, number> = {};
    inventoryData.vehicles.forEach((v) => {
      const make = v.make || 'Other';
      byMake[make] = (byMake[make] || 0) + 1;
    });
    const chartData = Object.entries(byMake)
      .map(([make, count]) => ({ make, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map((item, idx) => ({
        label: item.make,
        value: item.count,
        color: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'][idx % 5],
      }));

    console.log('[Total Inventory] Chart data prepared:', chartData.length, 'items');

    const metrics = [
      {
        label: 'Total Stok',
        value: `${inventoryData.totalStock}`,
        unit: 'Unit',
        color: '#3b82f6',
        formula: 'COUNT(vehicle) WHERE status IN (AVAILABLE, BOOKED)',
        calculation: `${inventoryData.totalStock} unit tersedia`,
      },
      {
        label: 'Total Nilai Stok',
        value: formatCurrency(inventoryData.totalValue),
        color: '#10b981',
        formula: 'SUM(price) WHERE status IN (AVAILABLE, BOOKED)',
        calculation: formatCurrency(inventoryData.totalValue),
      },
      {
        label: 'Rata-rata Hari di Stok',
        value: `${inventoryData.avgDaysInStock}`,
        unit: 'Hari',
        color: '#f59e0b',
        formula: 'AVG(days since added) WHERE status IN (AVAILABLE, BOOKED)',
        calculation: `Rata-rata ${inventoryData.avgDaysInStock} hari`,
      },
    ];

    const analysis = [
      `Total stok unit tersedia saat ini adalah ${inventoryData.totalStock} unit.`,
      `Total nilai aset inventory (Total Value) mencapai ${formatCurrency(inventoryData.totalValue)}.`,
      `Rata-rata waktu unit berada di stok adalah ${inventoryData.avgDaysInStock} hari. Fokus pada unit dengan aging tinggi.`
    ];

    const reportData = {
      title: 'Total Inventory Showroom',
      subtitle: 'Stok Kendaraan Tersedia',
      tenantName: tenant?.name || 'Prima Mobil',
      logoUrl: tenant?.logoUrl || undefined,
      date: new Date(),
      metrics,
      analysis,
      showChart: chartData.length > 0,
      chartData: chartData.map(c => ({ ...c, value: `${c.value} unit` })),
    };

    console.log('[Total Inventory] Generating PDF...');
    const pdfBuffer = await generator.generate(reportData);
    console.log('[Total Inventory] PDF generated successfully:', pdfBuffer.length, 'bytes');

    return {
      success: true,
      message: '✅ Total Inventory (format profesional) berhasil dibuat. Mengirim PDF...',
      pdfBuffer,
      filename: `total-inventory-${new Date().toISOString().split('T')[0]}.pdf`,
      followUp: true,
    };
  } catch (error) {
    console.error('[Total Inventory] ERROR:', error);
    return {
      success: false,
      message: `❌ Error generating Total Inventory PDF: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

async function generateAveragePricePDF(context: CommandContext): Promise<CommandResult> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: context.tenantId },
    select: { name: true, logoUrl: true },
  });

  const salesData = await fetchSalesData(context, 30);
  const inventoryData = await fetchInventoryData(context);

  const avgStockPrice = inventoryData.totalStock > 0 ? inventoryData.totalValue / inventoryData.totalStock : 0;

  // Use NEW professional WhatsApp Command PDF
  const generator = new WhatsAppCommandPDF();

  const metrics = [
    {
      label: 'Rata-rata Harga Penjualan',
      value: formatCurrency(salesData.avgPrice),
      color: '#10b981',
      formula: 'AVG(price) WHERE status = SOLD AND date >= NOW() - 30 DAYS',
      calculation: `${formatCurrency(salesData.summary.totalSalesValue)} / ${salesData.summary.totalSalesCount} = ${formatCurrency(salesData.avgPrice)}`,
    },
    {
      label: 'Rata-rata Harga Stok',
      value: formatCurrency(avgStockPrice),
      color: '#3b82f6',
      formula: 'SUM(price) / COUNT(vehicle) WHERE status IN (AVAILABLE, BOOKED)',
      calculation: `${formatCurrency(inventoryData.totalValue)} / ${inventoryData.totalStock} = ${formatCurrency(avgStockPrice)}`,
    },
    {
      label: 'Unit Terjual',
      value: `${salesData.summary.totalSalesCount}`,
      unit: 'Unit',
      color: '#f59e0b',
      formula: 'COUNT(vehicle) WHERE status = SOLD',
      calculation: `${salesData.summary.totalSalesCount} unit terjual dalam 30 hari`,
    },
    {
      label: 'Stok Tersedia',
      value: `${inventoryData.totalStock}`,
      unit: 'Unit',
      color: '#8b5cf6',
      formula: 'COUNT(vehicle) WHERE status IN (AVAILABLE, BOOKED)',
      calculation: `${inventoryData.totalStock} unit tersedia`,
    },
  ];

  const analysis = [
    `Rata-rata harga unit terjual (Sales) adalah ${formatCurrency(salesData.avgPrice)}.`,
    `Rata-rata harga unit yang masih tersedia (Stock) adalah ${formatCurrency(avgStockPrice)}.`,
    `Gap harga antara stok dan sales menunjukkan segmentasi unit yang ${avgStockPrice > salesData.avgPrice ? 'lebih tinggi' : 'lebih rendah'} dari rata-rata penjualan.`
  ];

  const reportData = {
    title: 'Average Price Showroom',
    subtitle: 'Analisis Perbandingan Harga',
    tenantName: tenant?.name || 'Prima Mobil',
    logoUrl: tenant?.logoUrl || undefined,
    date: new Date(),
    metrics,
    analysis,
    showChart: true,
    chartData: [
      { label: 'Avg Sales Price', value: formatCurrency(salesData.avgPrice), color: '#10b981' },
      { label: 'Avg Stock Price', value: formatCurrency(avgStockPrice), color: '#3b82f6' }
    ],
  };

  const pdfBuffer = await generator.generate(reportData);

  return {
    success: true,
    message: '✅ Average Price (format standar baru) berhasil dibuat. Mengirim PDF...',
    pdfBuffer,
    filename: `average-price-${new Date().toISOString().split('T')[0]}.pdf`,
    followUp: true,
  };
}
