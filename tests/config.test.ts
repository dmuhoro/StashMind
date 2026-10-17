import { describe, it, expect } from 'vitest';
import {
  MODELS,
  PROMPT_VERSIONS,
  AUDIENCE_PRESETS,
  LESSON_STYLES,
  LESSON_LENGTHS,
  QUOTAS,
  FEATURE_FLAGS,
  isValidAudiencePreset,
  isValidLessonStyle,
  isDailySpendKillSwitchActive,
} from '../src/config/index.ts';

describe('StashMind Central Configuration', () => {
  it('should only use approved 2026 Gemini models', () => {
    expect(MODELS.FLASH).toBe('gemini-3.8-flash');
    expect(MODELS.PRO).toBe('gemini-4-argon');
    expect(MODELS.TTS_LITE).toBe('gemini-3.8-flash-lite-tts');
    expect(MODELS.TTS_DUAL_HOST).toBe('gemini-3.8-flash-tts');
    expect(MODELS.LIVE_VOICE).toBe('gemini-3.8-live');

    // Verify deprecated models are strictly avoided
    const modelValues = Object.values(MODELS);
    for (const model of modelValues) {
      expect(model).not.toMatch(/gemini-1\.5/);
      expect(model).not.toMatch(/gemini-2\.0/);
    }
  });

  it('should define prompt versions for all core generation components', () => {
    expect(PROMPT_VERSIONS.LESSON_GENERATOR).toBeDefined();
    expect(PROMPT_VERSIONS.CARDS_EXTRACTION).toBeDefined();
    expect(PROMPT_VERSIONS.PRACTICE_FEEDBACK).toBeDefined();
    expect(PROMPT_VERSIONS.VOICE_PRACTICE_SYSTEM).toBeDefined();
    expect(PROMPT_VERSIONS.QUIZ_GENERATOR).toBeDefined();
  });

  it('should support the three specified audience presets', () => {
    expect(AUDIENCE_PRESETS.STUDENT).toBe('student');
    expect(AUDIENCE_PRESETS.LEARNER).toBe('learner');
    expect(AUDIENCE_PRESETS.PROFESSIONAL).toBe('professional');

    expect(isValidAudiencePreset('student')).toBe(true);
    expect(isValidAudiencePreset('learner')).toBe(true);
    expect(isValidAudiencePreset('professional')).toBe(true);
    expect(isValidAudiencePreset('invalid_preset')).toBe(false);
  });

  it('should support the four lesson styles and three standard durations', () => {
    expect(LESSON_STYLES.TLDR).toBe('tldr');
    expect(LESSON_STYLES.ELI5).toBe('eli5');
    expect(LESSON_STYLES.DEBATE).toBe('debate');
    expect(LESSON_STYLES.DEEP_DIVE).toBe('deep_dive');

    expect(isValidLessonStyle('tldr')).toBe(true);
    expect(isValidLessonStyle('debate')).toBe(true);
    expect(isValidLessonStyle('unknown')).toBe(false);

    expect(LESSON_LENGTHS).toEqual([5, 10, 20]);
  });

  it('should configure strict quotas and safety caps', () => {
    expect(QUOTAS.DAILY_LESSONS.free).toBeGreaterThan(0);
    expect(QUOTAS.DAILY_LESSONS.pro).toBeGreaterThan(QUOTAS.DAILY_LESSONS.free);
    expect(QUOTAS.MAX_PRACTICE_FEEDBACK_WORDS).toBe(30);
    expect(QUOTAS.SPACED_REPETITION_INTERVALS_DAYS).toEqual([1, 3, 7, 14, 30]);
    expect(QUOTAS.MINIMUM_USER_AGE).toBe(13);
  });

  it('should evaluate daily spend kill switch correctly', () => {
    const originalValue = process.env.DAILY_SPEND_KILL_SWITCH;
    try {
      process.env.DAILY_SPEND_KILL_SWITCH = 'true';
      expect(isDailySpendKillSwitchActive()).toBe(true);

      process.env.DAILY_SPEND_KILL_SWITCH = 'false';
      expect(isDailySpendKillSwitchActive()).toBe(false);
    } finally {
      process.env.DAILY_SPEND_KILL_SWITCH = originalValue;
    }
  });

  it('should enable core feature flags', () => {
    expect(FEATURE_FLAGS.ENABLE_CONTENT_HASH_CACHE).toBe(true);
    expect(FEATURE_FLAGS.ENABLE_DEVICE_TTS_FALLBACK).toBe(true);
    expect(FEATURE_FLAGS.ENABLE_VOICE_LIVE_PRACTICE).toBe(true);
  });
});
