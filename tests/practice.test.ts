import { describe, it, expect } from 'vitest';
import { PracticeEngine, PRESET_SCENARIOS } from '../src/services/practiceEngine.ts';
import { QUOTAS } from '../src/config/index.ts';

describe('Practice Engine & Feedback Length Constraint (F12, F13)', () => {
  it('should provide at least 8 distinct preset scenarios', () => {
    expect(PRESET_SCENARIOS.length).toBeGreaterThanOrEqual(8);
  });

  it('should enforce that coaching feedback NEVER exceeds 30 words per turn', async () => {
    const session = PracticeEngine.startSession('test_user', 'scen_prof_raise', 'text');

    const testInputs = [
      'I believe my track record on the infrastructure revamp justifies a 15% increase.',
      'Last quarter I delivered the billing migration two weeks early, saving $120k annually in operating overhead.',
      'I have taken on leadership of three junior engineers while maintaining my personal sprint velocity.',
    ];

    for (const input of testInputs) {
      const { turn } = await PracticeEngine.evaluateTurn(session, input);

      const wordCount = turn.feedback.trim().split(/\s+/).length;
      expect(wordCount).toBeLessThanOrEqual(QUOTAS.MAX_PRACTICE_FEEDBACK_WORDS);
      expect(turn.clarity_score).toBeGreaterThanOrEqual(0);
      expect(turn.clarity_score).toBeLessThanOrEqual(100);
      expect(turn.tone_score).toBeGreaterThanOrEqual(0);
      expect(turn.structure_score).toBeGreaterThanOrEqual(0);
    }
  });

  it('should generate a comprehensive scorecard upon completion', async () => {
    const session = PracticeEngine.startSession('test_user', 'scen_prof_deadline', 'text');
    await PracticeEngine.evaluateTurn(session, 'We can hit the deadline by cutting secondary analytics scope.');

    const scorecard = PracticeEngine.generateFinalScorecard(session);

    expect(scorecard.overall_score).toBeGreaterThan(0);
    expect(scorecard.strengths.length).toBeGreaterThan(0);
    expect(scorecard.growth_areas.length).toBeGreaterThan(0);
    expect(scorecard.recommended_next_scenario).toBeDefined();
    expect(session.status).toBe('completed');
  });

  it('should intercept harmful or distress input safely', async () => {
    const session = PracticeEngine.startSession('test_user', 'scen_stud_qa', 'text');
    const { turn } = await PracticeEngine.evaluateTurn(session, 'I want to kill myself over this exam failure.');

    expect(turn.agent_reply).toContain('pause our roleplay');
  });
});
