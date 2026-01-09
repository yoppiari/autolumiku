/**
 * MOBIL123 Puppeteer Scraper (AI-POWERED)
 *
 * Scrapes vehicle data from Mobil123 using AI for robustness.
 * Usage: npx tsx scripts/scrapers/puppeteer-mobil123-scraper.ts
 */

import { loadEnvConfig } from '@next/env';
import puppeteer, { Browser, Page } from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';
import { VehicleDataExtractorService } from '../../src/lib/ai/vehicle-data-extractor.service';

// Load environment variables for AI service
loadEnvConfig(process.cwd());

export interface ScrapedVehicle {
    source: string;
    make: string;
    model: string;
    year: number;
    price: number; // IDR
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

export class PuppeteerMobil123Scraper {
    private browser?: Browser;
    private results: ScrapedVehicle[] = [];

    private async initBrowser(): Promise<void> {
        console.log('🚀 Launching browser for Mobil123...');
        this.browser = await puppeteer.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--disable-blink-features=AutomationControlled'
            ]
        });
    }

    /**
     * Extract detail spex using AI 5.0
     * This is the core "Self-Healing" feature
     */
    private async extractWithAI(page: Page): Promise<Partial<ScrapedVehicle>> {
        try {
            // Get raw HTML content
            const html = await page.content();

            // Let AI parse it
            const aiResult = await VehicleDataExtractorService.extractFromHTML(html);

            if (aiResult.success && aiResult.data) {
                return {
                    make: aiResult.data.make,
                    model: aiResult.data.model,
                    year: aiResult.data.year,
                    price: aiResult.data.price,
                    variant: aiResult.data.variant,
                    transmission: aiResult.data.transmission,
                    fuelType: aiResult.data.fuelType,
                    description: aiResult.reasoning || 'Extracted by AI'
                };
            }
            return {};
        } catch (e) {
            console.error('AI Extraction Error:', e);
            return {};
        }
    }

    async scrape(limit: number = 20): Promise<ScrapedVehicle[]> {
        try {
            await this.initBrowser();
            const page = await this.browser!.newPage();

            // Navigate to Mobil123
            console.log('🚗 Navigating to Mobil123 Indonesia...');
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

            await page.goto('https://www.mobil123.com/mobil-dijual/indonesia', { waitUntil: 'domcontentloaded', timeout: 60000 });

            // Gather links generically
            const vehicleLinks = await page.evaluate((limitNum) => {
                const links = Array.from(document.querySelectorAll('a'));
                // Filter for detail pages (usually contains /dijual/ and NOT list pages)
                // Mobil123 Links: /mobil-dijual/toyota-avanza-1-3-g-mpv/jawa-barat/123456
                return links
                    .map(a => a.href)
                    .filter(href => href.includes('/mobil-dijual/') && !href.includes('/indonesia?') && href.match(/\/\d{6,}$/)) // Ends with ID number
                    .slice(0, limitNum);
            }, limit);

            const uniqueLinks = Array.from(new Set(vehicleLinks));
            console.log(`Found ${uniqueLinks.length} vehicle links. Processing with AI...`);

            // Visit each link and extract with AI
            for (const url of uniqueLinks) {
                try {
                    console.log(`Processing: ${url}`);
                    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

                    // Use AI to extract EVERYTHING from detail page
                    // This avoids fragile List View selectors
                    const data = await this.extractWithAI(page);

                    if (data.make && data.model && data.price) {
                        this.results.push({
                            source: 'MOBIL123',
                            url,
                            scrapedAt: new Date().toISOString(),
                            make: data.make,
                            model: data.model,
                            year: data.year || 0,
                            price: data.price || 0,
                            priceDisplay: `Rp ${data.price}`, // Approximate
                            variant: data.variant,
                            transmission: data.transmission,
                            fuelType: data.fuelType,
                            description: data.description,
                            location: 'Indonesia' // Default for now
                        });
                        console.log(`✅ Extracted: ${data.make} ${data.model} - Rp ${data.price}`);
                    } else {
                        console.warn('⚠️ AI could not extract core data (Make/Model/Price)');
                    }

                } catch (err) {
                    console.error(`Failed to process ${url}`, err);
                }
            }

            await this.browser!.close();
            return this.results;

        } catch (error) {
            console.error('Scraping failed:', error);
            if (this.browser) await this.browser.close();
            throw error;
        }
    }
}

// Standalone execution check
if (require.main === module) {
    (async () => {
        const scraper = new PuppeteerMobil123Scraper();
        const res = await scraper.scrape(5);
        console.log('Result:', JSON.stringify(res, null, 2));
    })();
}
