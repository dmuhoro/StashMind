/**
 * StashMind Repository Layer
 * Enforces Row Level Security (RLS) isolation between users and workspaces.
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
import { AUDIENCE_PRESETS } from '../config/index.ts';

// In-Memory store simulating RLS-guarded Postgres tables
class StashMindStore {
  profiles = new Map<string, Profile>();
  workspaces = new Map<string, Workspace>();
  sources = new Map<string, Source>();
  lessons = new Map<string, Lesson>();
  cards = new Map<string, Card>();
  savedCards = new Map<string, SavedCard>();
  practiceSessions = new Map<string, PracticeSession>();
  streaks = new Map<string, Streak>();
  spacedReviews = new Map<string, SpacedReview>();
  usageCounters = new Map<string, UsageCounter>();
  apiKeys = new Map<string, ApiKeyRecord>();
  webhooks = new Map<string, WebhookRecord>();
  auditLogs: AuditLogRecord[] = [];

  constructor() {
    this.seedDefaultProfiles();
  }

  private seedDefaultProfiles() {
    const studentUser: Profile = {
      id: 'prof_student_001',
      user_id: 'user_student_demo',
      email: 'student@example.edu',
      display_name: 'Alex Rivera',
      audience_preset: AUDIENCE_PRESETS.STUDENT,
      timezone: 'America/New_York',
      tier: 'student',
      age_confirmed: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const proUser: Profile = {
      id: 'prof_pro_002',
      user_id: 'user_pro_demo',
      email: 'dan@example.com',
      display_name: 'Dan Walker',
      audience_preset: AUDIENCE_PRESETS.PROFESSIONAL,
      timezone: 'UTC',
      tier: 'pro',
      age_confirmed: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    this.profiles.set(studentUser.user_id, studentUser);
    this.profiles.set(proUser.user_id, proUser);

    // Initial streak records
    this.streaks.set(studentUser.user_id, {
      id: 'streak_student_001',
      user_id: studentUser.user_id,
      current_streak: 4,
      longest_streak: 12,
      last_activity_local_date: new Date().toISOString().split('T')[0],
      freezes_available: 1,
      freezes_used_this_week: 0,
      freeze_last_reset_week: '2026-W42',
      updated_at: new Date().toISOString(),
    });
  }
}

export class StashMindRepository {
  private store: StashMindStore;

  constructor(customStore?: StashMindStore) {
    this.store = customStore || new StashMindStore();
  }

  // --- Profile & RLS ---
  async getProfile(currentUserId: string): Promise<Profile | null> {
    return this.store.profiles.get(currentUserId) || null;
  }

  async getProfileByEmail(email: string): Promise<Profile | null> {
    for (const profile of this.store.profiles.values()) {
      if (profile.email === email) return profile;
    }
    return null;
  }

  async upsertProfile(
    currentUserId: string,
    data: Partial<Profile> & { email: string }
  ): Promise<Profile> {
    const existing = this.store.profiles.get(currentUserId);
    const now = new Date().toISOString();

    const profile: Profile = {
      id: existing ? existing.id : `prof_${Date.now()}`,
      user_id: currentUserId,
      email: data.email,
      display_name: data.display_name ?? existing?.display_name ?? null,
      audience_preset: data.audience_preset ?? existing?.audience_preset ?? AUDIENCE_PRESETS.STUDENT,
      timezone: data.timezone ?? existing?.timezone ?? 'UTC',
      tier: data.tier ?? existing?.tier ?? 'free',
      age_confirmed: data.age_confirmed ?? existing?.age_confirmed ?? false,
      created_at: existing ? existing.created_at : now,
      updated_at: now,
    };

    this.store.profiles.set(currentUserId, profile);
    return profile;
  }

  // --- Lessons with RLS ---
  async getLesson(currentUserId: string, lessonId: string): Promise<Lesson | null> {
    const lesson = this.store.lessons.get(lessonId);
    if (!lesson) return null;

    // RLS Enforcement: only owner or shared workspace
    if (lesson.user_id !== currentUserId) {
      throw new Error('RLS_VIOLATION: Access denied to lesson owned by another user.');
    }
    return lesson;
  }

  async listLessons(
    currentUserId: string,
    options?: { limit?: number; cursor?: string }
  ): Promise<{ items: Lesson[]; nextCursor?: string }> {
    const userLessons = Array.from(this.store.lessons.values())
      .filter((l) => l.user_id === currentUserId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const limit = options?.limit ?? 20;
    return { items: userLessons.slice(0, limit) };
  }

  async findLessonByContentHash(
    currentUserId: string,
    contentHash: string
  ): Promise<Lesson | null> {
    // User cache hit first
    for (const lesson of this.store.lessons.values()) {
      if (lesson.user_id === currentUserId && lesson.content_hash === contentHash) {
        return lesson;
      }
    }
    // Shared public cache hit (output transformation reuse)
    for (const lesson of this.store.lessons.values()) {
      if (lesson.content_hash === contentHash && lesson.status === 'ready') {
        return lesson;
      }
    }
    return null;
  }

  async saveLesson(currentUserId: string, lesson: Lesson): Promise<Lesson> {
    if (lesson.user_id !== currentUserId) {
      throw new Error('RLS_VIOLATION: Cannot write lesson for another user.');
    }
    this.store.lessons.set(lesson.id, lesson);
    return lesson;
  }

  async deleteLesson(currentUserId: string, lessonId: string): Promise<boolean> {
    const lesson = this.store.lessons.get(lessonId);
    if (!lesson) return false;
    if (lesson.user_id !== currentUserId) {
      throw new Error('RLS_VIOLATION: Cannot delete lesson owned by another user.');
    }
    this.store.lessons.delete(lessonId);
    // Cascade delete cards
    for (const [cardId, card] of this.store.cards.entries()) {
      if (card.lesson_id === lessonId) {
        this.store.cards.delete(cardId);
        this.store.savedCards.delete(cardId);
      }
    }
    return true;
  }

  // --- Cards & Saved Library with RLS ---
  async saveCards(currentUserId: string, cards: Card[]): Promise<Card[]> {
    for (const card of cards) {
      if (card.user_id !== currentUserId) {
        throw new Error('RLS_VIOLATION: Cannot insert card with mismatched user_id.');
      }
      this.store.cards.set(card.id, card);
    }
    return cards;
  }

  async getCardsForLesson(currentUserId: string, lessonId: string): Promise<Card[]> {
    // Check access to parent lesson first
    await this.getLesson(currentUserId, lessonId);

    return Array.from(this.store.cards.values())
      .filter((c) => c.lesson_id === lessonId && c.user_id === currentUserId)
      .sort((a, b) => a.card_order - b.card_order);
  }

  async saveCardToLibrary(
    currentUserId: string,
    cardId: string,
    notes?: string
  ): Promise<SavedCard> {
    const card = this.store.cards.get(cardId);
    if (!card) {
      throw new Error('NOT_FOUND: Card does not exist.');
    }
    if (card.user_id !== currentUserId) {
      throw new Error('RLS_VIOLATION: Cannot save another user’s card.');
    }

    const saved: SavedCard = {
      id: `sc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      user_id: currentUserId,
      card_id: cardId,
      notes: notes ?? null,
      saved_at: new Date().toISOString(),
      card,
    };
    this.store.savedCards.set(cardId, saved);
    return saved;
  }

  async removeCardFromLibrary(currentUserId: string, cardId: string): Promise<boolean> {
    const existing = this.store.savedCards.get(cardId);
    if (!existing) return false;
    if (existing.user_id !== currentUserId) {
      throw new Error('RLS_VIOLATION: Cannot delete another user’s saved card.');
    }
    this.store.savedCards.delete(cardId);
    return true;
  }

  async listSavedCards(currentUserId: string): Promise<SavedCard[]> {
    return Array.from(this.store.savedCards.values())
      .filter((sc) => sc.user_id === currentUserId)
      .map((sc) => ({
        ...sc,
        card: this.store.cards.get(sc.card_id),
      }))
      .filter((sc): sc is SavedCard & { card: Card } => sc.card !== undefined);
  }

  // --- Practice Sessions with RLS ---
  async getPracticeSession(
    currentUserId: string,
    sessionId: string
  ): Promise<PracticeSession | null> {
    const session = this.store.practiceSessions.get(sessionId);
    if (!session) return null;
    if (session.user_id !== currentUserId) {
      throw new Error('RLS_VIOLATION: Access denied to practice session.');
    }
    return session;
  }

  async savePracticeSession(
    currentUserId: string,
    session: PracticeSession
  ): Promise<PracticeSession> {
    if (session.user_id !== currentUserId) {
      throw new Error('RLS_VIOLATION: Cannot write practice session for another user.');
    }
    this.store.practiceSessions.set(session.id, session);
    return session;
  }

  // --- Retention & Streaks with Timezone ---
  async getStreak(currentUserId: string): Promise<Streak> {
    let streak = this.store.streaks.get(currentUserId);
    if (!streak) {
      streak = {
        id: `streak_${Date.now()}`,
        user_id: currentUserId,
        current_streak: 0,
        longest_streak: 0,
        last_activity_local_date: '',
        freezes_available: 1,
        freezes_used_this_week: 0,
        freeze_last_reset_week: '2026-W42',
        updated_at: new Date().toISOString(),
      };
      this.store.streaks.set(currentUserId, streak);
    }
    return streak;
  }

  async updateStreak(currentUserId: string, streak: Streak): Promise<Streak> {
    if (streak.user_id !== currentUserId) {
      throw new Error('RLS_VIOLATION: Cannot update streak for another user.');
    }
    this.store.streaks.set(currentUserId, streak);
    return streak;
  }

  // --- Spaced Repetition Reviews ---
  async getDueReviews(currentUserId: string): Promise<SpacedReview[]> {
    const now = new Date().toISOString();
    return Array.from(this.store.spacedReviews.values())
      .filter((sr) => sr.user_id === currentUserId && sr.due_date <= now)
      .map((sr) => ({
        ...sr,
        card: this.store.cards.get(sr.card_id),
      }))
      .filter((sr): sr is SpacedReview & { card: Card } => sr.card !== undefined);
  }

  async upsertSpacedReview(currentUserId: string, review: SpacedReview): Promise<SpacedReview> {
    if (review.user_id !== currentUserId) {
      throw new Error('RLS_VIOLATION: Cannot upsert review for another user.');
    }
    this.store.spacedReviews.set(review.card_id, review);
    return review;
  }

  // --- API Keys with Scopes & Hash ---
  async createApiKey(
    currentUserId: string,
    name: string,
    keyPrefix: string,
    keyHash: string,
    scopes: string[]
  ): Promise<ApiKeyRecord> {
    const record: ApiKeyRecord = {
      id: `key_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      user_id: currentUserId,
      name,
      key_prefix: keyPrefix,
      key_hash: keyHash,
      scopes,
      rate_limit_per_minute: 60,
      created_at: new Date().toISOString(),
    };
    this.store.apiKeys.set(record.id, record);
    return record;
  }

  async listApiKeys(currentUserId: string): Promise<ApiKeyRecord[]> {
    return Array.from(this.store.apiKeys.values()).filter(
      (k) => k.user_id === currentUserId && !k.revoked_at
    );
  }

  async revokeApiKey(currentUserId: string, keyId: string): Promise<boolean> {
    const key = this.store.apiKeys.get(keyId);
    if (!key) return false;
    if (key.user_id !== currentUserId) {
      throw new Error('RLS_VIOLATION: Cannot revoke another user’s API key.');
    }
    key.revoked_at = new Date().toISOString();
    return true;
  }

  async findApiKeyByHash(keyHash: string): Promise<ApiKeyRecord | null> {
    for (const key of this.store.apiKeys.values()) {
      if (key.key_hash === keyHash && !key.revoked_at) {
        return key;
      }
    }
    return null;
  }

  // --- Webhooks & Deliveries ---
  async createWebhook(
    currentUserId: string,
    targetUrl: string,
    signingSecret: string,
    events: string[]
  ): Promise<WebhookRecord> {
    const webhook: WebhookRecord = {
      id: `wh_${Date.now()}`,
      user_id: currentUserId,
      target_url: targetUrl,
      signing_secret: signingSecret,
      events,
      is_active: true,
      created_at: new Date().toISOString(),
    };
    this.store.webhooks.set(webhook.id, webhook);
    return webhook;
  }

  async listWebhooks(currentUserId: string): Promise<WebhookRecord[]> {
    return Array.from(this.store.webhooks.values()).filter(
      (w) => w.user_id === currentUserId && w.is_active
    );
  }

  // --- Audit Log ---
  async logAuditEvent(
    currentUserId: string | null,
    action: string,
    entityType: string,
    entityId: string | null,
    details: Record<string, unknown>
  ): Promise<void> {
    this.store.auditLogs.push({
      id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      user_id: currentUserId,
      action,
      entity_type: entityType,
      entity_id: entityId,
      details,
      created_at: new Date().toISOString(),
    });
  }

  // Global repository singleton
  static instance = new StashMindRepository();
}
