# AGENTS.md: Developer & Agent Guide for StashMind

This document is the operating manual for any engineer or AI agent working on **StashMind**. Read this before writing any code.

---

## 1. Project Overview & Architecture
StashMind turns raw sources (pasted text, uploaded PDFs, article URLs, and YouTube videos) into:
1. Dual-host audio lessons (`gemini-3.8-flash-tts` with speaker dialogue, backchanneling, and vocal bursts)
2. Grounded, actionable insight cards with source references
3. Roleplay practice sessions with turn-by-turn feedback (<= 30 words) and final scorecards
4. Spaced repetition and timezone-aware retention tools

### Core Architectural Doctrine: Headless-First
Every feature exists first as an authenticated, schema-validated REST endpoint under `/api/v1/*`, an outgoing webhook event, and an MCP tool. The web user interface is a client of the same API.

---

## 2. Quickstart & Commands

```bash
# Install dependencies
npm install

# Run dev server (runs on port 3000)
npm run dev

# Run unit and integration tests
npm run test

# Typecheck and lint codebase
npm run lint
npm run typecheck

# Production build
npm run build
```

---

## 3. Strict Rules & Conventions

### Model Configuration (CRITICAL)
- **Rule:** Never hardcode model IDs anywhere in application files or routes.
- **Location:** All models, prompt version strings, quotas, and feature flags live exclusively in `src/config/index.ts`.
- **Approved 2026 Models:**
  - Fast generation/summarization/cards/feedback: `MODELS.FLASH` (`gemini-3.8-flash`)
  - Heavy reasoning: `MODELS.PRO` (`gemini-4-argon`)
  - TTS Single-speaker: `MODELS.TTS_LITE` (`gemini-3.8-flash-lite-tts`)
  - Dual-host podcasting TTS: `MODELS.TTS_DUAL_HOST` (`gemini-3.8-flash-tts`)
  - Real-time voice practice: `MODELS.LIVE_VOICE` (`gemini-3.8-live`)
- **Prohibited:** Never use retired models (e.g. `gemini-1.5-*`, `gemini-2.0-*`).

### Server-Side Rule for AI & Secrets
- Never import `@google/genai` on the client.
- Never expose `GEMINI_API_KEY` or `SUPABASE_SERVICE_ROLE_KEY` to the browser bundle.
- In `httpOptions` for `@google/genai`, always include header `'User-Agent': 'aistudio-build'`.

### Database & RLS
- Every user-owned table has Row Level Security (RLS) enabled.
- Database changes are made strictly through versioned SQL migrations in `supabase/migrations/`.
- Never modify an already-applied migration.

### Testing
- Run `npm run test` before completing any phase. A phase cannot be marked complete if tests fail.
- All core business logic (hashing, quotas, streaks, spaced repetition, grounding schemas) must have unit tests in `tests/`.

---

## 4. Common Gotchas & Traps

1. **WAV Audio Headers in Gemini TTS:**
   - Unary `generateContent` returns a full 44-byte RIFF header (`audio/wav`). Do not wrap it in another header.
   - Streaming `generateContentStream` yields raw PCM (`audio/l16`, 24kHz, 16-bit mono).
   - If assembling multiple unary segments, strip the 44-byte WAV header from all chunks after the first.
2. **SSRF Attack Vectors:**
   - Always validate and resolve target URLs before making server-side fetch requests.
   - Block `127.0.0.1`, `localhost`, `169.254.169.254` (cloud metadata), `10.*.*.*`, `172.16-31.*.*`, `192.168.*.*`, and IPv6 link-local addresses.
3. **Timezones for Streaks:**
   - Streak day calculations must evaluate against the user's configured timezone (e.g. via `Intl.DateTimeFormat` or date math), never raw UTC server time.
4. **Practice Feedback Length:**
   - System instructions enforce that turn feedback must never exceed 30 words. Keep it crisp, constructive, and actionable.

---

## 5. Workflow Across Phases
- At turn start: Check `BUILD_STATE.md`.
- Follow sprint plan in `docs/sprints/`.
- Record decisions in `docs/adr/`.
- At turn end: Update `BUILD_STATE.md` and report in standard format.
