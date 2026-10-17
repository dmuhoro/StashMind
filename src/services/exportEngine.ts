/**
 * Export Engine: Markdown, JSON, and CSV (Anki/Quizlet) Deck Exporter
 * Covers Requirement F18 and Account Data Export.
 */

import type { Lesson, Card } from '../db/types.ts';

export class ExportEngine {
  /**
   * Exports cards as formatted Markdown.
   */
  static exportToMarkdown(lesson: Lesson, cards: Card[]): string {
    const lines: string[] = [
      `# ${lesson.title}`,
      ``,
      `> **Summary**: ${lesson.summary}`,
      `> **Preset**: ${lesson.audience_preset} | **Style**: ${lesson.style} | **Duration**: ${lesson.target_duration_minutes}m`,
      ``,
      `---`,
      `## Grounded Insight Cards`,
      ``,
    ];

    cards.forEach((card, idx) => {
      lines.push(`### ${idx + 1}. ${card.headline}`);
      lines.push(`- **Insight**: ${card.insight}`);
      lines.push(`- **Actionable Takeaway**: ${card.actionable_takeaway}`);
      lines.push(`- **Source Section**: ${card.source_section_pointer}`);
      lines.push(`- **Audio Timestamp**: ${Math.floor(card.audio_timestamp_seconds / 60)}:${(card.audio_timestamp_seconds % 60).toString().padStart(2, '0')}`);
      lines.push(`- **Tags**: ${card.tags.join(', ')}`);
      lines.push(``);
    });

    lines.push(`---`);
    lines.push(`## Host Dialogue Script`);
    lines.push(``);
    lesson.script.forEach((line) => {
      lines.push(`**${line.speaker}**: ${line.text}`);
    });

    return lines.join('\n');
  }

  /**
   * Exports cards as CSV compatible with Anki and Quizlet flashcard imports.
   * Format: "Front (Headline & Question)","Back (Insight & Actionable Takeaway)","Tags"
   */
  static exportToCsv(lesson: Lesson, cards: Card[]): string {
    const headers = ['Front', 'Back', 'SourcePointer', 'AudioTimestamp', 'Tags'];
    const rows = [headers.join(',')];

    cards.forEach((card) => {
      const front = `"${this.escapeCsv(card.headline)}"`;
      const back = `"${this.escapeCsv(`${card.insight}\n\nActionable: ${card.actionable_takeaway}`)}"`;
      const source = `"${this.escapeCsv(card.source_section_pointer)}"`;
      const timestamp = `"${card.audio_timestamp_seconds}s"`;
      const tags = `"${this.escapeCsv(card.tags.join(' '))}"`;

      rows.push([front, back, source, timestamp, tags].join(','));
    });

    return rows.join('\n');
  }

  /**
   * Exports cards and lesson as structured JSON.
   */
  static exportToJson(lesson: Lesson, cards: Card[]): string {
    return JSON.stringify(
      {
        version: '1.0.0',
        exported_at: new Date().toISOString(),
        lesson: {
          id: lesson.id,
          title: lesson.title,
          summary: lesson.summary,
          audience_preset: lesson.audience_preset,
          style: lesson.style,
          target_duration_minutes: lesson.target_duration_minutes,
          audio_url: lesson.audio_url,
          sections: lesson.sections,
          script: lesson.script,
        },
        cards: cards.map((c) => ({
          headline: c.headline,
          insight: c.insight,
          actionable_takeaway: c.actionable_takeaway,
          source_section_pointer: c.source_section_pointer,
          audio_timestamp_seconds: c.audio_timestamp_seconds,
          tags: c.tags,
        })),
      },
      null,
      2
    );
  }

  private static escapeCsv(text: string): string {
    return text.replace(/"/g, '""');
  }
}
