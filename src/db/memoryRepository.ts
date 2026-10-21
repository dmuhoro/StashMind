/**
 * In-Memory Repository — Tests only.
 *
 * Refuses to construct when NODE_ENV is production. Production must use
 * AppwriteRepository with real TablesDB. Never fall back to in-memory in
 * production — that would lose all data on restart and bypass user
 * permissions.
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
import {
  Repository,
  type PaginatedResult,
  type ReviewGrade,
} from './repository.ts';

class MemoryRepository implements Repository {
  constructor() {
    const isProd = typeof process !== 'undefined' && process.env.NODE_ENV === 'production';
    if (isProd) {
      throw new Error(
        'MemoryRepository refused to construct in production. Use AppwriteRepository with real TablesDB.'
      );
    }
  }

  // --- Profiles ---
  private profiles = new Map<string, Profile>();
  async getProfile(userId: string): Promise<Profile | null> {
    return this.profiles.get(userId) || null;
  }
  async getProfileByEmail(email: string): Promise<Profile | null> {
    for (const p of this.profiles.values()) {
      if (p.email === email) return p;
    }
    return null;
  }
  async upsertProfile(userId: string, data: Partial<Profile> & { email: string }): Promise<Profile> {
    const existing = this.profiles.get(userId);
    const now = new Date().toISOString();
    const profile: Profile = {
      id: existing?.id ?? `prof_${Date.now()}`,
      user_id: userId,
      email: data.email,
      display_name: data.display_name ?? existing?.display_name ?? null,
      audience_preset: data.audience_preset ?? 'student',
      timezone: data.timezone ?? 'UTC',
      tier: data.tier ?? 'free',
      age_confirmed: data.age_confirmed ?? false,
      data_saver: data.data_saver ?? false,
      created_at: existing?.created_at ?? now,
      updated_at: now,
    };
    this.profiles.set(userId, profile);
    return profile;
  }

  // --- Lessons ---
  private lessons = new Map<string, Lesson>();
  async getLesson(userId: string, lessonId: string): Promise<Lesson | null> {
    const lesson = this.lessons.get(lessonId);
    if (!lesson || lesson.user_id !== userId) return null;
    return lesson;
  }
  async listLessons(
    userId: string,
    options?: { limit?: number; cursor?: string }
  ): Promise<PaginatedResult<Lesson>> {
    const limit = options?.limit ?? 20;
    const items = Array.from(this.lessons.values())
      .filter((l) => l.user_id === userId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, limit);
    return { items };
  }
  async findLessonByContentHash(
    userId: string,
    contentHash: string
  ): Promise<Lesson | null> {
    for (const lesson of this.lessons.values()) {
      if (lesson.user_id === userId && lesson.content_hash === contentHash) {
        return lesson;
      }
    }
    return null;
  }
  async saveLesson(userId: string, lesson: Lesson): Promise<Lesson> {
    if (lesson.user_id !== userId) {
      throw new Error('RLS_VIOLATION: Cannot write lesson for another user.');
    }
    this.lessons.set(lesson.id, lesson);
    return lesson;
  }
  async deleteLesson(userId: string, lessonId: string): Promise<boolean> {
    const lesson = this.lessons.get(lessonId);
    if (!lesson || lesson.user_id !== userId) return false;
    this.lessons.delete(lessonId);
    return true;
  }

  // --- Cards ---
  private cards = new Map<string, Card>();
  async saveCards(userId: string, cards: Card[]): Promise<Card[]> {
    for (const card of cards) {
      if (card.user_id !== userId) {
        throw new Error('RLS_VIOLATION: Cannot insert card with mismatched user_id.');
      }
      this.cards.set(card.id, {
        ...card,
        rating: card.rating ?? null,
        edited: card.edited ?? false,
        edited_at: card.edited_at ?? null,
      });
    }
    return cards;
  }
  async getCardsForLesson(userId: string, lessonId: string): Promise<Card[]> {
    // Check access to parent lesson
    const lesson = await this.getLesson(userId, lessonId);
    if (!lesson) throw new Error('NOT_FOUND: Lesson not found.');
    return Array.from(this.cards.values())
      .filter((c) => c.lesson_id === lessonId && c.user_id === userId)
      .sort((a, b) => a.card_order - b.card_order);
  }
  async rateCard(userId: string, cardId: string, rating: 'up' | 'down'): Promise<Card> {
    const card = this.cards.get(cardId);
    if (!card) throw new Error('NOT_FOUND: Card does not exist.');
    if (card.user_id !== userId) throw new Error('RLS_VIOLATION: Cannot rate another user’s card.');
    const updated: Card = { ...card, rating };
    this.cards.set(cardId, updated);
    return updated;
  }
  async editCard(
    userId: string,
    cardId: string,
    updates: Partial<Pick<Card, 'headline' | 'insight' | 'actionable_takeaway'>>
  ): Promise<Card> {
    const card = this.cards.get(cardId);
    if (!card) throw new Error('NOT_FOUND: Card does not exist.');
    if (card.user_id !== userId) throw new Error('RLS_VIOLATION: Cannot edit another user’s card.');
    const updated: Card = {
      ...card,
      ...updates,
      edited: true,
      edited_at: new Date().toISOString(),
    };
    this.cards.set(cardId, updated);
    return updated;
  }

  // --- Saved cards ---
  private savedCards = new Map<string, SavedCard & { card?: Card }>();
  async saveCardToLibrary(userId: string, cardId: string, notes?: string): Promise<SavedCard> {
    const card = this.cards.get(cardId);
    if (!card) throw new Error('NOT_FOUND: Card does not exist.');
    if (card.user_id !== userId) throw new Error('RLS_VIOLATION: Cannot save another user’s card.');
    const saved: SavedCard = {
      id: `sc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      user_id: userId,
      card_id: cardId,
      notes: notes ?? null,
      saved_at: new Date().toISOString(),
      card,
    };
    this.savedCards.set(cardId, saved);
    return saved;
  }
  async removeCardFromLibrary(userId: string, cardId: string): Promise<boolean> {
    const existing = this.savedCards.get(cardId);
    if (!existing) return false;
    if (existing.user_id !== userId) throw new Error('RLS_VIOLATION: Cannot delete another user’s saved card.');
    this.savedCards.delete(cardId);
    return true;
  }
  async listSavedCards(userId: string): Promise<SavedCard[]> {
    return Array.from(this.savedCards.values())
      .filter((sc) => sc.user_id === userId)
      .map((sc) => ({ ...sc, card: this.cards.get(sc.card_id) }))
      .filter((sc): sc is SavedCard & { card: Card } => sc.card !== undefined);
  }

  // --- Practice sessions ---
  private practiceSessions = new Map<string, PracticeSession>();
  async getPracticeSession(userId: string, sessionId: string): Promise<PracticeSession | null> {
    const session = this.practiceSessions.get(sessionId);
    if (!session || session.user_id !== userId) return null;
    return session;
  }
  async savePracticeSession(userId: string, session: PracticeSession): Promise<PracticeSession> {
    if (session.user_id !== userId) {
      throw new Error('RLS_VIOLATION: Cannot write practice session for another user.');
    }
    this.practiceSessions.set(session.id, session);
    return session;
  }

  // --- Streaks ---
  private streaks = new Map<string, Streak>();
  async getStreak(userId: string): Promise<Streak> {
    let streak = this.streaks.get(userId);
    if (!streak) {
      streak = {
        id: `streak_${Date.now()}`,
        user_id: userId,
        current_streak: 0,
        longest_streak: 0,
        last_activity_local_date: '',
        freezes_available: 1,
        freezes_used_this_week: 0,
        freeze_last_reset_week: '2026-W42',
        updated_at: new Date().toISOString(),
      };
      this.streaks.set(userId, streak);
    }
    return streak;
  }
  async updateStreak(userId: string, streak: Streak): Promise<Streak> {
    if (streak.user_id !== userId) {
      throw new Error('RLS_VIOLATION: Cannot update streak for another user.');
    }
    this.streaks.set(userId, streak);
    return streak;
  }

  // --- Spaced repetition ---
  private spacedReviews = new Map<string, SpacedReview & { card?: Card }>();
  async getDueReviews(userId: string): Promise<SpacedReview[]> {
    const now = new Date().toISOString();
    return Array.from(this.spacedReviews.values())
      .filter((sr) => sr.user_id === userId && sr.due_date <= now)
      .map((sr) => ({ ...sr, card: this.cards.get(sr.card_id) }))
      .filter((sr): sr is SpacedReview & { card: Card } => sr.card !== undefined);
  }
  async upsertSpacedReview(userId: string, review: SpacedReview): Promise<SpacedReview> {
    if (review.user_id !== userId) {
      throw new Error('RLS_VIOLATION: Cannot upsert review for another user.');
    }
    this.spacedReviews.set(review.card_id, { ...review, card: this.cards.get(review.card_id) });
    return review;
  }

  // --- API keys ---
  private apiKeys = new Map<string, ApiKeyRecord>();
  async createApiKey(
    userId: string,
    name: string,
    keyPrefix: string,
    keyHash: string,
    scopes: string[]
  ): Promise<ApiKeyRecord> {
    const record: ApiKeyRecord = {
      id: `key_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      user_id: userId,
      name,
      key_prefix: keyPrefix,
      key_hash: keyHash,
      scopes,
      rate_limit_per_minute: 60,
      created_at: new Date().toISOString(),
    };
    this.apiKeys.set(record.id, record);
    return record;
  }
  async listApiKeys(userId: string): Promise<ApiKeyRecord[]> {
    return Array.from(this.apiKeys.values()).filter(
      (k) => k.user_id === userId && !k.revoked_at
    );
  }
  async revokeApiKey(userId: string, keyId: string): Promise<boolean> {
    const key = this.apiKeys.get(keyId);
    if (!key) return false;
    if (key.user_id !== userId) throw new Error('RLS_VIOLATION: Cannot revoke another user’s API key.');
    key.revoked_at = new Date().toISOString();
    return true;
  }
  async findApiKeyByHash(keyHash: string): Promise<ApiKeyRecord | null> {
    for (const key of this.apiKeys.values()) {
      if (key.key_hash === keyHash && !key.revoked_at) return key;
    }
    return null;
  }

  // --- Webhooks ---
  private webhooks = new Map<string, WebhookRecord>();
  async createWebhook(
    userId: string,
    targetUrl: string,
    signingSecret: string,
    events: string[]
  ): Promise<WebhookRecord> {
    const webhook: WebhookRecord = {
      id: `wh_${Date.now()}`,
      user_id: userId,
      target_url: targetUrl,
      signing_secret: signingSecret,
      events,
      is_active: true,
      created_at: new Date().toISOString(),
    };
    this.webhooks.set(webhook.id, webhook);
    return webhook;
  }
  async listWebhooks(userId: string): Promise<WebhookRecord[]> {
    return Array.from(this.webhooks.values()).filter(
      (w) => w.user_id === userId && w.is_active
    );
  }

  // --- Audit log ---
  private auditLogs: AuditLogRecord[] = [];
  async logAuditEvent(
    userId: string | null,
    action: string,
    entityType: string,
    entityId: string | null,
    details: Record<string, unknown>
  ): Promise<void> {
    this.auditLogs.push({
      id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      user_id: userId,
      action,
      entity_type: entityType,
      entity_id: entityId,
      details,
      created_at: new Date().toISOString(),
    });
  }

  // --- Usage counters ---
  private usageCounters = new Map<string, UsageCounter>();
  async recordUsage(
    userId: string,
    data: { lessons_created?: number; tts_seconds_used?: number; input_tokens?: number; output_tokens?: number }
  ): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    const existing = this.usageCounters.get(`${userId}:${today}`);
    const now = new Date().toISOString();
    const counter: UsageCounter = {
      id: `usage_${Date.now()}`,
      user_id: userId,
      usage_date: today,
      lessons_created: (existing?.lessons_created ?? 0) + (data.lessons_created ?? 0),
      tts_seconds_used: (existing?.tts_seconds_used ?? 0) + (data.tts_seconds_used ?? 0),
      input_tokens: (existing?.input_tokens ?? 0) + (data.input_tokens ?? 0),
      output_tokens: (existing?.output_tokens ?? 0) + (data.output_tokens ?? 0),
    };
    this.usageCounters.set(`${userId}:${today}`, counter);
  }
  async getUsage(userId: string, usageDate: string): Promise<UsageCounter | null> {
    return this.usageCounters.get(`${userId}:${usageDate}`) || null;
  }
}

export { MemoryRepository };
export type { ReviewGrade };

// Singleton for convenience in tests
export const memoryRepository = new MemoryRepository();
