# ADR-005: Practice Feedback Word Constraint and Scoring Model

## Context
In conversational practice (F12, F13), verbosity from AI coaching models degrades the conversational rhythm. Users need immediate, actionable coaching during roleplay without reading long paragraphs between turns.

## Decision
1. System instructions and post-processing strictly enforce that turn feedback must not exceed 30 words (`QUOTAS.MAX_PRACTICE_FEEDBACK_WORDS = 30`).
2. Every turn evaluates three standardized 0-100 dimensions:
   - **Clarity:** Precision of language and lack of ambiguity.
   - **Tone:** Composure and emotional calibration under pressure.
   - **Structure:** Argument progression (e.g. Situation-Impact-Resolution).
3. Upon completion, a holistic scorecard aggregates averages, identifies top strengths, flags targeted growth areas, and suggests the next scenario.

## Consequences
- Fast turn cadence mimicking real high-stakes conversations.
- High signal-to-noise coaching that users can read in under 5 seconds.
