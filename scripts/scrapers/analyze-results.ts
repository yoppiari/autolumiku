/**
 * Scraper Results Analyzer
 *
 * Compare and analyze data quality from different scraping sources
 * Helps determine which source provides better data for AI feeding
 *
 * Usage: npx tsx scripts/scrapers/analyze-results.ts
 */

import * as fs from 'fs';
import * as path from 'path';

interface ScrapedVehicle {
  source: string;
  make: string;
  model: string;
  year: number;
  price: number;
  priceDisplay: string;
  variant?: string;
  mileage?: number;
  transmission?: string;
  fuelType?: string;
  color?: string;
  location?: string;
  url?: string;
  scrapedAt: string;
}

interface ScraperResults {
  source: string;
  scrapedAt: string;
  totalVehicles: number;
  vehicles: ScrapedVehicle[];
}

interface DataQualityScore {
  source: string;
  totalVehicles: number;
  completeness: {
    score: number; // 0-100
    hasBasicInfo: number; // % with make, model, year, price
    hasSpecs: number; // % with transmission, fuel, mileage
    hasExtras: number; // % with color, location, variant
  };
  dataQuality: {
    validYears: number; // % with valid year (1980-2025)
    validPrices: number; // % with price > 0
    validMakes: number; // % with recognized make
    avgFieldsPerVehicle: number;
  };
  diversity: {
    uniqueMakes: number;
    uniqueModels: number;
    uniqueYears: number;
    priceRangeSpread: number; // Max - Min in millions IDR
  };
  overallScore: number; // 0-100
}

class ResultsAnalyzer {
  private outputDir = path.join(process.cwd(), 'scripts', 'scrapers', 'output');

  // Common Indonesian car makes for validation
  private knownMakes = [
    'Toyota', 'Honda', 'Daihatsu', 'Mitsubishi', 'Suzuki',
    'Nissan', 'Mazda', 'Isuzu', 'Wuling', 'Hyundai',
    'Kia', 'BMW', 'Mercedes', 'Audi', 'Volkswagen',
    'Ford', 'Chevrolet', 'Peugeot', 'Renault', 'MG'
  ];

  /**
   * Load scraper results from JSON file
   */
  private loadResults(filename: string): ScraperResults | null {
    const filepath = path.join(this.outputDir, filename);

    if (!fs.existsSync(filepath)) {
      console.log(`⚠️  File not found: ${filename}`);
      return null;
    }

    try {
      const content = fs.readFileSync(filepath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      console.error(`❌ Error loading ${filename}:`, error);
      return null;
    }
  }

  /**
   * Calculate completeness score
   */
  private calculateCompleteness(vehicles: ScrapedVehicle[]): DataQualityScore['completeness'] {
    if (vehicles.length === 0) {
      return { score: 0, hasBasicInfo: 0, hasSpecs: 0, hasExtras: 0 };
    }

    const hasBasicInfo = vehicles.filter(v =>
      v.make && v.model && v.year && v.price > 0
    ).length / vehicles.length * 100;

    const hasSpecs = vehicles.filter(v =>
      v.transmission || v.fuelType || v.mileage
    ).length / vehicles.length * 100;

    const hasExtras = vehicles.filter(v =>
      v.color || v.location || v.variant
    ).length / vehicles.length * 100;

    const score = (hasBasicInfo * 0.5) + (hasSpecs * 0.3) + (hasExtras * 0.2);

    return {
      score: Math.round(score),
      hasBasicInfo: Math.round(hasBasicInfo),
      hasSpecs: Math.round(hasSpecs),
      hasExtras: Math.round(hasExtras),
    };
  }

  /**
   * Calculate data quality score
   */
  private calculateDataQuality(vehicles: ScrapedVehicle[]): DataQualityScore['dataQuality'] {
    if (vehicles.length === 0) {
      return { validYears: 0, validPrices: 0, validMakes: 0, avgFieldsPerVehicle: 0 };
    }

    const currentYear = new Date().getFullYear();
    const validYears = vehicles.filter(v =>
      v.year >= 1980 && v.year <= currentYear + 1
    ).length / vehicles.length * 100;

    const validPrices = vehicles.filter(v =>
      v.price > 0 && v.price < 1000000000000 // < 10M IDR
    ).length / vehicles.length * 100;

    const validMakes = vehicles.filter(v =>
      this.knownMakes.includes(v.make)
    ).length / vehicles.length * 100;

    // Calculate average number of filled fields
    const totalFields = vehicles.reduce((sum, v) => {
      let count = 0;
      if (v.make) count++;
      if (v.model) count++;
      if (v.year) count++;
      if (v.price > 0) count++;
      if (v.variant) count++;
      if (v.mileage) count++;
      if (v.transmission) count++;
      if (v.fuelType) count++;
      if (v.color) count++;
      if (v.location) count++;
      return sum + count;
    }, 0);

    const avgFieldsPerVehicle = totalFields / vehicles.length;

    return {
      validYears: Math.round(validYears),
      validPrices: Math.round(validPrices),
      validMakes: Math.round(validMakes),
      avgFieldsPerVehicle: Math.round(avgFieldsPerVehicle * 10) / 10,
    };
  }

  /**
   * Calculate diversity score
   */
  private calculateDiversity(vehicles: ScrapedVehicle[]): DataQualityScore['diversity'] {
    const makes = new Set(vehicles.map(v => v.make));
    const models = new Set(vehicles.map(v => `${v.make} ${v.model}`));
    const years = new Set(vehicles.map(v => v.year).filter(y => y > 0));

    const prices = vehicles.map(v => v.price).filter(p => p > 0);
    const priceRangeSpread = prices.length > 0
      ? Math.round((Math.max(...prices) - Math.min(...prices)) / 100000000)
      : 0;

    return {
      uniqueMakes: makes.size,
      uniqueModels: models.size,
      uniqueYears: years.size,
      priceRangeSpread,
    };
  }

  /**
   * Analyze a single source
   */
  analyzeSource(results: ScraperResults): DataQualityScore {
    const { vehicles, source } = results;

    const completeness = this.calculateCompleteness(vehicles);
    const dataQuality = this.calculateDataQuality(vehicles);
    const diversity = this.calculateDiversity(vehicles);

    // Calculate overall score (weighted average)
    const overallScore = Math.round(
      (completeness.score * 0.4) +
      ((dataQuality.validYears + dataQuality.validPrices + dataQuality.validMakes) / 3 * 0.4) +
      (Math.min(diversity.uniqueMakes / 10, 1) * 100 * 0.2)
    );

    return {
      source,
      totalVehicles: vehicles.length,
      completeness,
      dataQuality,
      diversity,
      overallScore,
    };
  }

  /**
   * Print analysis results
   */
  printAnalysis(score: DataQualityScore): void {
    console.log(`\n📊 ${score.source.toUpperCase()} ANALYSIS`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Total Vehicles: ${score.totalVehicles}`);
    console.log(`Overall Score: ${score.overallScore}/100 ${this.getScoreEmoji(score.overallScore)}`);

    console.log('\n📋 Completeness:');
    console.log(`  Score: ${score.completeness.score}/100`);
    console.log(`  Basic Info (make, model, year, price): ${score.completeness.hasBasicInfo}%`);
    console.log(`  Specs (transmission, fuel, mileage): ${score.completeness.hasSpecs}%`);
    console.log(`  Extras (color, location, variant): ${score.completeness.hasExtras}%`);

    console.log('\n✅ Data Quality:');
    console.log(`  Valid Years: ${score.dataQuality.validYears}%`);
    console.log(`  Valid Prices: ${score.dataQuality.validPrices}%`);
    console.log(`  Recognized Makes: ${score.dataQuality.validMakes}%`);
    console.log(`  Avg Fields per Vehicle: ${score.dataQuality.avgFieldsPerVehicle}/10`);

    console.log('\n🎨 Diversity:');
    console.log(`  Unique Makes: ${score.diversity.uniqueMakes}`);
    console.log(`  Unique Models: ${score.diversity.uniqueModels}`);
    console.log(`  Year Range: ${score.diversity.uniqueYears} years`);
    console.log(`  Price Range: Rp ${score.diversity.priceRangeSpread} juta`);

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  }

  /**
   * Get emoji for score
   */
  private getScoreEmoji(score: number): string {
    if (score >= 80) return '🏆';
    if (score >= 60) return '✅';
    if (score >= 40) return '⚠️';
    return '❌';
  }

  /**
   * Compare two sources
   */
  compare(score1: DataQualityScore, score2: DataQualityScore): void {
    console.log('\n📊 COMPARISON');
    console.log('═══════════════════════════════════════════');

    const winner = score1.overallScore > score2.overallScore ? score1 : score2;
    const loser = score1.overallScore > score2.overallScore ? score2 : score1;

    console.log(`\n🏆 Winner: ${winner.source}`);
    console.log(`   Overall Score: ${winner.overallScore}/100`);
    console.log(`   Difference: +${winner.overallScore - loser.overallScore} points`);

    console.log('\n📈 Strengths & Weaknesses:');

    // Completeness
    if (score1.completeness.score > score2.completeness.score) {
      console.log(`  ✅ ${score1.source}: Better completeness (+${score1.completeness.score - score2.completeness.score} points)`);
    } else if (score2.completeness.score > score1.completeness.score) {
      console.log(`  ✅ ${score2.source}: Better completeness (+${score2.completeness.score - score1.completeness.score} points)`);
    }

    // Data quality
    const q1 = (score1.dataQuality.validYears + score1.dataQuality.validPrices + score1.dataQuality.validMakes) / 3;
    const q2 = (score2.dataQuality.validYears + score2.dataQuality.validPrices + score2.dataQuality.validMakes) / 3;
    if (q1 > q2) {
      console.log(`  ✅ ${score1.source}: Better data quality (+${Math.round(q1 - q2)} points)`);
    } else if (q2 > q1) {
      console.log(`  ✅ ${score2.source}: Better data quality (+${Math.round(q2 - q1)} points)`);
    }

    // Diversity
    if (score1.diversity.uniqueMakes > score2.diversity.uniqueMakes) {
      console.log(`  ✅ ${score1.source}: More diverse (+${score1.diversity.uniqueMakes - score2.diversity.uniqueMakes} makes)`);
    } else if (score2.diversity.uniqueMakes > score1.diversity.uniqueMakes) {
      console.log(`  ✅ ${score2.source}: More diverse (+${score2.diversity.uniqueMakes - score1.diversity.uniqueMakes} makes)`);
    }

    console.log('\n💡 Recommendation:');
    if (winner.overallScore > loser.overallScore + 15) {
      console.log(`   Use ${winner.source} as primary source`);
      console.log(`   ${loser.source} can be used as supplement for missing data`);
    } else {
      console.log(`   Both sources are similar in quality`);
      console.log(`   Consider using both for better coverage`);
    }

    console.log('═══════════════════════════════════════════\n');
  }

  /**
   * Save analysis report
   */
  saveReport(scores: DataQualityScore[]): void {
    const report = {
      analyzedAt: new Date().toISOString(),
      sources: scores,
      recommendation: this.generateRecommendation(scores),
    };

    const reportPath = path.join(this.outputDir, 'analysis-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');

    console.log(`💾 Analysis report saved to: ${reportPath}\n`);
  }

  /**
   * Generate recommendation
   */
  private generateRecommendation(scores: DataQualityScore[]): string {
    if (scores.length === 0) return 'No data to analyze';

    const best = scores.reduce((prev, current) =>
      current.overallScore > prev.overallScore ? current : prev
    );

    if (best.overallScore >= 70) {
      return `${best.source} is recommended as primary source with overall score ${best.overallScore}/100`;
    } else if (best.overallScore >= 50) {
      return `${best.source} is acceptable but needs improvement. Consider using multiple sources.`;
    } else {
      return 'All sources need improvement. Consider adjusting scraping logic or finding alternative sources.';
    }
  }

  /**
   * Run full analysis
   */
  async analyze(): Promise<void> {
    console.log('═══════════════════════════════════════════');
    console.log('   SCRAPER RESULTS ANALYZER');
    console.log('═══════════════════════════════════════════\n');

    // Load results
    const mobil123Results = this.loadResults('mobil123-results.json');
    const olxResults = this.loadResults('olx-results.json');

    const scores: DataQualityScore[] = [];

    // Analyze Mobil123
    if (mobil123Results && mobil123Results.vehicles.length > 0) {
      const score = this.analyzeSource(mobil123Results);
      this.printAnalysis(score);
      scores.push(score);
    } else {
      console.log('⚠️  No Mobil123 results found or empty');
    }

    // Analyze OLX
    if (olxResults && olxResults.vehicles.length > 0) {
      const score = this.analyzeSource(olxResults);
      this.printAnalysis(score);
      scores.push(score);
    } else {
      console.log('⚠️  No OLX results found or empty');
    }

    // Compare if both available
    if (scores.length === 2) {
      this.compare(scores[0], scores[1]);
    }

    // Save report
    if (scores.length > 0) {
      this.saveReport(scores);
    } else {
      console.log('\n❌ No results to analyze');
      console.log('📝 Run scrapers first:');
      console.log('   npx tsx scripts/scrapers/test-mobil123-scraper.ts');
      console.log('   npx tsx scripts/scrapers/test-olx-scraper.ts\n');
    }
  }
}

// Run analyzer
async function main() {
  const analyzer = new ResultsAnalyzer();
  await analyzer.analyze();
}

// Execute if run directly
if (require.main === module) {
  main();
}

export { ResultsAnalyzer, DataQualityScore };
