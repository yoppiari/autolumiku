import { PuppeteerOLXScraper } from './puppeteer-olx-scraper';
import { PuppeteerCarsomeScraper } from './puppeteer-carsome-scraper';
import { PuppeteerMobil123Scraper } from './puppeteer-mobil123-scraper';

/**
 * Universal Scraper Engine
 * Wrapper for existing proven scrapers
 */
export class UniversalScraperEngine {
    /**
     * Scrape a source
     */
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
            // Mobil123
            else if (sourceUpper.includes('MOBIL123')) {
                console.log(`🚗 [ENGINE] Initializing Mobil123 scraper...`);
                const scraper = new PuppeteerMobil123Scraper();
                console.log(`📡 [ENGINE] Calling Mobil123 scraper.scrape()...`);
                results = await scraper.scrape(targetCount);
                console.log(`✅ [ENGINE] Mobil123 scraper returned ${results.length} results`);
            }
            // ALL - run OLX only for now (most reliable)
            else if (sourceUpper === 'ALL') {
                console.log(`🚗 [ENGINE] ALL mode - running OLX (most reliable source)...`);
                const scraper = new PuppeteerOLXScraper();
                results = await scraper.scrape(targetCount, false);
                console.log(`✅ [ENGINE] OLX scraper returned ${results.length} results`);
            }
            // Unsupported
            else {
                console.warn(`⚠️ [ENGINE] Source ${sourceUpper} not yet implemented`);
                return;
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
                    await onProgress(vehicle);
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
