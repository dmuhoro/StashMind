/**
 * StashMind REST API Router (/api/v1/*) & MCP Endpoint
 * Follows Part C (Integration Contract).
 */

import { Router, type Request, type Response } from 'express';
import { OPENAPI_SPEC } from './openapi.ts';
import { StashMindRepository } from '../db/repository.ts';
import { IngestionService } from '../services/ingestion.ts';
import { LessonEngine } from '../services/lessonEngine.ts';
import { TtsEngine } from '../services/ttsEngine.ts';
import { PracticeEngine, PRESET_SCENARIOS } from '../services/practiceEngine.ts';
import { RetentionEngine, type ReviewGrade } from '../services/retentionEngine.ts';
import { ApiKeyService, type ApiScope } from '../services/apiKeys.ts';
import { WebhookService } from '../services/webhooks.ts';
import { ExportEngine } from '../services/exportEngine.ts';
import { McpServer, MCP_TOOLS } from '../services/mcpServer.ts';
import { SEED_LESSONS } from '../services/seedData.ts';
import { handleTelegramUpdate, setWebhook, getMe } from '../services/telegram.ts';
import { AskSourceService } from '../services/askSource.ts';
import { StudyModeService } from '../services/studyMode.ts';
import { initiateStkPush, verifyMpesaCallback, MPESA_PRICING } from '../services/payments.ts';
import { signTokenPair, verifyAccessToken, verifyRefreshToken, hashPassword, type TokenPayload } from '../services/auth.ts';
import type { AudiencePreset, LessonStyle, LessonLengthMinutes } from '../config/index.ts';

export const apiV1Router = Router();

// Middleware to resolve authenticated user from Bearer JWT or API Key.
// Fail closed: no demo-user fallback. Every request must present valid credentials.
async function authenticateRequest(req: Request, res: Response, requiredScope?: ApiScope): Promise<string | null> {
  const authHeader = req.headers.authorization;
  const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  (req as unknown as { requestId: string }).requestId = requestId;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.replace(/^Bearer\s+/, '').trim();

    // API Key authentication (stm_live_*)
    if (token.startsWith('stm_')) {
      const verification = await ApiKeyService.verifyKey(token, requiredScope);
      if (!verification.valid || !verification.userId) {
        res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: verification.error || 'Invalid API key.',
            request_id: requestId,
          },
        });
        return null;
      }
      return verification.userId;
    }

    // JWT access token authentication
    try {
      const payload = verifyAccessToken(token) as TokenPayload;
      // Scope check for JWT holders: JWT implies lessons:read/write scope
      if (requiredScope && !['lessons:read', 'lessons:write', 'cards:read', 'cards:write'].includes(requiredScope)) {
        res.status(403).json({
          error: { code: 'INSUFFICIENT_SCOPE', message: 'JWT holder lacks required scope.', request_id: requestId },
        });
        return null;
      }
      return payload.userId;
    } catch {
      res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'Invalid or expired access token.', request_id: requestId },
      });
      return null;
    }
  }

  // No credentials provided — fail closed
  res.status(401).json({
    error: {
      code: 'MISSING_CREDENTIALS',
      message: 'Authentication required. Provide a Bearer API key (stm_live_*) or JWT access token.',
      request_id: requestId,
    },
  });
  return null;
}

// Pre-seed demo repository
(async () => {
  for (const item of SEED_LESSONS) {
    await StashMindRepository.instance.saveLesson(item.lesson.user_id, item.lesson);
    await StashMindRepository.instance.saveCards(item.lesson.user_id, item.cards);
    // Pre-save first card to library
    try {
      await StashMindRepository.instance.saveCardToLibrary(item.lesson.user_id, item.cards[0].id);
    } catch {
      // ignore
    }
  }
})();

// --- OpenAPI Spec ---
apiV1Router.get('/openapi.json', (_req: Request, res: Response) => {
  res.json(OPENAPI_SPEC);
});

// --- Health Check ---
apiV1Router.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// --- Auth: Signup ---
apiV1Router.post('/auth/signup', async (req: Request, res: Response) => {
  const { email, password, display_name, audience_preset, timezone, age_confirmed } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: { code: 'MISSING_FIELDS', message: 'Email and password are required.' } });
    return;
  }

  // Age gate enforcement (Constitution: 13+ standard, 16+ GDPR)
  if (age_confirmed !== true) {
    res.status(403).json({
      error: { code: 'AGE_GATE_REQUIRED', message: 'You must confirm you are 13+ (16+ under GDPR) to create an account.' },
    });
    return;
  }

  const existing = await StashMindRepository.instance.getProfileByEmail(email);
  if (existing) {
    res.status(409).json({ error: { code: 'USER_EXISTS', message: 'An account with this email already exists.' } });
    return;
  }

  const userId = `user_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const now = new Date().toISOString();

  const profile = await StashMindRepository.instance.upsertProfile(userId, {
    email,
    audience_preset: audience_preset || 'student',
    timezone: timezone || 'UTC',
    age_confirmed: true,
  });

  // Store hashed password on profile (in-memory; Supabase Auth in production)
  await StashMindRepository.instance.upsertProfile(userId, {
    ...profile,
    password_hash: hashPassword(password),
  } as any);

  const tokens = signTokenPair({
    userId,
    email,
    tier: profile.tier,
    age_confirmed: true,
  });

  await StashMindRepository.instance.logAuditEvent(userId, 'auth.signup', 'user', userId, { email });

  res.status(201).json({ user: profile, tokens });
});

// --- Auth: Login ---
apiV1Router.post('/auth/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: { code: 'MISSING_FIELDS', message: 'Email and password are required.' } });
    return;
  }

  const profile = await StashMindRepository.instance.getProfileByEmail(email);
  if (!profile) {
    res.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' } });
    return;
  }

  const storedHash = (profile as any).password_hash;
  if (!storedHash || storedHash !== hashPassword(password)) {
    res.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' } });
    return;
  }

  const tokens = signTokenPair({
    userId: profile.user_id,
    email: profile.email,
    tier: profile.tier,
    age_confirmed: profile.age_confirmed,
  });

  await StashMindRepository.instance.logAuditEvent(profile.user_id, 'auth.login', 'user', profile.user_id, { email });

  res.json({ user: profile, tokens });
});

// --- Auth: Refresh ---
apiV1Router.post('/auth/refresh', async (req: Request, res: Response) => {
  const { refresh_token } = req.body;

  if (!refresh_token) {
    res.status(400).json({ error: { code: 'MISSING_TOKEN', message: 'Refresh token is required.' } });
    return;
  }

  try {
    const { userId } = verifyRefreshToken(refresh_token);
    const profile = await StashMindRepository.instance.getProfile(userId);
    if (!profile) {
      res.status(401).json({ error: { code: 'USER_NOT_FOUND', message: 'User not found.' } });
      return;
    }

    const tokens = signTokenPair({
      userId: profile.user_id,
      email: profile.email,
      tier: profile.tier,
      age_confirmed: profile.age_confirmed,
    });

    res.json({ tokens });
  } catch {
    res.status(401).json({ error: { code: 'INVALID_REFRESH_TOKEN', message: 'Invalid or expired refresh token.' } });
  }
});

// --- User Profile & Preset ---
apiV1Router.get('/me', async (req: Request, res: Response) => {
  const userId = await authenticateRequest(req, res);
  if (!userId) return;

  let profile = await StashMindRepository.instance.getProfile(userId);
  if (!profile) {
    profile = await StashMindRepository.instance.upsertProfile(userId, {
      email: `${userId}@example.com`,
      audience_preset: 'student',
      tier: 'free',
      age_confirmed: true,
    });
  }
  res.json(profile);
});

apiV1Router.patch('/me', async (req: Request, res: Response) => {
  const userId = await authenticateRequest(req, res);
  if (!userId) return;

  const { audience_preset, timezone, display_name, age_confirmed } = req.body;
  const updated = await StashMindRepository.instance.upsertProfile(userId, {
    email: `${userId}@example.com`,
    audience_preset,
    timezone,
    display_name,
    age_confirmed,
  });

  res.json(updated);
});

// --- Data-saver mode (Tier 1: low-bandwidth mobile-first) ---
apiV1Router.patch('/me/data-saver', async (req: Request, res: Response) => {
  const userId = await authenticateRequest(req, res);
  if (!userId) return;

  const { data_saver } = req.body;
  if (typeof data_saver !== 'boolean') {
    res.status(400).json({ error: { code: 'INVALID_VALUE', message: 'data_saver must be a boolean.' } });
    return;
  }

  const profile = await StashMindRepository.instance.getProfile(userId);
  if (!profile) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Profile not found.' } });
    return;
  }

  const updated = await StashMindRepository.instance.upsertProfile(userId, {
    email: profile.email,
    audience_preset: profile.audience_preset,
    timezone: profile.timezone,
    data_saver,
  });

  res.json({ data_saver: updated.data_saver });
});

// --- Downloadable lesson audio (Tier 1: data-saver, offline) ---
apiV1Router.get('/lessons/:id/download', async (req: Request, res: Response) => {
  const userId = await authenticateRequest(req, res);
  if (!userId) return;

  const lessonId = req.params.id;
  try {
    const lesson = await StashMindRepository.instance.getLesson(userId, lessonId);
    if (!lesson) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Lesson not found.' } });
      return;
    }

    if (!lesson.audio_url) {
      res.status(404).json({ error: { code: 'NO_AUDIO', message: 'Lesson has no audio to download.' } });
      return;
    }

    res.setHeader('Content-Type', 'audio/wav');
    res.setHeader('Content-Disposition', `attachment; filename="${lesson.title.replace(/\s+/g, '_')}.wav"`);
    // audio_url is a data:audio/wav;base64,... URL — extract the base64 payload
    const match = lesson.audio_url.match(/^data:audio\/wav;base64,(.*)$/);
    if (match) {
      res.send(Buffer.from(match[1], 'base64'));
    } else {
      res.redirect(lesson.audio_url);
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(403).json({ error: { code: 'FORBIDDEN', message, request_id: (req as any).requestId } });
  }
});

// --- Lessons (F6, F17, Ingestion F2-F5) ---
apiV1Router.post('/lessons', async (req: Request, res: Response) => {
  const userId = await authenticateRequest(req, res, 'lessons:write');
  if (!userId) return;

  const requestId = (req as unknown as { requestId: string }).requestId;
  const { source_type, content, title, preset, style, duration_minutes, language } = req.body;

  if (!source_type || !content) {
    res.status(400).json({
      error: {
        code: 'MISSING_SOURCE_CONTENT',
        message: 'Both source_type and content are required.',
        request_id: requestId,
      },
    });
    return;
  }

  try {
    let ingested;
    if (source_type === 'url') {
      ingested = await IngestionService.ingestArticleUrl(content);
    } else if (source_type === 'youtube') {
      ingested = await IngestionService.ingestYouTubeUrl(content);
    } else if (source_type === 'pdf') {
      ingested = IngestionService.ingestPdf({
        fileName: title || 'Uploaded Document.pdf',
        byteSize: content.length,
        extractedText: content,
      });
    } else {
      ingested = IngestionService.ingestPastedText(content, title);
    }

    // Check shared / user content hash cache first (F11)
    const { lesson, cards } = await LessonEngine.generateLesson({
      userId,
      sourceText: ingested.text,
      sourceTitle: ingested.title,
      audiencePreset: preset as AudiencePreset,
      style: style as LessonStyle,
      durationMinutes: duration_minutes as LessonLengthMinutes,
      language,
    });

    // Synthesize audio
    const profile = await StashMindRepository.instance.getProfile(userId);
    const audioResult = await TtsEngine.synthesizeLessonAudio(lesson.script, profile?.data_saver ?? false);
    lesson.audio_url = audioResult.audioUrl;
    lesson.audio_duration_seconds = audioResult.audioDurationSeconds;
    lesson.tts_provider = audioResult.ttsProvider;

    await StashMindRepository.instance.saveLesson(userId, lesson);
    await StashMindRepository.instance.saveCards(userId, cards);

    // Dispatch webhook
    await WebhookService.dispatchEvent(userId, 'lesson.ready', {
      lesson_id: lesson.id,
      title: lesson.title,
      cards_count: cards.length,
    });

    res.status(202).json({
      lesson_id: lesson.id,
      status: lesson.status,
      title: lesson.title,
      summary: lesson.summary,
      cards_count: cards.length,
      audio_duration_seconds: lesson.audio_duration_seconds,
      lesson,
      cards,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(400).json({
      error: {
        code: 'LESSON_CREATION_FAILED',
        message,
        request_id: requestId,
      },
    });
  }
});

apiV1Router.post('/study/session', async (req: Request, res: Response) => {
  const userId = await authenticateRequest(req, res, 'lessons:write');
  if (!userId) return;

  const { source_text, source_title } = req.body;

  if (!source_text) {
    res.status(400).json({ error: { code: 'MISSING_SOURCE', message: 'source_text is required.' } });
    return;
  }

  try {
    const session = await StudyModeService.createSession(userId, source_text, source_title || 'Study Session');

    await StashMindRepository.instance.logAuditEvent(userId, 'study.session_created', 'lesson', session.sessionId, {
      source_title: session.sourceTitle,
      cards_count: session.cards.length,
    });

    res.status(201).json({
      session_id: session.sessionId,
      source_title: session.sourceTitle,
      cards_count: session.cards.length,
      quiz_count: session.quiz.length,
      anki_csv: session.ankiCsv,
      cards: session.cards,
      quiz: session.quiz,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: { code: 'STUDY_FAILED', message, request_id: (req as any).requestId } });
  }
});

apiV1Router.get('/lessons', async (req: Request, res: Response) => {
  const userId = await authenticateRequest(req, res, 'lessons:read');
  if (!userId) return;

  const limit = parseInt(req.query.limit as string) || 20;
  const { items } = await StashMindRepository.instance.listLessons(userId, { limit });
  res.json({ items });
});

apiV1Router.get('/lessons/:id', async (req: Request, res: Response) => {
  const userId = await authenticateRequest(req, res, 'lessons:read');
  if (!userId) return;

  const requestId = (req as unknown as { requestId: string }).requestId;
  const lessonId = req.params.id;

  try {
    const lesson = await StashMindRepository.instance.getLesson(userId, lessonId);
    if (!lesson) {
      res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Lesson does not exist.', request_id: requestId },
      });
      return;
    }

    const cards = await StashMindRepository.instance.getCardsForLesson(userId, lessonId);
    res.json({ lesson, cards });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(403).json({
      error: { code: 'FORBIDDEN', message, request_id: requestId },
    });
  }
});

// --- Ask the Source (Tier 1: chat with citations) ---
apiV1Router.post('/lessons/:id/ask', async (req: Request, res: Response) => {
  const userId = await authenticateRequest(req, res, 'lessons:read');
  if (!userId) return;

  const { question } = req.body;
  const lessonId = req.params.id;

  if (!question || typeof question !== 'string') {
    res.status(400).json({ error: { code: 'MISSING_QUESTION', message: 'A question is required.' } });
    return;
  }

  try {
    const lesson = await StashMindRepository.instance.getLesson(userId, lessonId);
    if (!lesson) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Lesson not found.' } });
      return;
    }

    const result = await AskSourceService.ask(question, lesson.sections, lesson.title);

    await StashMindRepository.instance.logAuditEvent(userId, 'ask_source', 'lesson', lessonId, {
      question,
      confidence: result.confidence,
      citations_count: result.citations.length,
    });

    res.json({ question, answer: result.answer, citations: result.citations, confidence: result.confidence });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: { code: 'ASK_FAILED', message, request_id: (req as any).requestId } });
  }
});

// --- Cards & Saved Library (F7) ---
apiV1Router.get('/cards', async (req: Request, res: Response) => {
  const userId = await authenticateRequest(req, res, 'cards:read');
  if (!userId) return;

  const lessonId = req.query.lesson_id as string;
  if (!lessonId) {
    res.status(400).json({ error: { code: 'PARAM_REQUIRED', message: 'lesson_id query param is required.' } });
    return;
  }

  const cards = await StashMindRepository.instance.getCardsForLesson(userId, lessonId);
  res.json({ cards });
});

// --- Card quality controls (Tier 1) ---
apiV1Router.post('/cards/:id/rate', async (req: Request, res: Response) => {
  const userId = await authenticateRequest(req, res, 'cards:write');
  if (!userId) return;

  const { rating } = req.body;
  if (rating !== 'up' && rating !== 'down') {
    res.status(400).json({ error: { code: 'INVALID_RATING', message: 'rating must be "up" or "down".' } });
    return;
  }

  try {
    const updated = await StashMindRepository.instance.rateCard(userId, req.params.id, rating);
    await StashMindRepository.instance.logAuditEvent(userId, 'card.rated', 'card', req.params.id, { rating });
    res.json({ card: updated });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(400).json({ error: { code: 'RATE_FAILED', message } });
  }
});

apiV1Router.patch('/cards/:id', async (req: Request, res: Response) => {
  const userId = await authenticateRequest(req, res, 'cards:write');
  if (!userId) return;

  const { headline, insight, actionable_takeaway } = req.body;
  try {
    const updated = await StashMindRepository.instance.editCard(userId, req.params.id, {
      headline,
      insight,
      actionable_takeaway,
    });
    await StashMindRepository.instance.logAuditEvent(userId, 'card.edited', 'card', req.params.id, {
      headline,
      insight,
      actionable_takeaway,
    });
    res.json({ card: updated });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(400).json({ error: { code: 'EDIT_FAILED', message } });
  }
});

apiV1Router.post('/cards/:id/save', async (req: Request, res: Response) => {
  const userId = await authenticateRequest(req, res, 'cards:write');
  if (!userId) return;

  const { notes } = req.body;
  try {
    const saved = await StashMindRepository.instance.saveCardToLibrary(userId, req.params.id, notes);
    await WebhookService.dispatchEvent(userId, 'card.saved', { card_id: req.params.id });
    res.json({ saved_card: saved });
  } catch (err: unknown) {
    res.status(400).json({ error: { code: 'SAVE_FAILED', message: String(err) } });
  }
});

apiV1Router.delete('/cards/:id/save', async (req: Request, res: Response) => {
  const userId = await authenticateRequest(req, res, 'cards:write');
  if (!userId) return;

  const success = await StashMindRepository.instance.removeCardFromLibrary(userId, req.params.id);
  res.json({ success });
});

apiV1Router.get('/library/saved', async (req: Request, res: Response) => {
  const userId = await authenticateRequest(req, res, 'cards:read');
  if (!userId) return;

  const saved = await StashMindRepository.instance.listSavedCards(userId);
  res.json({ items: saved });
});

apiV1Router.get('/library/search', async (req: Request, res: Response) => {
  const userId = await authenticateRequest(req, res, 'cards:read');
  if (!userId) return;

  const q = ((req.query.q as string) || '').toLowerCase();
  const saved = await StashMindRepository.instance.listSavedCards(userId);
  const lessons = (await StashMindRepository.instance.listLessons(userId)).items;

  const matchedCards = saved.filter(
    (s) =>
      s.card?.headline.toLowerCase().includes(q) ||
      s.card?.insight.toLowerCase().includes(q) ||
      s.card?.tags.some((t) => t.toLowerCase().includes(q))
  );

  const matchedLessons = lessons.filter(
    (l) => l.title.toLowerCase().includes(q) || l.summary.toLowerCase().includes(q)
  );

  res.json({ cards: matchedCards, lessons: matchedLessons });
});

// --- Roleplay Practice (F12, F13) ---
apiV1Router.get('/practice/scenarios', (_req: Request, res: Response) => {
  res.json({ scenarios: PRESET_SCENARIOS });
});

apiV1Router.post('/practice', async (req: Request, res: Response) => {
  const userId = await authenticateRequest(req, res, 'practice:write');
  if (!userId) return;

  const { scenario_id, mode } = req.body;
  const session = PracticeEngine.startSession(userId, scenario_id, mode || 'text');
  await StashMindRepository.instance.savePracticeSession(userId, session);

  res.status(201).json({ session });
});

apiV1Router.post('/practice/:id/turn', async (req: Request, res: Response) => {
  const userId = await authenticateRequest(req, res, 'practice:write');
  if (!userId) return;

  const { user_input } = req.body;
  const session = await StashMindRepository.instance.getPracticeSession(userId, req.params.id);
  if (!session) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Practice session not found.' } });
    return;
  }

  const { turn, updatedSession } = await PracticeEngine.evaluateTurn(session, user_input);
  await StashMindRepository.instance.savePracticeSession(userId, updatedSession);

  res.json({ turn, session: updatedSession });
});

apiV1Router.post('/practice/:id/complete', async (req: Request, res: Response) => {
  const userId = await authenticateRequest(req, res, 'practice:write');
  if (!userId) return;

  const session = await StashMindRepository.instance.getPracticeSession(userId, req.params.id);
  if (!session) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Practice session not found.' } });
    return;
  }

  const scorecard = PracticeEngine.generateFinalScorecard(session);
  await StashMindRepository.instance.savePracticeSession(userId, session);

  await WebhookService.dispatchEvent(userId, 'practice.completed', {
    session_id: session.id,
    overall_score: scorecard.overall_score,
  });

  res.json({ scorecard, session });
});

// --- Retention & Spaced Repetition (F14, F15) ---
apiV1Router.get('/reviews/due', async (req: Request, res: Response) => {
  const userId = await authenticateRequest(req, res, 'reviews:read');
  if (!userId) return;

  const due = await StashMindRepository.instance.getDueReviews(userId);
  res.json({ due_count: due.length, items: due });
});

apiV1Router.post('/reviews/:card_id/grade', async (req: Request, res: Response) => {
  const userId = await authenticateRequest(req, res, 'reviews:write');
  if (!userId) return;

  const { grade } = req.body;
  const cardId = req.params.card_id;

  const due = await StashMindRepository.instance.getDueReviews(userId);
  const existing = due.find((d) => d.card_id === cardId) || {
    id: `rev_${Date.now()}`,
    user_id: userId,
    card_id: cardId,
    interval_days: 1,
    ease_factor: 2.5,
    repetition_number: 0,
    due_date: new Date().toISOString(),
    created_at: new Date().toISOString(),
  };

  const updated = RetentionEngine.gradeReview(existing, grade as ReviewGrade);
  await StashMindRepository.instance.upsertSpacedReview(userId, updated);

  // Update streak
  const profile = await StashMindRepository.instance.getProfile(userId);
  const currentStreak = await StashMindRepository.instance.getStreak(userId);
  const { updatedStreak } = RetentionEngine.recordActivity(
    currentStreak,
    profile?.timezone || 'UTC'
  );
  await StashMindRepository.instance.updateStreak(userId, updatedStreak);

  res.json({ review: updated, streak: updatedStreak });
});

apiV1Router.get('/streak', async (req: Request, res: Response) => {
  const userId = await authenticateRequest(req, res);
  if (!userId) return;

  const streak = await StashMindRepository.instance.getStreak(userId);
  res.json({ streak });
});

// --- Deck Export (F18) ---
apiV1Router.get('/export/deck/:id', async (req: Request, res: Response) => {
  const userId = await authenticateRequest(req, res, 'export:read');
  if (!userId) return;

  const format = (req.query.format as 'md' | 'json' | 'csv') || 'md';
  const lesson = await StashMindRepository.instance.getLesson(userId, req.params.id);
  if (!lesson) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Lesson not found.' } });
    return;
  }
  const cards = await StashMindRepository.instance.getCardsForLesson(userId, req.params.id);

  if (format === 'json') {
    res.setHeader('Content-Type', 'application/json');
    res.send(ExportEngine.exportToJson(lesson, cards));
  } else if (format === 'csv') {
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${lesson.title.replace(/\s+/g, '_')}.csv"`);
    res.send(ExportEngine.exportToCsv(lesson, cards));
  } else {
    res.setHeader('Content-Type', 'text/markdown');
    res.send(ExportEngine.exportToMarkdown(lesson, cards));
  }
});

// --- Usage & Limits (F16) ---
apiV1Router.get('/usage', async (req: Request, res: Response) => {
  const userId = await authenticateRequest(req, res);
  if (!userId) return;

  const profile = await StashMindRepository.instance.getProfile(userId);
  const streak = await StashMindRepository.instance.getStreak(userId);

  res.json({
    tier: profile?.tier ?? 'free',
    daily_lesson_cap: profile?.tier === 'pro' ? 100 : profile?.tier === 'student' ? 20 : 5,
    lessons_created_today: 1,
    tts_seconds_used_today: 45,
    current_streak: streak.current_streak,
    freezes_available: streak.freezes_available,
  });
});

// --- API Keys (Integration Contract Section 2) ---
apiV1Router.post('/api-keys', async (req: Request, res: Response) => {
  const userId = await authenticateRequest(req, res);
  if (!userId) return;

  const { name, scopes } = req.body;
  const { plaintextKey, keyRecord } = await ApiKeyService.generateKey(userId, name || 'Default Key', scopes);

  res.status(201).json({
    api_key: plaintextKey,
    key_record: keyRecord,
  });
});

apiV1Router.get('/api-keys', async (req: Request, res: Response) => {
  const userId = await authenticateRequest(req, res);
  if (!userId) return;

  const keys = await StashMindRepository.instance.listApiKeys(userId);
  res.json({ items: keys });
});

apiV1Router.delete('/api-keys/:id', async (req: Request, res: Response) => {
  const userId = await authenticateRequest(req, res);
  if (!userId) return;

  const success = await StashMindRepository.instance.revokeApiKey(userId, req.params.id);
  res.json({ success });
});

// --- Webhooks (Integration Contract Section 3) ---
apiV1Router.post('/webhooks', async (req: Request, res: Response) => {
  const userId = await authenticateRequest(req, res, 'webhooks:manage');
  if (!userId) return;

  const { target_url, signing_secret, events } = req.body;
  const webhook = await StashMindRepository.instance.createWebhook(
    userId,
    target_url,
    signing_secret || 'whsec_' + Math.random().toString(36).slice(2, 10),
    events || ['lesson.ready', 'practice.completed']
  );
  res.status(201).json({ webhook });
});

apiV1Router.get('/webhooks', async (req: Request, res: Response) => {
  const userId = await authenticateRequest(req, res, 'webhooks:manage');
  if (!userId) return;

  const webhooks = await StashMindRepository.instance.listWebhooks(userId);
  res.json({ items: webhooks });
});

apiV1Router.post('/webhooks/test', async (req: Request, res: Response) => {
  const userId = await authenticateRequest(req, res, 'webhooks:manage');
  if (!userId) return;

  const dispatched = await WebhookService.dispatchEvent(userId, 'lesson.ready', {
    test: true,
    lesson_id: 'les_test_001',
    message: 'Test webhook delivery from StashMind integration testing.',
  });

  res.json({ success: true, dispatched_count: dispatched });
});

// --- Telegram Bot Ingestion Webhook (Tier 1) ---
apiV1Router.post('/webhooks/telegram', async (req: Request, res: Response) => {
  const update = req.body;
  const result = await handleTelegramUpdate(update as any);
  res.json({ ok: result.ok });
});

apiV1Router.post('/webhooks/telegram/set', async (req: Request, res: Response) => {
  const { webhook_url } = req.body;
  if (!webhook_url) {
    res.status(400).json({ error: { code: 'MISSING_URL', message: 'webhook_url is required.' } });
    return;
  }
  const result = await setWebhook(webhook_url);
  res.json(result);
});

apiV1Router.get('/webhooks/telegram/me', async (_req: Request, res: Response) => {
  const result = await getMe();
  res.json(result);
});

// --- M-Pesa Payments (Tier 1: KES pricing, student tier) ---
apiV1Router.get('/payments/pricing', (_req: Request, res: Response) => {
  res.json({ tiers: MPESA_PRICING, currency: 'KES' });
});

apiV1Router.post('/payments/mpesa/stkpush', async (req: Request, res: Response) => {
  const userId = await authenticateRequest(req, res);
  if (!userId) return;

  const { phone_number, amount_kes, account_reference, transaction_desc } = req.body;

  if (!phone_number || !amount_kes) {
    res.status(400).json({ error: { code: 'MISSING_FIELDS', message: 'phone_number and amount_kes are required.' } });
    return;
  }

  const result = await initiateStkPush({
    phoneNumber: phone_number,
    amountKes: amount_kes,
    accountReference: account_reference || `stm_user_${userId}`,
    transactionDesc: transaction_desc || 'StashMind lesson package',
  });

  if (result.ok) {
    const checkoutRequestId = (result.result as { CheckoutRequestID?: string })?.CheckoutRequestID;
    await StashMindRepository.instance.logAuditEvent(userId, 'payment.stk_push', 'payment', userId, {
      amount_kes,
      phone_number,
      checkout_request_id: checkoutRequestId,
    });
    res.json({ ok: true, result: result.result });
  } else {
    res.status(502).json({ ok: false, error: result.error || 'M-Pesa STK push failed.' });
  }
});

apiV1Router.post('/payments/mpesa/callback', async (req: Request, res: Response) => {
  const payload = req.body;
  const verification = verifyMpesaCallback(payload);

  await StashMindRepository.instance.logAuditEvent(null, 'payment.mpesa_callback', 'payment', null, {
    result_code: verification.resultCode,
    receipt_number: verification.receiptNumber,
    phone_number: verification.phoneNumber,
    amount: verification.amount,
  });

  // Acknowledge receipt to Daraja (required to stop retries)
  res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
});

// --- MCP Server Endpoint (Integration Contract Section 4) ---
apiV1Router.get('/mcp/tools', (_req: Request, res: Response) => {
  res.json({ tools: MCP_TOOLS });
});

apiV1Router.post('/mcp', async (req: Request, res: Response) => {
  const userId = await authenticateRequest(req, res);
  if (!userId) return;

  const { jsonrpc, id, method, params } = req.body;

  if (method === 'tools/list') {
    res.json({
      jsonrpc: '2.0',
      id,
      result: { tools: MCP_TOOLS },
    });
    return;
  }

  if (method === 'tools/call') {
    const toolName = params?.name;
    const args = params?.arguments || {};
    const execution = await McpServer.executeTool(userId, toolName, args);

    if (execution.error) {
      res.json({
        jsonrpc: '2.0',
        id,
        error: { code: -32603, message: execution.error },
      });
    } else {
      res.json({
        jsonrpc: '2.0',
        id,
        result: execution.result,
      });
    }
    return;
  }

  res.json({
    jsonrpc: '2.0',
    id,
    error: { code: -32601, message: `Method not found: ${method}` },
  });
});
