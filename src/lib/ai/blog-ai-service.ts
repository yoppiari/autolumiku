/**
 * Blog AI Service
 *
 * Handles AI-powered blog content generation with SEO optimization
 * and local search targeting for automotive showroom blogs
 */

import { createZAIClient, ZAIClient } from './zai-client';
import { prisma } from '../prisma';

export enum BlogCategory {
  BUYING_GUIDE = 'BUYING_GUIDE',
  COMPARISON = 'COMPARISON',
  MAINTENANCE_TIPS = 'MAINTENANCE_TIPS',
  MARKET_NEWS = 'MARKET_NEWS',
  FEATURE_REVIEW = 'FEATURE_REVIEW',
  FINANCING = 'FINANCING',
  LOCAL_INSIGHTS = 'LOCAL_INSIGHTS',
}

export enum BlogTone {
  FORMAL = 'FORMAL',
  CASUAL = 'CASUAL',
  FRIENDLY = 'FRIENDLY',
}

export interface BlogGenerationInput {
  category: BlogCategory;
  topic: string; // e.g., "Toyota Avanza 2020" or "Perbandingan SUV keluarga"
  tone: BlogTone;
  targetLocation: string; // e.g., "Jakarta"
  tenantName?: string;
  tenantAreas?: string[]; // e.g., ["Jakarta Selatan", "BSD"]
  includeVehicles?: boolean;
  vehicleIds?: string[];
}

export interface BlogGenerationResult {
  title: string;
  slug: string;
  metaDescription: string;
  content: string; // HTML content
  excerpt: string;
  keywords: string[];
  localKeywords: string[];
  focusKeyword: string;
  seoScore: number;
  wordCount: number;
  readabilityScore: number;
  relatedTopics: string[];
}

// SEO guidelines per category
const CATEGORY_GUIDELINES = {
  [BlogCategory.BUYING_GUIDE]: `
- Focus on practical tips, checklist, step-by-step guide
- Include sections: Persiapan, Inspeksi, Negosiasi, Dokumen
- Add price ranges and market insights
- Mention common mistakes to avoid
  `,
  [BlogCategory.COMPARISON]: `
- Create comparison table with key specs
- Pros/cons for each model
- Price comparison in local market
- Recommendation based on use case (family, commute, etc)
  `,
  [BlogCategory.MAINTENANCE_TIPS]: `
- Specific maintenance schedule
- Cost estimates for common services
- Local workshop recommendations (if available)
- Seasonal maintenance tips for Indonesian climate
  `,
  [BlogCategory.MARKET_NEWS]: `
- Recent market trends and data
- Price movement analysis
- Popular models in the area
- Predictions for upcoming months
  `,
  [BlogCategory.FEATURE_REVIEW]: `
- Detailed feature explanation with images/diagrams
- Real-world usage scenarios
- Comparison with competitors
- Value for money analysis
  `,
  [BlogCategory.FINANCING]: `
- Financing options (cash vs kredit)
- Down payment calculations
- Interest rate comparisons
- Required documents
- Tips for loan approval
  `,
  [BlogCategory.LOCAL_INSIGHTS]: `
- Local traffic patterns
- Parking availability
- Best routes for test drive
- Community recommendations
- Local regulations (ganjil-genap, etc)
  `,
};

// Tone guidelines
const TONE_GUIDELINES = {
  [BlogTone.FORMAL]: `
- Gunakan bahasa baku dan profesional
- Hindari slang atau bahasa gaul
- Struktur kalimat formal dan lengkap
- Cocok untuk artikel edukatif dan panduan teknis
  `,
  [BlogTone.CASUAL]: `
- Bahasa santai tapi tetap sopan
- Boleh gunakan contoh sehari-hari
- Kalimat lebih pendek dan mudah dipahami
- Seperti berbicara dengan teman yang lebih tahu
  `,
  [BlogTone.FRIENDLY]: `
- Hangat dan personal
- Gunakan "Anda" untuk pembaca
- Ajak pembaca berinteraksi
- Empati dengan kebutuhan pembaca
  `,
};

const BLOG_GENERATION_PROMPT = `Anda adalah expert content writer untuk blog showroom mobil bekas di Indonesia dengan spesialisasi SEO dan automotive industry.

KONTEKS:
- Showroom: {tenantName}
- Lokasi: {targetLocation}
- Area Coverage: {tenantAreas}
- Target Audience: Pembeli mobil bekas di {targetLocation} dan sekitarnya
- Tone: {tone}
- Category: {category}

TUGAS:
Generate artikel blog yang memenuhi kriteria berikut:

1. SEO REQUIREMENTS (Google 2025):
   - Title: Maks 60 karakter, include focus keyword dan lokasi
   - Meta Description: 140-160 karakter, compelling dengan CTA
   - Headers: H2, H3 dengan keyword variations
   - Word Count: 1000-1500 kata
   - Keyword Density: 1-2% (natural, tidak spam)
   - Focus Keyword harus dari topik: "{topic}"

2. E-E-A-T COMPLIANCE:
   - Tunjukkan Expertise: Data market, tips praktis dari pengalaman
   - Tunjukkan Experience: Real scenarios, case studies
   - Build Authority: Reference data, statistics (gunakan estimasi wajar untuk Indonesia)
   - Build Trust: Honest, balanced, helpful - jangan hype berlebihan

3. LOCAL SEO OPTIMIZATION:
   - Mention: {targetLocation} minimal 3-5 kali secara natural
   - Include: Landmark lokal, area populer di {targetLocation}
   - Add: Insight lokal (traffic, parkir, komunitas, regulasi setempat)
   - Konteks lokal: Iklim tropis, kondisi jalan Indonesia, budaya lokal

4. CONTENT STRUCTURE:
   - Introduction (100-150 kata):
     * Hook yang menarik perhatian
     * Overview singkat isi artikel
     * Mention lokasi dan konteks lokal

   - Body (800-1200 kata):
     * 3-5 H2 sections dengan H3 subsections
     * Gunakan bullet points dan numbering
     * Include practical tips dan actionable advice
     * Data/statistik yang relevan (estimasi wajar untuk market Indonesia)

   - Conclusion (100-150 kata):
     * Summary key points
     * Soft CTA ke showroom (jangan hard selling)

5. SPECIFIC REQUIREMENTS untuk {category}:
{categoryGuidelines}

6. CTA (Call-to-Action):
   - Soft mention showroom: "{tenantName} di {targetLocation}"
   - Include: "Kunjungi showroom kami", "Hubungi kami untuk informasi lebih lanjut"
   - NO hard selling, fokus pada value & informasi berguna
   - Natural integration dalam flow artikel

7. TONE & STYLE ({tone}):
{toneGuidelines}

8. FORMATTING:
   - Use HTML tags: <h2>, <h3>, <p>, <ul>, <ol>, <strong>, <em>
   - NO <h1> tag (will be used for title)
   - Add <br/> for readability where needed
   - Use <blockquote> for important tips or quotes

9. IMPORTANT RULES:
   - Content must be 100% original and unique
   - Avoid superlatif berlebihan ("terbaik di dunia", etc)
   - Fact-check: Gunakan data yang masuk akal untuk market Indonesia
   - NO plagiarism - jangan copy dari sumber manapun
   - Update information - assume tahun 2025

TOPIK: {topic}

OUTPUT FORMAT:
You MUST respond with VALID JSON ONLY. No additional text before or after the JSON.

IMPORTANT JSON RULES:
- Properly escape all double quotes inside strings using backslash: \\"
- Escape all backslashes: \\\\
- Escape newlines in strings: \\n
- Do NOT use single quotes
- Do NOT include comments in the JSON
- Ensure all strings are properly closed with double quotes

{{
  "title": "SEO-optimized title (maks 60 char, include keyword dan lokasi)",
  "slug": "url-friendly-slug-with-dashes",
  "metaDescription": "Compelling meta description 140-160 char dengan CTA",
  "content": "Full HTML content dengan proper headers dan formatting. Remember to escape all quotes!",
  "excerpt": "Summary singkat 150-200 karakter untuk preview",
  "keywords": ["keyword1", "keyword2", "keyword3"],
  "localKeywords": ["{targetLocation}", "area1", "area2"],
  "focusKeyword": "primary keyword from topic",
  "seoScore": 85,
  "wordCount": 1250,
  "readabilityScore": 65,
  "relatedTopics": ["topic1", "topic2", "topic3"]
}}`;

export class BlogAIService {
  private client: ZAIClient;

  constructor(client?: ZAIClient) {
    this.client = client || createZAIClient();
  }

  /**
   * Generate blog post using AI
   */
  async generateBlogPost(input: BlogGenerationInput): Promise<BlogGenerationResult> {
    const maxRetries = 2;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[BlogAI] Generation attempt ${attempt}/${maxRetries}`);

        // Build prompt with input data
        const prompt = this.buildPrompt(input);

        // Generate content with GLM-4-Plus
        const response = await this.client.generateText({
          systemPrompt: 'You are an expert SEO content writer for automotive industry in Indonesia. You MUST respond with VALID JSON only. Properly escape all quotes and special characters in JSON strings.',
          userPrompt: prompt,
          temperature: 0.7, // Balance between creativity and consistency
          maxTokens: 4000,
        });

        console.log('[BlogAI] Raw response length:', response.content.length);

        // Try to extract JSON if wrapped in markdown or text
        let jsonContent = response.content.trim();

        // Log first 200 chars for debugging
        console.log('[BlogAI] Response preview:', jsonContent.substring(0, 200));

        // Remove markdown code blocks
        if (jsonContent.includes('```')) {
          const jsonMatch = jsonContent.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
          if (jsonMatch) {
            jsonContent = jsonMatch[1];
          }
        }

        // Try to find JSON object boundaries
        const startIdx = jsonContent.indexOf('{');
        const lastIdx = jsonContent.lastIndexOf('}');

        if (startIdx !== -1 && lastIdx !== -1 && lastIdx > startIdx) {
          jsonContent = jsonContent.substring(startIdx, lastIdx + 1);
        }

        // Parse JSON response
        let result: BlogGenerationResult;
        try {
          result = JSON.parse(jsonContent);
        } catch (parseError) {
          console.error('[BlogAI] JSON parse error:', parseError);
          console.error('[BlogAI] Failed JSON content:', jsonContent.substring(0, 500));
          throw new Error(`Invalid JSON response from AI: ${parseError instanceof Error ? parseError.message : 'Parse failed'}`);
        }

        // Validate result
        this.validateResult(result);

        // Calculate actual metrics
        result.wordCount = this.calculateWordCount(result.content);
        result.readabilityScore = this.calculateReadability(result.content);
        result.seoScore = this.calculateSEOScore(result);

        console.log('[BlogAI] Generation successful');
        return result;

      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        console.error(`[BlogAI] Attempt ${attempt} failed:`, lastError.message);

        // Don't retry if it's a validation error
        if (lastError.message.includes('Missing required field')) {
          throw lastError;
        }

        // Retry for JSON parse errors
        if (attempt < maxRetries) {
          console.log(`[BlogAI] Retrying... (${attempt + 1}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s before retry
          continue;
        }
      }
    }

    // All retries failed
    throw new Error(
      `Failed to generate blog post after ${maxRetries} attempts: ${lastError?.message || 'Unknown error'}`
    );
  }

  /**
   * Build prompt with all context
   */
  private buildPrompt(input: BlogGenerationInput): string {
    const {
      category,
      topic,
      tone,
      targetLocation,
      tenantName = 'Showroom Kami',
      tenantAreas = [],
    } = input;

    return BLOG_GENERATION_PROMPT
      .replace(/{tenantName}/g, tenantName)
      .replace(/{targetLocation}/g, targetLocation)
      .replace(/{tenantAreas}/g, tenantAreas.join(', ') || targetLocation)
      .replace(/{tone}/g, tone)
      .replace(/{category}/g, category)
      .replace(/{topic}/g, topic)
      .replace(/{categoryGuidelines}/g, CATEGORY_GUIDELINES[category] || '')
      .replace(/{toneGuidelines}/g, TONE_GUIDELINES[tone] || '');
  }

  /**
   * Validate AI result
   */
  private validateResult(result: BlogGenerationResult): void {
    const requiredFields: (keyof BlogGenerationResult)[] = [
      'title',
      'slug',
      'metaDescription',
      'content',
      'excerpt',
      'keywords',
      'focusKeyword',
    ];

    for (const field of requiredFields) {
      if (!result[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    // Validate title length
    if (result.title.length > 70) {
      console.warn(`Title too long: ${result.title.length} characters`);
    }

    // Validate meta description length
    if (result.metaDescription.length < 140 || result.metaDescription.length > 170) {
      console.warn(`Meta description length not optimal: ${result.metaDescription.length} characters`);
    }

    // Validate content length
    const wordCount = this.calculateWordCount(result.content);
    if (wordCount < 800) {
      console.warn(`Content too short: ${wordCount} words`);
    }
  }

  /**
   * Calculate word count from HTML content
   */
  private calculateWordCount(htmlContent: string): number {
    // Remove HTML tags
    const text = htmlContent.replace(/<[^>]*>/g, ' ');
    // Count words
    const words = text.trim().split(/\s+/);
    return words.length;
  }

  /**
   * Calculate Flesch reading ease score (Indonesian approximation)
   */
  private calculateReadability(htmlContent: string): number {
    const text = htmlContent.replace(/<[^>]*>/g, ' ');
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const words = text.trim().split(/\s+/);
    const syllables = this.countSyllables(text);

    if (sentences.length === 0 || words.length === 0) return 0;

    // Simplified Flesch formula (adapted for Indonesian)
    const avgWordsPerSentence = words.length / sentences.length;
    const avgSyllablesPerWord = syllables / words.length;

    const score = 206.835 - (1.015 * avgWordsPerSentence) - (84.6 * avgSyllablesPerWord);

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Count syllables (simplified for Indonesian)
   */
  private countSyllables(text: string): number {
    // Indonesian vowels
    const vowels = /[aiueo]/gi;
    const matches = text.match(vowels);
    return matches ? matches.length : 0;
  }

  /**
   * Calculate SEO score based on various factors
   */
  private calculateSEOScore(result: BlogGenerationResult): number {
    let score = 0;

    // Title (20 points)
    if (result.title.length >= 50 && result.title.length <= 60) score += 20;
    else if (result.title.length >= 40 && result.title.length <= 70) score += 15;
    else score += 10;

    // Meta description (20 points)
    if (result.metaDescription.length >= 140 && result.metaDescription.length <= 160) score += 20;
    else if (result.metaDescription.length >= 120 && result.metaDescription.length <= 170) score += 15;
    else score += 10;

    // Word count (20 points)
    if (result.wordCount >= 1000 && result.wordCount <= 1500) score += 20;
    else if (result.wordCount >= 800 && result.wordCount <= 1800) score += 15;
    else score += 10;

    // Keywords (20 points)
    if (result.keywords.length >= 5 && result.keywords.length <= 10) score += 20;
    else score += 10;

    // Readability (20 points)
    if (result.readabilityScore >= 60) score += 20;
    else if (result.readabilityScore >= 50) score += 15;
    else score += 10;

    return Math.min(100, score);
  }

  /**
   * Generate slug from title
   */
  generateSlug(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }
}

// Export singleton instance
export const blogAIService = new BlogAIService();
