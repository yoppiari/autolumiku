/**
 * POST /api/v1/commands/suggestions
 * Epic 3: Story 3.5 - Get personalized command suggestions
 *
 * Returns personalized command suggestions based on user patterns,
 * time of day, context, and popular commands.
 */

import { NextRequest, NextResponse } from 'next/server';
import { learningEngine } from '@/services/nl-command-service/learning-engine';
import { helpSystem } from '@/services/nl-command-service/help-system';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tenantId, userId, limit = 10, context, partialInput } = body;

    // Validation
    if (!tenantId || !userId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'MISSING_CONTEXT',
            message: 'tenantId and userId are required',
          },
        },
        { status: 400 }
      );
    }

    // If there's a partial input, get autocomplete suggestions
    if (partialInput && partialInput.length >= 2) {
      const autocompleteSuggestions = await helpSystem.getSuggestions(
        partialInput,
        Math.min(limit, 5)
      );

      return NextResponse.json({
        success: true,
        suggestions: autocompleteSuggestions.map(s => ({
          command: s.command,
          category: s.category,
          description: s.description || '',
          isFrequent: false,
        })),
        type: 'autocomplete',
        metadata: {
          query: partialInput,
          resultCount: autocompleteSuggestions.length,
        },
      });
    }

    // Otherwise, get personalized suggestions
    const personalizedSuggestions = await learningEngine.getPersonalizedSuggestions(
      tenantId,
      userId,
      limit,
      context
    );

    // Convert to frontend format
    const suggestions = personalizedSuggestions.map(suggestion => ({
      command: suggestion.command,
      category: this.getCategoryForIntent(suggestion.intent),
      description: suggestion.description,
      isFrequent: suggestion.reason === 'frequent',
      confidence: suggestion.confidence,
      reason: suggestion.reason,
    }));

    return NextResponse.json({
      success: true,
      suggestions,
      type: 'personalized',
      metadata: {
        resultCount: suggestions.length,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Failed to get suggestions:', error);

    // Return fallback suggestions on error
    const fallbackSuggestions = [
      {
        command: 'Tampilkan semua mobil',
        category: 'Vehicle Management',
        description: 'Lihat semua kendaraan di inventory',
        isFrequent: false,
      },
      {
        command: 'Cari mobil Toyota',
        category: 'Vehicle Management',
        description: 'Cari kendaraan berdasarkan merek',
        isFrequent: false,
      },
      {
        command: 'Mobil harga di bawah 200 juta',
        category: 'Vehicle Management',
        description: 'Filter berdasarkan range harga',
        isFrequent: false,
      },
      {
        command: 'Update harga mobil',
        category: 'Pricing',
        description: 'Ubah harga kendaraan',
        isFrequent: false,
      },
      {
        command: 'Tampilkan analytics',
        category: 'Analytics',
        description: 'Lihat statistik performa',
        isFrequent: false,
      },
      {
        command: 'Lihat customer leads',
        category: 'Customer Management',
        description: 'Cek inquiry customer terbaru',
        isFrequent: false,
      },
    ];

    return NextResponse.json({
      success: true,
      suggestions: fallbackSuggestions,
      type: 'fallback',
      metadata: {
        error: 'Failed to load personalized suggestions, using fallback',
        resultCount: fallbackSuggestions.length,
      },
    });
  }
}

// Helper function to map intent to category
function getCategoryForIntent(intent: string): string {
  const categoryMap: Record<string, string> = {
    upload_vehicle: 'Vehicle Management',
    update_vehicle: 'Vehicle Management',
    delete_vehicle: 'Vehicle Management',
    search_vehicle: 'Vehicle Management',
    list_vehicles: 'Vehicle Management',
    view_vehicle: 'Vehicle Management',
    mark_as_sold: 'Vehicle Management',
    mark_as_booked: 'Vehicle Management',
    mark_as_available: 'Vehicle Management',
    update_price: 'Pricing',
    view_analytics: 'Analytics',
    generate_report: 'Analytics',
    export_data: 'Data Management',
    view_customer_leads: 'Customer Management',
    view_sales_history: 'Sales',
    calculate_commission: 'Finance',
    view_inventory_value: 'Analytics',
    view_top_selling: 'Analytics',
    compare_vehicles: 'Vehicle Management',
    get_help: 'Help',
    show_examples: 'Help',
  };

  return categoryMap[intent] || 'General';
}
