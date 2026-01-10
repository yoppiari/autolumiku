/**
 * Universal Scraper Engine
 * 
 * Orchestrates scraping from multiple sources (OLX, Carsome, SEVA)
 * Usage: imported by scraper-service.ts
 */

import { PuppeteerOLXScraper } from './puppeteer-olx-scraper';
import { PuppeteerCarsomeScraper } from './puppeteer-carsome-scraper';
import { PuppeteerSevaScraper } from './puppeteer-seva-scraper';

export class UniversalScraperEngine {
    async scrape(
        source: string,
        targetCount: number = 50,
        onProgress?: (vehicle: any) => Promise<void>
    ): Promise<void> {
        const sourceUpper = source.toUpperCase();

        console.log(`🔍 [ENGINE] Starting scrape for ${sourceUpper}, target: ${targetCount}`);
        console.log(`🔍 [ENGINE] Callback provided: ${onProgress ? 'YES' : 'NO'}`);

        if (!onProgress) {
            console.error(`❌ [ENGINE] CRITICAL: No progress callback provided! Data will not be saved!`);
            return;
        }

        try {
            let results: any[] = [];

            // OLX and variants
            if (sourceUpper.includes('OLX')) {
                console.log(`🚗 [ENGINE] Initializing OLX scraper...`);
                const scraper = new PuppeteerOLXScraper();
                console.log(`📡 [ENGINE] Calling OLX scraper.scrape()...`);
                results = await scraper.scrape(targetCount, false);
                console.log(`✅ [ENGINE] OLX scraper returned ${results.length} results`);
            }
            // Carsome
            else if (sourceUpper.includes('CARSOME')) {
                console.log(`🚗 [ENGINE] Initializing Carsome scraper...`);
                const scraper = new PuppeteerCarsomeScraper();
                console.log(`📡 [ENGINE] Calling Carsome scraper.scrape()...`);
                results = await scraper.scrape(targetCount);
                console.log(`✅ [ENGINE] Carsome scraper returned ${results.length} results`);
            }
            // SEVA
            else if (sourceUpper.includes('SEVA')) {
                console.log(`🚗 [ENGINE] Initializing SEVA scraper...`);
                const scraper = new PuppeteerSevaScraper();
                console.log(`📡 [ENGINE] Calling SEVA scraper.scrape()...`);
                results = await scraper.scrape(targetCount);
                console.log(`✅ [ENGINE] SEVA scraper returned ${results.length} results`);
            }
            // Mobil123 (Deleted/Disabled)
            else if (sourceUpper.includes('MOBIL123')) {
                console.warn(`⚠️ [ENGINE] Mobil123 scraper is currently disabled.`);
                // No op
            }

            // Process results via callback
            if (results.length === 0) {
                console.warn(`⚠️ [ENGINE] Scraper returned 0 results`);
                return;
            }

            console.log(`🔄 [ENGINE] Processing ${results.length} vehicles via callback...`);
            let successCount = 0;
            let errorCount = 0;

            for (let i = 0; i < results.length; i++) {
                const vehicle = results[i];
                try {
                    console.log(`  → [${i + 1}/${results.length}] ${vehicle.make} ${vehicle.model} ${vehicle.year} - ${vehicle.priceDisplay}`);
                    await onProgress(vehicle); // Callback to save data
                    successCount++;
                } catch (err) {
                    errorCount++;
                    console.error(`  ❌ Failed to save vehicle #${i + 1}:`, err);
                }
            }

            console.log(`✅ [ENGINE] Callback complete: ${successCount} saved, ${errorCount} errors`);

        } catch (error) {
            console.error(`❌ [ENGINE] Scraper error for ${sourceUpper}:`, error);
            throw error;
        }
    }
}
