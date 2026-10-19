# StashMind Architect Context

## Stack
- React 19 + TypeScript (strict) + Vite + Tailwind CSS v4
- Express 4.21 server (`server.ts`) on port 3000
- `@google/genai` SDK (server-side only)
- Supabase PostgreSQL (target) — currently in-memory Map store (Tier 0 gap)
- Vitest for testing

## Headless-First Doctrine
Every capability exists as:
1. Authenticated REST endpoint (`/api/v1/*`)
2. Outgoing webhook event (HMAC-SHA256 signed)
3. MCP tool (`/api/v1/mcp`)

The React UI is a client of the same API — no private backend shortcuts.

## Service Boundaries (`src/services/`)
- `security.ts` — SSRF validation, URL allow/block, HTML sanitization
- `cache.ts` — Content hashing (currently non-SHA-256 — Tier 0 gap)
- `ingestion.ts` — Text, PDF, URL, YouTube ingestors (YouTube uses fallback — Tier 0 gap)
- `gemini.ts` — Server-side @google/genai adapter (fast-fails without API key)
- `lessonEngine.ts` — Dual-host lesson generation with grounding fallback
- `ttsEngine.ts` — WAV header stripping, PCM splicing, device-TTS fallback
- `practiceEngine.ts` — 8 roleplay scenarios, <= 30-word feedback, scorecards
- `retentionEngine.ts` — Timezone streaks, weekly freeze, SM-2 spaced repetition
- `apiKeys.ts` — `stm_live_` keys (hash is non-SHA-256 — Tier 0 gap)
- `webhooks.ts` — HMAC signatures (non-SHA-256 — Tier 0 gap)
- `mcpServer.ts` — 11 MCP tools
- `exportEngine.ts` — Markdown, JSON, CSV (Anki) export
- `seedData.ts` — 10 seed lessons (hardcoded model strings — Tier 0 gap)

## Config (`src/config/index.ts`)
Single source of truth for MODELS, PROMPT_VERSIONS, QUOTAS, FEATURE_FLAGS.
Approved: gemini-3.8-flash, gemini-4-argon, gemini-3.8-flash-lite-tts, gemini-3.8-flash-tts, gemini-3.8-live.

## Known Gaps (Tier 0)
- package.json has fake dependency versions (vite@8, plugin-react@6, typescript@7)
- No `@supabase/supabase-js` client; repository is in-memory
- No `.env` file
- Hardcoded model IDs in seedData.ts, lessonEngine.ts, ttsEngine.ts
- Cache/API-key/webhook hashes are not real SHA-256
- YouTube ingestor uses sample fallback, not real transcript fetch
- No DNS resolution in SSRF guard
- Demo-user auth fallback (`user_student_demo`), no JWT
