import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { Page, Browser } from 'puppeteer';

// Add stealth plugin
puppeteer.use(StealthPlugin());

export interface ScraperOptions {
    userAgent?: string;
    waitForSelector?: string;
}

export interface ScrapeResult {
    url: string;
    html: string;
    success: boolean;
    error?: string;
}

/**
 * Universal Scraper using Puppeteer with Advanced Stealth (puppeteer-extra)
 */
export class PuppeteerUniversalScraper {

    async scrape(url: string, options: ScraperOptions = {}): Promise<ScrapeResult> {
        console.log(`🕵️ Starting Stealth Scrape: ${url}`);

        // Launch Puppeteer with Stealth
        const browser = await puppeteer.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu',
                '--window-size=1920,1080',
            ],
            defaultViewport: { width: 1920, height: 1080 }
        }) as unknown as Browser;

        try {
            const page = await browser.newPage();

            // Randomize User Agent (Simulate Real Chrome)
            const userAgents = [
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36 Edg/119.0.0.0'
            ];
            await page.setUserAgent(userAgents[Math.floor(Math.random() * userAgents.length)]);

            // Extra Headers for Legitimacy
            await page.setExtraHTTPHeaders({
                'Accept-Language': 'en-US,en;q=0.9,id;q=0.8',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
                'Referer': 'https://www.google.com/'
            });

            // Navigate with robust timeout
            await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

            // Simulate Human Interaction (Scroll)
            await this.autoScroll(page);

            // Wait for typical car card selectors (Generic heuristic)
            try {
                // Try to wait for common car listing containers if possible
                // We use a generic 'img' as a fallback if no specific selector
                await page.waitForSelector('img', { timeout: 5000 });
            } catch (e) {
                // Ignore
            }

            const html = await page.content();

            return {
                url,
                html,
                success: true
            };

        } catch (error) {
            console.error(`❌ Scrape Failed: ${error}`);
            return {
                url,
                html: '',
                success: false,
                error: String(error)
            };
        } finally {
            await browser.close();
        }
    }

    private async autoScroll(page: Page) {
        await page.evaluate(async () => {
            await new Promise<void>((resolve) => {
                let totalHeight = 0;
                const distance = 100;
                const timer = setInterval(() => {
                    const scrollHeight = document.body.scrollHeight;
                    window.scrollBy(0, distance);
                    totalHeight += distance;

                    if (totalHeight >= scrollHeight - window.innerHeight || totalHeight > 10000) {
                        clearInterval(timer);
                        resolve();
                    }
                }, 100);
            });
        });
    }
}
