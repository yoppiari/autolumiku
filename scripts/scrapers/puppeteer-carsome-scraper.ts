/**
 * CARSOME Puppeteer Scraper
 *
 * Scrapes vehicle data from Carsome.id
 * CARSOME has much richer data: mileage, warranty, inspection, features
 * Usage: npx tsx scripts/scrapers/puppeteer-carsome-scraper.ts
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
  transmission?: string;
  fuelType?: string;
  bodyType?: string;
  features?: string;
  description?: string;
  mileage?: number;
  color?: string;
  location?: string;
  url?: string;
  scrapedAt: string;
}

class PuppeteerCarsomeScraper {
  private browser?: Browser;
  private results: ScrapedVehicle[] = [];

  /**
   * Parse price string to IDR cents
   */
  private parsePrice(priceStr: string): number {
    if (!priceStr) return 0;

    // Handle "Rp 220.000.000" format
    const cleaned = priceStr.replace(/[Rp\s.]/g, '');
    const value = parseInt(cleaned, 10);
    return isNaN(value) ? 0 : value * 100;
  }

  /**
   * Extract body type from model name
   */
  private extractBodyType(make: string, model: string): string | undefined {
    const modelLower = model.toLowerCase();

    const suvModels = [
      'fortuner', 'pajero', 'crv', 'cr-v', 'hrv', 'hr-v', 'brv', 'br-v',
      'xpander cross', 'terios', 'rush', 'outlander', 'cx', 'rocky',
      'raize', 'tiguan', 'x-trail', 'rav4', 'tucson', 'sportage',
      'vitara', 'sx4', 'jimny', 'escudo', 'wrangler', 'evoque', 'defender'
    ];

    const mpvModels = [
      'avanza', 'xenia', 'innova', 'ertiga', 'mobilio', 'freed',
      'expander', 'xpander', 'livina', 'grand livina', 'serena',
      'alphard', 'vellfire', 'sienta', 'calya', 'sigra', 'kijang',
      'cortez', 'confero', 'formo', 'luxio', 'apv', 'grand max'
    ];

    const sedanModels = [
      'camry', 'corolla', 'altis', 'vios', 'accord', 'civic', 'city',
      'mazda 3', 'mazda 6', 'teana', 'almera', 'lancer', 'galant',
      'baleno', 'ciaz', 'c-class', 'e-class', 's-class', 'a4', 'a6'
    ];

    const hatchbackModels = [
      'yaris', 'agya', 'ayla', 'brio', 'jazz', 'ignis', 'swift',
      'karimun', 'wagon r', 'celerio', 'march', 'fiesta', 'mirage'
    ];

    for (const pattern of suvModels) {
      if (modelLower.includes(pattern)) return 'SUV';
    }
    for (const pattern of mpvModels) {
      if (modelLower.includes(pattern)) return 'MPV';
    }
    for (const pattern of sedanModels) {
      if (modelLower.includes(pattern)) return 'Sedan';
    }
    for (const pattern of hatchbackModels) {
      if (modelLower.includes(pattern)) return 'Hatchback';
    }

    return undefined;
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
   * Scrape CARSOME listings
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

      console.log('🚗 Navigating to CARSOME...');
      const url = 'https://www.carsome.id/beli-mobil-bekas';

      try {
        await page.goto(url, {
          waitUntil: 'domcontentloaded',
          timeout: 60000
        });
      } catch (error) {
        console.log('⚠️  Initial load timeout, trying alternative wait...');
        await new Promise(resolve => setTimeout(resolve, 5000));
      }

      console.log('✅ Page loaded, waiting for data...\n');

      // Wait for page to be fully rendered
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Debug: Take screenshot and check page content
      await page.screenshot({ path: '/tmp/carsome-debug.png' });
      console.log('📸 Screenshot saved to /tmp/carsome-debug.png for debugging\n');

      // Check what selectors are available
      const pageContent = await page.evaluate(() => {
        return {
          title: document.title,
          bodyText: document.body.innerText.substring(0, 500),
          linkCount: document.querySelectorAll('a').length,
          hasVehicleLinks: document.querySelectorAll('a[href*="/beli-mobil-bekas/"]').length,
        };
      });

      console.log('📋 Page info:', pageContent);

      // Wait longer for content to appear
      try {
        await page.waitForSelector('a[href*="/beli-mobil-bekas/"]', { timeout: 20000 });
        console.log('✅ Found vehicle links\n');
      } catch (error) {
        console.log('⚠️  Could not find vehicle links with expected selector\n');
        console.log('⚠️  CARSOME may be blocking or using different structure\n');
        console.log('⚠️  Continuing with alternative extraction...\n');
      }

      // Scroll to load more items
      if (limit > 12) {
        console.log('📜 Scrolling to load more listings...');
        await page.evaluate(async () => {
          await new Promise<void>((resolve) => {
            let totalHeight = 0;
            const distance = 500;
            const timer = setInterval(() => {
              const scrollHeight = document.body.scrollHeight;
              window.scrollBy(0, distance);
              totalHeight += distance;

              if (totalHeight >= scrollHeight || totalHeight >= 3000) {
                clearInterval(timer);
                resolve();
              }
            }, 200);
          });
        });

        await new Promise(resolve => setTimeout(resolve, 2000));
        console.log('✅ Scrolling complete\n');
      }

      // Extract data from page
      console.log('📦 Extracting vehicle data from CARSOME...\n');

      const vehicles = await page.evaluate((limitNum) => {
        const results: any[] = [];

        // Find all vehicle cards - CARSOME uses various link patterns
        const links = Array.from(document.querySelectorAll('a[href*="/beli-mobil-bekas/"]'));

        // Group by unique URLs to avoid duplicates
        const uniqueUrls = new Set<string>();
        const uniqueLinks: Element[] = [];

        links.forEach(link => {
          const href = link.getAttribute('href');
          if (href && !href.endsWith('/beli-mobil-bekas') && !href.includes('/beli-mobil-bekas?') && !href.includes('#')) {
            if (!uniqueUrls.has(href)) {
              uniqueUrls.add(href);
              uniqueLinks.push(link);
            }
          }
        });

        console.log(`Found ${uniqueLinks.length} unique vehicle links`);

        for (let i = 0; i < Math.min(uniqueLinks.length, limitNum); i++) {
          // Try multiple parent selectors
          let card = uniqueLinks[i].closest('div[class*="card"]');
          if (!card) card = uniqueLinks[i].closest('article');
          if (!card) card = uniqueLinks[i].closest('li');
          if (!card) card = uniqueLinks[i].closest('div');

          const url = uniqueLinks[i].getAttribute('href') || '';
          const fullUrl = url.startsWith('http') ? url : `https://www.carsome.id${url}`;

          // Extract text from card or link itself
          const cardText = card ? card.textContent || '' : uniqueLinks[i].textContent || '';

          // Extract make and model from URL
          // Format: /beli-mobil-bekas/toyota/avanza/2022-toyota-avanza-15-veloz-q/xxxxx
          const urlParts = url.split('/').filter(p => p);
          let makeFromUrl = '';
          let modelFromUrl = '';

          // Find index of "beli-mobil-bekas"
          const baseIdx = urlParts.indexOf('beli-mobil-bekas');
          if (baseIdx >= 0 && urlParts.length > baseIdx + 2) {
            makeFromUrl = urlParts[baseIdx + 1] || '';
            modelFromUrl = urlParts[baseIdx + 2] || '';
          }

          // Find price - look for "Rp" followed by numbers
          const priceMatch = cardText.match(/Rp\s*([\d.,]+)/);
          let priceDisplay = '';
          if (priceMatch) {
            priceDisplay = priceMatch[0].replace(/\s+/g, ' ');
          }

          // Find year - 4 digit number (20xx or 19xx)
          const yearMatch = cardText.match(/\b(20\d{2}|19\d{2})\b/);
          const year = yearMatch ? parseInt(yearMatch[0], 10) : 0;

          // Find mileage - look for "km" pattern (e.g., "74.108 km")
          const mileageMatch = cardText.match(/([\d.,]+)\s*km/i);
          let mileage = 0;
          if (mileageMatch) {
            const mileageStr = mileageMatch[1].replace(/[.,]/g, '');
            mileage = parseInt(mileageStr, 10);
          }

          // Find transmission
          let transmission = undefined;
          const cardLower = cardText.toLowerCase();
          if (cardLower.includes('automatic') || cardLower.includes('matic')) {
            transmission = 'Automatic';
          } else if (cardLower.includes('manual')) {
            transmission = 'Manual';
          }

          // Find location - look for Indonesian cities
          const locationMatch = cardText.match(/(Jakarta\s+\w+|Jakarta|Surabaya|Bandung|Semarang|Medan|Bekasi|Tangerang\s+\w+|Tangerang|Depok|Bogor|Yogyakarta|Bali|Denpasar)/i);
          const location = locationMatch ? locationMatch[0].trim() : '';

          if (makeFromUrl && modelFromUrl && priceDisplay) {
            results.push({
              make: makeFromUrl.charAt(0).toUpperCase() + makeFromUrl.slice(1),
              model: modelFromUrl.charAt(0).toUpperCase() + modelFromUrl.slice(1).replace(/-/g, ' '),
              year,
              priceDisplay,
              mileage: mileage > 0 ? mileage : undefined,
              transmission,
              location: location || undefined,
              url: fullUrl,
            });
          }
        }

        return results;
      }, limit);

      console.log(`✅ Found ${vehicles.length} vehicles from listing page\n`);

      // Visit each detail page for richer data
      let processedCount = 0;
      for (const raw of vehicles) {
        try {
          processedCount++;
          console.log(`[${processedCount}/${vehicles.length}] Visiting: ${raw.make} ${raw.model} ${raw.year}`);

          await page.goto(raw.url, {
            waitUntil: 'networkidle2',
            timeout: 15000
          });

          // Extract detailed data from page
          const detailData = await page.evaluate(() => {
            const data: any = {};

            // Try to get variant from title
            const titleEl = document.querySelector('h1');
            if (titleEl) {
              const title = titleEl.textContent || '';
              data.fullTitle = title;
            }

            // Extract specs from page
            const allText = document.body.textContent || '';

            // Find variant (after model, before other specs)
            // Example: "2021 Toyota Avanza 1.5 Veloz Q"
            data.variant = undefined;

            // Find fuel type
            if (allText.toLowerCase().includes('bensin') || allText.toLowerCase().includes('gasoline')) {
              data.fuelType = 'Bensin';
            } else if (allText.toLowerCase().includes('diesel') || allText.toLowerCase().includes('solar')) {
              data.fuelType = 'Diesel';
            } else if (allText.toLowerCase().includes('hybrid')) {
              data.fuelType = 'Hybrid';
            } else if (allText.toLowerCase().includes('electric') || allText.toLowerCase().includes('listrik')) {
              data.fuelType = 'Electric';
            }

            // Find color
            const colorPatterns = ['hitam', 'putih', 'silver', 'abu', 'merah', 'biru', 'kuning', 'hijau', 'coklat', 'black', 'white', 'gray', 'grey', 'red', 'blue'];
            for (const color of colorPatterns) {
              if (allText.toLowerCase().includes(color)) {
                data.color = color.charAt(0).toUpperCase() + color.slice(1);
                break;
              }
            }

            // Extract description from meta or visible text
            const metaDesc = document.querySelector('meta[name="description"]');
            if (metaDesc) {
              data.description = metaDesc.getAttribute('content');
            }

            // Look for features section
            const featuresList: string[] = [];
            const featureKeywords = [
              'sunroof', 'leather', 'kulit', 'abs', 'airbag', 'camera', 'kamera',
              'sensor', 'keyless', 'push start', 'cruise control', 'led',
              'warranty', 'garansi', 'inspected', 'certified'
            ];

            for (const keyword of featureKeywords) {
              if (allText.toLowerCase().includes(keyword)) {
                const featureName = keyword.charAt(0).toUpperCase() + keyword.slice(1);
                if (!featuresList.includes(featureName)) {
                  featuresList.push(featureName);
                }
              }
            }

            if (featuresList.length > 0) {
              data.features = featuresList.join(', ');
            }

            return data;
          });

          // Create vehicle object
          const vehicle: ScrapedVehicle = {
            source: 'CARSOME',
            make: raw.make,
            model: raw.model,
            year: raw.year,
            price: this.parsePrice(raw.priceDisplay),
            priceDisplay: raw.priceDisplay,
            location: raw.location,
            url: raw.url,
            mileage: raw.mileage,
            transmission: raw.transmission,
            fuelType: detailData.fuelType,
            color: detailData.color,
            bodyType: this.extractBodyType(raw.make, raw.model),
            variant: detailData.variant,
            features: detailData.features,
            description: detailData.description,
            scrapedAt: new Date().toISOString(),
          };

          this.results.push(vehicle);

          // Small delay
          await new Promise(resolve => setTimeout(resolve, 1000));

        } catch (error) {
          console.log(`⚠️  Failed to get details for ${raw.make} ${raw.model}:`, error);
        }
      }

      console.log(`\n✅ Parsed ${this.results.length} vehicles successfully\n`);

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
  async saveResults(filename: string = 'carsome-puppeteer-results.json'): Promise<void> {
    const outputDir = path.join(process.cwd(), 'scripts', 'scrapers', 'output');

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const outputPath = path.join(outputDir, filename);

    const output = {
      source: 'CARSOME',
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
      const withMileage = this.results.filter(v => v.mileage);

      console.log(`Unique makes: ${makes.size}`);
      console.log(`Makes: ${Array.from(makes).join(', ')}`);
      console.log(`With mileage data: ${withMileage.length}`);

      if (validPrices.length > 0) {
        const avgPrice = validPrices.reduce((sum, v) => sum + v.price, 0) / validPrices.length;
        console.log(`Average price: Rp ${(avgPrice / 100000000).toFixed(0)} juta`);

        const prices = validPrices.map(v => v.price).sort((a, b) => a - b);
        console.log(`Price range: Rp ${(prices[0] / 100000000).toFixed(0)} - ${(prices[prices.length - 1] / 100000000).toFixed(0)} juta`);
      }

      // Sample data
      console.log('\n📋 Sample vehicles:');
      this.results.slice(0, 3).forEach((v, i) => {
        console.log(`${i + 1}. ${v.make} ${v.model} ${v.year} - ${v.priceDisplay} ${v.mileage ? `(${v.mileage.toLocaleString()} km)` : ''}`);
      });
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  }
}

// Main execution
async function main() {
  console.log('═══════════════════════════════════════════');
  console.log('   CARSOME PUPPETEER SCRAPER');
  console.log('═══════════════════════════════════════════\n');

  const scraper = new PuppeteerCarsomeScraper();

  try {
    // Scrape 5 vehicles for testing
    await scraper.scrape(5);

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

export { PuppeteerCarsomeScraper };
