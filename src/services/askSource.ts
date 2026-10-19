/**
 * Ask the Source: Chat over a user's own material with citations and passage highlights.
 *
 * Given a lesson's source sections and a user question, generates an answer where
 * every claim is backed by a citation pointing to the exact source section.
 * This is the strongest trust feature for students: they can verify every answer
 * against their own material.
 */

import { GeminiService } from './gemini.ts';
import { CacheService } from './cache.ts';
import type { LessonSectionMarker } from '../db/types.ts';
import { MODELS } from '../config/index.ts';

export interface Citation {
  sectionId: string;
  sectionTitle: string;
  sourceExcerpt: string;
  relevance: string; // why this section supports the answer
}

export interface AskSourceResult {
  answer: string;
  citations: Citation[];
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Answers a question about a lesson's source material, with citations.
 * Falls back to deterministic extraction when Gemini is unavailable (test mode / no API key).
 */
export class AskSourceService {
  static async ask(
    question: string,
    sections: LessonSectionMarker[],
    lessonTitle: string
  ): Promise<AskSourceResult> {
    const contentHash = CacheService.computeContentHash(question, {
      audiencePreset: 'student',
      style: 'tldr',
      durationMinutes: 5,
      promptVersion: 'ask-source-v1',
    });

    const sectionsText = sections
      .map((s) => `[${s.id}] ${s.title}: ${s.source_excerpt}`)
      .join('\n\n');

    const systemInstruction = `You are a study assistant answering questions about a user's source material.
RULES:
1. Answer ONLY using the provided source sections. Never invent facts, quotes, or statistics.
2. Every claim in your answer MUST be backed by a citation to a specific source section.
3. Format citations as [section_id] referencing the section titles/excerpts provided.
4. If the source doesn't contain enough information to answer, say so candidly — do not guess.
5. Keep the answer concise and directly responsive to the question.
6. Include a "confidence" assessment: high (fully supported), medium (partially supported), or low (not supported by source).
7. Respond in JSON with keys: answer, citations (array of {sectionId, sectionTitle, sourceExcerpt, relevance}), confidence.`;

    const prompt = `LESSON TITLE: ${lessonTitle}

QUESTION: ${question}

SOURCE SECTIONS:
${sectionsText}

Answer the question using only the source sections above. Cite each claim with [section_id].`;

    const schema = {
      type: 'object',
      properties: {
        answer: { type: 'string' },
        citations: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              sectionId: { type: 'string' },
              sectionTitle: { type: 'string' },
              sourceExcerpt: { type: 'string' },
              relevance: { type: 'string' },
            },
            required: ['sectionId', 'sectionTitle', 'sourceExcerpt', 'relevance'],
          },
        },
        confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
      },
      required: ['answer', 'citations', 'confidence'],
    };

    try {
      const response = await GeminiService.generateStructuredJson<AskSourceResult & { citations: Citation[] }>({
        systemInstruction,
        prompt,
        schema,
        model: MODELS.FLASH,
      });

      return {
        answer: response.data.answer,
        citations: response.data.citations,
        confidence: response.data.confidence as 'high' | 'medium' | 'low',
      };
    } catch {
      // Deterministic fallback: find the most relevant section by simple keyword overlap
      const qWords = question.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
      const scored = sections.map((s) => {
        const text = (s.title + ' ' + s.source_excerpt).toLowerCase();
        const score = qWords.filter((w) => text.includes(w)).length;
        return { section: s, score };
      });
      scored.sort((a, b) => b.score - a.score);
      const best = scored[0];

      if (!best || best.score === 0) {
        return {
          answer: `I couldn't find information about "${question}" in your source material. The source may not cover this topic.`,
          citations: [],
          confidence: 'low',
        };
      }

      return {
        answer: `Based on "${best.section.title}", the source states: ${best.section.source_excerpt.slice(0, 300)}...`,
        citations: [
          {
            sectionId: best.section.id,
            sectionTitle: best.section.title,
            sourceExcerpt: best.section.source_excerpt,
            relevance: 'Best matching section by keyword overlap (deterministic fallback).',
          },
        ],
        confidence: 'medium',
      };
    }
  }
}
