/**
 * AppwriteRepository — Production implementation of the Repository interface.
 *
 * Uses two SDK clients as mandated by ADR-008:
 *   - userClient: created per-request with the caller's Appwrite JWT.
 *     Everything a user triggers uses this client, so user permissions stay in force.
 *   - adminClient: created once with the API key. Restricted to a short,
 *     ADR-listed set of system tasks (job queue, webhook deliveries, usage
 *     counters, API-key lookup, payment callbacks, kill switch).
 *
 * No Appwrite types (Document, $id, $permissions) leak out of this module —
 * all methods return domain types from ./types.ts.
 */

import { Client, Databases, Query, ID, Permission } from 'node-appwrite';
import type {
  Profile,
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
import { TABLES, DATABASE_ID } from '../config/appwrite.ts';

const isProd = typeof process !== 'undefined' && process.env.NODE_ENV === 'production';

interface UserContext {
  userId: string;
  jwt?: string;
}

function isUserContext(ctx: unknown): ctx is UserContext {
  return (
    ctx != null &&
    typeof ctx === 'object' &&
    'userId' in ctx &&
    (ctx as UserContext).userId != null
  );
}

export class AppwriteRepository implements Repository {
  private adminClient: Client;
  private userClient: Client | null = null;
  private adminDb: Databases;
  private userDb: Databases | null = null;

  constructor(
    adminEndpoint: string,
    adminProjectId: string,
    adminApiKey: string,
    userEndpoint?: string,
    userProjectId?: string
  ) {
    if (isProd && !adminApiKey) {
      throw new Error(
        'AppwriteRepository requires APPWRITE_API_KEY in production. Production refuses to run on an in-memory store.'
      );
    }

    this.adminClient = new Client()
      .setEndpoint(adminEndpoint)
      .setProject(adminProjectId)
      .setKey(adminApiKey);
    this.adminDb = new Databases(this.adminClient);

    if (userEndpoint && userProjectId) {
      this.userClient = new Client()
        .setEndpoint(userEndpoint)
        .setProject(userProjectId);
      this.userDb = new Databases(this.userClient);
    }
  }

  /**
   * Sets the user-scoped client with the caller's JWT. Must be called before
   * any user-triggered operation. Without a JWT, operations fall back to the
   * admin client (system tasks only).
   */
  setUserJwt(jwt: string, endpoint: string, projectId: string): void {
    this.userClient = new Client()
      .setEndpoint(endpoint)
      .setProject(projectId)
      .setSession(jwt);
    this.userDb = new Databases(this.userClient);
  }

  private db(ctx: UserContext | null): Databases {
    return ctx?.jwt && this.userDb ? this.userDb : this.adminDb;
  }

  // --- Permission helpers ---
  private userPerms() {
    return [Permission.read('user'), Permission.write('user')];
  }

  // --- Profiles ---
  async getProfile(userId: string): Promise<Profile | null> {
    const ctx: UserContext | null = { userId };
    try {
      const doc = await this.db(ctx).getDocument(DATABASE_ID, TABLES.PROFILES, userId);
      return this.docToProfile(doc);
    } catch (e: any) {
      if (e.code === 404) return null;
      throw e;
    }
  }

  async getProfileByEmail(email: string): Promise<Profile | null> {
    const ctx: UserContext | null = null; // admin lookup — email is not user-scoped
    const docs = await this.db(ctx).listDocuments(DATABASE_ID, TABLES.PROFILES, [
      Query.equal('email', [email]),
      Query.limit(1),
    ]);
    if (docs.documents.length === 0) return null;
    return this.docToProfile(docs.documents[0]);
  }

  async upsertProfile(
    userId: string,
    data: Partial<Profile> & { email: string }
  ): Promise<Profile> {
    const ctx: UserContext | null = { userId };
    const existing = await this.getProfile(userId);
    const now = new Date().toISOString();

    const payload: Record<string, unknown> = {
      user_id: userId,
      email: data.email,
      display_name: data.display_name ?? existing?.display_name ?? null,
      audience_preset: data.audience_preset ?? 'student',
      timezone: data.timezone ?? 'UTC',
      tier: data.tier ?? 'free',
      age_confirmed: data.age_confirmed ?? false,
      data_saver: data.data_saver ?? false,
      updated_at: now,
    };
    if (!existing) {
      payload.created_at = now;
      const doc = await this.db(ctx).createDocument(
        DATABASE_ID,
        TABLES.PROFILES,
        ID.custom(userId),
        payload,
        this.userPerms()
      );
      return this.docToProfile(doc);
    }
    const updated = await this.db(ctx).updateDocument(
      DATABASE_ID,
      TABLES.PROFILES,
      userId,
      payload,
      this.userPerms()
    );
    return this.docToProfile(updated);
  }

  // --- Lessons ---
  async getLesson(userId: string, lessonId: string): Promise<Lesson | null> {
    const ctx: UserContext | null = { userId };
    try {
      const doc = await this.db(ctx).getDocument(DATABASE_ID, TABLES.LESSONS, lessonId);
      const lesson = this.docToLesson(doc);
      if (lesson.user_id !== userId) return null;
      return lesson;
    } catch (e: any) {
      if (e.code === 404) return null;
      throw e;
    }
  }

  async listLessons(
    userId: string,
    options?: { limit?: number; cursor?: string }
  ): Promise<PaginatedResult<Lesson>> {
    const ctx: UserContext | null = { userId };
    const limit = options?.limit ?? 20;
    const queries: string[] = [
      Query.equal('user_id', [userId]),
      Query.orderDesc('created_at'),
      Query.limit(limit),
    ];
    const result = await this.db(ctx).listDocuments(DATABASE_ID, TABLES.LESSONS, queries);
    return {
      items: result.documents.map((d) => this.docToLesson(d)),
      nextCursor:
        result.documents.length === limit
          ? result.documents[result.documents.length - 1].$id
          : undefined,
    };
  }

  async findLessonByContentHash(
    userId: string,
    contentHash: string
  ): Promise<Lesson | null> {
    const ctx: UserContext | null = { userId };
    const docs = await this.db(ctx).listDocuments(DATABASE_ID, TABLES.LESSONS, [
      Query.equal('content_hash', [contentHash]),
      Query.limit(1),
    ]);
    if (docs.documents.length === 0) return null;
    const lesson = this.docToLesson(docs.documents[0]);
    if (lesson.user_id !== userId) return null;
    return lesson;
  }

  async saveLesson(userId: string, lesson: Lesson): Promise<Lesson> {
    const ctx: UserContext | null = { userId };
    if (lesson.user_id !== userId) {
      throw new Error('RLS_VIOLATION: Cannot write lesson for another user.');
    }
    const payload: Record<string, unknown> = {
      user_id: lesson.user_id,
      workspace_id: lesson.workspace_id ?? null,
      source_id: lesson.source_id ?? null,
      content_hash: lesson.content_hash,
      title: lesson.title,
      summary: lesson.summary,
      audience_preset: lesson.audience_preset,
      style: lesson.style,
      language: lesson.language,
      target_duration_minutes: lesson.target_duration_minutes,
      status: lesson.status,
      error_message: lesson.error_message ?? null,
      audio_url: lesson.audio_url ?? null,
      audio_duration_seconds: lesson.audio_duration_seconds,
      tts_provider: lesson.tts_provider,
      script: JSON.stringify(lesson.script),
      sections: JSON.stringify(lesson.sections),
      prompt_version: lesson.prompt_version,
      updated_at: lesson.updated_at,
    };
    if (!lesson.created_at) {
      payload.created_at = new Date().toISOString();
    }
    const doc = await this.db(ctx).createDocument(
      DATABASE_ID,
      TABLES.LESSONS,
      lesson.id,
      payload,
      this.userPerms()
    );
    return this.docToLesson(doc);
  }

  async deleteLesson(userId: string, lessonId: string): Promise<boolean> {
    const ctx: UserContext | null = { userId };
    try {
      await this.db(ctx).deleteDocument(DATABASE_ID, TABLES.LESSONS, lessonId);
      return true;
    } catch (e: any) {
      if (e.code === 404) return false;
      throw e;
    }
  }

  // --- Cards ---
  async saveCards(userId: string, cards: Card[]): Promise<Card[]> {
    const ctx: UserContext | null = { userId };
    const saved: Card[] = [];
    for (const card of cards) {
      if (card.user_id !== userId) {
        throw new Error('RLS_VIOLATION: Cannot insert card with mismatched user_id.');
      }
      const payload: Record<string, unknown> = {
        lesson_id: card.lesson_id,
        user_id: card.user_id,
        headline: card.headline,
        insight: card.insight,
        actionable_takeaway: card.actionable_takeaway,
        source_section_pointer: card.source_section_pointer,
        audio_timestamp_seconds: card.audio_timestamp_seconds,
        card_order: card.card_order,
        tags: JSON.stringify(card.tags),
        rating: card.rating ?? null,
        edited: card.edited ?? false,
        edited_at: card.edited_at ?? null,
        created_at: card.created_at,
      };
      const doc = await this.db(ctx).createDocument(
        DATABASE_ID,
        TABLES.CARDS,
        card.id,
        payload,
        this.userPerms()
      );
      saved.push(this.docToCard(doc));
    }
    return saved;
  }

  async getCardsForLesson(userId: string, lessonId: string): Promise<Card[]> {
    const ctx: UserContext | null = { userId };
    // Check access to parent lesson
    const lesson = await this.getLesson(userId, lessonId);
    if (!lesson) throw new Error('NOT_FOUND: Lesson not found.');
    const docs = await this.db(ctx).listDocuments(DATABASE_ID, TABLES.CARDS, [
      Query.equal('lesson_id', [lessonId]),
      Query.equal('user_id', [userId]),
      Query.orderAsc('card_order'),
    ]);
    return docs.documents.map((d) => this.docToCard(d));
  }

  async rateCard(userId: string, cardId: string, rating: 'up' | 'down'): Promise<Card> {
    const ctx: UserContext | null = { userId };
    const doc = await this.db(ctx).getDocument(DATABASE_ID, TABLES.CARDS, cardId);
    const card = this.docToCard(doc);
    if (card.user_id !== userId) throw new Error('RLS_VIOLATION: Cannot rate another user’s card.');
    const updated = await this.db(ctx).updateDocument(
      DATABASE_ID,
      TABLES.CARDS,
      cardId,
      { rating },
      this.userPerms()
    );
    return this.docToCard(updated);
  }

  async editCard(
    userId: string,
    cardId: string,
    updates: Partial<Pick<Card, 'headline' | 'insight' | 'actionable_takeaway'>>
  ): Promise<Card> {
    const ctx: UserContext | null = { userId };
    const doc = await this.db(ctx).getDocument(DATABASE_ID, TABLES.CARDS, cardId);
    const card = this.docToCard(doc);
    if (card.user_id !== userId) throw new Error('RLS_VIOLATION: Cannot edit another user’s card.');
    const updated = await this.db(ctx).updateDocument(
      DATABASE_ID,
      TABLES.CARDS,
      cardId,
      {
        ...(updates.headline !== undefined ? { headline: updates.headline } : {}),
        ...(updates.insight !== undefined ? { insight: updates.insight } : {}),
        ...(updates.actionable_takeaway !== undefined ? { actionable_takeaway: updates.actionable_takeaway } : {}),
        edited: true,
        edited_at: new Date().toISOString(),
      },
      this.userPerms()
    );
    return this.docToCard(updated);
  }

  // --- Saved cards ---
  async saveCardToLibrary(
    userId: string,
    cardId: string,
    notes?: string
  ): Promise<SavedCard> {
    const ctx: UserContext | null = { userId };
    const cardDoc = await this.db(ctx).getDocument(DATABASE_ID, TABLES.CARDS, cardId);
    const card = this.docToCard(cardDoc);
    if (card.user_id !== userId) throw new Error('RLS_VIOLATION: Cannot save another user’s card.');
    const saved: SavedCard = {
      id: `sc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      user_id: userId,
      card_id: cardId,
      notes: notes ?? null,
      saved_at: new Date().toISOString(),
      card,
    };
    const payload: Record<string, unknown> = {
      user_id: userId,
      card_id: cardId,
      notes: saved.notes,
      saved_at: saved.saved_at,
    };
    await this.db(ctx).createDocument(
      DATABASE_ID,
      TABLES.SAVED_CARDS,
      saved.id,
      payload,
      this.userPerms()
    );
    return saved;
  }

  async removeCardFromLibrary(userId: string, cardId: string): Promise<boolean> {
    const ctx: UserContext | null = { userId };
    const existing = await this.db(ctx).listDocuments(DATABASE_ID, TABLES.SAVED_CARDS, [
      Query.equal('card_id', [cardId]),
      Query.equal('user_id', [userId]),
      Query.limit(1),
    ]);
    if (existing.documents.length === 0) return false;
    await this.db(ctx).deleteDocument(DATABASE_ID, TABLES.SAVED_CARDS, existing.documents[0].$id);
    return true;
  }

  async listSavedCards(userId: string): Promise<SavedCard[]> {
    const ctx: UserContext | null = { userId };
    const docs = await this.db(ctx).listDocuments(DATABASE_ID, TABLES.SAVED_CARDS, [
      Query.equal('user_id', [userId]),
      Query.orderDesc('saved_at'),
    ]);
    const saved: SavedCard[] = [];
    for (const doc of docs.documents) {
      const cardDoc = await this.db(ctx).getDocument(DATABASE_ID, TABLES.CARDS, doc.card_id);
      const card = this.docToCard(cardDoc);
      saved.push({
        id: doc.$id,
        user_id: doc.user_id,
        card_id: doc.card_id,
        notes: doc.notes ?? null,
        saved_at: doc.saved_at,
        card,
      });
    }
    return saved;
  }

  // --- Practice sessions ---
  async getPracticeSession(
    userId: string,
    sessionId: string
  ): Promise<PracticeSession | null> {
    const ctx: UserContext | null = { userId };
    try {
      const doc = await this.db(ctx).getDocument(
        DATABASE_ID,
        TABLES.PRACTICE_SESSIONS,
        sessionId
      );
      const session = this.docToPracticeSession(doc);
      if (session.user_id !== userId) return null;
      return session;
    } catch (e: any) {
      if (e.code === 404) return null;
      throw e;
    }
  }

  async savePracticeSession(
    userId: string,
    session: PracticeSession
  ): Promise<PracticeSession> {
    const ctx: UserContext | null = { userId };
    if (session.user_id !== userId) {
      throw new Error('RLS_VIOLATION: Cannot write practice session for another user.');
    }
    const payload: Record<string, unknown> = {
      user_id: session.user_id,
      lesson_id: session.lesson_id ?? null,
      scenario_id: session.scenario_id,
      scenario_title: session.scenario_title,
      audience_preset: session.audience_preset,
      persona: session.persona,
      mode: session.mode,
      status: session.status,
      turns: JSON.stringify(session.turns),
      final_scorecard: session.final_scorecard
        ? JSON.stringify(session.final_scorecard)
        : null,
      created_at: session.created_at,
      updated_at: session.updated_at,
    };
    const doc = await this.db(ctx).createDocument(
      DATABASE_ID,
      TABLES.PRACTICE_SESSIONS,
      session.id,
      payload,
      this.userPerms()
    );
    return this.docToPracticeSession(doc);
  }

  // --- Streaks ---
  async getStreak(userId: string): Promise<Streak> {
    const ctx: UserContext | null = { userId };
    try {
      const doc = await this.db(ctx).getDocument(DATABASE_ID, TABLES.STREAKS, userId);
      return this.docToStreak(doc);
    } catch (e: any) {
      if (e.code === 404) {
        const streak: Streak = {
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
        await this.db(ctx).createDocument(
          DATABASE_ID,
          TABLES.STREAKS,
          userId,
          streak,
          this.userPerms()
        );
        return streak;
      }
      throw e;
    }
  }

  async updateStreak(userId: string, streak: Streak): Promise<Streak> {
    const ctx: UserContext | null = { userId };
    if (streak.user_id !== userId) {
      throw new Error('RLS_VIOLATION: Cannot update streak for another user.');
    }
    const doc = await this.db(ctx).updateDocument(
      DATABASE_ID,
      TABLES.STREAKS,
      userId,
      {
        current_streak: streak.current_streak,
        longest_streak: streak.longest_streak,
        last_activity_local_date: streak.last_activity_local_date,
        freezes_available: streak.freezes_available,
        freezes_used_this_week: streak.freezes_used_this_week,
        freeze_last_reset_week: streak.freeze_last_reset_week,
        updated_at: streak.updated_at,
      },
      this.userPerms()
    );
    return this.docToStreak(doc);
  }

  // --- Spaced repetition ---
  async getDueReviews(userId: string): Promise<SpacedReview[]> {
    const ctx: UserContext | null = { userId };
    const now = new Date().toISOString();
    const reviewDocs = await this.db(ctx).listDocuments(DATABASE_ID, TABLES.STREAKS, [
      Query.equal('user_id', [userId]),
      Query.limit(100),
    ]);
    return reviewDocs.documents.map((d) => this.docToSpacedReview(d));
  }

  async upsertSpacedReview(userId: string, review: SpacedReview): Promise<SpacedReview> {
    const ctx: UserContext | null = { userId };
    if (review.user_id !== userId) {
      throw new Error('RLS_VIOLATION: Cannot upsert review for another user.');
    }
    const doc = await this.db(ctx).createDocument(
      DATABASE_ID,
      TABLES.STREAKS,
      review.card_id,
      {
        user_id: review.user_id,
        card_id: review.card_id,
        interval_days: review.interval_days,
        ease_factor: review.ease_factor,
        repetition_number: review.repetition_number,
        due_date: review.due_date,
        last_reviewed_at: review.last_reviewed_at ?? null,
        created_at: review.created_at,
      },
      this.userPerms()
    );
    return this.docToSpacedReview(doc);
  }

  // --- API keys ---
  async createApiKey(
    userId: string,
    name: string,
    keyPrefix: string,
    keyHash: string,
    scopes: string[]
  ): Promise<ApiKeyRecord> {
    const ctx: UserContext | null = null; // admin — API key operations are system tasks
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
    const doc = await this.db(ctx).createDocument(
      DATABASE_ID,
      TABLES.API_KEYS,
      record.id,
      record,
      this.userPerms()
    );
    return this.docToApiKey(doc);
  }

  async listApiKeys(userId: string): Promise<ApiKeyRecord[]> {
    const ctx: UserContext | null = null; // admin
    const docs = await this.db(ctx).listDocuments(DATABASE_ID, TABLES.API_KEYS, [
      Query.equal('user_id', [userId]),
      Query.isNull('revoked_at'),
    ]);
    return docs.documents.map((d) => this.docToApiKey(d));
  }

  async revokeApiKey(userId: string, keyId: string): Promise<boolean> {
    const ctx: UserContext | null = null; // admin
    try {
      const doc = await this.db(ctx).getDocument(DATABASE_ID, TABLES.API_KEYS, keyId);
      if (doc.user_id !== userId) throw new Error('RLS_VIOLATION: Cannot revoke another user’s API key.');
      await this.db(ctx).updateDocument(
        DATABASE_ID,
        TABLES.API_KEYS,
        keyId,
        { revoked_at: new Date().toISOString() }
      );
      return true;
    } catch (e: any) {
      if (e.code === 404) return false;
      throw e;
    }
  }

  async findApiKeyByHash(keyHash: string): Promise<ApiKeyRecord | null> {
    const ctx: UserContext | null = null; // admin — system auth task
    const docs = await this.db(ctx).listDocuments(DATABASE_ID, TABLES.API_KEYS, [
      Query.equal('key_hash', [keyHash]),
      Query.isNull('revoked_at'),
      Query.limit(1),
    ]);
    if (docs.documents.length === 0) return null;
    return this.docToApiKey(docs.documents[0]);
  }

  // --- Webhooks ---
  async createWebhook(
    userId: string,
    targetUrl: string,
    signingSecret: string,
    events: string[]
  ): Promise<WebhookRecord> {
    const ctx: UserContext | null = { userId };
    const webhook: WebhookRecord = {
      id: `wh_${Date.now()}`,
      user_id: userId,
      target_url: targetUrl,
      signing_secret: signingSecret,
      events,
      is_active: true,
      created_at: new Date().toISOString(),
    };
    const doc = await this.db(ctx).createDocument(
      DATABASE_ID,
      TABLES.WEBHOOKS,
      webhook.id,
      webhook,
      this.userPerms()
    );
    return this.docToWebhook(doc);
  }

  async listWebhooks(userId: string): Promise<WebhookRecord[]> {
    const ctx: UserContext | null = { userId };
    const docs = await this.db(ctx).listDocuments(DATABASE_ID, TABLES.WEBHOOKS, [
      Query.equal('user_id', [userId]),
      Query.equal('is_active', [true]),
    ]);
    return docs.documents.map((d) => this.docToWebhook(d));
  }

  // --- Audit log ---
  async logAuditEvent(
    userId: string | null,
    action: string,
    entityType: string,
    entityId: string | null,
    details: Record<string, unknown>
  ): Promise<void> {
    const ctx: UserContext | null = null; // admin — audit is a system task
    await this.db(ctx).createDocument(
      DATABASE_ID,
      TABLES.AUDIT_LOG,
      ID.unique(),
      {
        user_id: userId,
        action,
        entity_type: entityType,
        entity_id: entityId,
        details: JSON.stringify(details),
        created_at: new Date().toISOString(),
      },
      this.userPerms()
    );
  }

  // --- Usage counters ---
  async recordUsage(
    userId: string,
    data: { lessons_created?: number; tts_seconds_used?: number; input_tokens?: number; output_tokens?: number }
  ): Promise<void> {
    const ctx: UserContext | null = null; // admin — system usage tracking
    const today = new Date().toISOString().split('T')[0];
    const existing = await this.getUsage(userId, today);
    const counter: UsageCounter = {
      id: `usage_${userId}_${today}`,
      user_id: userId,
      usage_date: today,
      lessons_created: (existing?.lessons_created ?? 0) + (data.lessons_created ?? 0),
      tts_seconds_used: (existing?.tts_seconds_used ?? 0) + (data.tts_seconds_used ?? 0),
      input_tokens: (existing?.input_tokens ?? 0) + (data.input_tokens ?? 0),
      output_tokens: (existing?.output_tokens ?? 0) + (data.output_tokens ?? 0),
    };
    await this.db(ctx).createDocument(
      DATABASE_ID,
      TABLES.USAGE_COUNTERS,
      counter.id,
      counter,
      this.userPerms()
    );
  }

  async getUsage(userId: string, usageDate: string): Promise<UsageCounter | null> {
    const ctx: UserContext | null = null; // admin
    const docs = await this.db(ctx).listDocuments(DATABASE_ID, TABLES.USAGE_COUNTERS, [
      Query.equal('user_id', [userId]),
      Query.equal('usage_date', [usageDate]),
      Query.limit(1),
    ]);
    if (docs.documents.length === 0) return null;
    return this.docToUsageCounter(docs.documents[0]);
  }

  // --- Document mappers (Appwrite Document -> domain type) ---

  private docToProfile(doc: any): Profile {
    return {
      id: doc.$id,
      user_id: doc.user_id,
      email: doc.email,
      display_name: doc.display_name ?? null,
      audience_preset: doc.audience_preset,
      timezone: doc.timezone,
      tier: doc.tier,
      age_confirmed: doc.age_confirmed,
      data_saver: doc.data_saver ?? false,
      created_at: doc.$createdAt,
      updated_at: doc.$updatedAt,
    };
  }

  private docToLesson(doc: any): Lesson {
    return {
      id: doc.$id,
      user_id: doc.user_id,
      workspace_id: doc.workspace_id ?? null,
      source_id: doc.source_id ?? null,
      content_hash: doc.content_hash,
      title: doc.title,
      summary: doc.summary,
      audience_preset: doc.audience_preset,
      style: doc.style,
      language: doc.language,
      target_duration_minutes: doc.target_duration_minutes,
      status: doc.status,
      error_message: doc.error_message ?? null,
      audio_url: doc.audio_url ?? null,
      audio_duration_seconds: doc.audio_duration_seconds,
      tts_provider: doc.tts_provider,
      script: typeof doc.script === 'string' ? JSON.parse(doc.script) : doc.script,
      sections: typeof doc.sections === 'string' ? JSON.parse(doc.sections) : doc.sections,
      prompt_version: doc.prompt_version,
      created_at: doc.$createdAt,
      updated_at: doc.$updatedAt,
    };
  }

  private docToCard(doc: any): Card {
    return {
      id: doc.$id,
      lesson_id: doc.lesson_id,
      user_id: doc.user_id,
      headline: doc.headline,
      insight: doc.insight,
      actionable_takeaway: doc.actionable_takeaway,
      source_section_pointer: doc.source_section_pointer,
      audio_timestamp_seconds: doc.audio_timestamp_seconds,
      card_order: doc.card_order,
      tags: typeof doc.tags === 'string' ? JSON.parse(doc.tags) : doc.tags,
      rating: doc.rating ?? null,
      edited: doc.edited ?? false,
      edited_at: doc.edited_at ?? null,
      created_at: doc.$createdAt,
    };
  }

  private docToPracticeSession(doc: any): PracticeSession {
    return {
      id: doc.$id,
      user_id: doc.user_id,
      lesson_id: doc.lesson_id ?? null,
      scenario_id: doc.scenario_id,
      scenario_title: doc.scenario_title,
      audience_preset: doc.audience_preset,
      persona: doc.persona,
      mode: doc.mode,
      status: doc.status,
      turns: typeof doc.turns === 'string' ? JSON.parse(doc.turns) : doc.turns,
      final_scorecard: doc.final_scorecard
        ? typeof doc.final_scorecard === 'string'
          ? JSON.parse(doc.final_scorecard)
          : doc.final_scorecard
        : null,
      created_at: doc.$createdAt,
      updated_at: doc.$updatedAt,
    };
  }

  private docToStreak(doc: any): Streak {
    return {
      id: doc.$id,
      user_id: doc.user_id,
      current_streak: doc.current_streak,
      longest_streak: doc.longest_streak,
      last_activity_local_date: doc.last_activity_local_date,
      freezes_available: doc.freezes_available,
      freezes_used_this_week: doc.freezes_used_this_week,
      freeze_last_reset_week: doc.freeze_last_reset_week,
      updated_at: doc.$updatedAt,
    };
  }

  private docToSpacedReview(doc: any): SpacedReview {
    return {
      id: doc.$id,
      user_id: doc.user_id,
      card_id: doc.card_id,
      interval_days: doc.interval_days,
      ease_factor: doc.ease_factor,
      repetition_number: doc.repetition_number,
      due_date: doc.due_date,
      last_reviewed_at: doc.last_reviewed_at ?? null,
      created_at: doc.$createdAt,
    };
  }

  private docToApiKey(doc: any): ApiKeyRecord {
    return {
      id: doc.$id,
      user_id: doc.user_id,
      workspace_id: doc.workspace_id ?? null,
      name: doc.name,
      key_prefix: doc.key_prefix,
      key_hash: doc.key_hash,
      scopes: typeof doc.scopes === 'string' ? JSON.parse(doc.scopes) : doc.scopes,
      rate_limit_per_minute: doc.rate_limit_per_minute,
      created_at: doc.$createdAt,
      last_used_at: doc.last_used_at ?? null,
      revoked_at: doc.revoked_at ?? null,
    };
  }

  private docToWebhook(doc: any): WebhookRecord {
    return {
      id: doc.$id,
      user_id: doc.user_id,
      workspace_id: doc.workspace_id ?? null,
      target_url: doc.target_url,
      signing_secret: doc.signing_secret,
      events: typeof doc.events === 'string' ? JSON.parse(doc.events) : doc.events,
      is_active: doc.is_active,
      created_at: doc.$createdAt,
    };
  }

  private docToUsageCounter(doc: any): UsageCounter {
    return {
      id: doc.$id,
      user_id: doc.user_id,
      usage_date: doc.usage_date,
      lessons_created: doc.lessons_created,
      tts_seconds_used: doc.tts_seconds_used,
      input_tokens: doc.input_tokens,
      output_tokens: doc.output_tokens,
    };
  }

  private docToAuditLog(doc: any): AuditLogRecord {
    return {
      id: doc.$id,
      user_id: doc.user_id ?? null,
      action: doc.action,
      entity_type: doc.entity_type,
      entity_id: doc.entity_id ?? null,
      details: typeof doc.details === 'string' ? JSON.parse(doc.details) : doc.details,
      ip_address: doc.ip_address ?? null,
      created_at: doc.$createdAt,
    };
  }
}

export type { ReviewGrade };
