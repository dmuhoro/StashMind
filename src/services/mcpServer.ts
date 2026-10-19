/**
 * Model Context Protocol (MCP) Server
 * Follows Part C (Integration Contract) Section 4.
 * Exposes all StashMind capabilities as standard MCP tools for autonomous AI agents.
 */

import { StashMindRepository } from '../db/repository.ts';
import { IngestionService } from './ingestion.ts';
import { LessonEngine } from './lessonEngine.ts';
import { PracticeEngine, PRESET_SCENARIOS } from './practiceEngine.ts';
import { RetentionEngine, type ReviewGrade } from './retentionEngine.ts';
import { ExportEngine } from './exportEngine.ts';
import type { AudiencePreset, LessonStyle, LessonLengthMinutes } from '../config/index.ts';

export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export const MCP_TOOLS: McpToolDefinition[] = [
  {
    name: 'create_lesson',
    description: 'Ingest source content (text, URL, or YouTube) and generate a dual-host audio lesson with grounded cards.',
    inputSchema: {
      type: 'object',
      properties: {
        source_type: { type: 'string', enum: ['text', 'url', 'youtube'] },
        content: { type: 'string', description: 'Raw text or external URL' },
        title: { type: 'string' },
        preset: { type: 'string', enum: ['student', 'learner', 'professional'] },
        style: { type: 'string', enum: ['tldr', 'eli5', 'debate', 'deep_dive'] },
        duration_minutes: { type: 'number', enum: [5, 10, 20] },
      },
      required: ['source_type', 'content'],
    },
  },
  {
    name: 'get_lesson',
    description: 'Retrieve a lesson by ID, including its summary, section markers, host dialogue script, and cards.',
    inputSchema: {
      type: 'object',
      properties: {
        lesson_id: { type: 'string' },
      },
      required: ['lesson_id'],
    },
  },
  {
    name: 'list_cards',
    description: 'List grounded insight cards associated with a lesson.',
    inputSchema: {
      type: 'object',
      properties: {
        lesson_id: { type: 'string' },
      },
      required: ['lesson_id'],
    },
  },
  {
    name: 'search_library',
    description: 'Perform full-text search over saved cards and lesson summaries in the user’s library.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
      },
      required: ['query'],
    },
  },
  {
    name: 'save_card',
    description: 'Save an insight card to the user’s personal spaced-repetition library.',
    inputSchema: {
      type: 'object',
      properties: {
        card_id: { type: 'string' },
        notes: { type: 'string' },
      },
      required: ['card_id'],
    },
  },
  {
    name: 'start_practice',
    description: 'Start a roleplay practice session for a specified scenario or lesson.',
    inputSchema: {
      type: 'object',
      properties: {
        scenario_id: { type: 'string' },
        mode: { type: 'string', enum: ['text', 'voice'] },
      },
      required: ['scenario_id'],
    },
  },
  {
    name: 'submit_practice_turn',
    description: 'Submit a conversational turn in a practice session. Returns persona reply, <= 30-word feedback, and scores.',
    inputSchema: {
      type: 'object',
      properties: {
        session_id: { type: 'string' },
        user_input: { type: 'string' },
      },
      required: ['session_id', 'user_input'],
    },
  },
  {
    name: 'get_due_reviews',
    description: 'Retrieve flashcards currently due for spaced repetition review.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'grade_review',
    description: 'Grade a spaced repetition review (again, hard, good, easy) and recalculate the next due date.',
    inputSchema: {
      type: 'object',
      properties: {
        card_id: { type: 'string' },
        grade: { type: 'string', enum: ['again', 'hard', 'good', 'easy'] },
      },
      required: ['card_id', 'grade'],
    },
  },
  {
    name: 'export_deck',
    description: 'Export a lesson deck to Markdown, JSON, or CSV for Anki/Quizlet.',
    inputSchema: {
      type: 'object',
      properties: {
        lesson_id: { type: 'string' },
        format: { type: 'string', enum: ['md', 'json', 'csv'] },
      },
      required: ['lesson_id', 'format'],
    },
  },
  {
    name: 'get_usage',
    description: 'Retrieve current period usage counters, daily lesson quota, and spend status.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
];

export class McpServer {
  /**
   * Dispatches and executes an MCP tool call on behalf of an authenticated agent.
   */
  static async executeTool(
    userId: string,
    toolName: string,
    args: Record<string, unknown>
  ): Promise<{ result?: unknown; error?: string }> {
    try {
      switch (toolName) {
        case 'create_lesson': {
          const sourceType = args.source_type as 'text' | 'url' | 'youtube';
          const content = args.content as string;
          const title = (args.title as string) || 'MCP Generated Lesson';
          const preset = (args.preset as AudiencePreset) || 'student';
          const style = (args.style as LessonStyle) || 'tldr';
          const duration = (args.duration_minutes as LessonLengthMinutes) || 10;

          let ingested;
          if (sourceType === 'url') {
            ingested = await IngestionService.ingestArticleUrl(content);
          } else if (sourceType === 'youtube') {
            ingested = await IngestionService.ingestYouTubeUrl(content);
          } else {
            ingested = IngestionService.ingestPastedText(content, title);
          }

          const { lesson, cards } = await LessonEngine.generateLesson({
            userId,
            sourceText: ingested.text,
            sourceTitle: ingested.title,
            audiencePreset: preset,
            style,
            durationMinutes: duration,
          });

          await StashMindRepository.instance.saveLesson(userId, lesson);
          await StashMindRepository.instance.saveCards(userId, cards);

          return {
            result: {
              lesson_id: lesson.id,
              title: lesson.title,
              summary: lesson.summary,
              cards_count: cards.length,
              status: lesson.status,
            },
          };
        }

        case 'get_lesson': {
          const lessonId = args.lesson_id as string;
          const lesson = await StashMindRepository.instance.getLesson(userId, lessonId);
          if (!lesson) return { error: 'Lesson not found' };
          const cards = await StashMindRepository.instance.getCardsForLesson(userId, lessonId);
          return { result: { lesson, cards } };
        }

        case 'list_cards': {
          const lessonId = args.lesson_id as string;
          const cards = await StashMindRepository.instance.getCardsForLesson(userId, lessonId);
          return { result: { cards } };
        }

        case 'search_library': {
          const query = ((args.query as string) || '').toLowerCase();
          const saved = await StashMindRepository.instance.listSavedCards(userId);
          const matches = saved.filter(
            (s) =>
              s.card?.headline.toLowerCase().includes(query) ||
              s.card?.insight.toLowerCase().includes(query) ||
              s.card?.tags.some((t) => t.toLowerCase().includes(query))
          );
          return { result: { matches } };
        }

        case 'save_card': {
          const cardId = args.card_id as string;
          const notes = args.notes as string | undefined;
          const saved = await StashMindRepository.instance.saveCardToLibrary(userId, cardId, notes);
          return { result: { saved_card: saved } };
        }

        case 'start_practice': {
          const scenarioId = (args.scenario_id as string) || PRESET_SCENARIOS[0].id;
          const mode = (args.mode as 'text' | 'voice') || 'text';
          const session = PracticeEngine.startSession(userId, scenarioId, mode);
          await StashMindRepository.instance.savePracticeSession(userId, session);
          return { result: { session } };
        }

        case 'submit_practice_turn': {
          const sessionId = args.session_id as string;
          const userInput = args.user_input as string;
          const session = await StashMindRepository.instance.getPracticeSession(userId, sessionId);
          if (!session) return { error: 'Session not found' };

          const { turn, updatedSession } = await PracticeEngine.evaluateTurn(session, userInput);
          await StashMindRepository.instance.savePracticeSession(userId, updatedSession);
          return { result: { turn, session_status: updatedSession.status } };
        }

        case 'get_due_reviews': {
          const due = await StashMindRepository.instance.getDueReviews(userId);
          return { result: { due_count: due.length, reviews: due } };
        }

        case 'grade_review': {
          const cardId = args.card_id as string;
          const grade = args.grade as ReviewGrade;
          const existingReviews = await StashMindRepository.instance.getDueReviews(userId);
          const review = existingReviews.find((r) => r.card_id === cardId) || {
            id: `rev_${Date.now()}`,
            user_id: userId,
            card_id: cardId,
            interval_days: 1,
            ease_factor: 2.5,
            repetition_number: 0,
            due_date: new Date().toISOString(),
            created_at: new Date().toISOString(),
          };

          const updated = RetentionEngine.gradeReview(review, grade);
          await StashMindRepository.instance.upsertSpacedReview(userId, updated);
          return { result: { next_interval_days: updated.interval_days, next_due: updated.due_date } };
        }

        case 'export_deck': {
          const lessonId = args.lesson_id as string;
          const format = (args.format as 'md' | 'json' | 'csv') || 'md';
          const lesson = await StashMindRepository.instance.getLesson(userId, lessonId);
          if (!lesson) return { error: 'Lesson not found' };
          const cards = await StashMindRepository.instance.getCardsForLesson(userId, lessonId);

          let exportedContent: string;
          if (format === 'json') exportedContent = ExportEngine.exportToJson(lesson, cards);
          else if (format === 'csv') exportedContent = ExportEngine.exportToCsv(lesson, cards);
          else exportedContent = ExportEngine.exportToMarkdown(lesson, cards);

          return { result: { format, content: exportedContent } };
        }

        case 'get_usage': {
          const profile = await StashMindRepository.instance.getProfile(userId);
          const streak = await StashMindRepository.instance.getStreak(userId);
          return {
            result: {
              tier: profile?.tier ?? 'free',
              current_streak: streak.current_streak,
              freezes_available: streak.freezes_available,
              daily_lesson_cap: 5,
            },
          };
        }

        default:
          return { error: `Unrecognized MCP tool: ${toolName}` };
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { error: message };
    }
  }
}
