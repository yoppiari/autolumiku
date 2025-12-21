/**
 * Comprehensive WhatsApp AI Test Endpoint
 * GET /api/v1/debug/test-whatsapp-ai?tenant=primamobil-id
 *
 * Tests all WhatsApp AI features:
 * 1. send_vehicle_images - Vehicle search & photo URLs
 * 2. upload_vehicle - Data extraction from various formats
 * 3. Staff authorization - Phone normalization
 * 4. Aimeow connection status
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { VehicleDataExtractorService } from "@/lib/ai/vehicle-data-extractor.service";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const tenantSlug = searchParams.get("tenant") || "primamobil-id";
  const startTime = Date.now();

  const results: any = {
    tenant: null,
    tests: [],
    summary: {
      total: 0,
      passed: 0,
      failed: 0,
      warnings: 0,
    },
  };

  try {
    // ========== SETUP: Get Tenant ==========
    const tenant = await prisma.tenant.findUnique({
      where: { slug: tenantSlug },
      select: { id: true, name: true, slug: true },
    });

    if (!tenant) {
      return NextResponse.json({
        success: false,
        error: `Tenant '${tenantSlug}' not found`,
      }, { status: 404 });
    }

    results.tenant = tenant;

    // ========== TEST 1: Aimeow Connection ==========
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

    const test1: any = {
      id: 1,
      name: "Aimeow Connection",
      status: "FAIL",
      details: {},
    };

    if (aimeowAccount) {
      test1.details = {
        accountId: aimeowAccount.id,
        clientId: aimeowAccount.clientId,
        phoneNumber: aimeowAccount.phoneNumber,
        connectionStatus: aimeowAccount.connectionStatus,
        isActive: aimeowAccount.isActive,
      };

      if (aimeowAccount.connectionStatus === "connected" && aimeowAccount.isActive) {
        test1.status = "PASS";
        test1.message = "Aimeow connected and active";
      } else if (aimeowAccount.connectionStatus === "connected") {
        test1.status = "WARN";
        test1.message = "Connected but isActive=false";
      } else {
        test1.status = "FAIL";
        test1.message = `Connection status: ${aimeowAccount.connectionStatus}`;
      }
    } else {
      test1.status = "FAIL";
      test1.message = "No Aimeow account configured";
    }

    results.tests.push(test1);

    // ========== TEST 2: Staff Users ==========
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

    const usersWithPhone = staffUsers.filter(u => u.phone);

    const test2: any = {
      id: 2,
      name: "Staff Users",
      status: usersWithPhone.length > 0 ? "PASS" : "FAIL",
      message: `${staffUsers.length} users total, ${usersWithPhone.length} with phone`,
      details: {
        total: staffUsers.length,
        withPhone: usersWithPhone.length,
        users: staffUsers.map(u => ({
          name: `${u.firstName} ${u.lastName}`,
          phone: u.phone,
          phoneNormalized: u.phone ? normalizePhone(u.phone) : null,
          role: u.role,
        })),
      },
    };

    if (usersWithPhone.length === 0) {
      test2.message = "No staff with phone numbers - upload will fail!";
    }

    results.tests.push(test2);

    // ========== TEST 3: Vehicle Inventory ==========
    const vehicles = await prisma.vehicle.findMany({
      where: { tenantId: tenant.id, status: "AVAILABLE" },
      select: {
        id: true,
        make: true,
        model: true,
        year: true,
        price: true,
        photos: {
          select: {
            id: true,
            originalUrl: true,
            mediumUrl: true,
            largeUrl: true,
          },
          take: 1,
        },
      },
      take: 10,
    });

    const vehiclesWithPhotos = vehicles.filter(v => v.photos.length > 0);

    const test3: any = {
      id: 3,
      name: "Vehicle Inventory",
      status: vehicles.length > 0 ? "PASS" : "WARN",
      message: `${vehicles.length} available vehicles, ${vehiclesWithPhotos.length} with photos`,
      details: {
        totalAvailable: vehicles.length,
        withPhotos: vehiclesWithPhotos.length,
        vehicles: vehicles.slice(0, 5).map(v => ({
          id: v.id,
          name: `${v.make} ${v.model} ${v.year}`,
          price: Number(v.price),
          hasPhoto: v.photos.length > 0,
          photoUrl: v.photos[0]?.mediumUrl || v.photos[0]?.originalUrl || null,
        })),
      },
    };

    if (vehicles.length === 0) {
      test3.status = "WARN";
      test3.message = "No available vehicles - send_vehicle_images will return empty";
    }

    results.tests.push(test3);

    // ========== TEST 4: send_vehicle_images Search ==========
    const searchQueries = ["Brio", "Avanza", "Jazz"];
    const searchResults: any[] = [];

    for (const query of searchQueries) {
      const searchTerms = query.toLowerCase().split(/\s+/);
      const found = await prisma.vehicle.findMany({
        where: {
          tenantId: tenant.id,
          status: "AVAILABLE",
          OR: searchTerms.flatMap(term => [
            { make: { contains: term, mode: "insensitive" as const } },
            { model: { contains: term, mode: "insensitive" as const } },
          ]),
        },
        include: {
          photos: { take: 1, orderBy: { isMainPhoto: "desc" } },
        },
        take: 3,
      });

      searchResults.push({
        query,
        found: found.length,
        withPhotos: found.filter(v => v.photos.length > 0).length,
        vehicles: found.map(v => ({
          name: `${v.make} ${v.model}`,
          hasPhoto: v.photos.length > 0,
        })),
      });
    }

    const test4: any = {
      id: 4,
      name: "send_vehicle_images Search",
      status: searchResults.some(r => r.found > 0) ? "PASS" : "WARN",
      message: `Tested ${searchQueries.length} search queries`,
      details: { searchResults },
    };

    results.tests.push(test4);

    // ========== TEST 5: Photo URL Validation ==========
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://primamobil.id";
    const photoUrls = vehiclesWithPhotos.slice(0, 3).map(v => {
      const photo = v.photos[0];
      // Prioritize JPG (originalUrl) for better WhatsApp mobile compatibility
      let url = photo.originalUrl || photo.largeUrl || photo.mediumUrl;
      const isRelative = url?.startsWith("/");

      return {
        vehicleId: v.id,
        originalUrl: url,
        fullUrl: isRelative ? `${baseUrl}${url}` : url,
        isRelative,
        isValid: !!url,
      };
    });

    const test5: any = {
      id: 5,
      name: "Photo URL Validation",
      status: photoUrls.every(p => p.isValid) ? "PASS" : "WARN",
      message: `${photoUrls.length} photo URLs checked`,
      details: {
        baseUrl,
        photoUrls,
      },
    };

    if (photoUrls.some(p => !p.isValid)) {
      test5.status = "WARN";
      test5.message = "Some photos have invalid URLs";
    }

    results.tests.push(test5);

    // ========== TEST 6: upload_vehicle Data Extraction ==========
    const extractionTests = [
      { input: "Brio 2020 120jt hitam matic km 30rb", expectComplete: true },
      { input: "Avanza 2019 silver manual 150jt kilometer 50ribu", expectComplete: true },
      { input: "Jazz RS 2018 merah AT harga 165jt km 45000", expectComplete: true },
      { input: "Xenia 2017 putih 95jt", expectComplete: false }, // missing: transmission, km
      { input: "hitam matic km 30rb", expectComplete: false }, // partial completion
    ];

    const extractionResults: any[] = [];

    for (const test of extractionTests) {
      // Test regex extraction (no AI call needed)
      const regexResult = VehicleDataExtractorService.extractUsingRegex(test.input);
      const partialResult = VehicleDataExtractorService.extractPartialData(test.input);

      extractionResults.push({
        input: test.input,
        expectComplete: test.expectComplete,
        regex: {
          success: regexResult.success,
          data: regexResult.data,
          confidence: regexResult.confidence,
          error: regexResult.error,
        },
        partial: {
          success: partialResult.success,
          data: partialResult.data,
          confidence: partialResult.confidence,
        },
        matchesExpectation: regexResult.success === test.expectComplete ||
          (test.expectComplete === false && partialResult.success),
      });
    }

    const allMatch = extractionResults.every(r => r.matchesExpectation);

    const test6: any = {
      id: 6,
      name: "upload_vehicle Data Extraction",
      status: allMatch ? "PASS" : "WARN",
      message: `${extractionResults.filter(r => r.matchesExpectation).length}/${extractionResults.length} tests matched expectation`,
      details: { extractionResults },
    };

    results.tests.push(test6);

    // ========== TEST 7: Phone Normalization ==========
    const phoneTests = [
      { input: "6281234567890", expected: "6281234567890" },
      { input: "+6281234567890", expected: "6281234567890" },
      { input: "081234567890", expected: "6281234567890" },
      { input: "81234567890", expected: "81234567890" }, // No leading 0, kept as is
    ];

    const phoneResults = phoneTests.map(t => ({
      input: t.input,
      expected: t.expected,
      actual: normalizePhone(t.input),
      match: normalizePhone(t.input) === t.expected,
    }));

    const allPhoneMatch = phoneResults.every(r => r.match);

    const test7: any = {
      id: 7,
      name: "Phone Normalization",
      status: allPhoneMatch ? "PASS" : "FAIL",
      message: `${phoneResults.filter(r => r.match).length}/${phoneResults.length} phone formats normalized correctly`,
      details: { phoneResults },
    };

    results.tests.push(test7);

    // ========== TEST 8: AI Config ==========
    const aiConfig = await prisma.whatsAppAIConfig.findFirst({
      where: { tenantId: tenant.id },
      select: {
        id: true,
        aiName: true,
        customerChatEnabled: true,
        staffCommandsEnabled: true,
        autoReply: true,
      },
    });

    const test8: any = {
      id: 8,
      name: "AI Config",
      status: aiConfig?.customerChatEnabled ? "PASS" : "WARN",
      message: aiConfig
        ? `AI: ${aiConfig.aiName}, Chat: ${aiConfig.customerChatEnabled}, Commands: ${aiConfig.staffCommandsEnabled}`
        : "No AI config - will use defaults",
      details: aiConfig || { message: "Config will be auto-created on first use" },
    };

    results.tests.push(test8);

    // ========== SUMMARY ==========
    results.summary.total = results.tests.length;
    results.summary.passed = results.tests.filter((t: any) => t.status === "PASS").length;
    results.summary.failed = results.tests.filter((t: any) => t.status === "FAIL").length;
    results.summary.warnings = results.tests.filter((t: any) => t.status === "WARN").length;

    const allPassed = results.summary.failed === 0;

    return NextResponse.json({
      success: allPassed,
      message: allPassed
        ? `All ${results.summary.total} tests passed!`
        : `${results.summary.failed} tests failed, ${results.summary.warnings} warnings`,
      results,
      recommendations: generateRecommendations(results.tests),
      processingTime: Date.now() - startTime,
    });

  } catch (error: any) {
    console.error("[Test WhatsApp AI] Error:", error);
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack,
      processingTime: Date.now() - startTime,
    }, { status: 500 });
  }
}

/**
 * Normalize phone number
 */
function normalizePhone(phone: string): string {
  if (!phone) return "";
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0")) {
    digits = "62" + digits.substring(1);
  }
  return digits;
}

/**
 * Generate recommendations based on test results
 */
function generateRecommendations(tests: any[]): string[] {
  const recommendations: string[] = [];

  for (const test of tests) {
    if (test.status === "FAIL") {
      switch (test.id) {
        case 1: // Aimeow
          recommendations.push("Aimeow tidak connected - scan QR di dashboard atau restart Aimeow");
          break;
        case 2: // Staff
          recommendations.push("Tambahkan phone number untuk staff di /dashboard/users agar bisa upload via WhatsApp");
          break;
        case 7: // Phone
          recommendations.push("Phone normalization error - check normalizePhone function");
          break;
      }
    } else if (test.status === "WARN") {
      switch (test.id) {
        case 3: // Vehicles
          recommendations.push("Tidak ada vehicle available - tambahkan via dashboard atau WhatsApp");
          break;
        case 4: // Search
          recommendations.push("Search tidak menemukan hasil - pastikan ada vehicle dengan merk/model yang umum");
          break;
        case 5: // Photos
          recommendations.push("Beberapa vehicle tidak punya foto - upload foto via dashboard");
          break;
        case 8: // AI Config
          recommendations.push("AI config belum ada - akan auto-create dengan default settings");
          break;
      }
    }
  }

  if (recommendations.length === 0) {
    recommendations.push("Semua test passed! WhatsApp AI siap digunakan.");
  }

  return recommendations;
}
