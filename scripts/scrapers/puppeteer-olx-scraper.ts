/**
 * OLX Puppeteer Scraper (LITE VERSION)
 *
 * Fast scraper using Puppeteer to bypass anti-bot protection
 * Usage: npx tsx scripts/scrapers/puppeteer-olx-scraper.ts
 */

import puppeteer, { Browser, Page } from 'puppeteer';
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

class PuppeteerOLXScraper {
  private browser?: Browser;
  private results: ScrapedVehicle[] = [];

  /**
   * Parse price string to IDR cents
   */
  private parsePrice(priceStr: string): number {
    if (!priceStr) return 0;

    // Handle "Juta" format
    if (priceStr.toLowerCase().includes('juta')) {
      const millions = parseFloat(priceStr.replace(/[^0-9.]/g, ''));
      return isNaN(millions) ? 0 : millions * 100000000;
    }

    // Handle full number format
    const cleaned = priceStr.replace(/[Rp\s.]/g, '');
    const value = parseInt(cleaned, 10);
    return isNaN(value) ? 0 : value * 100;
  }

  /**
   * Extract make and model from title
   */
  private extractMakeModel(title: string): { make: string; model: string } {
    const makes = [
      'Toyota', 'Honda', 'Daihatsu', 'Mitsubishi', 'Suzuki',
      'Nissan', 'Mazda', 'Isuzu', 'Wuling', 'Hyundai',
      'Kia', 'BMW', 'Mercedes', 'Audi', 'Volkswagen'
    ];

    const titleLower = title.toLowerCase();
    for (const make of makes) {
      if (titleLower.includes(make.toLowerCase())) {
        const afterMake = title.substring(titleLower.indexOf(make.toLowerCase()) + make.length).trim();
        const words = afterMake.split(/\s+/);
        let model = words[0] || '';
        if (words[1] && words[1].length <= 3) {
          model += ' ' + words[1];
        }
        return { make, model: model.trim() };
      }
    }
    return { make: 'Unknown', model: 'Unknown' };
  }

  /**
   * Extract year from title
   */
  private extractYear(title: string): number {
    const yearMatch = title.match(/\b(19|20)\d{2}\b/);
    return yearMatch ? parseInt(yearMatch[0], 10) : 0;
  }

  /**
   * Initialize browser
   */
  private async initBrowser(): Promise<void> {
    console.log('🚀 Launching browser...');
    this.browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-http2',
        '--disable-blink-features=AutomationControlled'
      ]
    });
    console.log('✅ Browser launched\n');
  }

  /**
   * Scrape OLX listings
   */
  async scrape(limit: number = 20): Promise<ScrapedVehicle[]> {
    try {
      await this.initBrowser();

      const page = await this.browser!.newPage();

      // Stealth tactics
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      await page.setViewport({ width: 1280, height: 800 });

      // Remove webdriver flag
      await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => false });
      });

      console.log('🚗 Navigating to OLX mobil bekas...');
      const url = 'https://www.olx.co.id/mobil-bekas_c198';

      await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      console.log('✅ Page loaded, waiting for listings...\n');

      // Wait for listings to load
      await page.waitForSelector('[data-aut-id="itemBox"]', { timeout: 10000 });

      // Extract listings data
      console.log('📦 Extracting vehicle data...\n');

      const vehicles = await page.evaluate((limitNum) => {
        const listings = document.querySelectorAll('[data-aut-id="itemBox"]');
        const results: any[] = [];

        for (let i = 0; i < Math.min(listings.length, limitNum); i++) {
          const listing = listings[i];

          // Extract title (contains make, model, year)
          const titleEl = listing.querySelector('[data-aut-id="itemTitle"]');
          const title = titleEl?.textContent?.trim() || '';

          // Extract price
          const priceEl = listing.querySelector('[data-aut-id="itemPrice"]');
          const priceDisplay = priceEl?.textContent?.trim() || '';

          // Extract location - try multiple selectors
          let location = '';
          const locationEl1 = listing.querySelector('[data-aut-id="item-location"]');
          const locationEl2 = listing.querySelector('span[data-aut-id="item-location"]');
          const locationEl3 = listing.querySelector('.rui-3Xdvs');
          location = locationEl1?.textContent?.trim() || locationEl2?.textContent?.trim() || locationEl3?.textContent?.trim() || '';

          // Extract URL
          const linkEl = listing.querySelector('a[href]');
          const url = linkEl?.getAttribute('href') || '';

          if (title && priceDisplay) {
            results.push({
              title,
              priceDisplay,
              location,
              url: url.startsWith('http') ? url : `https://www.olx.co.id${url}`
            });
          }
        }

        return results;
      }, limit);

      console.log(`✅ Found ${vehicles.length} raw listings\n`);

      // Process and parse the data
      for (const raw of vehicles) {
        const { make, model } = this.extractMakeModel(raw.title);
        const year = this.extractYear(raw.title);

        const vehicle: ScrapedVehicle = {
          source: 'OLX (Puppeteer)',
          make,
          model,
          year,
          price: this.parsePrice(raw.priceDisplay),
          priceDisplay: raw.priceDisplay,
          location: raw.location,
          url: raw.url,
          scrapedAt: new Date().toISOString(),
        };

        this.results.push(vehicle);
      }

      console.log(`✅ Parsed ${this.results.length} vehicles successfully\n`);

      await this.browser!.close();

      return this.results;

    } catch (error) {
      console.error('❌ Scraping failed:', error);
      if (this.browser) {
        await this.browser.close();
      }
      throw error;
    }
  }

  /**
   * Save results to JSON
   */
  async saveResults(filename: string = 'olx-puppeteer-results.json'): Promise<void> {
    const outputDir = path.join(process.cwd(), 'scripts', 'scrapers', 'output');

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const outputPath = path.join(outputDir, filename);

    const output = {
      source: 'OLX (Puppeteer)',
      scrapedAt: new Date().toISOString(),
      totalVehicles: this.results.length,
      vehicles: this.results,
    };

    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf-8');
    console.log(`💾 Results saved to: ${outputPath}\n`);
  }

  /**
   * Print summary
   */
  printSummary(): void {
    console.log('📊 SCRAPING SUMMARY');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Total vehicles: ${this.results.length}`);

    if (this.results.length > 0) {
      const makes = new Set(this.results.map(v => v.make));
      const validPrices = this.results.filter(v => v.price > 0);

      console.log(`Unique makes: ${makes.size}`);
      console.log(`Makes: ${Array.from(makes).join(', ')}`);

      if (validPrices.length > 0) {
        const avgPrice = validPrices.reduce((sum, v) => sum + v.price, 0) / validPrices.length;
        console.log(`Average price: Rp ${(avgPrice / 100000000).toFixed(0)} juta`);

        const prices = validPrices.map(v => v.price).sort((a, b) => a - b);
        console.log(`Price range: Rp ${(prices[0] / 100000000).toFixed(0)} - ${(prices[prices.length - 1] / 100000000).toFixed(0)} juta`);
      }

      // Sample data
      console.log('\n📋 Sample vehicles:');
      this.results.slice(0, 3).forEach((v, i) => {
        console.log(`${i + 1}. ${v.make} ${v.model} ${v.year} - ${v.priceDisplay} (${v.location})`);
      });
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  }
}

// Main execution
async function main() {
  console.log('═══════════════════════════════════════════');
  console.log('   OLX PUPPETEER SCRAPER (LITE)');
  console.log('═══════════════════════════════════════════\n');

  const scraper = new PuppeteerOLXScraper();

  try {
    // Scrape 20 vehicles
    await scraper.scrape(20);

    // Print summary
    scraper.printSummary();

    // Save results
    await scraper.saveResults();

    console.log('✅ Scraping completed successfully!\n');

  } catch (error) {
    console.error('\n❌ Scraping failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { PuppeteerOLXScraper };
