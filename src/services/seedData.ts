/**
 * Seed Data: 10 High-Quality Demo Lessons across Student, Learner, and Professional Presets
 * Pre-seeded with grounded insight cards, host dialogue scripts, and audio timestamps.
 */

import { AUDIENCE_PRESETS, TTS_PROVIDER_DUAL_HOST } from '../config/index.ts';
import type { Lesson, Card } from '../db/types.ts';

export interface SeedLessonPackage {
  lesson: Lesson;
  cards: Card[];
}

export const SEED_LESSONS: SeedLessonPackage[] = [
  // 1. Student (Exam Prep) - Biology
  {
    lesson: {
      id: 'les_seed_bio_01',
      user_id: 'user_student_demo',
      content_hash: 'sha256_bio_krebs_01',
      title: 'Cellular Respiration & The Krebs Cycle',
      summary: 'Master the high-yield bioenergetics pathways: Glycolysis, the Citric Acid Cycle, and the Electron Transport Chain.',
      audience_preset: AUDIENCE_PRESETS.STUDENT,
      style: 'tldr',
      target_duration_minutes: 10,
      status: 'ready',
      audio_duration_seconds: 600,
      tts_provider: TTS_PROVIDER_DUAL_HOST,
      sections: [
        { id: 'sec_1', title: 'Glycolysis & Pyruvate Conversion', start_second: 0, end_second: 180, summary: 'Net ATP yield from substrate-level phosphorylation.', source_excerpt: 'Glycolysis yields 2 net ATP and 2 NADH per glucose molecule.' },
        { id: 'sec_2', title: 'The Mitochondrial Matrix Cycle', start_second: 181, end_second: 380, summary: 'Oxaloacetate regeneration and electron carrier reduction.', source_excerpt: 'Acetyl-CoA combines with oxaloacetate to form citrate.' },
        { id: 'sec_3', title: 'Chemiosmosis & ATP Synthase', start_second: 381, end_second: 600, summary: 'Proton gradient dynamics across the inner mitochondrial membrane.', source_excerpt: 'Complex IV transfers electrons to oxygen, the terminal electron acceptor.' },
      ],
      script: [
        { speaker: 'Alex', text: 'Welcome back! Today we are cracking one of the highest-yield topics on the exam: cellular respiration.', sectionMarkerId: 'sec_1' },
        { speaker: 'Sam', text: '|yeah| Students often lose points confusing substrate-level phosphorylation with oxidative phosphorylation.', sectionMarkerId: 'sec_1' },
        { speaker: 'Alex', text: 'What is the biggest trap question professors set here?', sectionMarkerId: 'sec_2' },
        { speaker: 'Sam', text: 'Tracking the carbon count! <breath> You start with a 6-carbon glucose, split into two 3-carbon pyruvates, and enter the Krebs cycle as 2-carbon Acetyl-CoA.', sectionMarkerId: 'sec_2' },
        { speaker: 'Alex', text: '<laugh> That explains it! And where does the bulk of ATP actually come from?', sectionMarkerId: 'sec_3' },
        { speaker: 'Sam', text: 'Chemiosmosis. The proton gradient powered by the electron transport chain drives ATP synthase to produce around 26 to 28 ATP.', sectionMarkerId: 'sec_3' },
      ],
      prompt_version: '2026-10-v1.0.0',
      created_at: '2026-10-17T00:00:00.000Z',
      updated_at: '2026-10-17T00:00:00.000Z',
    },
    cards: [
      {
        id: 'card_seed_bio_1',
        lesson_id: 'les_seed_bio_01',
        user_id: 'user_student_demo',
        headline: 'Substrate vs Oxidative Phosphorylation',
        insight: 'Glycolysis and Krebs generate only 4 ATP directly via substrate-level phosphorylation; the remaining 26-28 ATP rely on the proton-motive force.',
        actionable_takeaway: 'On exam questions, look for whether ATP is formed by direct enzymatic transfer or the inner membrane electrochemical gradient.',
        source_section_pointer: 'Section 1 (Lines 14-22)',
        audio_timestamp_seconds: 45,
        card_order: 1,
        tags: ['student', 'biology', 'exam-prep'],
        created_at: '2026-10-17T00:00:00.000Z',
        rating: null,
        edited: false,
        edited_at: null,
      },
      {
        id: 'card_seed_bio_2',
        lesson_id: 'les_seed_bio_01',
        user_id: 'user_student_demo',
        headline: 'Terminal Electron Acceptor Dynamics',
        insight: 'Oxygen serves as the terminal electron acceptor in Complex IV; without it, the entire electron transport chain backs up, halting Krebs.',
        actionable_takeaway: 'Remember that cyanide halts respiration by inhibiting Complex IV cytochrome c oxidase.',
        source_section_pointer: 'Section 3 (Lines 48-55)',
        audio_timestamp_seconds: 420,
        card_order: 2,
        tags: ['student', 'biochemistry'],
        created_at: '2026-10-17T00:00:00.000Z',
        rating: null,
        edited: false,
        edited_at: null,
      },
    ],
  },

  // 2. Student (Exam Prep) - Computer Science
  {
    lesson: {
      id: 'les_seed_cs_02',
      user_id: 'user_student_demo',
      content_hash: 'sha256_cs_algos_02',
      title: 'Dynamic Programming: Memoization vs Tabulation',
      summary: 'Deconstruct optimal substructure and overlapping subproblems with top-down and bottom-up state transitions.',
      audience_preset: AUDIENCE_PRESETS.STUDENT,
      style: 'debate',
      target_duration_minutes: 5,
      status: 'ready',
      audio_duration_seconds: 300,
      tts_provider: TTS_PROVIDER_DUAL_HOST,
      sections: [
        { id: 'sec_1', title: 'Recognizing Overlapping Subproblems', start_second: 0, end_second: 120, summary: 'When to upgrade recursion to DP.', source_excerpt: 'Dynamic programming requires optimal substructure and overlapping subproblems.' },
        { id: 'sec_2', title: 'Top-Down Memoization Trade-Offs', start_second: 121, end_second: 210, summary: 'Call-stack overhead vs intuitive recursion.', source_excerpt: 'Memoization caches recursive results in a hash table or array.' },
        { id: 'sec_3', title: 'Bottom-Up Tabulation & Space Optimization', start_second: 211, end_second: 300, summary: 'Rolling arrays and O(1) space tricks.', source_excerpt: 'Tabulation builds solutions iteratively from base cases.' },
      ],
      script: [
        { speaker: 'Alex', text: 'Let’s settle this classic argument: is top-down memoization practically as good as bottom-up tabulation?', sectionMarkerId: 'sec_1' },
        { speaker: 'Sam', text: '|mhm| Recursion with memoization is easier to write, but you pay a hidden tax in call-stack frames.', sectionMarkerId: 'sec_2' },
        { speaker: 'Alex', text: 'And in interviews, that call-stack overhead can cause a recursion depth error on large inputs!', sectionMarkerId: 'sec_2' },
        { speaker: 'Sam', text: 'Exactly. <breath> Tabulation forces you to identify your state dependencies early, which often lets you optimize O(N) space down to O(1).', sectionMarkerId: 'sec_3' },
      ],
      prompt_version: '2026-10-v1.0.0',
      created_at: '2026-10-17T00:00:00.000Z',
      updated_at: '2026-10-17T00:00:00.000Z',
    },
    cards: [
      {
        id: 'card_seed_cs_1',
        lesson_id: 'les_seed_cs_02',
        user_id: 'user_student_demo',
        headline: 'Space Optimization via Rolling Variables',
        insight: 'When state `dp[i]` only depends on `dp[i-1]` and `dp[i-2]`, discard the array and maintain two scalar variables.',
        actionable_takeaway: 'Always ask in coding interviews: "Do I need the full history, or just the previous k states?"',
        source_section_pointer: 'Section 3 (Lines 32-40)',
        audio_timestamp_seconds: 240,
        card_order: 1,
        tags: ['student', 'algorithms', 'interviews'],
        created_at: '2026-10-17T00:00:00.000Z',
        rating: null,
        edited: false,
        edited_at: null,
      },
    ],
  },

  // 3. Professional - Leadership & Engineering
  {
    lesson: {
      id: 'les_seed_prof_03',
      user_id: 'user_pro_demo',
      content_hash: 'sha256_prof_roadmaps_03',
      title: 'Managing Up: The Three-Box Tradeoff Framework',
      summary: 'How to push back on impossible executive deadlines by reframing constraints as explicit business choices.',
      audience_preset: AUDIENCE_PRESETS.PROFESSIONAL,
      style: 'tldr',
      target_duration_minutes: 5,
      status: 'ready',
      audio_duration_seconds: 300,
      tts_provider: TTS_PROVIDER_DUAL_HOST,
      sections: [
        { id: 'sec_1', title: 'Why Simple Refusal Fails', start_second: 0, end_second: 90, summary: 'Saying no sounds like lack of drive.', source_excerpt: 'Executives interpret "we cannot" as engineering intransigence.' },
        { id: 'sec_2', title: 'The Three-Box Choice Architecture', start_second: 91, end_second: 210, summary: 'Scope, Quality, and Date trade-offs.', source_excerpt: 'Presenting explicit alternatives puts leadership in control of the business risk.' },
        { id: 'sec_3', title: 'Executing the Negotiation Script', start_second: 211, end_second: 300, summary: 'Word-for-word executive phrasing.', source_excerpt: 'We can hit October 15th if we defer the analytics module to v1.1.' },
      ],
      script: [
        { speaker: 'Alex', text: 'When your VP demands a three-month feature in four weeks, your initial instinct is usually to protest.', sectionMarkerId: 'sec_1' },
        { speaker: 'Sam', text: '|yeah| And that’s a trap. When you say "that’s impossible", leadership hears "you aren’t trying hard enough".', sectionMarkerId: 'sec_1' },
        { speaker: 'Alex', text: 'So how do you reframe it without overcommitting your engineers?', sectionMarkerId: 'sec_2' },
        { speaker: 'Sam', text: 'You present the Three-Box choice. <breath> "We can hit the November 1st date if we cut the reporting tier, or we can keep the full scope and deliver December 10th. Which aligns better with Q4 targets?"', sectionMarkerId: 'sec_3' },
      ],
      prompt_version: '2026-10-v1.0.0',
      created_at: '2026-10-17T00:00:00.000Z',
      updated_at: '2026-10-17T00:00:00.000Z',
    },
    cards: [
      {
        id: 'card_seed_prof_1',
        lesson_id: 'les_seed_prof_03',
        user_id: 'user_pro_demo',
        headline: 'The Trade-off Framing Technique',
        insight: 'Replace defensive pushback ("We can’t do that") with strategic prioritization ("We can deliver X by date Y if we defer Z").',
        actionable_takeaway: 'In your next roadmap review, draft two viable packages and make the executive sponsor choose between them.',
        source_section_pointer: 'Section 2 (Lines 18-29)',
        audio_timestamp_seconds: 140,
        card_order: 1,
        tags: ['professional', 'leadership', 'communication'],
        created_at: '2026-10-17T00:00:00.000Z',
        rating: null,
        edited: false,
        edited_at: null,
      },
    ],
  },

  // 4. Learner - Complex Systems
  {
    lesson: {
      id: 'les_seed_learn_04',
      user_id: 'user_pro_demo',
      content_hash: 'sha256_learn_coop_04',
      title: 'The Evolution of Cooperation in Repeated Games',
      summary: 'Why reciprocal altruism emerges naturally in hostile environments: Axelrod’s tournaments and Tit-for-Tat.',
      audience_preset: AUDIENCE_PRESETS.LEARNER,
      style: 'eli5',
      target_duration_minutes: 10,
      status: 'ready',
      audio_duration_seconds: 600,
      tts_provider: TTS_PROVIDER_DUAL_HOST,
      sections: [
        { id: 'sec_1', title: 'The Prisoner’s Dilemma Trap', start_second: 0, end_second: 180, summary: 'Defection in one-shot games.', source_excerpt: 'In single encounters, rational self-interest leads both players to defect.' },
        { id: 'sec_2', title: 'The Shadow of the Future', start_second: 181, end_second: 390, summary: 'Repeated interactions shift the equilibrium.', source_excerpt: 'When future interaction is probable, long-term reciprocity outweighs immediate betrayal.' },
        { id: 'sec_3', title: 'The 4 Rules of Winning Strategies', start_second: 391, end_second: 600, summary: 'Nice, retaliatory, forgiving, and clear.', source_excerpt: 'Tit-for-Tat succeeded because it was never envious and immediately forgiving.' },
      ],
      script: [
        { speaker: 'Alex', text: 'If evolution rewards survival of the fittest, why is nature filled with creatures helping each other?', sectionMarkerId: 'sec_1' },
        { speaker: 'Sam', text: '|right| Robert Axelrod ran a famous computer tournament in 1980 that revealed the answer.', sectionMarkerId: 'sec_1' },
        { speaker: 'Alex', text: 'And the winning program was shockingly simple, wasn’t it?', sectionMarkerId: 'sec_2' },
        { speaker: 'Sam', text: 'Just four lines of code called Tit-for-Tat! <laugh> Start by cooperating, and then simply mimic whatever the other player did on the previous turn.', sectionMarkerId: 'sec_2' },
      ],
      prompt_version: '2026-10-v1.0.0',
      created_at: '2026-10-17T00:00:00.000Z',
      updated_at: '2026-10-17T00:00:00.000Z',
    },
    cards: [
      {
        id: 'card_seed_learn_1',
        lesson_id: 'les_seed_learn_04',
        user_id: 'user_pro_demo',
        headline: 'Axelrod’s Four Rules for Enduring Reciprocity',
        insight: 'Successful strategies are: 1) Be nice (never defect first), 2) Be retaliatory (respond to defection immediately), 3) Be forgiving (return to cooperation after one turn), 4) Be clear (predictable to opponents).',
        actionable_takeaway: 'In professional negotiations, establish immediate generosity followed by clear, non-spiteful boundaries.',
        source_section_pointer: 'Section 3 (Lines 42-51)',
        audio_timestamp_seconds: 410,
        card_order: 1,
        tags: ['learner', 'game-theory', 'mental-models'],
        created_at: '2026-10-17T00:00:00.000Z',
        rating: null,
        edited: false,
        edited_at: null,
      },
    ],
  },
];
