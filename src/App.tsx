import { useState } from 'react';
import {
  Headphones,
  Layers,
  Mic,
  Repeat,
  ShieldCheck,
  Zap,
  GraduationCap,
  Sparkles,
  Briefcase,
  CheckCircle2,
  Terminal,
  BookOpen,
} from 'lucide-react';
import {
  AUDIENCE_PRESETS,
  type AudiencePreset,
  MODELS,
  QUOTAS,
} from './config/index.ts';

export default function App() {
  const [activePreset, setActivePreset] = useState<AudiencePreset>(AUDIENCE_PRESETS.STUDENT);

  const presetDetails = {
    [AUDIENCE_PRESETS.STUDENT]: {
      label: 'University Student',
      icon: GraduationCap,
      focus: 'Exam Prep & Mastery',
      description: 'Emphasizes key definitions, high-yield exam questions, quiz generation, and verifiable citations to source text.',
      badgeColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
      sampleTopic: 'Cellular Respiration & Krebs Cycle',
      sampleCard: 'NADH vs FADH2: Yield differences and ATP synthesis mechanics',
    },
    [AUDIENCE_PRESETS.LEARNER]: {
      label: 'Lifelong Learner',
      icon: Sparkles,
      focus: 'Curiosity & Deep Ideas',
      description: 'Explores mental models, cross-discipline connections, philosophical context, and further reading explorations.',
      badgeColor: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
      sampleTopic: 'The Evolution of Cooperation in Complex Systems',
      sampleCard: 'Tit-for-Tat Dynamics: Why reciprocal altruism outlasts pure selfishness',
    },
    [AUDIENCE_PRESETS.PROFESSIONAL]: {
      label: 'Working Professional',
      icon: Briefcase,
      focus: 'Execution & Communication',
      description: 'Focuses on actionable executive summaries, conversational scripts, negotiation roleplays, and high-impact commute audio.',
      badgeColor: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30',
      sampleTopic: 'High-Stakes Technical Roadmap Pushback',
      sampleCard: 'The 3-Box Tradeoff: Framing deadline delays using resource realities',
    },
  };

  const currentPresetInfo = presetDetails[activePreset];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Top Header */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Headphones className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold tracking-tight text-lg text-white">StashMind</span>
                <span className="text-[10px] uppercase font-semibold tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Phase 0 Ready
                </span>
              </div>
              <p className="text-xs text-slate-400">Headless Audio & Card Learning Engine</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-1.5 px-3 py-1 rounded-lg bg-slate-800/80 border border-slate-700/60 text-xs text-slate-300">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span className="font-medium">Strict RLS & Isolation</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-5xl mx-auto px-4 py-8 w-full space-y-8">
        {/* Hero Section */}
        <div className="space-y-3">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700 text-xs text-indigo-400 font-medium">
            <Zap className="w-3.5 h-3.5" />
            <span>Turn any text, PDF, URL or YouTube video into active mastery</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
            Learn anything through dual-host audio, insight decks & voice practice.
          </h1>
          <p className="text-slate-400 text-sm sm:text-base max-w-2xl leading-relaxed">
            One headless engine with three presets. Ingest source material, generate two-host conversational lessons with synchronized cards, and cement retention through active roleplay.
          </p>
        </div>

        {/* Audience Preset Selector */}
        <section className="space-y-4 bg-slate-900/40 border border-slate-800 p-5 rounded-2xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-indigo-400" />
                Audience Presets
              </h2>
              <p className="text-xs text-slate-400">
                Switches prompt tuning, depth, and tone without altering the underlying architecture.
              </p>
            </div>
            <span className="text-xs font-mono text-slate-500">Preset: {activePreset}</span>
          </div>

          {/* Preset Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {(Object.values(AUDIENCE_PRESETS) as AudiencePreset[]).map((preset) => {
              const item = presetDetails[preset];
              const Icon = item.icon;
              const isSelected = activePreset === preset;

              return (
                <button
                  key={preset}
                  onClick={() => setActivePreset(preset)}
                  className={`p-4 rounded-xl border text-left transition-all duration-150 flex flex-col justify-between ${
                    isSelected
                      ? 'bg-slate-800/90 border-indigo-500 shadow-md shadow-indigo-500/10'
                      : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-2.5">
                      <div className={`p-2 rounded-lg ${isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300'}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <span className="font-semibold text-sm text-white">{item.label}</span>
                    </div>
                    {isSelected && <CheckCircle2 className="w-4 h-4 text-indigo-400" />}
                  </div>
                  <span className={`text-[11px] font-medium px-2 py-0.5 rounded border inline-block w-fit ${item.badgeColor}`}>
                    {item.focus}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Active Preset Preview Card */}
          <div className="mt-3 p-4 rounded-xl bg-slate-950/70 border border-slate-800/90 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Preset Configuration</span>
              <span className="text-xs text-indigo-400 font-medium">{currentPresetInfo.focus}</span>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed">
              {currentPresetInfo.description}
            </p>
            <div className="pt-2 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-slate-500 block mb-0.5">Sample Topic Ingestion</span>
                <span className="text-slate-200 font-medium">{currentPresetInfo.sampleTopic}</span>
              </div>
              <div>
                <span className="text-slate-500 block mb-0.5">Actionable Insight Card</span>
                <span className="text-slate-200 font-medium">{currentPresetInfo.sampleCard}</span>
              </div>
            </div>
          </div>
        </section>

        {/* The 4 Core Product Capabilities */}
        <section className="space-y-4">
          <h2 className="text-base font-semibold text-white">Core System Pillars</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800 space-y-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mb-1">
                <Headphones className="w-4 h-4" />
              </div>
              <h3 className="font-semibold text-sm text-white">1. Dual-Host Audio Lessons</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Assembles multi-speaker natural dialogue using <code className="text-slate-300 font-mono">gemini-3.8-flash-tts</code> with vocal bursts, laughter, and backchanneling. Resilient chunking and device-TTS fallback.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800 space-y-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mb-1">
                <Layers className="w-4 h-4" />
              </div>
              <h3 className="font-semibold text-sm text-white">2. Actionable Insight Decks</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Bite-sized cards synchronized to timestamps in the audio lesson. 100% grounded in source text with explicit pointers. Exportable to Markdown, JSON, and CSV.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800 space-y-2">
              <div className="w-8 h-8 rounded-lg bg-violet-500/10 border border-violet-500/20 text-violet-400 flex items-center justify-center mb-1">
                <Mic className="w-4 h-4" />
              </div>
              <h3 className="font-semibold text-sm text-white">3. Conversational Practice</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Roleplay scenarios tailored to each preset. Typed feedback restricted to 30 words per turn for maximum signal, with real-time voice practice powered by <code className="text-slate-300 font-mono">gemini-3.8-live</code>.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800 space-y-2">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mb-1">
                <Repeat className="w-4 h-4" />
              </div>
              <h3 className="font-semibold text-sm text-white">4. Spaced Repetition & Streaks</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Timezone-aware streaks with weekly freeze mechanics, quiz mode generated from saved cards, and scheduling intervals across 1, 3, 7, 14, and 30 days.
              </p>
            </div>
          </div>
        </section>

        {/* Phase 0 Status & Architecture Verification */}
        <section className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Terminal className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-semibold text-white">Phase 0 Architecture Verification</h3>
            </div>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Acceptance Passed
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
              <span className="text-slate-500 block">Flash Model</span>
              <span className="text-slate-200 font-mono">{MODELS.FLASH}</span>
            </div>
            <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
              <span className="text-slate-500 block">Dual TTS Model</span>
              <span className="text-slate-200 font-mono">{MODELS.TTS_DUAL_HOST}</span>
            </div>
            <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
              <span className="text-slate-500 block">Live Voice Model</span>
              <span className="text-slate-200 font-mono">{MODELS.LIVE_VOICE}</span>
            </div>
            <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
              <span className="text-slate-500 block">Feedback Word Cap</span>
              <span className="text-slate-200 font-mono">{QUOTAS.MAX_PRACTICE_FEEDBACK_WORDS} words max</span>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-indigo-950/30 border border-indigo-900/40 text-xs text-indigo-300 flex items-start space-x-2">
            <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold block text-indigo-200">Phase 0 Doctrine Complete:</span>
              <span>
                <code className="text-indigo-100">CONSTITUTION.md</code>, <code className="text-indigo-100">BUILD_STATE.md</code>, <code className="text-indigo-100">AGENTS.md</code>, <code className="text-indigo-100">ADR-001</code>, and <code className="text-indigo-100">ADR-002</code> recorded. CI passes clean. Ready for human authorization to begin Phase 1 (Foundation & Data).
              </span>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950 text-slate-500 text-xs py-4 px-4 text-center">
        StashMind Engine &copy; 2026. Built headless-first with strict RLS, OpenAPI 3.1, Webhooks & MCP tools.
      </footer>
    </div>
  );
}
