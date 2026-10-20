/**
 * Repository Contract Tests
 *
 * Runs the same test suite against both MemoryRepository and (when Appwrite
 * is configured) AppwriteRepository. Ensures the domain contract is honored
 * by both implementations.
 *
 * MemoryRepository tests run unconditionally. AppwriteRepository tests are
 * skipped unless APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, and APPWRITE_API_KEY
 * are set (G1 gate).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MemoryRepository } from '../src/db/memoryRepository.ts';
import { AppwriteRepository } from '../src/db/appwriteRepository.ts';
import type {
  Profile,
  Lesson,
  Card,
  PracticeSession,
  Streak,
  SpacedReview,
  ApiKeyRecord,
} from '../src/db/types.ts';

function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: `prof_${Date.now()}`,
    user_id: `user_${Date.now()}`,
    email: `user_${Date.now()}@example.com`,
    display_name: 'Test User',
    audience_preset: 'student',
    timezone: 'Africa/Nairobi',
    tier: 'free',
    age_confirmed: true,
    data_saver: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

function makeLesson(overrides: Partial<Lesson> = {}): Lesson {
  return {
    id: `les_${Date.now()}`,
    user_id: `user_${Date.now()}`,
    content_hash: 'hash_' + Date.now(),
    title: 'Test Lesson',
    summary: 'A test lesson summary',
    audience_preset: 'student',
    style: 'tldr',
    language: 'en',
    target_duration_minutes: 10,
    status: 'ready',
    audio_url: null,
    audio_duration_seconds: 600,
    tts_provider: 'gemini-3.8-flash-tts',
    script: [
      { speaker: 'Alex', text: 'Hello', sectionMarkerId: 'sec_1' },
      { speaker: 'Sam', text: '|yeah| Welcome', sectionMarkerId: 'sec_1' },
    ],
    sections: [
      { id: 'sec_1', title: 'Overview', start_second: 0, end_second: 600, summary: 'Overview', source_excerpt: 'Source text' },
    ],
    prompt_version: '2026-10-v1.0.0',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

function makeCard(overrides: Partial<Card> = {}): Card {
  return {
    id: `card_${Date.now()}`,
    lesson_id: `les_${Date.now()}`,
    user_id: `user_${Date.now()}`,
    headline: 'Test Card',
    insight: 'Test insight',
    actionable_takeaway: 'Test takeaway',
    source_section_pointer: 'Section 1',
    audio_timestamp_seconds: 30,
    card_order: 1,
    tags: ['student'],
    rating: null,
    edited: false,
    edited_at: null,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

interface RepoFixture {
  repo: any;
  cleanup: () => Promise<void>;
}

async function memoryFixture(): Promise<RepoFixture> {
  const repo = new MemoryRepository();
  return { repo, cleanup: async () => {} };
}

async function appwriteFixture(): Promise<RepoFixture | null> {
  const endpoint = process.env.APPWRITE_ENDPOINT;
  const projectId = process.env.APPWRITE_PROJECT_ID;
  const apiKey = process.env.APPWRITE_API_KEY;
  if (!endpoint || !projectId || !apiKey) {
    return null; // G1 not ready — skip
  }
  const repo = new AppwriteRepository(endpoint, projectId, apiKey);
  return { repo, cleanup: async () => {} };
}

function runContractTests(fixtureName: string, makeFixture: () => Promise<RepoFixture>) {
  if (!makeFixture) {
    describe(`Repository contract: ${fixtureName} (skipped — no Appwrite config)`, () => {
      it('skipped', () => {
        expect(true).toBe(true);
      });
    });
    return;
  }

  describe(`Repository contract: ${fixtureName}`, () => {
    let repo: any;
    let cleanup: () => Promise<void>;

    beforeEach(async () => {
      const f = await makeFixture();
      repo = f.repo;
      cleanup = f.cleanup;
    });

    afterEach(async () => {
      if (cleanup) await cleanup();
    });

    describe('Profiles', () => {
      it('should upsert and retrieve a profile', async () => {
        const profile = makeProfile({ user_id: 'user_profile_1', email: 'alice@example.edu' });
        await repo.upsertProfile(profile.user_id, { email: profile.email });

        const fetched = await repo.getProfile(profile.user_id);
        expect(fetched).not.toBeNull();
        expect(fetched?.email).toBe('alice@example.edu');
      });

      it('should find profile by email', async () => {
        const profile = makeProfile({ user_id: 'user_profile_2', email: 'bob@example.edu' });
        await repo.upsertProfile(profile.user_id, { email: profile.email });

        const found = await repo.getProfileByEmail('bob@example.edu');
        expect(found).not.toBeNull();
        expect(found?.user_id).toBe('user_profile_2');
      });

      it('should return null for unknown profile', async () => {
        const fetched = await repo.getProfile('user_nonexistent');
        expect(fetched).toBeNull();
      });
    });

    describe('Lessons', () => {
      it('should save and retrieve a lesson', async () => {
        const profile = makeProfile({ user_id: 'user_lesson_1' });
        await repo.upsertProfile(profile.user_id, { email: profile.email });

        const lesson = makeLesson({ user_id: 'user_lesson_1' });
        const saved = await repo.saveLesson('user_lesson_1', lesson);
        expect(saved.id).toBe(lesson.id);

        const fetched = await repo.getLesson('user_lesson_1', lesson.id);
        expect(fetched).not.toBeNull();
        expect(fetched?.title).toBe('Test Lesson');
      });

      it('should enforce RLS — user B cannot read user A lesson', async () => {
        const lesson = makeLesson({ user_id: 'user_lesson_a' });
        await repo.saveLesson('user_lesson_a', lesson);

        const result = await repo.getLesson('user_lesson_b', lesson.id);
        expect(result).toBeNull();
      });

      it('should list lessons for a user', async () => {
        const lesson1 = makeLesson({ user_id: 'user_list_1', id: 'les_list_1' });
        const lesson2 = makeLesson({ user_id: 'user_list_1', id: 'les_list_2' });
        await repo.saveLesson('user_list_1', lesson1);
        await repo.saveLesson('user_list_1', lesson2);

        const result = await repo.listLessons('user_list_1');
        expect(result.items.length).toBeGreaterThanOrEqual(2);
      });

      it('should find lesson by content hash', async () => {
        const lesson = makeLesson({ user_id: 'user_hash_1', content_hash: 'unique_hash_1' });
        await repo.saveLesson('user_hash_1', lesson);

        const found = await repo.findLessonByContentHash('user_hash_1', 'unique_hash_1');
        expect(found).not.toBeNull();
        expect(found?.content_hash).toBe('unique_hash_1');
      });

      it('should delete a lesson', async () => {
        const lesson = makeLesson({ user_id: 'user_delete_1' });
        await repo.saveLesson('user_delete_1', lesson);

        const deleted = await repo.deleteLesson('user_delete_1', lesson.id);
        expect(deleted).toBe(true);

        const fetched = await repo.getLesson('user_delete_1', lesson.id);
        expect(fetched).toBeNull();
      });
    });

    describe('Cards', () => {
      it('should save and retrieve cards for a lesson', async () => {
        const lesson = makeLesson({ user_id: 'user_cards_1' });
        await repo.saveLesson('user_cards_1', lesson);

        const card = makeCard({ lesson_id: lesson.id, user_id: 'user_cards_1' });
        const saved = await repo.saveCards('user_cards_1', [card]);
        expect(saved.length).toBe(1);

        const cards = await repo.getCardsForLesson('user_cards_1', lesson.id);
        expect(cards.length).toBe(1);
        expect(cards[0].headline).toBe('Test Card');
      });

      it('should rate a card', async () => {
        const lesson = makeLesson({ user_id: 'user_rate_1' });
        await repo.saveLesson('user_rate_1', lesson);
        const card = makeCard({ lesson_id: lesson.id, user_id: 'user_rate_1' });
        await repo.saveCards('user_rate_1', [card]);

        const rated = await repo.rateCard('user_rate_1', card.id, 'up');
        expect(rated.rating).toBe('up');
      });

      it('should edit a card', async () => {
        const lesson = makeLesson({ user_id: 'user_edit_1' });
        await repo.saveLesson('user_edit_1', lesson);
        const card = makeCard({ lesson_id: lesson.id, user_id: 'user_edit_1' });
        await repo.saveCards('user_edit_1', [card]);

        const updated = await repo.editCard('user_edit_1', card.id, {
          headline: 'Updated Headline',
        });
        expect(updated.headline).toBe('Updated Headline');
        expect(updated.edited).toBe(true);
      });
    });

    describe('Practice sessions', () => {
      it('should save and retrieve a practice session', async () => {
        const session: PracticeSession = {
          id: 'psess_test_1',
          user_id: 'user_practice_1',
          lesson_id: null,
          scenario_id: 'scen_stud_qa',
          scenario_title: 'Test Scenario',
          audience_preset: 'student',
          persona: 'Test Persona',
          mode: 'text',
          status: 'active',
          turns: [],
          final_scorecard: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        const saved = await repo.savePracticeSession('user_practice_1', session);
        expect(saved.id).toBe('psess_test_1');

        const fetched = await repo.getPracticeSession('user_practice_1', 'psess_test_1');
        expect(fetched).not.toBeNull();
        expect(fetched?.scenario_title).toBe('Test Scenario');
      });
    });

    describe('Streaks', () => {
      it('should get and update a streak', async () => {
        const streak: Streak = {
          id: 'streak_test_1',
          user_id: 'user_streak_1',
          current_streak: 0,
          longest_streak: 0,
          last_activity_local_date: '',
          freezes_available: 1,
          freezes_used_this_week: 0,
          freeze_last_reset_week: '2026-W42',
          updated_at: new Date().toISOString(),
        };

        const fetched = await repo.getStreak('user_streak_1');
        expect(fetched.current_streak).toBe(0);

        const updated = await repo.updateStreak('user_streak_1', {
          ...streak,
          current_streak: 5,
        });
        expect(updated.current_streak).toBe(5);
      });
    });

    describe('API keys', () => {
      it('should create and verify an API key', async () => {
        const key = await repo.createApiKey(
          'user_key_1',
          'Test Key',
          'stm_live_abcd1234',
          'hash_' + Date.now(),
          ['lessons:read', 'lessons:write']
        );
        expect(key.key_prefix).toBe('stm_live_abcd1234');
        expect(key.scopes).toContain('lessons:read');

        const verified = await repo.findApiKeyByHash(key.key_hash);
        expect(verified).not.toBeNull();
        expect(verified?.user_id).toBe('user_key_1');

        const keys = await repo.listApiKeys('user_key_1');
        expect(keys.length).toBeGreaterThanOrEqual(1);
      });

      it('should revoke an API key', async () => {
        const key = await repo.createApiKey(
          'user_key_2',
          'Revocable Key',
          'stm_live_revoke',
          'hash_revoke_' + Date.now(),
          ['lessons:read']
        );

        const revoked = await repo.revokeApiKey('user_key_2', key.id);
        expect(revoked).toBe(true);

        const keys = await repo.listApiKeys('user_key_2');
        expect(keys.find((k) => k.id === key.id)).toBeUndefined();
      });

      it('should store scopes correctly on API key', async () => {
        const key = await repo.createApiKey(
          'user_key_3',
          'Scoped Key',
          'stm_live_scope3',
          'hash_scope_' + Date.now(),
          ['lessons:read', 'cards:read', 'practice:write']
        );
        expect(key.scopes).toEqual(['lessons:read', 'cards:read', 'practice:write']);

        const verified = await repo.findApiKeyByHash(key.key_hash);
        expect(verified?.scopes).toContain('cards:read');
        expect(verified?.scopes).not.toContain('webhooks:manage');
      });
    });
  });
}

const hasAppwrite = !!(process.env.APPWRITE_ENDPOINT && process.env.APPWRITE_PROJECT_ID && process.env.APPWRITE_API_KEY);

runContractTests('MemoryRepository', memoryFixture);
if (hasAppwrite) {
  runContractTests('AppwriteRepository', appwriteFixture);
}

describe('MemoryRepository production guard', () => {
  it('should refuse to construct in production', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      // Fresh import to get a new class with isProd checked at construction
      const mod = await import('../src/db/memoryRepository.ts');
      expect(() => new mod.MemoryRepository()).toThrow(/production/);
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });
});
