# StashMind Product Context

## Capabilities
1. Dual-host audio lessons (Alex & Sam) via Gemini TTS
2. Grounded insight cards with source section pointers
3. Roleplay practice with <= 30-word feedback and scorecards
4. Spaced repetition + timezone streaks + weekly freeze
5. Deck export (Markdown, JSON, CSV/Anki)
6. Headless REST API + MCP + webhooks

## Audience Presets
- student: exam prep, definitions, test questions, memory anchors, citations
- learner: curiosity, mental models, interdisciplinary parallels
- professional: actionable execution, negotiation, commute-friendly

## Lesson Styles
- tldr, eli5, debate, deep_dive
- Durations: 5, 10, 20 minutes

## Requirements Matrix (F1-F19) — from BUILD_STATE.md
All 19 requirements are claimed "Verified/PASS" but several rely on simulated/in-memory implementations (see data.md, performance.md, integrations.md gaps).

## Tier 1 (Mobile-First, Low-Bandwidth, African Users)
1. Telegram bot ingestion (webhook on Express)
2. Data-saver mode: low-bitrate Opus, downloadable lessons, text-only weak-signal switch
3. Ask the source: chat over own material with citations + passage highlights
4. Card quality controls: source excerpt on card, thumbs up/down, edit cards, fixture evals
5. Study mode: quiz + flashcards from notes/past papers, Anki export
6. Swahili lessons + audio (test TTS voice support first)
7. Local payments: M-Pesa (Daraja/IntaSend), KES pricing, student tier via school email

## EasyTutor Merge (Tier 2)
- Model router: Gemini, Anthropic, Groq, local Ollama
- Local TTS: Piper or Kokoro for offline
- Shared core package between StashMind (Next.js/Gemini) and EasyTutor (React Native/Expo/Ollama)
