/**
 * UNIVERSAL AI SCRAPER
 *
 * Supports: Seva, Carmudi, Oto, Caroline, Auto2000, Mobil88, Carro, OLX Autos
 * Uses "Smart Discovery" to find vehicle links and AI 5.0 to extract data.
 */

import { loadEnvConfig } from '@next/env';
import puppeteer, { Browser, Page } from 'puppeteer';
import { VehicleDataExtractorService } from '../../src/lib/ai/vehicle-data-extractor.service';

loadEnvConfig(process.cwd());

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
    location?: string;
    url?: string;
    scrapedAt: string;
    description?: string;
}

interface SourceConfig {
    name: string;
    url: string; // List page URL
    validLinkPattern: RegExp; // Regex to identify detail pages
}

export const SOURCES: Record<string, SourceConfig> = {
    SEVA: {
        name: 'Seva.id',
        url: 'https://www.seva.id/mobil-bekas',
        validLinkPattern: /\/mobil-bekas\/[a-z0-9-]+/i
    },
    OLX: {
        name: 'OLX Indonesia',
        url: 'https://www.olx.co.id/mobil-bekas_c198',
        validLinkPattern: /\/item\/[a-z0-9-]+/i
    },
    CARSOME: {
        name: 'Carsome Indonesia',
        url: 'https://www.carsome.id/buy-car',
        validLinkPattern: /\/buy-car\/[a-z0-9-]+/i
    },
    MOBIL123: {
        name: 'Mobil123',
        url: 'https://www.mobil123.com/mobil-dijual',
        validLinkPattern: /\/dijual\/[a-z0-9-]+/i
    },
    CARMUDI: {
        name: 'Carmudi',
        url: 'https://www.carmudi.co.id/mobil-dijual',
        validLinkPattern: /\/mobil-dijual\/[a-z0-9-]+/i
    },
    OTO: {
        name: 'Oto.com',
        url: 'https://www.oto.com/mobil-bekas',
        validLinkPattern: /\/mobil-bekas\/[a-z0-9-]+/i
    },
    CAROLINE: {
        name: 'Caroline.id',
        url: 'https://www.caroline.id/beli-mobil',
        validLinkPattern: /\/beli-mobil\/[a-z0-9-]+/i
    },
    AUTO2000: {
        name: 'Auto2000',
        url: 'https://auto2000.co.id/mobil-bekas-toyota',
        validLinkPattern: /\/mobil-bekas-toyota\/[a-z0-9-]+/i
    },
    MOBIL88: {
        name: 'Mobil88',
        url: 'https://www.mo88i.com/cari-mobil',
        validLinkPattern: /\/cari-mobil\/[a-z0-9-]+/i
    },
    CARRO: {
        name: 'Carro',
        url: 'https://carro.co/id/en/buy-car',
        validLinkPattern: /\/buy-car\/[a-z0-9-]+/i
    },
    OLX_AUTOS: {
        name: 'OLX Autos',
        url: 'https://www.olx.co.id/olx-autos-jual-beli-mobil_c5158', // Specific category for OLX Autos
        validLinkPattern: /\/item\/[a-z0-9-]+/i
    }
};

export class UniversalScraper {
    private browser?: Browser;

    async scrape(sourceKey: string, limit: number = 20, onProgress?: (vehicle: ScrapedVehicle) => Promise<void>): Promise<ScrapedVehicle[]> {
        const config = SOURCES[sourceKey];
        if (!config) throw new Error(`Unknown source: ${sourceKey}`);

        console.log(`🚀 Starting Universal Scraper for ${config.name}...`);
        const results: ScrapedVehicle[] = [];

        try {
            this.browser = await puppeteer.launch({
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-blink-features=AutomationControlled',
                    '--window-size=1920,1080'
                ]
            });

            const page = await this.browser.newPage();

            // STEALTH: Override navigator properties
            await page.evaluateOnNewDocument(() => {
                Object.defineProperty(navigator, 'webdriver', { get: () => false });
            });

            // STEALTH: Random Viewport
            await page.setViewport({
                width: 1366 + Math.floor(Math.random() * 100),
                height: 768 + Math.floor(Math.random() * 100)
            });

            // STEALTH: Advanced Fingerprint Evasion
            await page.evaluateOnNewDocument(() => {
                // Pass WebDriver check
                Object.defineProperty(navigator, 'webdriver', { get: () => false });

                // Mock Plugins to look like real Chrome
                Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
                Object.defineProperty(navigator, 'languages', { get: () => ['id-ID', 'id', 'en-US', 'en'] });

                // Mock Permissions
                const originalQuery = window.navigator.permissions.query;
                window.navigator.permissions.query = (parameters: any) => (
                    parameters.name === 'notifications' ?
                        Promise.resolve({ state: Notification.permission } as PermissionStatus) :
                        originalQuery(parameters)
                );

                // Mock WebGL Vendor
                try {
                    const getParameter = WebGLRenderingContext.prototype.getParameter;
                    WebGLRenderingContext.prototype.getParameter = function (parameter) {
                        // 37445: UNMASKED_VENDOR_WEBGL
                        // 37446: UNMASKED_RENDERER_WEBGL
                        if (parameter === 37445) return 'Intel Inc.';
                        if (parameter === 37446) return 'Intel(R) Iris(R) Xe Graphics';
                        return getParameter.apply(this, [parameter]);
                    };
                } catch (e) { }
            });

            // STEALTH: Rotate User Agents
            const UAs = [
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
                'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            ];
            const randomUA = UAs[Math.floor(Math.random() * UAs.length)];
            await page.setUserAgent(randomUA);

            // STEALTH: Header Manipulation
            await page.setExtraHTTPHeaders({
                'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
                'Referer': 'https://www.google.com/'
            });

            // 1. Visit List Page
            console.log(`Navigating to list: ${config.url}`);
            await page.goto(config.url, { waitUntil: 'networkidle2', timeout: 60000 });

            // STEALTH: Human Delay and Mouse Movement
            await new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * 2000) + 1000));
            try {
                // Move mouse randomly
                await page.mouse.move(100, 100);
                await page.mouse.move(200, 200, { steps: 10 });
                await page.mouse.move(Math.random() * 1000, Math.random() * 500, { steps: 20 });
            } catch (e) { }

            // SCROLL TO LOAD CONTENT (Critical for SPAs)
            console.log('Scrolling to populate items...');
            await page.evaluate(async () => {
                await new Promise<void>((resolve) => {
                    let totalHeight = 0;
                    const distance = 200; // Scroll chunk
                    const timer = setInterval(() => {
                        window.scrollBy(0, distance);
                        totalHeight += distance;

                        // Stop after scrolling reasonable amount (e.g. 5 screens)
                        if (totalHeight >= 4000) {
                            clearInterval(timer);
                            resolve();
                        }
                    }, 100);
                });
            });
            await new Promise(resolve => setTimeout(resolve, 2000)); // Settle

            // 2. Discover Links (Smart Discovery)
            const links = await page.evaluate((patternStr) => {
                const pattern = new RegExp(patternStr.slice(1, -2), 'i'); // Reconstruct regex
                const allLinks = Array.from(document.querySelectorAll('a'));

                return allLinks
                    .map(a => a.href)
                    .filter(href => {
                        // Filter internal links that match the vehicle pattern
                        return pattern.test(href) && !href.includes('google') && !href.includes('facebook') && href.length > 20;
                    })
                    .slice(0, 50); // Grab candidate pool
            }, String(config.validLinkPattern));

            const uniqueLinks = Array.from(new Set(links)).slice(0, limit);
            console.log(`Found ${uniqueLinks.length} candidate vehicles.`);

            // 3. Visit each and Extract
            for (const link of uniqueLinks) {
                try {
                    console.log(`Analyzing: ${link}`);
                    await page.goto(link, { waitUntil: 'domcontentloaded', timeout: 30000 });

                    const html = await page.content();
                    const aiResult = await VehicleDataExtractorService.extractFromHTML(html);

                    if (aiResult.success && aiResult.data) {
                        console.log(`✅ Identified: ${aiResult.data.make} ${aiResult.data.model} - ${aiResult.data.price}`);
                        const vehicle: ScrapedVehicle = {
                            source: config.name,
                            url: link,
                            make: aiResult.data.make,
                            model: aiResult.data.model,
                            year: aiResult.data.year || 0,
                            price: aiResult.data.price || 0,
                            priceDisplay: `Rp ${aiResult.data.price}`,
                            variant: aiResult.data.variant,
                            transmission: aiResult.data.transmission,
                            fuelType: aiResult.data.fuelType,
                            description: aiResult.reasoning || `Extracted from ${config.name}`,
                            scrapedAt: new Date().toISOString()
                        };

                        results.push(vehicle);
                        if (onProgress) await onProgress(vehicle);
                    }
                } catch (err) {
                    console.error(`Skipping ${link}:`, err);
                }
            }

        } catch (error) {
            console.error('Universal scrape failed:', error);
        } finally {
            if (this.browser) await this.browser.close();
        }

        return results;
    }
}
