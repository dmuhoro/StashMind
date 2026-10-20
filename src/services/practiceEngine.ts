/**
 * Practice Engine: Roleplay Sessions, Turn-by-Turn Feedback & Final Scorecards
 * Covers Requirements F12, F13 with STRICT <= 30-word feedback constraint.
 */

import {
  AUDIENCE_PRESETS,
  QUOTAS,
  MODELS,
  type AudiencePreset,
} from '../config/index.ts';
import { createAIClient } from './aiClient.ts';
import type { PracticeSession, PracticeTurn, PracticeScorecard } from '../db/types.ts';

export interface PracticeScenarioDefinition {
  id: string;
  title: string;
  audiencePreset: AudiencePreset;
  persona: string;
  context: string;
  initialPrompt: string;
}

export const PRESET_SCENARIOS: PracticeScenarioDefinition[] = [
  // Professional Scenarios
  {
    id: 'scen_prof_raise',
    title: 'Negotiating a Compensation Adjustment',
    audiencePreset: AUDIENCE_PRESETS.PROFESSIONAL,
    persona: 'Executive VP of People Operations (firm, pragmatic, metric-driven)',
    context: 'You are meeting with your manager/VP to request a salary increase based on exceptional impact and expanded team scope over the past year.',
    initialPrompt: 'Thanks for scheduling this time. I reviewed your annual self-assessment. What specific adjustment are you looking for, and what evidence supports it?',
  },
  {
    id: 'scen_prof_deadline',
    title: 'Pushing Back on an Unrealistic Deadline',
    audiencePreset: AUDIENCE_PRESETS.PROFESSIONAL,
    persona: 'Product Director (under executive pressure, urgent, impatient)',
    context: 'Leadership requested that a 6-week architecture overhaul be delivered in 2 weeks. You need to frame the engineering tradeoff without simply saying no.',
    initialPrompt: 'We need this feature shipped before the enterprise client demo in 10 business days. How are we hitting this timeline?',
  },
  {
    id: 'scen_prof_feedback',
    title: 'Delivering Difficult Peer Feedback',
    audiencePreset: AUDIENCE_PRESETS.PROFESSIONAL,
    persona: 'Senior Teammate (defensive, experienced, sensitive to critique)',
    context: 'A respected peer consistently misses handoff deadlines, blocking your deliverables. Address the pattern constructively using the SBI framework.',
    initialPrompt: 'You mentioned you wanted to catch up about our workflow. Did something go wrong with yesterday’s handoff?',
  },
  {
    id: 'scen_prof_interview',
    title: 'Executive Behavioral Interview (STAR Method)',
    audiencePreset: AUDIENCE_PRESETS.PROFESSIONAL,
    persona: 'Hiring Committee Lead (probing for accountability and high-stakes judgment)',
    context: 'You are interviewing for a principal role. You must recount a severe project failure and what you learned.',
    initialPrompt: 'Tell me about a time a major technical initiative under your ownership failed or missed its core milestone. What happened and how did you navigate it?',
  },

  // Student Scenarios
  {
    id: 'scen_stud_qa',
    title: 'Class Presentation Thesis Defense & Q&A',
    audiencePreset: AUDIENCE_PRESETS.STUDENT,
    persona: 'Professor of Economics / Examiner (rigorous, interrogating data validity)',
    context: 'You just finished presenting your capstone research paper. Defend your methodology against an unexpected critique.',
    initialPrompt: 'Your findings rely heavily on a small sample size in table 3. Why shouldn’t we view your primary correlation as statistically spurious?',
  },
  {
    id: 'scen_stud_office_hours',
    title: 'Advocating for Academic Assistance in Office Hours',
    audiencePreset: AUDIENCE_PRESETS.STUDENT,
    persona: 'Department Head (busy, values prepared students who show prior effort)',
    context: 'You are struggling with advanced multivariate concepts. Frame your confusion specifically to receive targeted guidance.',
    initialPrompt: 'Come in. I only have ten minutes before my faculty committee. Which specific proof from lecture 4 are you stuck on?',
  },
  {
    id: 'scen_stud_group_conflict',
    title: 'Resolving Group Project Slacking',
    audiencePreset: AUDIENCE_PRESETS.STUDENT,
    persona: 'Unresponsive Group Partner (distracted, making excuses, avoiding work)',
    context: 'Final presentation is in 48 hours. One teammate hasn’t contributed their assigned slides. Realign responsibilities calmly.',
    initialPrompt: 'Hey, I saw your five texts. Look, I’ve had three midterms this week and I haven’t had a minute to open the shared doc.',
  },

  // Learner Scenarios
  {
    id: 'scen_learn_pitch',
    title: '60-Second Intellectual Elevator Pitch',
    audiencePreset: AUDIENCE_PRESETS.LEARNER,
    persona: 'Curious Podcast Host (fast-paced, seeking crisp clarity without jargon)',
    context: 'You must explain a complex scientific or philosophical concept clearly to an educated general audience.',
    initialPrompt: 'Welcome! We have exactly one minute before the break. Can you explain the core breakthrough in quantum computing without using any buzzwords?',
  },
];

export class PracticeEngine {
  /**
   * Initializes a new practice session for a chosen scenario.
   */
  static startSession(
    userId: string,
    scenarioId: string,
    mode: 'text' | 'voice' = 'text'
  ): PracticeSession {
    const scenario = PRESET_SCENARIOS.find((s) => s.id === scenarioId) || PRESET_SCENARIOS[0];
    const now = new Date().toISOString();

    const session: PracticeSession = {
      id: `psess_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      user_id: userId,
      scenario_id: scenario.id,
      scenario_title: scenario.title,
      audience_preset: scenario.audiencePreset,
      persona: scenario.persona,
      mode,
      status: 'active',
      turns: [
        {
          id: `pturn_0`,
          turn_number: 0,
          user_input: '',
          agent_reply: scenario.initialPrompt,
          feedback: 'Session initiated. Respond directly to the prompt.',
          clarity_score: 100,
          tone_score: 100,
          structure_score: 100,
          timestamp: now,
        },
      ],
      created_at: now,
      updated_at: now,
    };

    return session;
  }

  /**
   * Evaluates a user response, returns conversational roleplay continuation,
   * and provides constructive feedback STRICTLY capped at 30 words.
   */
  static async evaluateTurn(
    session: PracticeSession,
    userInput: string
  ): Promise<{ turn: PracticeTurn; updatedSession: PracticeSession }> {
    // 1. Safety check
    if (this.detectAbuseOrDistress(userInput)) {
      const safetyTurn: PracticeTurn = {
        id: `pturn_${session.turns.length}`,
        turn_number: session.turns.length,
        user_input: userInput,
        agent_reply: 'Let’s pause our roleplay for a moment. StashMind is committed to safe, supportive learning. If you are experiencing distress, please reach out to trusted support resources.',
        feedback: 'Practice paused. Please ensure roleplay remains constructive and respectful.',
        clarity_score: 50,
        tone_score: 50,
        structure_score: 50,
        timestamp: new Date().toISOString(),
      };
      session.turns.push(safetyTurn);
      session.updated_at = new Date().toISOString();
      return { turn: safetyTurn, updatedSession: session };
    }

    const previousContext = session.turns
      .map((t) => (t.user_input ? `User: ${t.user_input}\nPersona: ${t.agent_reply}` : `Persona: ${t.agent_reply}`))
      .join('\n');

    const systemInstruction = `You are roleplaying as: "${session.persona}".
Scenario: "${session.scenario_title}".
AUDIENCE PRESET: ${session.audience_preset}.
Respond in character to the user's latest statement.
CRITICAL CONSTRAINT: You must also output an instructional coaching feedback string.
The feedback MUST BE AT MOST 30 WORDS. Specific, actionable, kind, constructive. Never exceed 30 words.
Also grade Clarity (0-100), Tone (0-100), and Structure (0-100).`;

    const prompt = `CONVERSATION SO FAR:
${previousContext}

USER'S LATEST TURN:
"${userInput}"

Evaluate the turn and reply as the persona.`;

    const schema = {
      type: 'object',
      properties: {
        agent_reply: { type: 'string' },
        feedback: { type: 'string', description: 'Coaching tip strictly under 30 words' },
        clarity_score: { type: 'number' },
        tone_score: { type: 'number' },
        structure_score: { type: 'number' },
      },
      required: ['agent_reply', 'feedback', 'clarity_score', 'tone_score', 'structure_score'],
    };

    let evaluation: {
      agent_reply: string;
      feedback: string;
      clarity_score: number;
      tone_score: number;
      structure_score: number;
    };

    const aiClient = createAIClient();

    try {
      const response = await aiClient.generateStructuredJson<typeof evaluation>({
        systemInstruction,
        prompt,
        schema,
        model: MODELS.FLASH,
      });
      evaluation = response.data;
    } catch {
      // Fail closed: no fallback when AI generation fails
      throw new Error(
        'AI_GENERATION_FAILED: Could not evaluate practice turn. AI client returned an error.'
      );
    }

    // STRICTLY ENFORCE 30-WORD FEEDBACK LIMIT
    evaluation.feedback = this.trimFeedbackToThirtyWords(evaluation.feedback);

    const newTurn: PracticeTurn = {
      id: `pturn_${session.turns.length}`,
      turn_number: session.turns.length,
      user_input: userInput,
      agent_reply: evaluation.agent_reply,
      feedback: evaluation.feedback,
      clarity_score: Math.min(100, Math.max(0, evaluation.clarity_score)),
      tone_score: Math.min(100, Math.max(0, evaluation.tone_score)),
      structure_score: Math.min(100, Math.max(0, evaluation.structure_score)),
      timestamp: new Date().toISOString(),
    };

    session.turns.push(newTurn);
    session.updated_at = new Date().toISOString();

    return { turn: newTurn, updatedSession: session };
  }

  /**
   * Concludes a practice session and generates a comprehensive scorecard.
   */
  static generateFinalScorecard(session: PracticeSession): PracticeScorecard {
    const validTurns = session.turns.filter((t) => t.user_input);

    if (validTurns.length === 0) {
      return {
        overall_score: 70,
        clarity_average: 70,
        tone_average: 70,
        structure_average: 70,
        summary: 'Session completed with initial baseline metrics.',
        strengths: ['Prompt readiness', 'Willingness to practice'],
        growth_areas: ['Complete multiple interactive turns to generate detailed analytics.'],
        recommended_next_scenario: 'scen_prof_feedback',
      };
    }

    const clarityAvg = Math.round(validTurns.reduce((acc, t) => acc + t.clarity_score, 0) / validTurns.length);
    const toneAvg = Math.round(validTurns.reduce((acc, t) => acc + t.tone_score, 0) / validTurns.length);
    const structAvg = Math.round(validTurns.reduce((acc, t) => acc + t.structure_score, 0) / validTurns.length);
    const overall = Math.round((clarityAvg + toneAvg + structAvg) / 3);

    const strengths: string[] = [];
    const growthAreas: string[] = [];

    if (clarityAvg >= 80) strengths.push('Clear framing without ambiguous terminology.');
    else growthAreas.push('Anchor statements with specific numbers and verifiable examples.');

    if (toneAvg >= 80) strengths.push('Firm, collaborative tone maintaining composure under pushback.');
    else growthAreas.push('Soften defensive phrasing; focus on shared team outcomes.');

    if (structAvg >= 80) strengths.push('Structured argument following Situation-Impact-Resolution.');
    else growthAreas.push('Lead with your primary ask before presenting background details.');

    const scorecard: PracticeScorecard = {
      overall_score: overall,
      clarity_average: clarityAvg,
      tone_average: toneAvg,
      structure_average: structAvg,
      summary: `Completed ${validTurns.length} turns in "${session.scenario_title}". Demonstrates strong core competence with targeted growth opportunities.`,
      strengths: strengths.length > 0 ? strengths : ['Courage to tackle challenging conversation'],
      growth_areas: growthAreas.length > 0 ? growthAreas : ['Continue refining brevity under pressure'],
      recommended_next_scenario: session.scenario_id.includes('raise') ? 'scen_prof_deadline' : 'scen_stud_qa',
    };

    session.final_scorecard = scorecard;
    session.status = 'completed';
    session.updated_at = new Date().toISOString();

    return scorecard;
  }

  private static trimFeedbackToThirtyWords(feedback: string): string {
    const words = feedback.trim().split(/\s+/);
    if (words.length <= QUOTAS.MAX_PRACTICE_FEEDBACK_WORDS) {
      return feedback;
    }
    return words.slice(0, QUOTAS.MAX_PRACTICE_FEEDBACK_WORDS).join(' ') + '...';
  }

  private static detectAbuseOrDistress(text: string): boolean {
    const lower = text.toLowerCase();
    const abusiveOrDistressMarkers = [
      'kill myself',
      'hurt myself',
      'suicide',
      'die alone',
      'threaten you',
      'slit your',
    ];
    return abusiveOrDistressMarkers.some((marker) => lower.includes(marker));
  }

  private static createFallbackTurnEvaluation(userInput: string) {
    const wordCount = userInput.split(/\s+/).length;
    return {
      agent_reply: 'I understand your perspective. Given that, what specific next step do you propose we commit to right now?',
      feedback: wordCount > 25
        ? 'Great substance. Next turn, lead with your primary conclusion first to maximize executive clarity.'
        : 'Good direct answer. Add one concrete proof point or metric to strengthen your position.',
      clarity_score: Math.min(95, 70 + wordCount),
      tone_score: 82,
      structure_score: 78,
    };
  }
}
