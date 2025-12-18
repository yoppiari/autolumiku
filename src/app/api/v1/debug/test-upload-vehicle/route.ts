/**
 * Debug endpoint to test upload_vehicle flow
 * GET /api/v1/debug/test-upload-vehicle?tenant=primamobil-id
 * POST /api/v1/debug/test-upload-vehicle - Simulate upload with data
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { VehicleDataExtractorService } from "@/lib/ai/vehicle-data-extractor.service";

/**
 * GET - Check upload readiness and staff authorization
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const tenantSlug = searchParams.get("tenant") || "primamobil-id";
  const staffPhone = searchParams.get("phone");

  try {
    // 1. Get tenant
    const tenant = await prisma.tenant.findUnique({
      where: { slug: tenantSlug },
      select: { id: true, name: true, slug: true },
    });

    if (!tenant) {
      return NextResponse.json(
        { success: false, error: `Tenant '${tenantSlug}' not found` },
        { status: 404 }
      );
    }

    // 2. Get Aimeow Account
    const aimeowAccount = await prisma.aimeowAccount.findUnique({
      where: { tenantId: tenant.id },
      select: {
        id: true,
        clientId: true,
        phoneNumber: true,
        connectionStatus: true,
        isActive: true,
      },
    });

    // 3. Get staff users
    const staffUsers = await prisma.user.findMany({
      where: { tenantId: tenant.id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
      },
    });

    // 4. Check specific staff if phone provided
    let staffAuth = null;
    if (staffPhone) {
      const normalizedPhone = normalizePhone(staffPhone);
      const matchedStaff = staffUsers.find(
        (u) => u.phone && normalizePhone(u.phone) === normalizedPhone
      );
      staffAuth = {
        inputPhone: staffPhone,
        normalizedPhone,
        isAuthorized: !!matchedStaff,
        matchedUser: matchedStaff || null,
      };
    }

    // 5. Get recent uploads
    const recentUploads = await prisma.vehicle.findMany({
      where: { tenantId: tenant.id },
      select: {
        id: true,
        make: true,
        model: true,
        year: true,
        price: true,
        status: true,
        createdAt: true,
        photos: {
          select: { id: true, isMainPhoto: true },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    });

    // 6. Get upload statistics
    const uploadStats = await prisma.vehicle.groupBy({
      by: ["status"],
      where: { tenantId: tenant.id },
      _count: true,
    });

    return NextResponse.json({
      success: true,
      tenant,
      aimeowAccount: aimeowAccount
        ? {
            ...aimeowAccount,
            ready: aimeowAccount.connectionStatus === "connected",
          }
        : { ready: false, message: "Aimeow not configured" },
      staffUsers: {
        total: staffUsers.length,
        withPhone: staffUsers.filter((u) => u.phone).length,
        users: staffUsers.map((u) => ({
          name: `${u.firstName} ${u.lastName}`,
          email: u.email,
          phone: u.phone,
          phoneNormalized: u.phone ? normalizePhone(u.phone) : null,
          role: u.role,
          canUpload: !!u.phone,
        })),
      },
      staffAuth,
      recentUploads: recentUploads.map((v) => ({
        id: v.id,
        name: `${v.make} ${v.model} ${v.year}`,
        price: Number(v.price),
        status: v.status,
        hasPhoto: v.photos.length > 0,
        createdAt: v.createdAt,
      })),
      uploadStats: uploadStats.reduce(
        (acc, s) => ({ ...acc, [s.status]: s._count }),
        {}
      ),
      uploadFlow: {
        description: "Flow upload vehicle via WhatsApp AI",
        steps: [
          {
            step: 1,
            action: "Staff kirim '/upload'",
            response: "Sistem minta 6 foto (interior + exterior)",
          },
          {
            step: 2,
            action: "Staff kirim 6 foto",
            response: "Sistem minta data mobil",
          },
          {
            step: 3,
            action: "Staff ketik: 'Brio 2020 120jt hitam matic km 30rb'",
            response: "AI extract data, jika lengkap → upload",
          },
          {
            step: 4,
            action: "Jika data kurang",
            response: "AI minta lengkapi: 'warna apa? transmisi apa?'",
          },
          {
            step: 5,
            action: "Staff lengkapi data",
            response: "Vehicle dibuat + notifikasi ke semua staff",
          },
        ],
        requiredFields: [
          "Model (Brio, Avanza, dll)",
          "Tahun (2020, 2019, dll)",
          "Harga (120jt, 150000000, dll)",
          "Warna (hitam, putih, silver, dll)",
          "Transmisi (manual, matic, MT, AT)",
          "KM (30rb, 50000, dll)",
        ],
        photoRequirements: {
          minimum: 6,
          maximum: 15,
          types: [
            "Eksterior: depan, belakang, samping kiri, samping kanan",
            "Interior: dashboard, jok depan, bagasi",
          ],
        },
      },
    });
  } catch (error: any) {
    console.error("[Test Upload Vehicle] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message, stack: error.stack },
      { status: 500 }
    );
  }
}

/**
 * POST - Test vehicle data extraction
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text, testType = "extract" } = body;

    if (!text) {
      return NextResponse.json(
        { success: false, error: "Text is required" },
        { status: 400 }
      );
    }

    const results: any = {
      input: text,
      testType,
    };

    // Test AI extraction
    console.log("[Test Upload] Testing AI extraction for:", text);
    const startTime = Date.now();

    const aiResult =
      await VehicleDataExtractorService.extractFromNaturalLanguage(text);
    results.aiExtraction = {
      ...aiResult,
      processingTime: Date.now() - startTime,
    };

    // Test regex extraction
    const regexResult = VehicleDataExtractorService.extractUsingRegex(text);
    results.regexExtraction = regexResult;

    // Check completeness
    if (aiResult.success && aiResult.data) {
      const data = aiResult.data;
      const missingFields: string[] = [];

      if (!data.model) missingFields.push("model");
      if (!data.year) missingFields.push("year");
      if (!data.price) missingFields.push("price");
      if (!data.color || data.color === "Unknown") missingFields.push("color");
      if (!data.transmission || data.transmission === "Unknown")
        missingFields.push("transmission");
      if (!data.mileage && data.mileage !== 0) missingFields.push("mileage");

      results.completeness = {
        isComplete: missingFields.length === 0,
        missingFields,
        message:
          missingFields.length === 0
            ? "✅ Data lengkap, siap upload!"
            : `⚠️ Kurang: ${missingFields.join(", ")}`,
      };
    }

    // Example responses
    results.examples = {
      complete: [
        "Brio 2020 120jt hitam matic km 30rb",
        "Avanza 2019 silver manual 150jt kilometer 50ribu",
        "Jazz RS 2018 merah AT harga 165jt km 45000",
      ],
      incomplete: [
        "Brio 2020 120jt → kurang: warna, transmisi, km",
        "Avanza silver → kurang: tahun, harga, transmisi, km",
      ],
    };

    return NextResponse.json({
      success: true,
      results,
    });
  } catch (error: any) {
    console.error("[Test Upload Vehicle POST] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * Normalize phone number for comparison
 */
function normalizePhone(phone: string): string {
  if (!phone) return "";
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0")) {
    digits = "62" + digits.substring(1);
  }
  return digits;
}
