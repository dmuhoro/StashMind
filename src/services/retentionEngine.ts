/**
 * Retention Engine: Timezone-Correct Streaks & Spaced Repetition Scheduling
 * Covers Requirements F14, F15.
 */

import { QUOTAS } from '../config/index.ts';
import type { Streak, SpacedReview, Card } from '../db/types.ts';

export type ReviewGrade = 'again' | 'hard' | 'good' | 'easy';

export class RetentionEngine {
  /**
   * Calculates the current local calendar date string (YYYY-MM-DD) for a given IANA timezone.
   * Crucial: Evaluates against user's configured timezone, NOT server UTC.
   */
  static getLocalDateString(timezone: string, date: Date = new Date()): string {
    try {
      const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone || 'UTC',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
      return formatter.format(date); // Formats as YYYY-MM-DD
    } catch {
      // Fallback if invalid timezone string provided
      return date.toISOString().split('T')[0];
    }
  }

  /**
   * Computes streak updates when a user completes an activity (lesson, review, or practice).
   * Supports streak preservation via weekly freeze.
   */
  static recordActivity(
    streak: Streak,
    userTimezone: string,
    activityDate: Date = new Date()
  ): { updatedStreak: Streak; streakIncremented: boolean; freezeUsed: boolean } {
    const todayLocal = this.getLocalDateString(userTimezone, activityDate);
    const lastLocal = streak.last_activity_local_date;

    // Reset weekly freeze allowance if entering a new calendar week
    const currentWeekId = this.getWeekId(userTimezone, activityDate);
    if (streak.freeze_last_reset_week !== currentWeekId) {
      streak.freezes_available = QUOTAS.STREAK_FREEZE_MAX_PER_WEEK;
      streak.freezes_used_this_week = 0;
      streak.freeze_last_reset_week = currentWeekId;
    }

    // 1. Same-day duplicate activity: no streak change
    if (lastLocal === todayLocal) {
      return { updatedStreak: streak, streakIncremented: false, freezeUsed: false };
    }

    // 2. First activity ever
    if (!lastLocal) {
      streak.current_streak = 1;
      streak.longest_streak = Math.max(streak.longest_streak, 1);
      streak.last_activity_local_date = todayLocal;
      streak.updated_at = new Date().toISOString();
      return { updatedStreak: streak, streakIncremented: true, freezeUsed: false };
    }

    const dayDiff = this.calculateCalendarDayDifference(lastLocal, todayLocal);

    if (dayDiff === 1) {
      // Consecutive day: increment streak
      streak.current_streak += 1;
      streak.longest_streak = Math.max(streak.longest_streak, streak.current_streak);
      streak.last_activity_local_date = todayLocal;
      streak.updated_at = new Date().toISOString();
      return { updatedStreak: streak, streakIncremented: true, freezeUsed: false };
    }

    if (dayDiff === 2 && streak.freezes_available > 0) {
      // Exactly 1 missed day and freeze available: use freeze to protect streak
      streak.freezes_available -= 1;
      streak.freezes_used_this_week += 1;
      streak.current_streak += 1;
      streak.longest_streak = Math.max(streak.longest_streak, streak.current_streak);
      streak.last_activity_local_date = todayLocal;
      streak.updated_at = new Date().toISOString();
      return { updatedStreak: streak, streakIncremented: true, freezeUsed: true };
    }

    // Streak broken: reset to 1
    streak.current_streak = 1;
    streak.last_activity_local_date = todayLocal;
    streak.updated_at = new Date().toISOString();
    return { updatedStreak: streak, streakIncremented: false, freezeUsed: false };
  }

  /**
   * Spaced Repetition: Grades a review and calculates the next due interval
   * using standard intervals [1, 3, 7, 14, 30] days with ease factor adjustments.
   */
  static gradeReview(review: SpacedReview, grade: ReviewGrade): SpacedReview {
    const intervals = QUOTAS.SPACED_REPETITION_INTERVALS_DAYS;
    const now = new Date();

    let newRepetition = review.repetition_number;
    let newInterval = review.interval_days;
    let newEase = review.ease_factor;

    switch (grade) {
      case 'again':
        newRepetition = 0;
        newInterval = intervals[0]; // 1 day
        newEase = Math.max(1.3, newEase - 0.2);
        break;
      case 'hard':
        newInterval = Math.max(1, Math.round(newInterval * 1.2));
        newEase = Math.max(1.3, newEase - 0.15);
        newRepetition += 1;
        break;
      case 'good': {
        const nextIndex = Math.min(newRepetition + 1, intervals.length - 1);
        newInterval = intervals[nextIndex];
        newRepetition += 1;
        break;
      }
      case 'easy': {
        const nextIndex = Math.min(newRepetition + 1, intervals.length - 1);
        newInterval = Math.round(intervals[nextIndex] * 1.3);
        newEase = Math.min(3.0, newEase + 0.15);
        newRepetition += 2;
        break;
      }
    }

    const nextDueDate = new Date(now.getTime() + newInterval * 24 * 60 * 60 * 1000);

    return {
      ...review,
      interval_days: newInterval,
      ease_factor: Number(newEase.toFixed(2)),
      repetition_number: newRepetition,
      due_date: nextDueDate.toISOString(),
      last_reviewed_at: now.toISOString(),
    };
  }

  /**
   * Generates interactive quiz questions from a set of saved cards.
   */
  static generateQuizFromCards(cards: Card[]): Array<{
    cardId: string;
    question: string;
    answer: string;
    options: string[];
    sourceSection: string;
  }> {
    return cards.map((card, idx) => ({
      cardId: card.id,
      question: `Key Concept: What is the core mechanism behind "${card.headline}"?`,
      answer: card.insight,
      options: [
        card.insight,
        `Alternative hypothesis: Focus solely on short-term optimization instead.`,
        `Surface metric: Increase raw volume without structural adjustments.`,
        `Passive assumption: Wait for external alignment before taking action.`,
      ].sort(() => (idx % 2 === 0 ? 0.5 - Math.random() : -0.5 + Math.random())),
      sourceSection: card.source_section_pointer,
    }));
  }

  private static calculateCalendarDayDifference(dateStr1: string, dateStr2: string): number {
    const d1 = new Date(dateStr1 + 'T00:00:00Z');
    const d2 = new Date(dateStr2 + 'T00:00:00Z');
    const diffTime = d2.getTime() - d1.getTime();
    return Math.round(diffTime / (1000 * 60 * 60 * 24));
  }

  private static getWeekId(timezone: string, date: Date): string {
    const localStr = this.getLocalDateString(timezone, date);
    const d = new Date(localStr + 'T00:00:00Z');
    const oneJan = new Date(d.getUTCFullYear(), 0, 1);
    const weekNum = Math.ceil(((d.getTime() - oneJan.getTime()) / 86400000 + oneJan.getUTCDay() + 1) / 7);
    return `${d.getUTCFullYear()}-W${weekNum.toString().padStart(2, '0')}`;
  }
}
