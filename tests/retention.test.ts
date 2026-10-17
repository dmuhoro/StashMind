import { describe, it, expect } from 'vitest';
import { RetentionEngine } from '../src/services/retentionEngine.ts';
import type { Streak, SpacedReview } from '../src/db/types.ts';

describe('Retention Engine, Timezone Streaks & Spaced Repetition (F14, F15)', () => {
  it('should compute local calendar date correctly in different timezones', () => {
    // 2026-10-17 01:00 UTC is still 2026-10-16 in Los Angeles (-7 / -8)
    const testDate = new Date('2026-10-17T01:00:00Z');

    const tokyoDate = RetentionEngine.getLocalDateString('Asia/Tokyo', testDate);
    const laDate = RetentionEngine.getLocalDateString('America/Los_Angeles', testDate);

    expect(tokyoDate).toBe('2026-10-17');
    expect(laDate).toBe('2026-10-16');
  });

  it('should increment streaks on consecutive days and protect with freeze', () => {
    const initialStreak: Streak = {
      id: 'streak_1',
      user_id: 'user_1',
      current_streak: 3,
      longest_streak: 5,
      last_activity_local_date: '2026-10-15',
      freezes_available: 1,
      freezes_used_this_week: 0,
      freeze_last_reset_week: '2026-W42',
      updated_at: new Date().toISOString(),
    };

    // Consecutive day activity (2026-10-16)
    const day1Date = new Date('2026-10-16T12:00:00Z');
    const result1 = RetentionEngine.recordActivity(initialStreak, 'UTC', day1Date);
    expect(result1.streakIncremented).toBe(true);
    expect(result1.updatedStreak.current_streak).toBe(4);

    // Same day duplicate activity: no increment
    const resultDuplicate = RetentionEngine.recordActivity(result1.updatedStreak, 'UTC', day1Date);
    expect(resultDuplicate.streakIncremented).toBe(false);
    expect(resultDuplicate.updatedStreak.current_streak).toBe(4);

    // Skip a day to 2026-10-18 (missed 2026-10-17): Should use freeze!
    const day3Date = new Date('2026-10-18T12:00:00Z');
    const resultWithFreeze = RetentionEngine.recordActivity(result1.updatedStreak, 'UTC', day3Date);
    expect(resultWithFreeze.freezeUsed).toBe(true);
    expect(resultWithFreeze.updatedStreak.current_streak).toBe(5);
    expect(resultWithFreeze.updatedStreak.freezes_available).toBe(0);
  });

  it('should advance spaced repetition intervals across standard milestones', () => {
    const initialReview: SpacedReview = {
      id: 'rev_1',
      user_id: 'user_1',
      card_id: 'card_1',
      interval_days: 1,
      ease_factor: 2.5,
      repetition_number: 0,
      due_date: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };

    // Grade 'good': moves repetition from 0 -> 1, interval to 1 -> 3
    const gradedGood = RetentionEngine.gradeReview(initialReview, 'good');
    expect(gradedGood.interval_days).toBe(3);
    expect(gradedGood.repetition_number).toBe(1);

    // Grade 'again': resets repetition to 0, interval to 1
    const gradedAgain = RetentionEngine.gradeReview(gradedGood, 'again');
    expect(gradedAgain.interval_days).toBe(1);
    expect(gradedAgain.repetition_number).toBe(0);
  });
});
