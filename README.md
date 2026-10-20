# StashMind 🎧💡

> **Turn any raw source (pasted text, PDFs, article URLs, and YouTube videos) into dual-host audio lessons, grounded insight cards, roleplay practice sessions, and spaced-repetition retention tools.**

[![Build & Test Status](https://img.shields.io/badge/tests-26%2F26%20passing-emerald)](https://github.com/dmuhoro/stashmind)
[![TypeScript Strict](https://img.shields.io/badge/typescript-strict%20100%25-blue)](https://www.typescriptlang.org)
[![Headless Architecture](https://img.shields.io/badge/architecture-headless--first-purple)](docs/adr/ADR-002-headless-first.md)
[![MCP Server](https://img.shields.io/badge/mcp-11%20tools%20active-cyan)](docs/integration/MCP_AGENT_QUICKSTART.md)
[![OpenAPI 3.1](https://img.shields.io/badge/openapi-3.1.0-orange)](src/server/openapi.ts)
[![Security RLS](https://img.shields.io/badge/security-RLS%20enforced-red)](supabase/migrations/20261017000000_stashmind_core_schema.sql)
[![Stability](https://img.shields.io/badge/stability-17%2F17%20passing-green)](scripts/verify-stability.sh)
[![License: Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-blue)](LICENSE)

---

## 1. Executive Overview

**StashMind** is a headless-first learning engine designed to transform high-volume information into active, long-term mastery. It serves university students, lifelong learners, and working professionals through three targeted presets that alter prompt framing, depth, and copy without fragmenting the underlying software architecture:

1. **University Students (`student` preset):** Focuses on high-yield exam preparation, core definitions, likely test questions, memory anchors, and precise citations to source paragraphs.
2. **Lifelong Learners (`learner` preset):** Focuses on curiosity, foundational mental models, interdisciplinary parallels, philosophical context, and prompts for further inquiry.
3. **Working Professionals (`professional` preset):** Focuses on actionable execution, executive conversational scripts, negotiation trade-offs, and commute-friendly formats.

StashMind is built for **low-bandwidth, mobile-first African users** — with Telegram bot ingestion, data-saver mode, Swahili lessons, downloadable audio, and M-Pesa (KES) payments.

---

## 2. Core Product Capabilities

| Pillar | Capability | Technical Implementation |
|--------|------------|-------------------------|
| **1. Audio Lessons** | Dual-Host Dialogue (Alex & Sam) | Multi-speaker audio via `gemini-3.8-flash-tts` with `multiSpeakerVoiceConfig` (Alex: Puck, Sam: Kore). Backchanneling (`|yeah|`, `|mhm|`), vocal bursts (`<laugh>`, `<breath>`), WAV header stripping, device-TTS fallback. |
| **2. Insight Decks** | Grounded Cards with Source Pointers | Bite-sized actionable cards synchronized with audio timestamps. **Zero hallucinations**: every card references an explicit `source_section_pointer`. Exportable to Markdown, JSON, CSV (Anki/Quizlet). |
| **3. Practice Studio** | Conversational Roleplay & Feedback | 8+ preset scenarios. Strictly enforced coaching feedback of **≤ 30 words** per turn. Grades Clarity, Tone, Structure (0–100). Final scorecards. Text + voice modes. |
| **4. Retention Tools** | Timezone Streaks & Spaced Repetition | Daily streaks vs. user's IANA timezone (not UTC). Weekly streak freezes. SM-2 intervals `[1, 3, 7, 14, 30]` days. Flashcard quiz generation. |

---

## 3. Tier Roadmap

### Tier 0 — Make It Real (Complete)
| Item | Status |
|------|--------|
| Real dependency versions (clean `npm install`) | ✅ |
| Real SHA-256 / HMAC-SHA256 hashing | ✅ |
| DNS resolution in SSRF guard | ✅ |
| JWT auth (fail-closed, no demo-user fallback) | ✅ |
| Age gate (13+ / 16+ GDPR) | ✅ |
| Rate limiting (global + AI-specific) | ✅ |
| Spend kill switch | ✅ |
| Stability verification script (17/17) | ✅ |
| CI workflow | ✅ |

### Tier 1 — Mobile-First, Low-Bandwidth (Complete)
| Item | Status |
|------|--------|
| Telegram bot ingestion webhook | ✅ |
| Data-saver mode (downloadable WAV, low-bandwidth) | ✅ |
| Ask the source (chat + citations + confidence) | ✅ |
| Card quality controls (thumbs up/down, edit) | ✅ |
| Study mode (quiz + flashcards, Anki CSV) | ✅ |
| Swahili lessons + audio | ✅ |
| M-Pesa Daraja payments (KES, student tier) | ✅ |

### Tier 2 — EasyTutor Merge (Complete)
| Item | Status |
|------|--------|
| Model router (Gemini, Anthropic, Groq, Ollama) | ✅ |
| Local TTS (Piper, Kokoro, browser fallback) | ✅ |
| Shared core package (`@stashmind/core`) | ✅ |

---

## 4. Headless-First Architecture

Every capability exists first as:
1. An authenticated REST endpoint (`/api/v1/*`)
2. An outgoing HMAC-SHA256-signed webhook event
3. An MCP (Model Context Protocol) tool

The React web UI is a client of the same API — no private backend shortcuts.

```
┌───────────────────────────┐
│   Autonomous AI Agents    │
│   (Opencode / Software    │
│    Factory / Anthropic)   │
└─────────────┬─────────────┘
              │ MCP JSON-RPC
              ▼
┌───────────────────────────┐     ┌───────────────────────────┐
│   Third-Party Apps        │────►│   REST API (/api/v1)      │
│   (Software Factory / LMS)│     │   OpenAPI 3.1 Spec        │
└───────────────────────────┘     └───────────┬───────────────┘
                                              │
                                      ┌───────▼───────┐
                                      │ StashMind     │
                                      │ Domain Core   │
                                      └───────┬───────┘
                                              │
        ┌───────────────┬─────────────────────┼─────────────┬───────────────┐
        ▼               ▼                     ▼               ▼               ▼
┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐
│Ingestion │   │Lesson &  │   │Roleplay  │   │Retention │   │Payments  │
│& SSRF    │   │Audio     │   │Studio    │   │& SM-2    │   │(M-Pesa)  │
└──────────┘   └──────────┘   └──────────┘   └──────────┘   └──────────┘
```

### Interfaces
- **REST API:** `/api/v1/*` with OpenAPI 3.1 spec at `/api/v1/openapi.json`
- **MCP Server:** `/api/v1/mcp` — 11 tools (`create_lesson`, `get_lesson`, `list_cards`, `search_library`, `save_card`, `start_practice`, `submit_practice_turn`, `get_due_reviews`, `grade_review`, `export_deck`, `get_usage`)
- **Webhooks:** HMAC-SHA256 signed events (`lesson.ready`, `practice.completed`, `card.saved`, etc.)
- **Scoped API Keys:** `stm_live_*` keys, SHA-256 hashed at rest, fine-grained scopes

---

## 5. Quickstart

### Prerequisites
- Node.js v20+
- npm v10+

### Install
```bash
git clone https://github.com/dmuhoro/stashmind.git
cd stashmind
npm install
```

### Configure
```bash
cp .env.example .env
# Fill in GEMINI_API_KEY, SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY,
# JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, TELEGRAM_BOT_TOKEN, MPESA_DARAJA_*
```

### Verify (17 stability checks)
```bash
npm run verify
```

### Typecheck + Tests
```bash
npm run typecheck   # tsc --noEmit (strict)
npm run test        # vitest run (26 tests)
```

### Run Dev Server
```bash
npm run dev  # Express + Vite on port 3000
```

### Verify Live Endpoints
```bash
curl -s http://localhost:3000/api/v1/health
# {"status":"ok","version":"1.0.0",...}

curl -s http://localhost:3000/api/v1/openapi.json | grep -o '"openapi":"3.1.0"'

curl -s -X POST http://localhost:3000/api/v1/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

---

## 6. Repository Structure

```
stashmind/
├── .github/workflows/ci.yml     # CI: npm ci → typecheck → test → verify
├── .env.example                 # Secrets template (gitignored .env)
├── AGENTS.md                    # Agent operating manual
├── BUILD_STATE.md               # Phase tracker & requirements matrix
├── CHANGELOG.md                 # Versioned changelog
├── CONSTITUTION.md              # Non-negotiable rules
├── package.json                 # Scripts & dependencies
├── server.ts                    # Express + Vite server (port 3000)
├── scripts/verify-stability.sh  # Fail-closed prerequisite verification
├── src/
│   ├── config/index.ts          # Single source of truth: models, quotas, flags
│   ├── db/                      # Types + repository (RLS-enforced)
│   ├── services/                # Headless domain services
│   ├── server/                  # OpenAPI 3.1 + REST routes
│   ├── App.tsx                  # React 19 mobile-first UI
│   └── main.tsx                 # Client entry
├── supabase/migrations/         # Versioned SQL migrations
├── tests/                       # Vitest suites (26 tests)
├── docs/
│   ├── adr/                     # ADR-001 through ADR-007
│   ├── integration/             # REST, MCP, Software Factory quickstarts
│   ├── sprints/                 # Sprint 02-04 documentation
│   └── launch/                  # Launch checklist
├── packages/core/               # @stashmind/core (shared with EasyTutor)
└── ai-context/                  # Machine-readable context for agents
```

---

## 7. Constitutional Non-Negotiables

StashMind operates under [`CONSTITUTION.md`](CONSTITUTION.md):

1. **Headless-First:** Every UI feature exists as REST + webhook + MCP tool.
2. **Security:** RLS on all tables, zero secrets in client bundle, SSRF protection, rate limiting, scoped API keys hashed at rest, HMAC-signed webhooks, immutable audit log.
3. **Privacy:** Uploads private by default, GDPR/Kenya DPA export & deletion, age gate.
4. **Cost:** Content-hash dedup, per-user daily caps, global spend kill switch.
5. **Honesty:** No fabricated citations; every card grounded in source text; thin sources acknowledged.
6. **Accessibility:** Transcripts for every audio lesson, keyboard operable, WCAG AA, screen-reader labels.
7. **Minors:** 13+ (16+ GDPR) explicit age gate at signup.

---

## 8. Approved 2026 Model Roster

All model IDs live exclusively in [`src/config/index.ts`](src/config/index.ts):

| Use | Model | Env Var |
|-----|-------|---------|
| Fast generation / cards / feedback | `gemini-3.8-flash` | `MODELS.FLASH` |
| Heavy reasoning | `gemini-4-argon` | `MODELS.PRO` |
| Single-speaker TTS | `gemini-3.8-flash-lite-tts` | `MODELS.TTS_LITE` |
| Dual-host podcasting TTS | `gemini-3.8-flash-tts` | `MODELS.TTS_DUAL_HOST` |
| Real-time voice practice | `gemini-3.8-live` | `MODELS.LIVE_VOICE` |

Retired models (`gemini-1.5-*`, `gemini-2.0-*`) are strictly prohibited.

---

## 9. Deployment

### Vercel (Recommended)
```bash
vercel login
vercel --prod
```

Environment variables must be set in the Vercel project dashboard or via `vercel env add`.

### Docker / Railway
See [`docs/`](docs/) for deployment runbooks.

---

## 10. Topics

`stashmind` `audio-lessons` `ai-education` `gemini` `tts` `spaced-repetition` `mcp` `headless` `mobile-first` `africa` `swahili` `mpesa` `telegram-bot` `typescript` `react` `express` `supabase` `openapi-3.1`

---

## 11. License

Apache-2.0. Built for StashMind.
