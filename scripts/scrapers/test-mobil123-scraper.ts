/**
 * Mobil123 Test Scraper
 *
 * Simple scraper to test extracting vehicle data from Mobil123.com
 * Purpose: Feed accurate data to AI system
 *
 * Usage: npx tsx scripts/scrapers/test-mobil123-scraper.ts
 */

import * as fs from 'fs';
import * as path from 'path';

interface ScrapedVehicle {
  source: string;
  make: string;
  model: string;
  year: number;
  price: number; // IDR cents
  priceDisplay: string;
  variant?: string;
  mileage?: number;
  transmission?: string;
  fuelType?: string;
  color?: string;
  location?: string;
  url?: string;
  scrapedAt: string;
}

class Mobil123Scraper {
  private baseUrl = 'https://www.mobil123.com';
  private results: ScrapedVehicle[] = [];
  private requestDelay = 3000; // 3 seconds between requests

  /**
   * Delay helper for rate limiting
   */
  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Fetch HTML content from URL
   */
  private async fetchPage(url: string): Promise<string> {
    try {
      console.log(`Fetching: ${url}`);

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.text();
    } catch (error) {
      console.error(`Error fetching ${url}:`, error);
      throw error;
    }
  }

  /**
   * Parse price string to IDR cents
   * e.g., "Rp 150.000.000" -> 15000000000
   */
  private parsePrice(priceStr: string): number {
    const cleaned = priceStr.replace(/[Rp\s.]/g, '');
    const value = parseInt(cleaned, 10);
    return isNaN(value) ? 0 : value * 100; // Convert to cents
  }

  /**
   * Parse mileage string to number
   * e.g., "20.000 km" -> 20000
   */
  private parseMileage(mileageStr: string): number | undefined {
    const cleaned = mileageStr.replace(/[.,\s]/g, '').replace(/km/i, '');
    const value = parseInt(cleaned, 10);
    return isNaN(value) ? undefined : value;
  }

  /**
   * Extract vehicle data from listing page HTML
   *
   * NOTE: This is a BASIC parser - actual implementation will depend on
   * Mobil123's HTML structure. This needs to be adjusted after inspecting
   * the actual page structure.
   */
  private parseListingPage(html: string): ScrapedVehicle[] {
    const vehicles: ScrapedVehicle[] = [];

    // PLACEHOLDER: Basic regex-based extraction
    // In production, use cheerio or jsdom for proper HTML parsing

    console.log('⚠️  This is a BASIC parser - needs adjustment based on actual HTML structure');
    console.log('📋 Sample HTML length:', html.length, 'characters');

    // Example patterns (adjust based on actual HTML):
    // - Look for listing cards/items
    // - Extract: title (make/model/year), price, specs, location

    // For now, just log that we got the page
    console.log('✅ Successfully fetched page HTML');
    console.log('🔍 Next step: Inspect HTML structure and implement proper parsing');

    return vehicles;
  }

  /**
   * Scrape used cars from Mobil123
   */
  async scrapeUsedCars(limit: number = 20): Promise<ScrapedVehicle[]> {
    try {
      console.log('🚗 Starting Mobil123 scraper...');
      console.log(`📊 Target: ${limit} vehicles\n`);

      // Start with used cars listing page
      const listingUrl = `${this.baseUrl}/mobil-dijual/indonesia`;

      const html = await this.fetchPage(listingUrl);

      // Parse the page
      const vehicles = this.parseListingPage(html);

      console.log(`\n✅ Scraping complete`);
      console.log(`📦 Found ${vehicles.length} vehicles`);

      this.results = vehicles;
      return vehicles;

    } catch (error) {
      console.error('❌ Scraping failed:', error);
      throw error;
    }
  }

  /**
   * Save results to JSON file
   */
  async saveResults(filename: string = 'mobil123-results.json'): Promise<void> {
    const outputDir = path.join(process.cwd(), 'scripts', 'scrapers', 'output');

    // Create output directory if not exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const outputPath = path.join(outputDir, filename);

    const output = {
      source: 'Mobil123',
      scrapedAt: new Date().toISOString(),
      totalVehicles: this.results.length,
      vehicles: this.results,
    };

    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf-8');

    console.log(`\n💾 Results saved to: ${outputPath}`);
  }

  /**
   * Print summary statistics
   */
  printSummary(): void {
    console.log('\n📊 SCRAPING SUMMARY');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Total vehicles: ${this.results.length}`);

    if (this.results.length > 0) {
      const makes = new Set(this.results.map(v => v.make));
      const avgPrice = this.results.reduce((sum, v) => sum + v.price, 0) / this.results.length;

      console.log(`Unique makes: ${makes.size}`);
      console.log(`Makes: ${Array.from(makes).join(', ')}`);
      console.log(`Average price: Rp ${(avgPrice / 100000000).toFixed(0)} juta`);

      // Price range
      const prices = this.results.map(v => v.price).sort((a, b) => a - b);
      console.log(`Price range: Rp ${(prices[0] / 100000000).toFixed(0)} - ${(prices[prices.length - 1] / 100000000).toFixed(0)} juta`);
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  }
}

// Run scraper
async function main() {
  console.log('═══════════════════════════════════════════');
  console.log('   MOBIL123 TEST SCRAPER');
  console.log('═══════════════════════════════════════════\n');

  const scraper = new Mobil123Scraper();

  try {
    // Scrape 20 vehicles as test
    await scraper.scrapeUsedCars(20);

    // Print summary
    scraper.printSummary();

    // Save results
    await scraper.saveResults();

    console.log('✅ Test scraping completed successfully!\n');

  } catch (error) {
    console.error('\n❌ Test scraping failed:', error);
    process.exit(1);
  }
}

// Execute if run directly
if (require.main === module) {
  main();
}

export { Mobil123Scraper };
export type { ScrapedVehicle };
