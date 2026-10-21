/**
 * StashMind Domain Repository Interface
 *
 * Domain-level contract with no Appwrite types leaking out. All methods
 * enforce user-scoped access: every write checks that the caller owns the
 * resource they are touching.
 *
 * Implementations:
 *   - AppwriteRepository (src/db/appwriteRepository.ts) — production, uses Appwrite TablesDB
 *   - MemoryRepository (src/db/memoryRepository.ts) — tests only, refuses NODE_ENV=production
 */

import type {
  Profile,
  Workspace,
  Source,
  Lesson,
  Card,
  SavedCard,
  PracticeSession,
  Streak,
  SpacedReview,
  UsageCounter,
  ApiKeyRecord,
  WebhookRecord,
  AuditLogRecord,
} from './types.ts';
import { MemoryRepository } from './memoryRepository.ts';

export interface PaginatedResult<T> {
  items: T[];
  nextCursor?: string;
}

export type ReviewGrade = 'again' | 'hard' | 'good' | 'easy';

export interface Repository {
  // --- Profiles ---
  getProfile(userId: string): Promise<Profile | null>;
  getProfileByEmail(email: string): Promise<Profile | null>;
  upsertProfile(
    userId: string,
    data: Partial<Profile> & { email: string }
  ): Promise<Profile>;

  // --- Lessons ---
  getLesson(userId: string, lessonId: string): Promise<Lesson | null>;
  listLessons(
    userId: string,
    options?: { limit?: number; cursor?: string }
  ): Promise<PaginatedResult<Lesson>>;
  findLessonByContentHash(
    userId: string,
    contentHash: string
  ): Promise<Lesson | null>;
  saveLesson(userId: string, lesson: Lesson): Promise<Lesson>;
  deleteLesson(userId: string, lessonId: string): Promise<boolean>;

  // --- Cards ---
  saveCards(userId: string, cards: Card[]): Promise<Card[]>;
  getCardsForLesson(userId: string, lessonId: string): Promise<Card[]>;
  rateCard(userId: string, cardId: string, rating: 'up' | 'down'): Promise<Card>;
  editCard(
    userId: string,
    cardId: string,
    updates: Partial<Pick<Card, 'headline' | 'insight' | 'actionable_takeaway'>>
  ): Promise<Card>;

  // --- Saved cards ---
  saveCardToLibrary(
    userId: string,
    cardId: string,
    notes?: string
  ): Promise<SavedCard>;
  removeCardFromLibrary(userId: string, cardId: string): Promise<boolean>;
  listSavedCards(userId: string): Promise<SavedCard[]>;

  // --- Practice sessions ---
  getPracticeSession(
    userId: string,
    sessionId: string
  ): Promise<PracticeSession | null>;
  savePracticeSession(
    userId: string,
    session: PracticeSession
  ): Promise<PracticeSession>;

  // --- Streaks ---
  getStreak(userId: string): Promise<Streak>;
  updateStreak(userId: string, streak: Streak): Promise<Streak>;

  // --- Spaced repetition ---
  getDueReviews(userId: string): Promise<SpacedReview[]>;
  upsertSpacedReview(userId: string, review: SpacedReview): Promise<SpacedReview>;

  // --- API keys ---
  createApiKey(
    userId: string,
    name: string,
    keyPrefix: string,
    keyHash: string,
    scopes: string[]
  ): Promise<ApiKeyRecord>;
  listApiKeys(userId: string): Promise<ApiKeyRecord[]>;
  revokeApiKey(userId: string, keyId: string): Promise<boolean>;
  findApiKeyByHash(keyHash: string): Promise<ApiKeyRecord | null>;

  // --- Webhooks ---
  createWebhook(
    userId: string,
    targetUrl: string,
    signingSecret: string,
    events: string[]
  ): Promise<WebhookRecord>;
  listWebhooks(userId: string): Promise<WebhookRecord[]>;

  // --- Audit log ---
  logAuditEvent(
    userId: string | null,
    action: string,
    entityType: string,
    entityId: string | null,
    details: Record<string, unknown>
  ): Promise<void>;

  // --- Usage counters ---
  recordUsage(
    userId: string,
    data: {
      lessons_created?: number;
      tts_seconds_used?: number;
      input_tokens?: number;
      output_tokens?: number;
    }
  ): Promise<void>;
  getUsage(userId: string, usageDate: string): Promise<UsageCounter | null>;
}

export type { Profile, Workspace, Source, Lesson, Card, SavedCard, PracticeSession, Streak, SpacedReview, UsageCounter, ApiKeyRecord, WebhookRecord, AuditLogRecord };
export type ReviewGradeType = ReviewGrade;

// Singleton instance for backward compatibility — MemoryRepository throws in production.
// Production code must inject AppwriteRepository instead.
export const StashMindRepository = {
  instance: new MemoryRepository(),
};
