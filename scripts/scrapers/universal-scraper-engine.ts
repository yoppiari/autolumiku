import { PuppeteerOLXScraper } from './puppeteer-olx-scraper';

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

        try {
            // For now, use OLX scraper as it's proven to work
            if (sourceUpper.includes('OLX') || sourceUpper === 'ALL') {
                console.log(`🚗 [ENGINE] Initializing OLX scraper...`);
                const scraper = new PuppeteerOLXScraper();

                console.log(`📡 [ENGINE] Calling OLX scraper.scrape()...`);
                const results = await scraper.scrape(targetCount, false);

                console.log(`✅ [ENGINE] OLX scraper returned ${results.length} results`);

                if (!onProgress) {
                    console.error(`❌ [ENGINE] CRITICAL: No progress callback provided! Data will not be saved!`);
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
            } else {
                console.warn(`⚠️ [ENGINE] Source ${sourceUpper} not yet implemented`);
            }
        } catch (error) {
            console.error(`❌ [ENGINE] Scraper error for ${sourceUpper}:`, error);
            throw error;
        }
    }
}
