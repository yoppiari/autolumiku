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

    async scrape(sourceKey: string, limit: number = 20): Promise<ScrapedVehicle[]> {
        const config = SOURCES[sourceKey];
        if (!config) throw new Error(`Unknown source: ${sourceKey}`);

        console.log(`🚀 Starting Universal Scraper for ${config.name}...`);
        const results: ScrapedVehicle[] = [];

        try {
            this.browser = await puppeteer.launch({
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });

            const page = await this.browser.newPage();
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

            // 1. Visit List Page
            console.log(`Navigating to list: ${config.url}`);
            await page.goto(config.url, { waitUntil: 'domcontentloaded', timeout: 60000 });

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
                        results.push({
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
                        });
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
