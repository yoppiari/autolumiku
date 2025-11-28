/**
 * OLX Indonesia Test Scraper
 *
 * Simple scraper to test extracting vehicle data from OLX.co.id
 * Purpose: Feed accurate data to AI system
 *
 * Usage: npx tsx scripts/scrapers/test-olx-scraper.ts
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

class OLXScraper {
  private baseUrl = 'https://www.olx.co.id';
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
   * Try to fetch OLX API endpoint (if available)
   * OLX sometimes uses JSON API for listings
   */
  private async fetchAPI(url: string): Promise<any> {
    try {
      console.log(`Fetching API: ${url}`);

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json',
          'Accept-Language': 'id-ID,id;q=0.9',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`Error fetching API ${url}:`, error);
      throw error;
    }
  }

  /**
   * Parse price string to IDR cents
   * e.g., "Rp 150.000.000" or "Rp 150 Juta" -> 15000000000
   */
  private parsePrice(priceStr: string): number {
    // Handle "Juta" format
    if (priceStr.toLowerCase().includes('juta')) {
      const millions = parseFloat(priceStr.replace(/[^0-9.]/g, ''));
      return isNaN(millions) ? 0 : millions * 100000000; // Convert to cents
    }

    // Handle full number format
    const cleaned = priceStr.replace(/[Rp\s.]/g, '');
    const value = parseInt(cleaned, 10);
    return isNaN(value) ? 0 : value * 100; // Convert to cents
  }

  /**
   * Parse mileage string to number
   * e.g., "20.000 km" or "20rb km" -> 20000
   */
  private parseMileage(mileageStr: string): number | undefined {
    // Handle "rb" (ribu/thousand) format
    if (mileageStr.toLowerCase().includes('rb')) {
      const thousands = parseFloat(mileageStr.replace(/[^0-9.]/g, ''));
      return isNaN(thousands) ? undefined : thousands * 1000;
    }

    const cleaned = mileageStr.replace(/[.,\s]/g, '').replace(/km/i, '');
    const value = parseInt(cleaned, 10);
    return isNaN(value) ? undefined : value;
  }

  /**
   * Extract year from title
   * e.g., "Toyota Avanza 2020 G MT" -> 2020
   */
  private extractYear(title: string): number {
    const yearMatch = title.match(/\b(19|20)\d{2}\b/);
    return yearMatch ? parseInt(yearMatch[0], 10) : 0;
  }

  /**
   * Extract make and model from title
   * e.g., "Toyota Avanza 2020 G MT" -> {make: "Toyota", model: "Avanza"}
   */
  private extractMakeModel(title: string): { make: string; model: string } {
    // Common Indonesian car makes
    const makes = [
      'Toyota', 'Honda', 'Daihatsu', 'Mitsubishi', 'Suzuki',
      'Nissan', 'Mazda', 'Isuzu', 'Wuling', 'Hyundai',
      'Kia', 'BMW', 'Mercedes', 'Audi', 'Volkswagen',
      'Ford', 'Chevrolet', 'Peugeot', 'Renault', 'MG'
    ];

    const titleLower = title.toLowerCase();

    for (const make of makes) {
      if (titleLower.includes(make.toLowerCase())) {
        // Extract model - usually the word after make, before year
        const makeIndex = titleLower.indexOf(make.toLowerCase());
        const afterMake = title.substring(makeIndex + make.length).trim();
        const words = afterMake.split(/\s+/);

        // Get first 1-2 words as model (e.g., "Avanza" or "CR-V")
        let model = words[0] || '';
        if (words[1] && words[1].length <= 3 && !this.extractYear(words[1])) {
          model += ' ' + words[1]; // e.g., "CR-V", "X 70"
        }

        return { make, model: model.trim() };
      }
    }

    return { make: 'Unknown', model: 'Unknown' };
  }

  /**
   * Parse listing page HTML
   *
   * NOTE: This is a BASIC parser - actual implementation depends on
   * OLX's HTML/API structure. Needs adjustment after inspection.
   */
  private parseListingPage(html: string): ScrapedVehicle[] {
    const vehicles: ScrapedVehicle[] = [];

    console.log('⚠️  This is a BASIC parser - needs adjustment based on actual HTML/API structure');
    console.log('📋 Sample HTML length:', html.length, 'characters');

    // OLX often uses JSON embedded in HTML or separate API
    // Look for patterns like: window.__PRELOADED_STATE__ or similar

    // Check for JSON data in HTML
    const jsonMatch = html.match(/__PRELOADED_STATE__\s*=\s*(\{[\s\S]+?\});/);
    if (jsonMatch) {
      console.log('✅ Found JSON data in HTML');
      try {
        const data = JSON.parse(jsonMatch[1]);
        console.log('📦 Parsed JSON structure:', Object.keys(data));
        // Process data.listings or similar
      } catch (e) {
        console.log('⚠️  Failed to parse JSON:', e);
      }
    }

    console.log('✅ Successfully fetched page HTML');
    console.log('🔍 Next step: Inspect HTML/API structure and implement proper parsing');

    return vehicles;
  }

  /**
   * Parse OLX API response
   */
  private parseAPIResponse(data: any): ScrapedVehicle[] {
    const vehicles: ScrapedVehicle[] = [];

    console.log('📦 API Response structure:', Object.keys(data));

    // Common OLX API structure (adjust based on actual response):
    // data.data.results or data.listing or similar

    if (data.data && Array.isArray(data.data)) {
      console.log(`Found ${data.data.length} listings in API response`);

      for (const item of data.data) {
        const title = item.title || item.subject || '';
        const { make, model } = this.extractMakeModel(title);
        const year = this.extractYear(title);

        const vehicle: ScrapedVehicle = {
          source: 'OLX',
          make,
          model,
          year,
          price: this.parsePrice(item.price || '0'),
          priceDisplay: item.price || 'N/A',
          location: item.location?.name || item.region?.name,
          url: item.url || item.link,
          scrapedAt: new Date().toISOString(),
        };

        // Extract specs if available
        if (item.parameters) {
          for (const param of item.parameters) {
            if (param.key === 'mileage') {
              vehicle.mileage = this.parseMileage(param.value);
            } else if (param.key === 'transmission') {
              vehicle.transmission = param.value;
            } else if (param.key === 'fuel_type') {
              vehicle.fuelType = param.value;
            } else if (param.key === 'color') {
              vehicle.color = param.value;
            }
          }
        }

        vehicles.push(vehicle);
      }
    }

    return vehicles;
  }

  /**
   * Scrape used cars from OLX
   */
  async scrapeUsedCars(limit: number = 20): Promise<ScrapedVehicle[]> {
    try {
      console.log('🚗 Starting OLX scraper...');
      console.log(`📊 Target: ${limit} vehicles\n`);

      // Start with used cars listing page (mobil bekas)
      const listingUrl = `${this.baseUrl}/mobil-bekas_c198`;

      // Try HTML first
      const html = await this.fetchPage(listingUrl);
      let vehicles = this.parseListingPage(html);

      // If no results from HTML, try API endpoint
      if (vehicles.length === 0) {
        console.log('\n🔄 Trying API endpoint...');
        try {
          const apiUrl = `${this.baseUrl}/api/relevance/v4/search?category=198&location=1000001&page=1`;
          const apiData = await this.fetchAPI(apiUrl);
          vehicles = this.parseAPIResponse(apiData);
        } catch (apiError) {
          console.log('⚠️  API fetch failed, will need manual inspection');
        }
      }

      console.log(`\n✅ Scraping complete`);
      console.log(`📦 Found ${vehicles.length} vehicles`);

      this.results = vehicles.slice(0, limit);
      return this.results;

    } catch (error) {
      console.error('❌ Scraping failed:', error);
      throw error;
    }
  }

  /**
   * Save results to JSON file
   */
  async saveResults(filename: string = 'olx-results.json'): Promise<void> {
    const outputDir = path.join(process.cwd(), 'scripts', 'scrapers', 'output');

    // Create output directory if not exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const outputPath = path.join(outputDir, filename);

    const output = {
      source: 'OLX',
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

      // Location distribution
      const locations = this.results.filter(v => v.location).map(v => v.location);
      const locationCount = new Set(locations).size;
      console.log(`Locations: ${locationCount} unique locations`);
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  }
}

// Run scraper
async function main() {
  console.log('═══════════════════════════════════════════');
  console.log('   OLX INDONESIA TEST SCRAPER');
  console.log('═══════════════════════════════════════════\n');

  const scraper = new OLXScraper();

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

export { OLXScraper };
export type { ScrapedVehicle };
