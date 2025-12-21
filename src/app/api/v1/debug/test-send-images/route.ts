/**
 * Debug endpoint to test send_vehicle_images flow
 * POST /api/v1/debug/test-send-images
 *
 * Tests:
 * 1. Vehicle search by query
 * 2. Photo URL validation
 * 3. Image sending via Aimeow (optional)
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AimeowClientService } from "@/lib/services/aimeow/aimeow-client.service";

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await request.json();
    const {
      tenantSlug = "primamobil-id",
      searchQuery = "Brio",
      sendToPhone, // Optional: if provided, actually send the images
      dryRun = true, // Default to dry run (don't send)
    } = body;

    const results: any = {
      searchQuery,
      tenantSlug,
      dryRun,
      steps: [],
    };

    // Step 1: Get tenant
    console.log("[Test Send Images] Step 1: Getting tenant...");
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

    results.steps.push({
      step: 1,
      name: "Get Tenant",
      status: "OK",
      data: tenant,
    });

    // Step 2: Search vehicles
    console.log("[Test Send Images] Step 2: Searching vehicles...");
    const searchTerms = searchQuery.toLowerCase().split(/\s+/).filter((term: string) => term.length > 0);

    const vehicles = await prisma.vehicle.findMany({
      where: {
        tenantId: tenant.id,
        status: "AVAILABLE",
        ...(searchTerms.length > 0 && {
          OR: searchTerms.flatMap((term: string) => [
            { make: { contains: term, mode: "insensitive" as const } },
            { model: { contains: term, mode: "insensitive" as const } },
            { variant: { contains: term, mode: "insensitive" as const } },
          ]),
        }),
      },
      include: {
        photos: {
          orderBy: { isMainPhoto: "desc" },
          take: 2,
        },
      },
      take: 3,
    });

    results.steps.push({
      step: 2,
      name: "Search Vehicles",
      status: vehicles.length > 0 ? "OK" : "WARNING",
      message: `Found ${vehicles.length} vehicles matching '${searchQuery}'`,
      data: vehicles.map((v) => ({
        id: v.id,
        make: v.make,
        model: v.model,
        year: v.year,
        price: Number(v.price),
        photosCount: v.photos.length,
      })),
    });

    if (vehicles.length === 0) {
      return NextResponse.json({
        success: false,
        error: `No vehicles found for query '${searchQuery}'`,
        results,
        processingTime: Date.now() - startTime,
      });
    }

    // Step 3: Build image array
    console.log("[Test Send Images] Step 3: Building image array...");
    const images = vehicles
      .filter((v) => v.photos.length > 0)
      .map((v) => {
        const photo = v.photos[0];
        // Prioritize JPG (originalUrl) for better WhatsApp mobile compatibility
        const imageUrl = photo.originalUrl || photo.largeUrl || photo.mediumUrl;
        return {
          vehicleId: v.id,
          vehicleName: `${v.make} ${v.model} ${v.year}`,
          imageUrl,
          caption: `${v.make} ${v.model} ${v.year} - Rp ${formatPrice(Number(v.price))}\n${v.mileage?.toLocaleString("id-ID") || 0}km • ${v.transmissionType || "Manual"} • ${v.color || "-"}`,
          photoId: photo.id,
          photoUrls: {
            original: photo.originalUrl,
            large: photo.largeUrl,
            medium: photo.mediumUrl,
            thumbnail: photo.thumbnailUrl,
          },
        };
      })
      .filter((img) => img.imageUrl);

    results.steps.push({
      step: 3,
      name: "Build Image Array",
      status: images.length > 0 ? "OK" : "ERROR",
      message: `Prepared ${images.length} images from ${vehicles.length} vehicles`,
      data: images,
    });

    if (images.length === 0) {
      return NextResponse.json({
        success: false,
        error: "Vehicles found but no photos available",
        results,
        processingTime: Date.now() - startTime,
      });
    }

    // Step 4: Validate image URLs (check if accessible)
    console.log("[Test Send Images] Step 4: Validating image URLs...");
    const urlValidations = await Promise.all(
      images.map(async (img) => {
        try {
          // Just check if URL is valid format
          const url = new URL(img.imageUrl);
          const isLocalhost = url.hostname === "localhost" || url.hostname === "127.0.0.1";
          const isRelative = img.imageUrl.startsWith("/");

          return {
            vehicleName: img.vehicleName,
            imageUrl: img.imageUrl,
            isValid: true,
            isLocalhost,
            isRelative,
            warning: isLocalhost
              ? "Localhost URL - won't work in production"
              : isRelative
                ? "Relative URL - needs base URL"
                : null,
          };
        } catch (e) {
          // Check if it's a relative URL
          if (img.imageUrl.startsWith("/")) {
            return {
              vehicleName: img.vehicleName,
              imageUrl: img.imageUrl,
              isValid: true,
              isRelative: true,
              warning: "Relative URL - needs base URL prefix",
            };
          }
          return {
            vehicleName: img.vehicleName,
            imageUrl: img.imageUrl,
            isValid: false,
            error: "Invalid URL format",
          };
        }
      })
    );

    const validUrls = urlValidations.filter((v) => v.isValid);
    const invalidUrls = urlValidations.filter((v) => !v.isValid);

    results.steps.push({
      step: 4,
      name: "Validate Image URLs",
      status: invalidUrls.length === 0 ? "OK" : "WARNING",
      message: `${validUrls.length}/${urlValidations.length} URLs valid`,
      data: urlValidations,
    });

    // Step 5: Get Aimeow account (for actual sending)
    console.log("[Test Send Images] Step 5: Getting Aimeow account...");
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

    results.steps.push({
      step: 5,
      name: "Get Aimeow Account",
      status: aimeowAccount?.connectionStatus === "connected" ? "OK" : "WARNING",
      message: aimeowAccount
        ? `Account found: ${aimeowAccount.connectionStatus}`
        : "No Aimeow account configured",
      data: aimeowAccount,
    });

    // Step 6: Send images (if not dry run and phone provided)
    if (!dryRun && sendToPhone && aimeowAccount?.connectionStatus === "connected") {
      console.log("[Test Send Images] Step 6: Sending images...");

      const sendResults = [];
      for (let i = 0; i < images.length; i++) {
        const img = images[i];

        // Build full URL if relative
        let fullImageUrl = img.imageUrl;
        if (img.imageUrl.startsWith("/")) {
          const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://primamobil.id";
          fullImageUrl = `${baseUrl}${img.imageUrl}`;
        }

        console.log(`[Test Send Images] Sending image ${i + 1}: ${fullImageUrl}`);

        const sendResult = await AimeowClientService.sendImage(
          aimeowAccount.clientId,
          sendToPhone,
          fullImageUrl,
          img.caption
        );

        sendResults.push({
          vehicleName: img.vehicleName,
          imageUrl: fullImageUrl,
          ...sendResult,
        });

        // Delay between sends
        if (i < images.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }

      results.steps.push({
        step: 6,
        name: "Send Images",
        status: sendResults.every((r) => r.success) ? "OK" : "ERROR",
        message: `Sent ${sendResults.filter((r) => r.success).length}/${sendResults.length} images`,
        data: sendResults,
      });
    } else {
      results.steps.push({
        step: 6,
        name: "Send Images",
        status: "SKIPPED",
        message: dryRun
          ? "Dry run mode - not sending"
          : !sendToPhone
            ? "No phone number provided"
            : "Aimeow not connected",
      });
    }

    // Summary
    const allOk = results.steps.every(
      (s: any) => s.status === "OK" || s.status === "SKIPPED"
    );

    return NextResponse.json({
      success: allOk,
      message: allOk
        ? "All tests passed!"
        : "Some tests failed or have warnings",
      results,
      summary: {
        vehiclesFound: vehicles.length,
        imagesReady: images.length,
        aimeowConnected: aimeowAccount?.connectionStatus === "connected",
      },
      processingTime: Date.now() - startTime,
    });
  } catch (error: any) {
    console.error("[Test Send Images] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        stack: error.stack,
        processingTime: Date.now() - startTime,
      },
      { status: 500 }
    );
  }
}

function formatPrice(price: number): string {
  return new Intl.NumberFormat("id-ID").format(price);
}

// GET method for easy browser testing
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tenantSlug = searchParams.get("tenant") || "primamobil-id";
  const searchQuery = searchParams.get("query") || "Brio";

  // Create a fake request body
  const fakeRequest = {
    json: async () => ({
      tenantSlug,
      searchQuery,
      dryRun: true,
    }),
  } as NextRequest;

  return POST(fakeRequest);
}
