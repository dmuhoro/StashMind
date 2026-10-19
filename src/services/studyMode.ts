/**
 * Study Mode: Turn notes or past papers into quiz + flashcards with Anki-compatible export.
 *
 * Students can paste exam notes or past papers and get:
 * - A set of quiz questions (multiple choice, generated from the material)
 * - Flashcards for spaced repetition review
 * - Anki-compatible CSV export
 */

import { IngestionService } from './ingestion.ts';
import { LessonEngine } from './lessonEngine.ts';
import { RetentionEngine } from './retentionEngine.ts';
import { StashMindRepository } from '../db/repository.ts';
import type { Card } from '../db/types.ts';
import { AUDIENCE_PRESETS } from '../config/index.ts';

export interface StudyQuizQuestion {
  cardId: string;
  question: string;
  answer: string;
  options: string[];
  sourceSection: string;
}

export interface StudySession {
  sessionId: string;
  sourceTitle: string;
  cards: Card[];
  quiz: StudyQuizQuestion[];
  ankiCsv: string;
}

/**
 * Creates a study session from raw source text: generates cards, builds a quiz,
 * and produces Anki-compatible CSV export.
 */
export class StudyModeService {
  static async createSession(
    userId: string,
    sourceText: string,
    sourceTitle: string
  ): Promise<StudySession> {
    // 1. Ingest the source text
    const ingested = IngestionService.ingestPastedText(sourceText, sourceTitle);

    // 2. Generate a lesson + cards from the source (student preset, tldr style, 10 min)
    const { lesson, cards } = await LessonEngine.generateLesson({
      userId,
      sourceText: ingested.text,
      sourceTitle: ingested.title,
      audiencePreset: AUDIENCE_PRESETS.STUDENT,
      style: 'tldr',
      durationMinutes: 10,
    });

    // 3. Save lesson + cards to repository
    await StashMindRepository.instance.saveLesson(userId, lesson);
    await StashMindRepository.instance.saveCards(userId, cards);

    // 4. Generate quiz questions from cards
    const quiz = RetentionEngine.generateQuizFromCards(cards);

    // 5. Generate Anki-compatible CSV export
    const ankiCsv = this.exportAnkiCsv(lesson, cards);

    return {
      sessionId: lesson.id,
      sourceTitle: lesson.title,
      cards,
      quiz,
      ankiCsv,
    };
  }

  /**
   * Exports cards as Anki-compatible CSV: Front, Back, SourcePointer, Tags.
   */
  private static exportAnkiCsv(lesson: { title: string }, cards: Card[]): string {
    const headers = ['Front', 'Back', 'SourcePointer', 'Tags'];
    const rows = [headers.join(',')];

    for (const card of cards) {
      const front = `"${card.headline}"`;
      const back = `"${card.insight}\n\n${card.actionable_takeaway}"`;
      const source = `"${card.source_section_pointer}"`;
      const tags = `"${card.tags.join(' ')}"`;
      rows.push([front, back, source, tags].join(','));
    }

    return rows.join('\n');
  }
}
