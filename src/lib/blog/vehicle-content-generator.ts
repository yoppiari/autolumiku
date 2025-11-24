/**
 * Vehicle Content Generator
 *
 * Generate blog content using Popular Vehicle Database + AI
 * Supports: reviews, comparisons, buying guides, SEO content
 */

import { popularVehicleService } from '../services/popular-vehicle-service';
import { createZAIClient } from '../ai/zai-client';
import { PopularVehicle } from '@prisma/client';

const aiClient = createZAIClient();

export interface BlogPostResult {
  title: string;
  slug: string;
  metaDescription: string;
  content: string; // Markdown format
  seoKeywords: string[];
  publishedAt?: Date;
}

/**
 * Generate vehicle review blog post
 */
export async function generateVehicleReview(
  make: string,
  model: string
): Promise<BlogPostResult> {
  // Get vehicle data from database
  const vehicle = await popularVehicleService.findVehicle(make, model);
  if (!vehicle) {
    throw new Error(`Vehicle not found: ${make} ${model}`);
  }

  // Get competitors for comparison section
  const competitors = await popularVehicleService.getSimilarVehicles(make, model, 3);

  const prompt = `Write a comprehensive vehicle review article in Indonesian language.

Vehicle: ${vehicle.make} ${vehicle.model}
Category: ${vehicle.category}
Variants: ${JSON.stringify(vehicle.variants)}
Price Range: Rp ${formatPrice(vehicle.usedCarPrices)}
Specs: ${JSON.stringify({
    engine: vehicle.engineOptions,
    transmission: vehicle.transmissionTypes,
    seating: vehicle.seatingCapacity,
  })}
Pros: ${JSON.stringify(vehicle.prosAndCons)}
Competitors: ${competitors.map(c => `${c.make} ${c.model}`).join(', ')}

Write 1000-1200 words covering:
1. Introduction & Overview (100 words)
2. Design & Exterior (150 words)
3. Interior & Comfort (150 words)
4. Engine Performance & Fuel Efficiency (200 words)
5. Features & Technology (150 words)
6. Safety Features (100 words)
7. Pros & Cons (100 words)
8. Comparison with Competitors (150 words)
9. Value for Money & Conclusion (100 words)

Format as Markdown with proper headings (##).
Tone: Informative, objective, helpful for Indonesian car buyers.
Include specific price points and real-world observations.`;

  const response = await aiClient.generateText({
    systemPrompt: 'You are an automotive journalist writing for Indonesian car buyers.',
    userPrompt: prompt,
    temperature: 0.7,
    maxTokens: 3000,
  });

  const title = `Review ${vehicle.make} ${vehicle.model} ${new Date().getFullYear()}: Spesifikasi, Harga, dan Kelebihan`;
  const slug = `review-${vehicle.make.toLowerCase()}-${vehicle.model.toLowerCase().replace(/\s+/g, '-')}`;

  return {
    title,
    slug,
    metaDescription: vehicle.metaDescription || `Review lengkap ${vehicle.make} ${vehicle.model}. Spesifikasi, harga, kelebihan & kekurangan. Panduan lengkap sebelum membeli.`,
    content: response.content,
    seoKeywords: vehicle.seoKeywords || [],
    publishedAt: new Date(),
  };
}

/**
 * Generate comparison article
 */
export async function generateComparison(
  vehicleIds: string[]
): Promise<BlogPostResult> {
  if (vehicleIds.length < 2 || vehicleIds.length > 4) {
    throw new Error('Comparison requires 2-4 vehicles');
  }

  const vehicles = await popularVehicleService.getForComparison(vehicleIds);
  if (vehicles.length !== vehicleIds.length) {
    throw new Error('Some vehicles not found');
  }

  const vehicleNames = vehicles.map(v => `${v.make} ${v.model}`).join(' vs ');

  const prompt = `Write a detailed comparison article in Indonesian.

Vehicles to compare:
${vehicles.map((v, i) => `
${i + 1}. ${v.make} ${v.model}
   - Category: ${v.category}
   - Price: ${formatPrice(v.usedCarPrices)}
   - Engine: ${v.engineOptions.join(', ')}
   - Transmission: ${v.transmissionTypes.join(', ')}
   - Seating: ${v.seatingCapacity.join(', ')}
   - Pros: ${JSON.stringify(v.prosAndCons)}
`).join('\n')}

Write 1200-1500 words covering:
1. Introduction (100 words)
2. Price Comparison (200 words)
3. Design & Dimensions (200 words)
4. Interior & Space (200 words)
5. Engine & Performance (250 words)
6. Features & Technology (200 words)
7. Fuel Efficiency (150 words)
8. Maintenance & Ownership Cost (150 words)
9. Verdict & Recommendations (200 words)

Create comparison tables where appropriate.
Format as Markdown with proper headings (##).
Tone: Objective, data-driven, helpful for decision making.
End with clear recommendation for different buyer types.`;

  const response = await aiClient.generateText({
    systemPrompt: 'You are an automotive expert helping buyers make informed decisions.',
    userPrompt: prompt,
    temperature: 0.6,
    maxTokens: 4000,
  });

  const title = `Perbandingan ${vehicleNames}: Mana Pilihan Terbaik?`;
  const slug = `perbandingan-${vehicles.map(v => v.model.toLowerCase().replace(/\s+/g, '-')).join('-vs-')}`;

  return {
    title,
    slug,
    metaDescription: `Perbandingan lengkap ${vehicleNames}. Analisis harga, spesifikasi, fitur, dan rekomendasi terbaik untuk Anda.`,
    content: response.content,
    seoKeywords: vehicles.flatMap(v => v.seoKeywords || []),
    publishedAt: new Date(),
  };
}

/**
 * Generate buying guide
 */
export async function generateBuyingGuide(
  make: string,
  model: string
): Promise<BlogPostResult> {
  const vehicle = await popularVehicleService.findVehicle(make, model);
  if (!vehicle) {
    throw new Error(`Vehicle not found: ${make} ${model}`);
  }

  const prompt = `Write a comprehensive buying guide in Indonesian for used car buyers.

Vehicle: ${vehicle.make} ${vehicle.model}
Price Range (Used): ${formatPrice(vehicle.usedCarPrices)}
Common Issues: ${JSON.stringify(vehicle.commonIssues)}
Maintenance Cost: ${JSON.stringify(vehicle.maintenanceCost)}
Production Years: ${JSON.stringify(vehicle.productionYears)}
Variants: ${JSON.stringify(vehicle.variants)}

Write 1000 words covering:
1. Introduction (100 words)
2. Which Year/Variant to Buy (200 words)
3. Fair Price Guide by Year (150 words)
4. What to Check During Inspection (250 words)
5. Common Issues to Look For (200 words)
6. Maintenance & Running Costs (150 words)
7. Negotiation Tips (100 words)
8. Conclusion & Final Checklist (100 words)

Format as Markdown with checklists where appropriate.
Be specific with price ranges and year recommendations.
Include red flags and green flags for inspection.`;

  const response = await aiClient.generateText({
    systemPrompt: 'You are a used car buying consultant helping buyers avoid mistakes.',
    userPrompt: prompt,
    temperature: 0.7,
    maxTokens: 3000,
  });

  const title = `Panduan Lengkap Beli ${vehicle.make} ${vehicle.model} Bekas: Hal yang Harus Dicek`;
  const slug = `panduan-beli-${vehicle.make.toLowerCase()}-${vehicle.model.toLowerCase().replace(/\s+/g, '-')}-bekas`;

  return {
    title,
    slug,
    metaDescription: `Panduan beli ${vehicle.make} ${vehicle.model} bekas. Harga wajar, cara cek kondisi, isu umum, dan tips negosiasi. Wajib baca!`,
    content: response.content,
    seoKeywords: [
      ...vehicle.seoKeywords || [],
      `beli ${vehicle.model} bekas`,
      `tips beli ${vehicle.model}`,
      `${vehicle.model} second`,
    ],
    publishedAt: new Date(),
  };
}

/**
 * Generate SEO landing page content
 */
export async function generateSEOLandingPage(
  make: string,
  model: string
): Promise<BlogPostResult> {
  const vehicle = await popularVehicleService.findVehicle(make, model);
  if (!vehicle) {
    throw new Error(`Vehicle not found: ${make} ${model}`);
  }

  const prompt = `Create SEO-optimized landing page content in Indonesian.

Vehicle: ${vehicle.make} ${vehicle.model}
Target Keywords: ${vehicle.seoKeywords?.join(', ')}

Write 800-1000 words with:
1. Hero Section (50 words) - Compelling intro
2. Why Choose This Vehicle (150 words)
3. Available Variants & Prices (200 words)
4. Key Features & Specifications (200 words)
5. Customer Testimonials Section (100 words)
6. FAQ (5 questions, 200 words)
7. Call-to-Action (50 words)

Format: Markdown with proper structure.
Include schema-friendly FAQ format.
Natural keyword usage, no keyword stuffing.
Persuasive but honest tone.`;

  const response = await aiClient.generateText({
    systemPrompt: 'You are an SEO content writer specializing in automotive.',
    userPrompt: prompt,
    temperature: 0.6,
    maxTokens: 2500,
  });

  const title = `Jual Beli ${vehicle.make} ${vehicle.model} Bekas Terbaik | Harga & Spesifikasi Lengkap`;
  const slug = `${vehicle.make.toLowerCase()}-${vehicle.model.toLowerCase().replace(/\s+/g, '-')}`;

  return {
    title,
    slug,
    metaDescription: vehicle.metaDescription || `${vehicle.make} ${vehicle.model} bekas berkualitas. Cek harga, spesifikasi lengkap, dan penawaran terbaik. Garansi & after-sales support.`,
    content: response.content,
    seoKeywords: vehicle.seoKeywords || [],
    publishedAt: new Date(),
  };
}

// Helper function
function formatPrice(priceData: any): string {
  if (typeof priceData === 'object') {
    const years = Object.keys(priceData);
    if (years.length > 0) {
      const latestYear = years.sort().reverse()[0];
      const range = priceData[latestYear];
      return `${(range.min / 1000000).toFixed(0)}-${(range.max / 1000000).toFixed(0)} juta`;
    }
  }
  return 'Price data not available';
}
