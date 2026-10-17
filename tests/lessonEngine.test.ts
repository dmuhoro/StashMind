import { describe, it, expect } from 'vitest';
import { LessonEngine } from '../src/services/lessonEngine.ts';
import { AUDIENCE_PRESETS } from '../src/config/index.ts';

describe('Lesson Engine & Grounding (Requirements F6, F17, Presets)', () => {
  it('should generate a grounded structured lesson with cards and section markers', async () => {
    const sourceText = `The MapReduce programming model consists of two primary functions: Map and Reduce.
The Map function takes an input pair and produces a set of intermediate key/value pairs.
The Reduce function accepts an intermediate key and a set of values for that key, merging them together to form a smaller set of values.`;

    const { lesson, cards } = await LessonEngine.generateLesson({
      userId: 'test_user_01',
      sourceTitle: 'MapReduce Architecture',
      sourceText,
      audiencePreset: AUDIENCE_PRESETS.STUDENT,
      style: 'tldr',
      durationMinutes: 10,
    });

    // Check lesson structure
    expect(lesson.id).toBeDefined();
    expect(lesson.title).toBe('MapReduce Architecture');
    expect(lesson.script.length).toBeGreaterThan(0);
    expect(lesson.sections.length).toBeGreaterThan(0);

    // Verify dual-host dialogue
    const speakers = new Set(lesson.script.map((line) => line.speaker));
    expect(speakers.has('Alex')).toBe(true);
    expect(speakers.has('Sam')).toBe(true);

    // CRITICAL GROUNDING CHECK: Every card MUST reference a source section pointer
    expect(cards.length).toBeGreaterThan(0);
    for (const card of cards) {
      expect(card.headline).toBeDefined();
      expect(card.insight).toBeDefined();
      expect(card.actionable_takeaway).toBeDefined();
      expect(card.source_section_pointer).toBeDefined();
      expect(card.source_section_pointer.length).toBeGreaterThan(3);
    }
  });

  it('should honor audience presets without breaking architecture', async () => {
    const sourceText = 'Delegation is the assignment of responsibility or authority to another person.';

    const studentResult = await LessonEngine.generateLesson({
      userId: 'test_user_02',
      sourceTitle: 'Delegation Principles',
      sourceText,
      audiencePreset: AUDIENCE_PRESETS.STUDENT,
    });

    const proResult = await LessonEngine.generateLesson({
      userId: 'test_user_02',
      sourceTitle: 'Delegation Principles',
      sourceText,
      audiencePreset: AUDIENCE_PRESETS.PROFESSIONAL,
    });

    expect(studentResult.lesson.audience_preset).toBe(AUDIENCE_PRESETS.STUDENT);
    expect(proResult.lesson.audience_preset).toBe(AUDIENCE_PRESETS.PROFESSIONAL);
  });
});
