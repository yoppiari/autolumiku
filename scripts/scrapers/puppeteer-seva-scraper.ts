/**
 * SEVA Puppeteer Scraper
 * 
 * Scrapes new vehicle data from seva.id
 * Usage: npx tsx scripts/scrapers/puppeteer-seva-scraper.ts
 */

import puppeteer, { Browser, Page } from 'puppeteer';

export interface ScrapedVehicle {
    source: string;
    make: string;
    model: string;
    year: number;
    price: number;
    priceDisplay: string;
    variant?: string;
    transmission?: string;
    fuelType?: string;
    bodyType?: string;
    features?: string;
    description?: string;
    location?: string;
    url?: string;
    scrapedAt: string;
}

export class PuppeteerSevaScraper {
    private browser?: Browser;
    private results: ScrapedVehicle[] = [];

    private async initBrowser(): Promise<void> {
        console.log('🚀 Launching browser for SEVA...');
        this.browser = await puppeteer.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu'
            ]
        });
    }

    /**
     * Parse price string to IDR
     * Format: "Rp 140,3 - 196,2 juta" or "Rp191.400.000"
     */
    private parsePrice(priceStr: string): number {
        // Check if "juta" exists in the original string
        const isJuta = priceStr.toLowerCase().includes('juta');

        // Remove "Rp", "juta" and spaces
        let clean = priceStr.replace(/Rp\s*/gi, '').replace(/juta/gi, '').trim();

        // If range, take first price
        if (clean.includes('-')) {
            clean = clean.split('-')[0].trim();
        }

        // Apply multiplier if it was "juta"
        if (isJuta) {
            // "140,3" -> "140.3"
            const numStr = clean.replace(/,/g, '.');
            const num = parseFloat(numStr);
            return Math.round(num * 1000000);
        }

        // If full format (e.g., "191.400.000")
        // Remove dots if they exist as thousands separators (standard IDR)
        // But be careful not to confuse with decimal points if any
        const fullNum = clean.replace(/\./g, '').replace(/,/g, '');
        return parseInt(fullNum, 10) || 0;
    }

    async scrape(limit: number = 20): Promise<ScrapedVehicle[]> {
        try {
            await this.initBrowser();
            const page = await this.browser!.newPage();

            console.log('🚗 Navigating to SEVA Mobil Bekas...');
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

            // Try Used Cars first as requested by user
            await page.goto('https://www.seva.id/mobil-bekas', {
                waitUntil: 'networkidle2',
                timeout: 60000
            });

            // Wait for vehicle cards to load - Seva uses a[href*="/mobil-bekas/p/"] for used car detail links
            try {
                await page.waitForSelector('a[href*="/mobil-bekas/p/"], a[href^="/mobil-baru/"]', { timeout: 15000 });
            } catch (e) {
                console.warn('⚠️ Timeout waiting for Seva cards, proceeding with current DOM...');
            }

            // Scroll to load more via infinite scroll
            if (limit > 5) {
                console.log('📜 Scrolling to load more vehicles...');
                await page.evaluate(async () => {
                    await new Promise<void>((resolve) => {
                        let totalHeight = 0;
                        const distance = 500;
                        const timer = setInterval(() => {
                            const scrollHeight = document.body.scrollHeight;
                            window.scrollBy(0, distance);
                            totalHeight += distance;

                            if (totalHeight >= scrollHeight || totalHeight >= 4000) {
                                clearInterval(timer);
                                resolve();
                            }
                        }, 250);
                    });
                });
                await new Promise(resolve => setTimeout(resolve, 2000));
            }

            // Extract vehicle data
            console.log('📦 Extracting vehicle data from SEVA...');

            const vehicles = await page.evaluate((limitNum) => {
                // Support both used car and new car cards
                const cards = Array.from(document.querySelectorAll('a[href*="/mobil-bekas/p/"], a[href^="/mobil-baru/"]'));
                const results: any[] = [];

                for (let i = 0; i < Math.min(cards.length, limitNum); i++) {
                    const card = cards[i] as HTMLAnchorElement;

                    try {
                        const url = card.href;
                        const textContent = card.innerText || '';

                        // 1. Get Title from h2 or h3
                        const titleEl = card.querySelector('h1, h2, h3, p.font-bold');
                        const fullTitle = titleEl?.textContent?.trim() || '';

                        // 2. Extract Price
                        // Used cars usually have direct "Rp 250.000.000"
                        const priceMatch = textContent.match(/Rp\s*[\d,.]+/i);
                        const priceDisplay = priceMatch ? priceMatch[0].trim() : '';

                        if (!priceDisplay || (!fullTitle && !url)) continue;

                        // 3. Extract Year from Title if possible
                        const yearMatch = fullTitle.match(/\b(20\d{2})\b/);
                        const year = yearMatch ? parseInt(yearMatch[1]) : new Date().getFullYear();

                        // 4. Extract Brand/Model
                        const parts = fullTitle.split(' ');
                        const brand = parts[0] || 'Unknown';
                        const model = fullTitle || 'Unknown';

                        results.push({
                            brand,
                            model,
                            year,
                            priceDisplay,
                            url,
                        });

                    } catch (err) {
                        continue;
                    }
                }

                return results;
            }, limit);

            console.log(`✅ Found ${vehicles.length} vehicles from SEVA listing. Now fetching details...\n`);

            // Process and fetch details for results
            for (let i = 0; i < vehicles.length; i++) {
                const raw = vehicles[i];
                console.log(`🔍 [${i + 1}/${vehicles.length}] Processing ${raw.model}...`);

                // For used cars, we might not need separate spec page if data is on main page
                // But let's try to visit the detail page to get specific specs
                let detailData: any = { fuelType: 'Bensin', transmission: 'Automatic' };

                try {
                    // Only visit detail page if it's a new car or we want deep specs
                    // For now, let's keep it simple for stability
                    if (raw.url.includes('/mobil-baru/')) {
                        const urlParts = raw.url.split('/');
                        const location = urlParts.pop() || '';
                        const detailUrl = [...urlParts, 'eksterior', 'spesifikasi', location].join('/');
                        await page.goto(detailUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });

                        detailData = await page.evaluate(() => {
                            const specs: any = {};
                            const bodyText = document.body.innerText;
                            if (bodyText.includes('Manual')) specs.transmission = 'Manual';
                            else if (bodyText.includes('Automatic') || bodyText.includes('CVT') || bodyText.includes('A/T')) specs.transmission = 'Automatic';
                            return specs;
                        });
                    } else {
                        // For used cars, transmission is often in the title or URL
                        if (raw.url.toLowerCase().includes('-m-t-') || raw.url.toLowerCase().includes('-manual-')) {
                            detailData.transmission = 'Manual';
                        }
                    }
                } catch (err) {
                    console.warn(`⚠️ Failed to fetch deep details for ${raw.model}`);
                }

                this.results.push({
                    source: 'SEVA',
                    make: raw.brand.charAt(0).toUpperCase() + raw.brand.slice(1),
                    model: raw.model,
                    year: raw.year,
                    price: this.parsePrice(raw.priceDisplay),
                    priceDisplay: raw.priceDisplay,
                    url: raw.url,
                    location: 'Indonesia',
                    fuelType: detailData.fuelType || 'Bensin',
                    transmission: detailData.transmission || 'Automatic',
                    scrapedAt: new Date().toISOString(),
                });

                // Small delay to be polite
                await new Promise(r => setTimeout(r, 1000));
            }

            console.log(`✅ Parsed ${this.results.length} vehicles successfully\n`);

            await this.browser!.close();
            return this.results;

        } catch (error) {
            console.error('Scraping failed:', error);
            if (this.browser) await this.browser.close();
            throw error;
        }
    }
}

// Standalone execution
if (require.main === module) {
    (async () => {
        const scraper = new PuppeteerSevaScraper();
        const results = await scraper.scrape(10);
        console.log('Results:', JSON.stringify(results, null, 2));
    })();
}
