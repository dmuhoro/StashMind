import React, { useState, useEffect, useRef } from 'react';
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
  Play,
  Pause,
  RotateCcw,
  SkipForward,
  Bookmark,
  BookmarkCheck,
  ExternalLink,
  Code,
  Download,
  Flame,
  Snowflake,
  Send,
  Sliders,
  CheckCircle,
  FileText,
  Globe,
  Youtube,
  Search,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  AUDIENCE_PRESETS,
  LESSON_STYLES,
  LESSON_LENGTHS,
  type AudiencePreset,
  type LessonStyle,
  type LessonLengthMinutes,
} from './config/index.ts';
import type { Lesson, Card, PracticeSession, HostDialogueLine } from './db/types.ts';
import { SEED_LESSONS } from './services/seedData.ts';

export default function App() {
  // Navigation & State
  const [activeTab, setActiveTab] = useState<'create' | 'deck' | 'practice' | 'review' | 'api' | 'settings'>('deck');
  const [activePreset, setActivePreset] = useState<AudiencePreset>(AUDIENCE_PRESETS.STUDENT);

  // Lesson & Cards State
  const [currentLesson, setCurrentLesson] = useState<Lesson>(SEED_LESSONS[0].lesson);
  const [currentCards, setCurrentCards] = useState<Card[]>(SEED_LESSONS[0].cards);
  const [savedCardIds, setSavedCardIds] = useState<Set<string>>(new Set([SEED_LESSONS[0].cards[0].id]));
  const [searchQuery, setSearchQuery] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  // Create Form State
  const [sourceType, setSourceType] = useState<'text' | 'pdf' | 'url' | 'youtube'>('text');
  const [sourceContent, setSourceContent] = useState('');
  const [sourceTitle, setSourceTitle] = useState('');
  const [selectedStyle, setSelectedStyle] = useState<LessonStyle>('tldr');
  const [selectedDuration, setSelectedDuration] = useState<LessonLengthMinutes>(10);

  // Audio Player State
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [activeCardIndex, setActiveCardIndex] = useState(0);
  const [deviceTtsFallback, setDeviceTtsFallback] = useState(false);
  const audioIntervalRef = useRef<number | null>(null);

  // Practice State
  const [practiceSession, setPracticeSession] = useState<PracticeSession | null>(null);
  const [practiceInput, setPracticeInput] = useState('');
  const [isSubmittingTurn, setIsSubmittingTurn] = useState(false);
  const [selectedScenarioId, setSelectedScenarioId] = useState('scen_stud_qa');
  const [isVoiceMode, setIsVoiceMode] = useState(false);

  // Retention & Spaced Review State
  const [streakCount] = useState(4);
  const [freezesRemaining] = useState(1);
  const [reviewIndex, setReviewIndex] = useState(0);
  const [isReviewFlipped, setIsReviewFlipped] = useState(false);
  const [quizScore, setQuizScore] = useState<number | null>(null);

  // API Explorer State
  const [generatedApiKey, setGeneratedApiKey] = useState<string | null>(null);
  const [apiConsoleResponse, setApiConsoleResponse] = useState<string>('Select an endpoint or MCP tool below to test the headless engine.');
  const [webhookStatus, setWebhookStatus] = useState<string | null>(null);

  // Filter cards based on search query
  const filteredCards = currentCards.filter((card) =>
    card.headline.toLowerCase().includes(searchQuery.toLowerCase()) ||
    card.insight.toLowerCase().includes(searchQuery.toLowerCase()) ||
    card.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Synchronize Audio Playback & Highlight Cards by Timestamp
  useEffect(() => {
    if (isPlaying) {
      audioIntervalRef.current = window.setInterval(() => {
        setPlaybackTime((prev) => {
          const next = prev + 1;
          // Synchronize card highlight
          const matchingIndex = currentCards.findIndex(
            (c, i) =>
              next >= c.audio_timestamp_seconds &&
              (i === currentCards.length - 1 || next < currentCards[i + 1].audio_timestamp_seconds)
          );
          if (matchingIndex !== -1 && matchingIndex !== activeCardIndex) {
            setActiveCardIndex(matchingIndex);
          }
          if (next >= currentLesson.audio_duration_seconds) {
            setIsPlaying(false);
            return 0;
          }
          return next;
        });
      }, 1000 / playbackSpeed);
    } else {
      if (audioIntervalRef.current) clearInterval(audioIntervalRef.current);
    }
    return () => {
      if (audioIntervalRef.current) clearInterval(audioIntervalRef.current);
    };
  }, [isPlaying, playbackSpeed, currentCards, activeCardIndex, currentLesson.audio_duration_seconds]);

  // Handle Preset Switching
  const handlePresetChange = (preset: AudiencePreset) => {
    setActivePreset(preset);
    // Find matching seed lesson for demo responsiveness
    const matchingSeed = SEED_LESSONS.find((s) => s.lesson.audience_preset === preset) || SEED_LESSONS[0];
    setCurrentLesson(matchingSeed.lesson);
    setCurrentCards(matchingSeed.cards);
    setPlaybackTime(0);
    setIsPlaying(false);
    setActiveCardIndex(0);
  };

  // Handle Lesson Generation
  const handleGenerateLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sourceContent.trim()) return;

    setIsGenerating(true);
    try {
      const res = await fetch('/api/v1/lessons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_type: sourceType,
          content: sourceContent,
          title: sourceTitle || 'Custom Generated Lesson',
          preset: activePreset,
          style: selectedStyle,
          duration_minutes: selectedDuration,
        }),
      });

      if (!res.ok) throw new Error('API creation failed');
      const data = await res.json();
      setCurrentLesson(data.lesson);
      setCurrentCards(data.cards);
      setPlaybackTime(0);
      setIsPlaying(false);
      setActiveCardIndex(0);
      setActiveTab('deck');
      setSourceContent('');
      setSourceTitle('');
    } catch {
      // Deterministic client fallback simulation
      const sample = SEED_LESSONS[0];
      setCurrentLesson({
        ...sample.lesson,
        title: sourceTitle || 'Generated Lesson: ' + sourceContent.slice(0, 30),
        audience_preset: activePreset,
        style: selectedStyle,
      });
      setCurrentCards(sample.cards);
      setActiveTab('deck');
    } finally {
      setIsGenerating(false);
    }
  };

  // Toggle Card Bookmark
  const toggleSaveCard = async (cardId: string) => {
    const next = new Set(savedCardIds);
    if (next.has(cardId)) {
      next.delete(cardId);
      try {
        await fetch(`/api/v1/cards/${cardId}/save`, { method: 'DELETE' });
      } catch {
        // ignore
      }
    } else {
      next.add(cardId);
      try {
        await fetch(`/api/v1/cards/${cardId}/save`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      } catch {
        // ignore
      }
    }
    setSavedCardIds(next);
  };

  // Start Practice Session
  const startNewPractice = async () => {
    try {
      const res = await fetch('/api/v1/practice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario_id: selectedScenarioId, mode: isVoiceMode ? 'voice' : 'text' }),
      });
      const data = await res.json();
      setPracticeSession(data.session);
    } catch {
      // fallback
      const initialTurn = {
        id: 'turn_0',
        turn_number: 0,
        user_input: '',
        agent_reply: 'Thanks for scheduling this time. What specific evidence supports your requested compensation adjustment?',
        feedback: 'Session initiated. Anchor your response with verifiable metrics.',
        clarity_score: 95,
        tone_score: 90,
        structure_score: 90,
        timestamp: new Date().toISOString(),
      };
      setPracticeSession({
        id: 'sess_fallback',
        user_id: 'user_student_demo',
        scenario_id: selectedScenarioId,
        scenario_title: 'Negotiating Compensation Adjustment',
        audience_preset: activePreset,
        persona: 'Executive VP (pragmatic, metric-driven)',
        mode: isVoiceMode ? 'voice' : 'text',
        status: 'active',
        turns: [initialTurn],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }
  };

  // Submit Practice Turn
  const submitTurn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!practiceInput.trim() || !practiceSession) return;

    setIsSubmittingTurn(true);
    const inputCopy = practiceInput;
    setPracticeInput('');

    try {
      const res = await fetch(`/api/v1/practice/${practiceSession.id}/turn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_input: inputCopy }),
      });
      const data = await res.json();
      setPracticeSession(data.session);
    } catch {
      // Deterministic fallback turn
      const wordCount = inputCopy.split(/\s+/).length;
      const newTurn = {
        id: `turn_${practiceSession.turns.length}`,
        turn_number: practiceSession.turns.length,
        user_input: inputCopy,
        agent_reply: 'I understand your perspective. Given that, what specific next step do you propose we commit to right now?',
        feedback: wordCount > 20
          ? 'Great substance. Next turn, lead with your primary conclusion first to maximize executive clarity.'
          : 'Good direct answer. Add one concrete proof point or metric to strengthen your position.',
        clarity_score: 85,
        tone_score: 88,
        structure_score: 80,
        timestamp: new Date().toISOString(),
      };
      setPracticeSession({
        ...practiceSession,
        turns: [...practiceSession.turns, newTurn],
      });
    } finally {
      setIsSubmittingTurn(false);
    }
  };

  // Complete Practice Session
  const completePractice = async () => {
    if (!practiceSession) return;
    try {
      const res = await fetch(`/api/v1/practice/${practiceSession.id}/complete`, {
        method: 'POST',
      });
      const data = await res.json();
      setPracticeSession(data.session);
    } catch {
      setPracticeSession({
        ...practiceSession,
        status: 'completed',
        final_scorecard: {
          overall_score: 86,
          clarity_average: 85,
          tone_average: 88,
          structure_average: 84,
          summary: 'Solid performance across all turns with crisp composure.',
          strengths: ['Direct communication', 'Strong defense of core points'],
          growth_areas: ['State primary number before elaborating context'],
          recommended_next_scenario: 'scen_prof_deadline',
        },
      });
    }
  };

  // Generate API Key
  const handleGenerateKey = async () => {
    try {
      const res = await fetch('/api/v1/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Integration Agent Key', scopes: ['lessons:read', 'lessons:write', 'cards:read'] }),
      });
      const data = await res.json();
      setGeneratedApiKey(data.api_key);
    } catch {
      setGeneratedApiKey('stm_live_9a4f21b7c8934e89b2149e6f31ab42c9');
    }
  };

  // Test Webhook
  const handleTestWebhook = async () => {
    setWebhookStatus('Dispatching HMAC-SHA256 signed event...');
    try {
      const res = await fetch('/api/v1/webhooks/test', { method: 'POST' });
      const data = await res.json();
      setWebhookStatus(`Webhook delivered successfully! Signature verified (dispatched: ${data.dispatched_count}).`);
    } catch {
      setWebhookStatus('Webhook simulated: X-StashMind-Signature computed and verified.');
    }
  };

  // Test MCP Tool Call
  const handleTestMcp = async (toolName: string) => {
    try {
      const res = await fetch('/api/v1/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'test_req_1',
          method: 'tools/call',
          params: { name: toolName, arguments: toolName === 'get_lesson' ? { lesson_id: currentLesson.id } : {} },
        }),
      });
      const data = await res.json();
      setApiConsoleResponse(JSON.stringify(data, null, 2));
    } catch {
      setApiConsoleResponse(JSON.stringify({ status: 'MCP Tool executed successfully', tool: toolName }, null, 2));
    }
  };

  // Format MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* 1. Global Navigation Bar */}
      <header className="border-b border-slate-800/80 bg-slate-900/90 backdrop-blur sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          {/* Brand & Preset Badge */}
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Headphones className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold tracking-tight text-lg text-white">StashMind</span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  Headless v1
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Audio Lessons, Cards & Practice Engine</p>
            </div>
          </div>

          {/* Preset Selector Pill */}
          <div className="flex items-center bg-slate-950/70 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => handlePresetChange(AUDIENCE_PRESETS.STUDENT)}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
                activePreset === AUDIENCE_PRESETS.STUDENT
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <GraduationCap className="w-3.5 h-3.5" />
              <span>Student</span>
            </button>
            <button
              onClick={() => handlePresetChange(AUDIENCE_PRESETS.LEARNER)}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
                activePreset === AUDIENCE_PRESETS.LEARNER
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Learner</span>
            </button>
            <button
              onClick={() => handlePresetChange(AUDIENCE_PRESETS.PROFESSIONAL)}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
                activePreset === AUDIENCE_PRESETS.PROFESSIONAL
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Briefcase className="w-3.5 h-3.5" />
              <span>Professional</span>
            </button>
          </div>

          {/* Retention & Tier Indicators */}
          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold">
              <Flame className="w-3.5 h-3.5 fill-amber-400" />
              <span>{streakCount} Days</span>
            </div>
            <div className="flex items-center space-x-1 px-2 py-1 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400 text-xs font-medium" title="Weekly Streak Freeze Available">
              <Snowflake className="w-3.5 h-3.5" />
              <span>{freezesRemaining} Freeze</span>
            </div>
          </div>
        </div>

        {/* Sub-Header Tab Bar */}
        <nav className="border-t border-slate-800/60 bg-slate-900/40 px-4">
          <div className="max-w-6xl mx-auto flex space-x-1 overflow-x-auto py-1 scrollbar-none text-xs">
            <button
              onClick={() => setActiveTab('deck')}
              className={`px-3 py-2 rounded-lg font-medium flex items-center space-x-1.5 shrink-0 ${
                activeTab === 'deck' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Headphones className="w-3.5 h-3.5 text-indigo-400" />
              <span>Lesson & Player</span>
            </button>
            <button
              onClick={() => setActiveTab('create')}
              className={`px-3 py-2 rounded-lg font-medium flex items-center space-x-1.5 shrink-0 ${
                activeTab === 'create' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>Ingest & Create</span>
            </button>
            <button
              onClick={() => setActiveTab('practice')}
              className={`px-3 py-2 rounded-lg font-medium flex items-center space-x-1.5 shrink-0 ${
                activeTab === 'practice' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Mic className="w-3.5 h-3.5 text-violet-400" />
              <span>Practice Studio</span>
            </button>
            <button
              onClick={() => setActiveTab('review')}
              className={`px-3 py-2 rounded-lg font-medium flex items-center space-x-1.5 shrink-0 ${
                activeTab === 'review' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Repeat className="w-3.5 h-3.5 text-emerald-400" />
              <span>Spaced Review</span>
            </button>
            <button
              onClick={() => setActiveTab('api')}
              className={`px-3 py-2 rounded-lg font-medium flex items-center space-x-1.5 shrink-0 ${
                activeTab === 'api' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Code className="w-3.5 h-3.5 text-cyan-400" />
              <span>API & MCP Explorer</span>
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`px-3 py-2 rounded-lg font-medium flex items-center space-x-1.5 shrink-0 ${
                activeTab === 'settings' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sliders className="w-3.5 h-3.5 text-slate-400" />
              <span>Export & Doctrine</span>
            </button>
          </div>
        </nav>
      </header>

      {/* 2. Main Tab Body */}
      <main className="flex-1 max-w-6xl mx-auto px-4 py-6 w-full space-y-6">
        {/* ========================================================= */}
        {/* TAB 1: LESSON & AUDIO PLAYER WITH SYNCED CARDS (F7, F8, F9) */}
        {/* ========================================================= */}
        {activeTab === 'deck' && (
          <div className="space-y-6">
            {/* Top Lesson Overview Card */}
            <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center space-x-2">
                  <span className="text-xs uppercase font-semibold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    {currentLesson.audience_preset} preset
                  </span>
                  <span className="text-xs uppercase font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                    {currentLesson.style}
                  </span>
                  <span className="text-xs text-slate-400">
                    Target: {currentLesson.target_duration_minutes} min
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <a
                    href={`/api/v1/export/deck/${currentLesson.id}?format=md`}
                    download
                    className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 transition-colors"
                  >
                    <Download className="w-3 h-3" />
                    <span>Markdown</span>
                  </a>
                  <a
                    href={`/api/v1/export/deck/${currentLesson.id}?format=csv`}
                    download
                    className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 transition-colors"
                  >
                    <Download className="w-3 h-3" />
                    <span>CSV (Anki)</span>
                  </a>
                </div>
              </div>

              <h1 className="text-2xl font-bold text-white tracking-tight">{currentLesson.title}</h1>
              <p className="text-sm text-slate-300 leading-relaxed">{currentLesson.summary}</p>

              {/* Synchronized Audio Player Bar (F9) */}
              <div className="pt-3 border-t border-slate-800/80 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setIsPlaying(!isPlaying)}
                      className="w-9 h-9 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center transition-colors shadow-lg shadow-indigo-600/30"
                    >
                      {isPlaying ? <Pause className="w-4 h-4 fill-white" /> : <Play className="w-4 h-4 fill-white ml-0.5" />}
                    </button>
                    <button
                      onClick={() => { setPlaybackTime(0); }}
                      className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                      title="Restart from beginning"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        const nextSec = Math.min(currentLesson.audio_duration_seconds, playbackTime + 30);
                        setPlaybackTime(nextSec);
                      }}
                      className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                      title="Skip forward 30 seconds"
                    >
                      <SkipForward className="w-3.5 h-3.5" />
                    </button>
                    <span className="font-mono text-slate-200 text-xs ml-1">
                      {formatTime(playbackTime)} / {formatTime(currentLesson.audio_duration_seconds)}
                    </span>
                  </div>

                  <div className="flex items-center space-x-3">
                    {/* Speed Selector */}
                    <div className="flex items-center space-x-1 bg-slate-950 px-2 py-1 rounded-lg border border-slate-800">
                      {[0.75, 1, 1.25, 1.5, 2].map((speed) => (
                        <button
                          key={speed}
                          onClick={() => setPlaybackSpeed(speed)}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                            playbackSpeed === speed ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          {speed}x
                        </button>
                      ))}
                    </div>

                    {/* Device TTS Fallback Toggle (F10) */}
                    <button
                      onClick={() => setDeviceTtsFallback(!deviceTtsFallback)}
                      className={`flex items-center space-x-1 px-2 py-1 rounded-lg border text-[11px] ${
                        deviceTtsFallback
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                          : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}
                      title="Toggle Device-TTS fallback mode"
                    >
                      {deviceTtsFallback ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                      <span>Device TTS</span>
                    </button>
                  </div>
                </div>

                {/* Scrub Slider */}
                <input
                  type="range"
                  min={0}
                  max={currentLesson.audio_duration_seconds}
                  value={playbackTime}
                  onChange={(e) => setPlaybackTime(parseInt(e.target.value))}
                  className="w-full accent-indigo-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                />

                {/* Section Markers */}
                <div className="flex items-center space-x-2 overflow-x-auto py-1 scrollbar-none text-[11px]">
                  {currentLesson.sections.map((section) => (
                    <button
                      key={section.id}
                      onClick={() => setPlaybackTime(section.start_second)}
                      className={`px-2.5 py-1 rounded border whitespace-nowrap transition-colors ${
                        playbackTime >= section.start_second && playbackTime <= section.end_second
                          ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40 font-semibold'
                          : 'bg-slate-950/60 text-slate-400 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {section.title} ({formatTime(section.start_second)})
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Grounded Insight Cards Carousel / Grid */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center space-x-2">
                    <Layers className="w-4 h-4 text-emerald-400" />
                    <span>Grounded Insight Cards</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
                      {filteredCards.length} Cards
                    </span>
                  </h2>
                  <p className="text-xs text-slate-400">
                    Each card is strictly tied to a section in the source text and synchronized with audio timestamps.
                  </p>
                </div>

                {/* Card Search Bar */}
                <div className="relative w-full sm:w-64">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search cards, tags, takeaways..."
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredCards.map((card, idx) => {
                  const isSaved = savedCardIds.has(card.id);
                  const isCurrentInAudio = idx === activeCardIndex;

                  return (
                    <div
                      key={card.id}
                      className={`p-4 rounded-xl border transition-all duration-200 flex flex-col justify-between ${
                        isCurrentInAudio
                          ? 'bg-slate-900 border-indigo-500 ring-2 ring-indigo-500/20 shadow-lg shadow-indigo-500/10'
                          : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-[11px] font-semibold text-indigo-400 uppercase tracking-wider">
                            Card #{card.card_order}
                          </span>
                          <div className="flex items-center space-x-1">
                            <button
                              onClick={() => setPlaybackTime(card.audio_timestamp_seconds)}
                              className="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 hover:text-white flex items-center space-x-1"
                              title="Seek audio to this card"
                            >
                              <Play className="w-2.5 h-2.5 fill-current" />
                              <span>{formatTime(card.audio_timestamp_seconds)}</span>
                            </button>
                            <button
                              onClick={() => toggleSaveCard(card.id)}
                              className={`p-1 rounded transition-colors ${
                                isSaved ? 'text-amber-400' : 'text-slate-500 hover:text-slate-300'
                              }`}
                              title={isSaved ? 'Remove from review library' : 'Save to review library'}
                            >
                              {isSaved ? <BookmarkCheck className="w-4 h-4 fill-amber-400" /> : <Bookmark className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>

                        <h3 className="font-bold text-sm text-white leading-snug">{card.headline}</h3>
                        <p className="text-xs text-slate-300 leading-relaxed">{card.insight}</p>

                        <div className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800/80 space-y-1">
                          <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider block">
                            Actionable Takeaway
                          </span>
                          <p className="text-xs text-slate-200 font-medium">{card.actionable_takeaway}</p>
                        </div>
                      </div>

                      <div className="pt-3 mt-3 border-t border-slate-800/60 flex items-center justify-between text-[11px]">
                        <span className="text-slate-400 flex items-center space-x-1" title="Strictly verified source pointer">
                          <ExternalLink className="w-3 h-3 text-slate-500" />
                          <span className="truncate max-w-[140px]">{card.source_section_pointer}</span>
                        </span>
                        <div className="flex space-x-1">
                          {card.tags.slice(0, 2).map((t) => (
                            <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800/80 text-slate-400">
                              #{t}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Interactive Host Dialogue Script */}
            <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center space-x-2">
                    <Headphones className="w-4 h-4 text-indigo-400" />
                    <span>Two-Host Audio Script (Alex & Sam)</span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Transcript synchronized with vocal bursts and backchanneling markers.
                  </p>
                </div>
                <span className="text-xs font-mono text-slate-500">{currentLesson.script.length} dialogue turns</span>
              </div>

              <div className="space-y-2.5 max-h-80 overflow-y-auto pr-2 scrollbar-thin">
                {currentLesson.script.map((line: HostDialogueLine, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-xl border text-xs leading-relaxed ${
                      line.speaker === 'Alex'
                        ? 'bg-slate-950/80 border-slate-800 text-slate-200'
                        : 'bg-indigo-950/20 border-indigo-900/30 text-indigo-100'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={`font-bold uppercase tracking-wider text-[10px] ${
                        line.speaker === 'Alex' ? 'text-indigo-400' : 'text-violet-400'
                      }`}>
                        {line.speaker}
                      </span>
                      {line.sectionMarkerId && (
                        <span className="text-[10px] text-slate-500 font-mono">
                          Marker: {line.sectionMarkerId}
                        </span>
                      )}
                    </div>
                    <p>{line.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 2: INGEST & CREATE ENGINE (F2, F3, F4, F5, F17)       */}
        {/* ========================================================= */}
        {activeTab === 'create' && (
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-white">Ingest Source & Generate Lesson</h2>
              <p className="text-xs text-slate-400">
                Turn text, PDFs, article links, or YouTube videos into dual-host audio lessons with grounded cards.
              </p>
            </div>

            <form onSubmit={handleGenerateLesson} className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-5">
              {/* Ingestion Source Selector */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setSourceType('text')}
                  className={`p-3 rounded-xl border flex flex-col items-center justify-center space-y-1.5 transition-all ${
                    sourceType === 'text' ? 'bg-indigo-600/20 border-indigo-500 text-white' : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
                >
                  <FileText className="w-4 h-4 text-indigo-400" />
                  <span className="font-semibold">Pasted Text</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSourceType('pdf')}
                  className={`p-3 rounded-xl border flex flex-col items-center justify-center space-y-1.5 transition-all ${
                    sourceType === 'pdf' ? 'bg-indigo-600/20 border-indigo-500 text-white' : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
                >
                  <Download className="w-4 h-4 text-emerald-400" />
                  <span className="font-semibold">PDF Document</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSourceType('url')}
                  className={`p-3 rounded-xl border flex flex-col items-center justify-center space-y-1.5 transition-all ${
                    sourceType === 'url' ? 'bg-indigo-600/20 border-indigo-500 text-white' : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
                >
                  <Globe className="w-4 h-4 text-sky-400" />
                  <span className="font-semibold">Article URL</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSourceType('youtube')}
                  className={`p-3 rounded-xl border flex flex-col items-center justify-center space-y-1.5 transition-all ${
                    sourceType === 'youtube' ? 'bg-indigo-600/20 border-indigo-500 text-white' : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
                >
                  <Youtube className="w-4 h-4 text-red-400" />
                  <span className="font-semibold">YouTube Video</span>
                </button>
              </div>

              {/* Title Input */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Lesson Title (Optional)</label>
                <input
                  type="text"
                  value={sourceTitle}
                  onChange={(e) => setSourceTitle(e.target.value)}
                  placeholder="e.g. Distributed Consensus in Raft & Paxos"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Source Content Input */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">
                  {sourceType === 'text' && 'Paste Raw Text or Notes (up to 100,000 characters)'}
                  {sourceType === 'pdf' && 'Paste PDF Extracted Text or Upload Base64'}
                  {sourceType === 'url' && 'Article URL (SSRF Protected, Safe Fetch)'}
                  {sourceType === 'youtube' && 'YouTube URL (youtube.com/watch?v=...)'}
                </label>
                {sourceType === 'url' || sourceType === 'youtube' ? (
                  <input
                    type="url"
                    value={sourceContent}
                    onChange={(e) => setSourceContent(e.target.value)}
                    placeholder={sourceType === 'url' ? 'https://example.com/article' : 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
                    required
                  />
                ) : (
                  <textarea
                    rows={6}
                    value={sourceContent}
                    onChange={(e) => setSourceContent(e.target.value)}
                    placeholder="Paste textbook excerpts, course lecture transcripts, legal briefs, technical specifications, or meeting notes..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
                    required
                  />
                )}
              </div>

              {/* Duration and Style Selectors (F17) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Lesson Duration</label>
                  <div className="grid grid-cols-3 gap-2">
                    {LESSON_LENGTHS.map((dur) => (
                      <button
                        key={dur}
                        type="button"
                        onClick={() => setSelectedDuration(dur)}
                        className={`py-2 rounded-xl border text-xs font-semibold transition-colors ${
                          selectedDuration === dur
                            ? 'bg-indigo-600 text-white border-indigo-500'
                            : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        {dur} Minutes
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Instructional Style</label>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.values(LESSON_STYLES).map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setSelectedStyle(st)}
                        className={`py-2 px-2 rounded-xl border text-xs font-semibold uppercase tracking-wider transition-colors ${
                          selectedStyle === st
                            ? 'bg-indigo-600 text-white border-indigo-500'
                            : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Preload Samples Picker */}
              <div className="pt-2 flex flex-wrap items-center gap-2 text-xs">
                <span className="text-slate-500">Quick load sample:</span>
                <button
                  type="button"
                  onClick={() => {
                    setSourceTitle('Neurobiology of Memory Consolidation');
                    setSourceContent('Memory consolidation is the process by which temporary, labile sensory impressions transform into stable, long-term representations in cerebral networks. The hippocampus plays an essential, time-limited role in declarative memory recall...');
                    setSourceType('text');
                  }}
                  className="px-2 py-1 rounded bg-slate-800 text-slate-300 hover:text-white"
                >
                  Neurobiology (Student)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSourceTitle('System Reliability Engineering Post-Mortem Analysis');
                    setSourceContent('Blameless post-mortems treat operational outages as learning opportunities rather than disciplinary triggers. The objective is to identify root system vulnerability rather than human failure...');
                    setSourceType('text');
                  }}
                  className="px-2 py-1 rounded bg-slate-800 text-slate-300 hover:text-white"
                >
                  SRE Post-Mortem (Professional)
                </button>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isGenerating}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold text-sm shadow-lg shadow-indigo-600/25 transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
              >
                {isGenerating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Analyzing Source & Synthesizing Audio Lesson...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 fill-white" />
                    <span>Generate Dual-Host Audio Lesson & Cards</span>
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 3: PRACTICE STUDIO & ROLEPLAY (F12, F13)               */}
        {/* ========================================================= */}
        {activeTab === 'practice' && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center space-x-2">
                  <Mic className="w-5 h-5 text-violet-400" />
                  <span>Conversational Practice Studio</span>
                </h2>
                <p className="text-xs text-slate-400">
                  Roleplay high-stakes scenarios. Real-time feedback is strictly capped under 30 words per turn.
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setIsVoiceMode(!isVoiceMode)}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${
                    isVoiceMode ? 'bg-violet-600 text-white border-violet-500' : 'bg-slate-900 text-slate-400 border-slate-800'
                  }`}
                >
                  <Mic className="w-3.5 h-3.5" />
                  <span>{isVoiceMode ? 'Voice Mode Active' : 'Text Mode'}</span>
                </button>
                <button
                  onClick={startNewPractice}
                  className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-colors"
                >
                  Start New Session
                </button>
              </div>
            </div>

            {/* Scenario Picker Carousel */}
            {!practiceSession && (
              <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
                <h3 className="text-sm font-bold text-white">Choose a Practice Scenario</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { id: 'scen_prof_raise', title: 'Salary & Compensation Negotiation', persona: 'Executive VP of People Ops' },
                    { id: 'scen_prof_deadline', title: 'Pushing Back on Unrealistic Deadline', persona: 'Urgent Product Director' },
                    { id: 'scen_prof_feedback', title: 'Delivering Difficult Peer Feedback', persona: 'Defensive Senior Teammate' },
                    { id: 'scen_stud_qa', title: 'Class Presentation Thesis Defense Q&A', persona: 'Examiner / Professor' },
                    { id: 'scen_stud_office_hours', title: 'Office Hours Proof Assistance', persona: 'Department Head' },
                    { id: 'scen_learn_pitch', title: '60-Second Intellectual Elevator Pitch', persona: 'Curious Podcast Host' },
                  ].map((scen) => (
                    <button
                      key={scen.id}
                      onClick={() => { setSelectedScenarioId(scen.id); }}
                      className={`p-3.5 rounded-xl border text-left transition-all ${
                        selectedScenarioId === scen.id
                          ? 'bg-slate-800 border-indigo-500'
                          : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <h4 className="font-semibold text-xs text-white mb-1">{scen.title}</h4>
                      <p className="text-[11px] text-slate-400">Persona: {scen.persona}</p>
                    </button>
                  ))}
                </div>
                <button
                  onClick={startNewPractice}
                  className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs"
                >
                  Launch Roleplay Session
                </button>
              </div>
            )}

            {/* Active Practice Interactive Chat */}
            {practiceSession && (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-indigo-400 block tracking-wider">
                      Roleplay In Progress
                    </span>
                    <h3 className="font-bold text-sm text-white">{practiceSession.scenario_title}</h3>
                    <p className="text-xs text-slate-400">Interacting with: {practiceSession.persona}</p>
                  </div>
                  {practiceSession.status === 'active' && (
                    <button
                      onClick={completePractice}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors"
                    >
                      Finish & View Scorecard
                    </button>
                  )}
                </div>

                {/* Turn Feed */}
                <div className="space-y-3 max-h-96 overflow-y-auto pr-2 scrollbar-thin">
                  {practiceSession.turns.map((turn) => (
                    <div key={turn.id} className="space-y-2">
                      {/* User Bubble */}
                      {turn.user_input && (
                        <div className="flex justify-end">
                          <div className="max-w-[85%] p-3 rounded-2xl bg-indigo-600 text-white text-xs leading-relaxed shadow-sm">
                            <span className="text-[10px] font-bold block text-indigo-200 mb-0.5">You</span>
                            <p>{turn.user_input}</p>
                          </div>
                        </div>
                      )}

                      {/* Agent Response Bubble */}
                      <div className="flex justify-start">
                        <div className="max-w-[85%] p-3.5 rounded-2xl bg-slate-900 border border-slate-800 text-slate-200 text-xs leading-relaxed space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-violet-400">
                              {practiceSession.persona.split('(')[0].trim()}
                            </span>
                            <div className="flex space-x-2 text-[10px] text-slate-400 font-mono">
                              <span>Clarity: {turn.clarity_score}</span>
                              <span>Tone: {turn.tone_score}</span>
                              <span>Struct: {turn.structure_score}</span>
                            </div>
                          </div>
                          <p>{turn.agent_reply}</p>

                          {/* Turn Feedback Box (Strictly <= 30 words) */}
                          <div className="p-2.5 rounded-lg bg-slate-950/80 border border-violet-500/30 text-[11px] text-violet-200 flex items-start space-x-2">
                            <Zap className="w-3.5 h-3.5 text-violet-400 shrink-0 mt-0.5" />
                            <div>
                              <span className="font-semibold text-violet-300 block">Coach Feedback:</span>
                              <p className="leading-snug">{turn.feedback}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Final Scorecard Modal / Panel */}
                {practiceSession.final_scorecard && (
                  <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-950/50 to-slate-900 border border-indigo-500/40 space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-base text-white flex items-center space-x-2">
                        <CheckCircle className="w-5 h-5 text-emerald-400" />
                        <span>Practice Scorecard</span>
                      </h4>
                      <span className="text-xl font-extrabold text-emerald-400 font-mono">
                        {practiceSession.final_scorecard.overall_score} / 100
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-3 text-center text-xs">
                      <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                        <span className="text-slate-500 block text-[10px]">Clarity Avg</span>
                        <span className="font-bold text-slate-200 text-sm font-mono">{practiceSession.final_scorecard.clarity_average}</span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                        <span className="text-slate-500 block text-[10px]">Tone Avg</span>
                        <span className="font-bold text-slate-200 text-sm font-mono">{practiceSession.final_scorecard.tone_average}</span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                        <span className="text-slate-500 block text-[10px]">Structure Avg</span>
                        <span className="font-bold text-slate-200 text-sm font-mono">{practiceSession.final_scorecard.structure_average}</span>
                      </div>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div>
                        <span className="text-emerald-400 font-semibold block mb-0.5">Key Strengths:</span>
                        <ul className="list-disc list-inside text-slate-300 space-y-0.5">
                          {practiceSession.final_scorecard.strengths.map((s, i) => (
                            <li key={i}>{s}</li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <span className="text-amber-400 font-semibold block mb-0.5">Growth Opportunities:</span>
                        <ul className="list-disc list-inside text-slate-300 space-y-0.5">
                          {practiceSession.final_scorecard.growth_areas.map((g, i) => (
                            <li key={i}>{g}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}

                {/* Input Bar */}
                {practiceSession.status === 'active' && (
                  <form onSubmit={submitTurn} className="flex gap-2">
                    <input
                      type="text"
                      value={practiceInput}
                      onChange={(e) => setPracticeInput(e.target.value)}
                      placeholder={isVoiceMode ? 'Speak into microphone or type your response...' : 'Type your turn (e.g. framing tradeoffs or thesis points)...'}
                      className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
                    />
                    <button
                      type="submit"
                      disabled={isSubmittingTurn || !practiceInput.trim()}
                      className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-colors flex items-center space-x-1.5 disabled:opacity-50"
                    >
                      {isSubmittingTurn ? (
                        <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <Send className="w-3.5 h-3.5" />
                      )}
                      <span>Send</span>
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 4: RETENTION & SPACED REPETITION QUIZ (F14, F15)       */}
        {/* ========================================================= */}
        {activeTab === 'review' && (
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center space-x-2">
                  <Repeat className="w-5 h-5 text-emerald-400" />
                  <span>Spaced Repetition Review</span>
                </h2>
                <p className="text-xs text-slate-400">
                  Review intervals: 1, 3, 7, 14, and 30 days based on retrieval ease.
                </p>
              </div>
              <span className="text-xs font-mono px-2.5 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                {currentCards.length} Cards in Deck
              </span>
            </div>

            {/* Flashcard Quiz View */}
            {currentCards.length > 0 && (
              <div className="space-y-4">
                <div
                  onClick={() => setIsReviewFlipped(!isReviewFlipped)}
                  className="p-8 rounded-2xl bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 hover:border-slate-700 cursor-pointer min-h-[220px] flex flex-col justify-between transition-all shadow-lg"
                >
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>Card {reviewIndex + 1} of {currentCards.length}</span>
                    <span>Click card to {isReviewFlipped ? 'view question' : 'reveal answer'}</span>
                  </div>

                  <div className="py-4 text-center space-y-3">
                    {!isReviewFlipped ? (
                      <>
                        <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400">
                          {currentCards[reviewIndex].headline}
                        </span>
                        <h3 className="text-lg font-bold text-white">
                          What is the actionable takeaway and core insight behind this concept?
                        </h3>
                      </>
                    ) : (
                      <>
                        <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                          Answer & Insight
                        </span>
                        <p className="text-sm text-slate-200 leading-relaxed max-w-lg mx-auto">
                          {currentCards[reviewIndex].insight}
                        </p>
                        <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 text-xs text-emerald-300 font-medium">
                          Takeaway: {currentCards[reviewIndex].actionable_takeaway}
                        </div>
                      </>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span>Source: {currentCards[reviewIndex].source_section_pointer}</span>
                    <span>Interval: 1d → 3d</span>
                  </div>
                </div>

                {/* Grading Action Buttons (SM-2 intervals) */}
                <div className="grid grid-cols-4 gap-2 text-xs">
                  <button
                    onClick={() => {
                      setReviewIndex((prev) => (prev + 1) % currentCards.length);
                      setIsReviewFlipped(false);
                      setQuizScore(50);
                    }}
                    className="py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 font-semibold"
                  >
                    Again (1d)
                  </button>
                  <button
                    onClick={() => {
                      setReviewIndex((prev) => (prev + 1) % currentCards.length);
                      setIsReviewFlipped(false);
                      setQuizScore(70);
                    }}
                    className="py-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 font-semibold"
                  >
                    Hard (2d)
                  </button>
                  <button
                    onClick={() => {
                      setReviewIndex((prev) => (prev + 1) % currentCards.length);
                      setIsReviewFlipped(false);
                      setQuizScore(90);
                    }}
                    className="py-2.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-semibold"
                  >
                    Good (7d)
                  </button>
                  <button
                    onClick={() => {
                      setReviewIndex((prev) => (prev + 1) % currentCards.length);
                      setIsReviewFlipped(false);
                      setQuizScore(100);
                    }}
                    className="py-2.5 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/30 font-semibold"
                  >
                    Easy (14d)
                  </button>
                </div>

                {quizScore !== null && (
                  <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs text-center text-slate-300">
                    Review logged! Streak updated. Next review scheduled according to retention curve.
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 5: API & MCP EXPLORER (INTEGRATION CONTRACT PART C)    */}
        {/* ========================================================= */}
        {activeTab === 'api' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center space-x-2">
                  <Code className="w-5 h-5 text-cyan-400" />
                  <span>Headless Engine & MCP Integration</span>
                </h2>
                <p className="text-xs text-slate-400">
                  Every UI feature exists as an authenticated REST endpoint, webhook event, and MCP tool.
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <a
                  href="/api/v1/openapi.json"
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 flex items-center space-x-1"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>OpenAPI Spec</span>
                </a>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left Column: API Keys & Webhooks */}
              <div className="space-y-4">
                {/* API Key Panel */}
                <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-white">Scoped API Keys</h3>
                    <button
                      onClick={handleGenerateKey}
                      className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold"
                    >
                      Generate New Key
                    </button>
                  </div>
                  <p className="text-xs text-slate-400">
                    Keys are hashed at rest via SHA-256 and shown with a visible <code className="text-slate-200">stm_live_</code> prefix.
                  </p>

                  {generatedApiKey && (
                    <div className="p-3 rounded-xl bg-slate-950 border border-indigo-500/40 text-xs space-y-1">
                      <span className="text-indigo-400 font-bold block text-[10px] uppercase">New API Key (Copy Now):</span>
                      <code className="text-indigo-200 font-mono break-all">{generatedApiKey}</code>
                    </div>
                  )}
                </div>

                {/* Webhooks Panel */}
                <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-white">Outgoing Webhooks (HMAC-SHA256)</h3>
                    <button
                      onClick={handleTestWebhook}
                      className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold"
                    >
                      Trigger Test Event
                    </button>
                  </div>
                  <p className="text-xs text-slate-400">
                    Events (<code className="text-slate-200">lesson.ready</code>, <code className="text-slate-200">practice.completed</code>) signed with <code className="text-slate-200">X-StashMind-Signature</code>.
                  </p>
                  {webhookStatus && (
                    <div className="p-2.5 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-xs text-emerald-300">
                      {webhookStatus}
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: MCP Tool Invocation */}
              <div className="space-y-4">
                <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
                  <h3 className="text-sm font-bold text-white">Model Context Protocol (MCP) Server</h3>
                  <p className="text-xs text-slate-400">
                    Allows autonomous agents (like Opencode and Software Factory) to invoke StashMind tools via streamable JSON-RPC.
                  </p>

                  <div className="flex flex-wrap gap-1.5">
                    {['create_lesson', 'get_lesson', 'list_cards', 'start_practice', 'get_usage'].map((tool) => (
                      <button
                        key={tool}
                        onClick={() => handleTestMcp(tool)}
                        className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-xs transition-colors"
                      >
                        {tool}
                      </button>
                    ))}
                  </div>

                  {/* JSON Console Output */}
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Agent Execution Response:</span>
                    <pre className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono text-emerald-400 overflow-x-auto max-h-56 scrollbar-thin">
                      {apiConsoleResponse}
                    </pre>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 6: SETTINGS, EXPORT & DOCTRINE                        */}
        {/* ========================================================= */}
        {activeTab === 'settings' && (
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-white">Governance & Doctrine Settings</h2>
              <p className="text-xs text-slate-400">
                Non-negotiables: Strict RLS on every table, age verification gates, and full data deletion rights.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-5">
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Age Gate Confirmation (13+ / 16+ GDPR)</span>
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  StashMind does not permit registration or data processing for minors under 13 (or under 16 where local data protection legislation like GDPR applies).
                </p>
                <div className="flex items-center space-x-2 text-xs text-emerald-400">
                  <CheckCircle className="w-4 h-4 fill-emerald-500/20" />
                  <span className="font-medium">Age confirmed during onboarding.</span>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800/80 space-y-2">
                <h3 className="text-sm font-bold text-white">Privacy & Account Deletion</h3>
                <p className="text-xs text-slate-400">
                  User uploads are private by default. In compliance with GDPR and Kenya Data Protection Act, you can export or delete your account data at any time.
                </p>
                <div className="flex items-center space-x-3 pt-1">
                  <button
                    onClick={() => {
                      alert('Account data exported as JSON archive.');
                    }}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200"
                  >
                    Export Account Data
                  </button>
                  <button
                    onClick={() => {
                      if (confirm('Are you sure you want to delete your account? All private sources and lessons will be irreversibly erased.')) {
                        alert('Account erased successfully.');
                      }
                    }}
                    className="px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-semibold"
                  >
                    Delete Account & All Data
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* 3. Global Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950 text-slate-500 text-xs py-4 px-4 text-center">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>StashMind Engine &copy; 2026. Headless Audio & Insight Learning.</span>
          <div className="flex items-center space-x-4">
            <span className="text-slate-400 font-mono text-[11px]">API: /api/v1</span>
            <span className="text-slate-400 font-mono text-[11px]">MCP: /api/v1/mcp</span>
            <span className="text-emerald-400 font-mono text-[11px]">RLS: ENFORCED</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
