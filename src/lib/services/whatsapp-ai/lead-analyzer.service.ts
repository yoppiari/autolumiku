/**
 * Lead Analyzer Service
 * Uses AI to analyze conversation sentiment and update Lead status
 */

import { prisma } from "@/lib/prisma";
import { LeadService } from "../leads/lead-service";
import { createZAIClient } from "@/lib/ai/zai-client";

interface AnalyzedLead {
    score: number;
    sentiment: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';
    buyingStage: 'AWARENESS' | 'INTEREST' | 'DESIRE' | 'ACTION';
    urgency: 'HIGH' | 'MEDIUM' | 'LOW';
    summary: string;
}

export class LeadAnalyzerService {
    /**
     * Analyze conversation and update lead status
     * Designed to be called as a background job
     */
    static async analyzeLead(leadId: string, tenantId: string) {
        try {
            // 1. Get recent conversation history
            const lead = await prisma.lead.findUnique({
                where: { id: leadId },
                include: {
                    whatsappConversations: {
                        include: {
                            messages: {
                                orderBy: { createdAt: 'desc' },
                                take: 10 // Analyze last 10 messages
                            }
                        }
                    }
                }
            });

            if (!lead || !lead.whatsappConversations.length) {
                return;
            }

            // Flatten messages from all linked conversations
            const messages = lead.whatsappConversations
                .flatMap(c => c.messages)
                .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()); // Sort ASC

            if (messages.length === 0) return;

            // 2. Format transcript for AI
            const transcript = messages.map(m =>
                `${m.senderType === 'customer' ? 'Customer' : 'AI'}: ${m.content}`
            ).join('\n');

            // 3. Call AI for analysis
            const analysis = await this.performAIAnalysis(transcript);

            if (analysis) {
                // 4. Update Lead
                await LeadService.updateLeadAnalysis(leadId, analysis);
                console.log(`[LeadAnalyzer] Analyzed Lead ${leadId}: Score ${analysis.score}, Stage ${analysis.buyingStage}`);
            }

        } catch (error) {
            console.error('[LeadAnalyzer] Error analyzing lead:', error);
        }
    }

    /**
     * Perform AI Analysis using Z.ai / LLM
     */
    private static async performAIAnalysis(transcript: string): Promise<AnalyzedLead | null> {
        try {
            const zai = createZAIClient();

            const prompt = `
        Analyze this car showroom sales conversation. 
        Determine the lead's quality based on their interest/intent.

        Conversation:
        ${transcript}

        Return ONLY a JSON object with this format:
        {
          "score": number (0-100),
          "sentiment": "POSITIVE" | "NEUTRAL" | "NEGATIVE",
          "buyingStage": "AWARENESS" | "INTEREST" | "DESIRE" | "ACTION",
          "urgency": "HIGH" | "MEDIUM" | "LOW",
          "summary": "1 sentence logic for the score"
        }
      `;

            const response = await zai.chat.completions.create({
                model: "glm-4", // Use standard model for analysis
                messages: [
                    { role: "system", content: "You are a senior sales manager expert in lead scoring." },
                    { role: "user", content: prompt }
                ],
                temperature: 0.1, // Low temp for consistent JSON
                response_format: { type: "json_object" }
            });

            const content = response.choices[0].message.content;
            if (!content) return null;

            return JSON.parse(content) as AnalyzedLead;

        } catch (error) {
            console.error('[LeadAnalyzer] AI Generation failed:', error);
            return null;
        }
    }
}
