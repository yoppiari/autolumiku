/**
 * Run All Scraper Tests
 *
 * Convenience script to run all scrapers and analyze results in one go
 *
 * Usage: npx tsx scripts/scrapers/run-all-tests.ts
 */

import { Mobil123Scraper } from './test-mobil123-scraper';
import { OLXScraper } from './test-olx-scraper';
import { ResultsAnalyzer } from './analyze-results';

async function main() {
  console.log('═══════════════════════════════════════════');
  console.log('   VEHICLE SCRAPER TEST SUITE');
  console.log('═══════════════════════════════════════════\n');

  let mobil123Success = false;
  let olxSuccess = false;

  // Test 1: Mobil123
  console.log('📍 Step 1/3: Testing Mobil123 scraper...\n');
  try {
    const mobil123 = new Mobil123Scraper();
    await mobil123.scrapeUsedCars(20);
    mobil123.printSummary();
    await mobil123.saveResults();
    mobil123Success = true;
    console.log('✅ Mobil123 test completed\n');
  } catch (error) {
    console.error('❌ Mobil123 test failed:', error);
    console.log('⏭️  Continuing with next test...\n');
  }

  // Small delay between tests
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Test 2: OLX
  console.log('📍 Step 2/3: Testing OLX scraper...\n');
  try {
    const olx = new OLXScraper();
    await olx.scrapeUsedCars(20);
    olx.printSummary();
    await olx.saveResults();
    olxSuccess = true;
    console.log('✅ OLX test completed\n');
  } catch (error) {
    console.error('❌ OLX test failed:', error);
    console.log('⏭️  Continuing with analysis...\n');
  }

  // Test 3: Analysis
  console.log('📍 Step 3/3: Analyzing results...\n');
  try {
    const analyzer = new ResultsAnalyzer();
    await analyzer.analyze();
    console.log('✅ Analysis completed\n');
  } catch (error) {
    console.error('❌ Analysis failed:', error);
  }

  // Final summary
  console.log('═══════════════════════════════════════════');
  console.log('   TEST SUITE SUMMARY');
  console.log('═══════════════════════════════════════════');
  console.log(`Mobil123: ${mobil123Success ? '✅ Success' : '❌ Failed'}`);
  console.log(`OLX:      ${olxSuccess ? '✅ Success' : '❌ Failed'}`);
  console.log('═══════════════════════════════════════════\n');

  if (!mobil123Success && !olxSuccess) {
    console.log('⚠️  Both scrapers failed. This is expected on first run.');
    console.log('📝 Next steps:');
    console.log('   1. Inspect HTML structure of target websites');
    console.log('   2. Update parsing logic in scraper files');
    console.log('   3. Test again with adjusted code\n');
  } else {
    console.log('🎉 At least one scraper is working!');
    console.log('📊 Check output/ directory for results\n');
  }
}

main().catch(console.error);
