import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { displayId } = body;

    if (!displayId) {
      return NextResponse.json({
        success: false,
        error: 'displayId is required',
      }, { status: 400 });
    }

    // Get vehicle
    const vehicle = await prisma.vehicle.findUnique({
      where: { displayId: displayId.toUpperCase() },
      select: {
        id: true,
        displayId: true,
        price: true,
      },
    });

    if (!vehicle) {
      return NextResponse.json({
        success: false,
        error: `Vehicle ${displayId} not found`,
      }, { status: 404 });
    }

    const currentPrice = Number(vehicle.price);

    // Calculate correct price (divide by 100 if looks like it was multiplied)
    let correctPrice;
    if (currentPrice > 1000000000) {
      // Price > 1 billion is likely wrong (unless it's a supercar)
      correctPrice = Math.round(currentPrice / 100);
    } else {
      correctPrice = currentPrice;
    }

    // Always update to ensure correction
    await prisma.vehicle.update({
      where: { id: vehicle.id },
      data: { price: correctPrice },
    });

    const priceChanged = currentPrice !== correctPrice;

    return NextResponse.json({
      success: true,
      message: priceChanged ? 'Price fixed successfully' : 'Price was already correct',
      data: {
        displayId: vehicle.displayId,
        oldPrice: currentPrice,
        newPrice: correctPrice,
        oldFormatted: new Intl.NumberFormat('id-ID', {
          style: 'currency',
          currency: 'IDR',
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }).format(currentPrice),
        newFormatted: new Intl.NumberFormat('id-ID', {
          style: 'currency',
          currency: 'IDR',
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }).format(correctPrice),
        priceChanged,
      },
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack,
    }, { status: 500 });
  }
}

// GET to check current price
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const displayId = searchParams.get('displayId');

  if (!displayId) {
    return NextResponse.json({
      success: false,
      error: 'displayId query parameter is required',
    }, { status: 400 });
  }

  try {
    const vehicle = await prisma.vehicle.findUnique({
      where: { displayId: displayId.toUpperCase() },
      select: {
        id: true,
        displayId: true,
        make: true,
        model: true,
        year: true,
        price: true,
      },
    });

    if (!vehicle) {
      return NextResponse.json({
        success: false,
        error: `Vehicle ${displayId} not found`,
      }, { status: 404 });
    }

    const price = Number(vehicle.price);
    const formattedPrice = `Rp ${price.toLocaleString('id-ID')}`;
    const inMillions = price / 1000000;
    const inJuta = Math.round(price / 1000000);

    return NextResponse.json({
      success: true,
      vehicle: {
        ...vehicle,
        price: Number(vehicle.price),
        formattedPrice,
        inMillions,
        inJuta,
      },
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}
