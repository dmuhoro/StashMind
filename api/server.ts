/**
 * Vercel serverless entrypoint for StashMind (self-contained).
 *
 * Imports only npm dependencies (express, rate-limit, jsonwebtoken, crypto)
 * — no imports from project source outside api/, so @vercel/node can bundle it.
 * All route logic is inline; the local dev server (server.ts) still uses src/.
 */

import express from 'express';
import rateLimit from 'express-rate-limit';
import { sign, verify } from 'jsonwebtoken';
import { createHash, createHmac, timingSafeEqual } from 'crypto';

/*───────────────────────── in-memory repository (Map-based) ─────────────────────────*/

type Tier = 'free' | 'student' | 'pro' | 'team';
type LessonStatus = 'pending' | 'processing' | 'ready' | 'failed';

interface Profile {
  id: string; user_id: string; email: string; display_name: string | null;
  audience_preset: string; timezone: string; tier: Tier; age_confirmed: boolean;
  data_saver: boolean; created_at: string; updated_at: string;
}
interface Lesson {
  id: string; user_id: string; source_id: string | null; content_hash: string;
  title: string; summary: string; audience_preset: string; style: string;
  target_duration_minutes: number; language: string; status: LessonStatus;
  error_message: string | null; audio_url: string | null;
  audio_duration_seconds: number; tts_provider: string;
  script: any[]; sections: any[]; prompt_version: string;
  created_at: string; updated_at: string;
}
interface Card {
  id: string; lesson_id: string; user_id: string; headline: string;
  insight: string; actionable_takeaway: string; source_section_pointer: string;
  audio_timestamp_seconds: number; card_order: number; tags: string[];
  rating: 'up' | 'down' | null; edited: boolean; edited_at: string | null;
  created_at: string;
}
interface PracticeSession {
  id: string; user_id: string; lesson_id: string | null; scenario_id: string;
  scenario_title: string; audience_preset: string; persona: string;
  mode: string; status: string; turns: any[];
  final_scorecard: any | null; created_at: string; updated_at: string;
}

const store = {
  profiles: new Map<string, Profile>(),
  lessons: new Map<string, Lesson>(),
  cards: new Map<string, Card>(),
  savedCards: new Map<string, Card>(),
  practiceSessions: new Map<string, PracticeSession>(),
  apiKeys: new Map<string, any>(),
  webhooks: new Map<string, any>(),
  auditLogs: [] as any[],
};

const now = () => new Date().toISOString();

function getProfile(userId: string): Profile | null {
  return store.profiles.get(userId) ?? null;
}
function upsertProfile(userId: string, data: Partial<Profile> & { email: string }): Profile {
  const existing = store.profiles.get(userId);
  const profile: Profile = {
    id: existing?.id ?? `prof_${Date.now()}`, user_id: userId, email: data.email,
    display_name: data.display_name ?? existing?.display_name ?? null,
    audience_preset: data.audience_preset ?? 'student',
    timezone: data.timezone ?? 'UTC', tier: data.tier ?? 'free',
    age_confirmed: data.age_confirmed ?? false,
    data_saver: data.data_saver ?? false,
    created_at: existing?.created_at ?? now(), updated_at: now(),
  };
  store.profiles.set(userId, profile);
  return profile;
}
function saveLesson(userId: string, lesson: Lesson) {
  if (lesson.user_id !== userId) throw new Error('RLS_VIOLATION');
  store.lessons.set(lesson.id, lesson);
  return lesson;
}
function getLesson(userId: string, id: string): Lesson | null {
  const l = store.lessons.get(id);
  if (!l || l.user_id !== userId) return null;
  return l;
}
function listLessons(userId: string, limit = 20): Lesson[] {
  return [...store.lessons.values()].filter((l) => l.user_id === userId)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, limit);
}
function saveCards(userId: string, cards: Card[]) {
  for (const c of cards) {
    if (c.user_id !== userId) throw new Error('RLS_VIOLATION');
    store.cards.set(c.id, { ...c, rating: c.rating ?? null, edited: c.edited ?? false, edited_at: c.edited_at ?? null });
  }
  return cards;
}
function getCardsForLesson(userId: string, lessonId: string): Card[] {
  const lesson = getLesson(userId, lessonId);
  if (!lesson) throw new Error('RLS_VIOLATION');
  return [...store.cards.values()].filter((c) => c.lesson_id === lessonId && c.user_id === userId)
    .sort((a, b) => a.card_order - b.card_order);
}
function saveCardToLibrary(userId: string, cardId: string, notes?: string) {
  const card = store.cards.get(cardId);
  if (!card) throw new Error('NOT_FOUND');
  if (card.user_id !== userId) throw new Error('RLS_VIOLATION');
  const saved: any = { id: `sc_${Date.now()}`, user_id: userId, card_id: cardId, notes: notes ?? null, saved_at: now(), card };
  store.savedCards.set(cardId, saved);
  return saved;
}
function startSession(userId: string, scenarioId: string, mode: string): PracticeSession {
  const scenarios: any[] = [
    { id: 'scen_prof_raise', title: 'Negotiating a Compensation Adjustment', audiencePreset: 'professional', persona: 'Executive VP of People Operations', initialPrompt: 'Thanks for scheduling this time. What specific adjustment are you looking for?' },
    { id: 'scen_prof_deadline', title: 'Pushing Back on an Unrealistic Deadline', audiencePreset: 'professional', persona: 'Product Director', initialPrompt: 'We need this feature shipped before the demo. How are we hitting this timeline?' },
    { id: 'scen_stud_qa', title: 'Class Presentation Thesis Defense Q&A', audiencePreset: 'student', persona: 'Professor of Economics', initialPrompt: 'Your findings rely on a small sample size. Why should we view your correlation as valid?' },
    { id: 'scen_learn_pitch', title: '60-Second Intellectual Elevator Pitch', audiencePreset: 'learner', persona: 'Curious Podcast Host', initialPrompt: 'Explain a complex concept without buzzwords.' },
  ];
  const scenario = scenarios.find((s) => s.id === scenarioId) ?? scenarios[0];
  const session: PracticeSession = {
    id: `psess_${Date.now()}`, user_id: userId, scenario_id: scenario.id,
    scenario_title: scenario.title, audience_preset: scenario.audiencePreset,
    persona: scenario.persona, mode, status: 'active',
    turns: [{ id: 'pturn_0', turn_number: 0, user_input: '', agent_reply: scenario.initialPrompt, feedback: 'Session initiated.', clarity_score: 100, tone_score: 100, structure_score: 100, timestamp: now() }],
    created_at: now(), updated_at: now(), final_scorecard: null,
    lesson_id: null,
  };
  store.practiceSessions.set(session.id, session);
  return session;
}

/*───────────────────────── auth ─────────────────────────*/
const JWT_SECRET = process.env.JWT_ACCESS_SECRET || 'dev-secret-change-me';
function signToken(userId: string, email: string, tier: Tier) {
  return sign({ userId, email, tier }, JWT_SECRET, { expiresIn: '15m' });
}
function verifyToken(token: string): { userId: string; email: string; tier: Tier } | null {
  try { return verify(token, JWT_SECRET) as any; } catch { return null; }
}

/*───────────────────────── express app ─────────────────────────*/
const app = express();
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

app.use('/api/v1', rateLimit({ windowMs: 15 * 60 * 1000, max: 100, standardHeaders: true, legacyHeaders: false }));
app.use('/api/v1/lessons', rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false }));
app.use('/api/v1/mcp', rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false }));

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Idempotency-Key, X-StashMind-User-Id');
  if (req.method === 'OPTIONS') { res.sendStatus(204); return; }
  next();
});

function auth(req: any, res: any): string | null {
  const h = req.headers.authorization;
  if (!h || !h.startsWith('Bearer ')) {
    res.status(401).json({ error: { code: 'MISSING_CREDENTIALS', message: 'Authentication required.' } });
    return null;
  }
  const token = h.replace(/^Bearer\s+/, '').trim();
  if (token.startsWith('stm_')) {
    // API key - accept any stm_ key in serverless mode
    return 'user_serverless';
  }
  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token.' } });
    return null;
  }
  return payload.userId;
}

/*───────────────────────── routes ─────────────────────────*/
app.get('/api/v1/health', (_req, res) => {
  res.json({ status: 'ok', version: '1.0.0', timestamp: now() });
});

app.get('/api/v1/openapi.json', (_req, res) => {
  res.json({ openapi: '3.1.0', info: { title: 'StashMind Public REST API', version: '1.0.0' } });
});

app.get('/api/v1/me', (req, res) => {
  const userId = auth(req, res);
  if (!userId) return;
  let profile = getProfile(userId);
  if (!profile) {
    profile = upsertProfile(userId, { email: `${userId}@example.com` });
  }
  res.json(profile);
});

app.post('/api/v1/auth/signup', (req, res) => {
  const { email, password, age_confirmed } = req.body;
  if (!email || !password) { res.status(400).json({ error: { code: 'MISSING_FIELDS', message: 'Email and password required.' } }); return; }
  if (age_confirmed !== true) { res.status(403).json({ error: { code: 'AGE_GATE_REQUIRED', message: 'Age gate required.' } }); return; }
  const userId = `user_${Date.now()}`;
  const profile = upsertProfile(userId, { email, age_confirmed: true });
  res.status(201).json({ user: profile, tokens: { accessToken: signToken(userId, email, 'free') } });
});

app.post('/api/v1/auth/login', (req, res) => {
  const { email, password } = req.body;
  const profile = [...store.profiles.values()].find((p) => p.email === email);
  if (!profile) { res.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid credentials.' } }); return; }
  res.json({ user: profile, tokens: { accessToken: signToken(profile.user_id, profile.email, profile.tier) } });
});

app.post('/api/v1/lessons', async (req, res) => {
  const userId = auth(req, res);
  if (!userId) return;
  const { source_type, content, title, preset, style, duration_minutes } = req.body;
  if (!source_type || !content) { res.status(400).json({ error: { code: 'MISSING_SOURCE', message: 'source_type and content required.' } }); return; }
  try {
    const lesson: Lesson = {
      id: `les_${Date.now()}`, user_id: userId, source_id: null, content_hash: createHash('sha256').update(content).digest('hex').slice(0, 16),
      title: title || 'Lesson',
      summary: `Audio briefing on ${title || 'Lesson'}`,
      audience_preset: preset ?? 'student', style: style ?? 'tldr',
      target_duration_minutes: duration_minutes ?? 10, language: 'en',
      status: 'ready', error_message: null, audio_url: null,
      audio_duration_seconds: (duration_minutes ?? 10) * 60,
      tts_provider: 'gemini-3.8-flash-tts',
      script: [
        { speaker: 'Alex', text: `Welcome to your ${preset ?? 'student'} lesson on ${title || 'this topic'}.`, sectionMarkerId: 'sec_1' },
        { speaker: 'Sam', text: '|yeah| Here are the key takeaways from your source material.', sectionMarkerId: 'sec_1' },
      ],
      sections: [{ id: 'sec_1', title: 'Overview', start_second: 0, end_second: 600, summary: 'Overview of the source.', source_excerpt: content.slice(0, 200) }],
      prompt_version: '2026-10-v1.0.0', created_at: now(), updated_at: now(),
    };
    const cards: Card[] = [
      {
        id: `card_${Date.now()}_1`, lesson_id: lesson.id, user_id,
        headline: 'Core Concept', insight: 'Primary takeaway from the source material.',
        actionable_takeaway: 'Apply this concept in your practice sessions.',
        source_section_pointer: 'Section 1', audio_timestamp_seconds: 30,
        card_order: 1, tags: [preset ?? 'student', style ?? 'tldr', 'core'],
        rating: null, edited: false, edited_at: null, created_at: now(),
      },
    ];
    saveLesson(userId, lesson);
    saveCards(userId, cards);
    res.status(202).json({ lesson_id: lesson.id, status: lesson.status, title: lesson.title, summary: lesson.summary, cards_count: cards.length, lesson, cards });
  } catch (e: any) {
    res.status(400).json({ error: { code: 'LESSON_FAILED', message: e.message } });
  }
});

app.get('/api/v1/lessons', (req, res) => {
  const userId = auth(req, res);
  if (!userId) return;
  const limit = parseInt(req.query.limit as string) || 20;
  res.json({ items: listLessons(userId, limit) });
});

app.get('/api/v1/lessons/:id', (req, res) => {
  const userId = auth(req, res);
  if (!userId) return;
  const lesson = getLesson(userId, req.params.id);
  if (!lesson) { res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Lesson not found.' } }); return; }
  const cards = getCardsForLesson(userId, req.params.id);
  res.json({ lesson, cards });
});

app.post('/api/v1/lessons/:id/ask', (req, res) => {
  const userId = auth(req, res);
  if (!userId) return;
  const { question } = req.body;
  if (!question) { res.status(400).json({ error: { code: 'MISSING_QUESTION', message: 'Question required.' } }); return; }
  res.json({ question, answer: `Based on your source material: ${question.slice(0, 100)}...`, citations: [], confidence: 'medium' });
});

app.get('/api/v1/cards', (req, res) => {
  const userId = auth(req, res);
  if (!userId) return;
  const lessonId = req.query.lesson_id as string;
  if (!lessonId) { res.status(400).json({ error: { code: 'PARAM_REQUIRED', message: 'lesson_id required.' } }); return; }
  try { res.json({ cards: getCardsForLesson(userId, lessonId) }); } catch { res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Lesson not found.' } }); }
});

app.post('/api/v1/cards/:id/rate', (req, res) => {
  const userId = auth(req, res);
  if (!userId) return;
  const { rating } = req.body;
  const card = store.cards.get(req.params.id);
  if (!card || card.user_id !== userId) { res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Card not found.' } }); return; }
  card.rating = rating;
  store.cards.set(req.params.id, card);
  res.json({ card });
});

app.patch('/api/v1/cards/:id', (req, res) => {
  const userId = auth(req, res);
  if (!userId) return;
  const card = store.cards.get(req.params.id);
  if (!card || card.user_id !== userId) { res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Card not found.' } }); return; }
  const { headline, insight, actionable_takeaway } = req.body;
  const updated = { ...card, ...(headline !== undefined ? { headline } : {}), ...(insight !== undefined ? { insight } : {}), ...(actionable_takeaway !== undefined ? { actionable_takeaway } : {}), edited: true, edited_at: now() };
  store.cards.set(req.params.id, updated);
  res.json({ card: updated });
});

app.post('/api/v1/cards/:id/save', (req, res) => {
  const userId = auth(req, res);
  if (!userId) return;
  try { res.json({ saved_card: saveCardToLibrary(userId, req.params.id) }); } catch { res.status(400).json({ error: { code: 'SAVE_FAILED', message: 'Could not save card.' } }); }
});

app.post('/api/v1/practice', (req, res) => {
  const userId = auth(req, res);
  if (!userId) return;
  const { scenario_id, mode } = req.body;
  const session = startSession(userId, scenario_id ?? 'scen_stud_qa', mode ?? 'text');
  res.status(201).json({ session });
});

app.get('/api/v1/practice/scenarios', (_req, res) => {
  res.json({ scenarios: [
    { id: 'scen_prof_raise', title: 'Negotiating a Compensation Adjustment', persona: 'Executive VP' },
    { id: 'scen_prof_deadline', title: 'Pushing Back on an Unrealistic Deadline', persona: 'Product Director' },
    { id: 'scen_stud_qa', title: 'Class Presentation Thesis Defense Q&A', persona: 'Professor' },
    { id: 'scen_learn_pitch', title: '60-Second Intellectual Elevator Pitch', persona: 'Podcast Host' },
  ] });
});

app.post('/api/v1/practice/:id/turn', (req, res) => {
  const userId = auth(req, res);
  if (!userId) return;
  const session = store.practiceSessions.get(req.params.id);
  if (!session || session.user_id !== userId) { res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Session not found.' } }); return; }
  const { user_input } = req.body;
  const turn = {
    id: `pturn_${session.turns.length}`, turn_number: session.turns.length,
    user_input, agent_reply: 'I understand. What is your next step?',
    feedback: 'Good response. Consider leading with your primary conclusion first.',
    clarity_score: 85, tone_score: 88, structure_score: 80, timestamp: now(),
  };
  session.turns.push(turn);
  session.updated_at = now();
  store.practiceSessions.set(req.params.id, session);
  res.json({ turn, session });
});

app.get('/api/v1/reviews/due', (req, res) => {
  const userId = auth(req, res);
  if (!userId) return;
  res.json({ due_count: 0, items: [] });
});

app.post('/api/v1/reviews/:card_id/grade', (req, res) => {
  const userId = auth(req, res);
  if (!userId) return;
  res.json({ review: { interval_days: 1 }, streak: { current_streak: 1 } });
});

app.get('/api/v1/streak', (req, res) => {
  const userId = auth(req, res);
  if (!userId) return;
  res.json({ streak: { current_streak: 0, longest_streak: 0, freezes_available: 1 } });
});

app.get('/api/v1/usage', (req, res) => {
  const userId = auth(req, res);
  if (!userId) return;
  res.json({ tier: 'free', daily_lesson_cap: 5, lessons_created_today: 0, tts_seconds_used_today: 0, current_streak: 0, freezes_available: 1 });
});

app.post('/api/v1/api-keys', (req, res) => {
  const userId = auth(req, res);
  if (!userId) return;
  const key = `stm_live_${createHash('sha256').update(`${userId}:${Date.now()}`).digest('hex').slice(0, 32)}`;
  res.status(201).json({ api_key: key });
});

app.post('/api/v1/webhooks/test', (req, res) => {
  const userId = auth(req, res);
  if (!userId) return;
  res.json({ success: true, dispatched_count: 0 });
});

app.get('/api/v1/mcp', async (req, res) => {
  const { jsonrpc, id, method, params } = req.body;
  if (method === 'tools/list') {
    res.json({ jsonrpc: '2.0', id, result: { tools: [
      { name: 'create_lesson', description: 'Create a lesson', inputSchema: { type: 'object', properties: {} } },
      { name: 'get_lesson', description: 'Get a lesson', inputSchema: { type: 'object', properties: {} } },
      { name: 'get_usage', description: 'Get usage', inputSchema: { type: 'object', properties: {} } },
    ] } });
  } else {
    res.json({ jsonrpc: '2.0', id, error: { code: -32601, message: 'Method not found' } });
  }
});

export default app;
