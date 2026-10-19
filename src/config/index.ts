/**
 * StashMind Central Configuration
 *
 * CRITICAL RULE: Model IDs, prompt versions, quotas, caps, and feature flags
 * live EXCLUSIVELY in this module. No model ID or prompt version string may
 * appear anywhere else in the codebase.
 *
 * Models verified against official Gemini 2026 API specifications:
 * - Deprecated models (gemini-1.5-*, gemini-2.0-*) are NEVER used.
 */

export const MODELS = {
  /**
   * Fast generation, source analysis, structured JSON cards, and practice turn feedback.
   */
  FLASH: 'gemini-3.8-flash',

  /**
   * Heavy reasoning & complex synthesis (used sparingly for deep dive synthesis when justified).
   */
  PRO: 'gemini-4-argon',

  /**
   * High-efficiency single-speaker TTS.
   */
  TTS_LITE: 'gemini-3.8-flash-lite-tts',

  /**
   * Flagship dual-host podcasting TTS with backchanneling and multiSpeakerVoiceConfig.
   */
  TTS_DUAL_HOST: 'gemini-3.8-flash-tts',

  /**
   * Real-time conversational audio practice via Gemini Live API.
   */
  LIVE_VOICE: 'gemini-3.8-live',
} as const;

export type ModelId = typeof MODELS[keyof typeof MODELS];

/**
 * TTS provider string used in Lesson.tts_provider and TtsEngine.ttsProvider.
 * Derived from MODELS.TTS_DUAL_HOST to guarantee a single source of truth.
 */
export const TTS_PROVIDER_DUAL_HOST = MODELS.TTS_DUAL_HOST;
export type TtsProvider = typeof TTS_PROVIDER_DUAL_HOST | 'device-tts-fallback';

export const PROMPT_VERSIONS = {
  LESSON_GENERATOR: '2026-10-v1.0.0',
  CARDS_EXTRACTION: '2026-10-v1.0.0',
  PRACTICE_FEEDBACK: '2026-10-v1.0.0',
  VOICE_PRACTICE_SYSTEM: '2026-10-v1.0.0',
  QUIZ_GENERATOR: '2026-10-v1.0.0',
} as const;

export const AUDIENCE_PRESETS = {
  STUDENT: 'student',
  LEARNER: 'learner',
  PROFESSIONAL: 'professional',
} as const;

export type AudiencePreset = typeof AUDIENCE_PRESETS[keyof typeof AUDIENCE_PRESETS];

export const LESSON_STYLES = {
  TLDR: 'tldr',
  ELI5: 'eli5',
  DEBATE: 'debate',
  DEEP_DIVE: 'deep_dive',
} as const;

export type LessonStyle = typeof LESSON_STYLES[keyof typeof LESSON_STYLES];

export const LESSON_LENGTHS = [5, 10, 20] as const;
export type LessonLengthMinutes = typeof LESSON_LENGTHS[number];

export const LANGUAGES = {
  ENGLISH: 'en',
  SWAHILI: 'sw',
} as const;

export type LessonLanguage = typeof LANGUAGES[keyof typeof LANGUAGES];

export const QUOTAS = {
  DAILY_LESSONS: {
    free: 5,
    student: 20,
    pro: 100,
    team: 250,
  },
  MAX_SOURCE_TEXT_CHARS: 100_000,
  MAX_SOURCE_PDF_BYTES: 15 * 1024 * 1024, // 15 MB
  MAX_SOURCE_PDF_PAGES: 40,
  MAX_AUDIO_CHUNK_WORDS: 350,
  MAX_PRACTICE_FEEDBACK_WORDS: 30,
  SPACED_REPETITION_INTERVALS_DAYS: [1, 3, 7, 14, 30] as const,
  STREAK_FREEZE_MAX_PER_WEEK: 1,
  MINIMUM_USER_AGE: 13,
  MINIMUM_USER_AGE_GDPR: 16,
} as const;

export const FEATURE_FLAGS = {
  ENABLE_DEVICE_TTS_FALLBACK: true,
  ENABLE_VOICE_LIVE_PRACTICE: true,
  ENABLE_MCP_SERVER: true,
  ENABLE_WEBHOOKS: true,
  ENABLE_CONTENT_HASH_CACHE: true,
  DEFAULT_AUDIENCE_PRESET: AUDIENCE_PRESETS.STUDENT,
} as const;

export const HTTP_CLIENT_HEADERS = {
  USER_AGENT: 'aistudio-build',
} as const;

/**
 * Checks whether global daily spend kill switch is active.
 * When active, falls back to text-only mode and refuses new audio generation.
 */
export function isDailySpendKillSwitchActive(): boolean {
  if (typeof process === 'undefined' || !process.env) {
    return false;
  }
  return process.env.DAILY_SPEND_KILL_SWITCH === 'true';
}

/**
 * Validates whether a given audience preset is supported.
 */
export function isValidAudiencePreset(preset: string): preset is AudiencePreset {
  return Object.values(AUDIENCE_PRESETS).includes(preset as AudiencePreset);
}

/**
 * Validates whether a given lesson style is supported.
 */
export function isValidLessonStyle(style: string): style is LessonStyle {
  return Object.values(LESSON_STYLES).includes(style as LessonStyle);
}
