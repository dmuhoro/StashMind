# ADR-006: Timezone-Aware Streaks and Spaced Repetition Scheduling

## Context
Evaluating learning streaks using UTC server time unfairly penalizes users living in non-UTC timezones (e.g. crossing midnight in Nairobi, Tokyo, or San Francisco). Additionally, rigid daily requirements lead to demotivation when unavoidable life disruptions occur.

## Decision
1. All streak calculations evaluate against the user's configured IANA timezone via `Intl.DateTimeFormat('en-CA', { timeZone })` yielding a local `YYYY-MM-DD` string.
2. Streak states:
   - Same-day repeat activity: no increment.
   - Day difference = 1: increment streak.
   - Day difference = 2 and freeze available: consume 1 weekly freeze to protect streak.
   - Missed > 2 days or no freeze: reset streak to 1.
3. Spaced repetition schedules review items across standard intervals: `[1, 3, 7, 14, 30]` days with ease factor adjustments based on user performance grading (Again, Hard, Good, Easy).

## Consequences
- Accurate and fair streak attribution across DST, travel, and global timezones.
- Higher long-term retention through grace mechanisms (weekly freeze).
