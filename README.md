# StashMind 🎧💡

> **Turn any raw source (pasted text, PDFs, web articles, YouTube videos) into dual-host audio lessons, grounded insight decks, roleplay practice sessions, and spaced-repetition retention tools.**

[![Build & Test Status](https://img.shields.io/badge/tests-26%2F26%20passing-emerald)](https://github.com)
[![TypeScript Strict](https://img.shields.io/badge/typescript-strict%20100%25-blue)](https://www.typescriptlang.org)
[![Headless Architecture](https://img.shields.io/badge/architecture-headless--first-purple)](docs/adr/ADR-002-headless-first.md)
[![MCP Server](https://img.shields.io/badge/mcp-11%20tools%20active-cyan)](docs/integration/MCP_AGENT_QUICKSTART.md)
[![OpenAPI 3.1](https://img.shields.io/badge/openapi-3.1.0-orange)](src/server/openapi.ts)
[![Security RLS](https://img.shields.io/badge/security-RLS%20enforced-red)](supabase/migrations/20261017000000_stashmind_core_schema.sql)

---

## 1. Executive Overview

**StashMind** is a headless-first learning engine designed to transform high-volume information into active, long-term mastery. It serves university students, lifelong learners, and working professionals through three targeted presets that alter prompt framing, depth, and copy without fragmenting the underlying software architecture:

1. **University Students (`student` preset):** Focuses on high-yield exam preparation, core definitions, likely test questions, memory anchors, and precise citations to source paragraphs.
2. **Lifelong Learners (`learner` preset):** Focuses on curiosity, foundational mental models, interdisciplinary parallels, philosophical context, and prompts for further inquiry.
3. **Working Professionals (`professional` preset):** Focuses on actionable execution, executive conversational scripts, negotiation trade-offs, and commute-friendly formats.

---

## 2. Core Product Capabilities

| Pillar | Capability | Technical Implementation |
|---|---|---|
| **1. Audio Lessons** | **Dual-Host Dialogue (Alex & Sam)** | Multi-speaker audio generated via `gemini-3.8-flash-tts` with `multiSpeakerVoiceConfig` (Alex: Puck, Sam: Kore). Features natural dialogue pacing, conversational backchanneling (`\|yeah\|`, `\|mhm\|`), vocal bursts (`<laugh>`, `<breath>`), and 44-byte WAV header stripping for seamless multi-chunk concatenation. Includes toggleable device-TTS fallback and transcript-only mode. |
| **2. Insight Decks** | **Grounded Cards with Source Pointers** | Bite-sized actionable cards synchronized with audio playback timestamps. **Zero hallucinations**: Every single card references an explicit `source_section_pointer` linking back to the source text. Exportable to Markdown, JSON, and CSV (Anki/Quizlet). |
| **3. Practice Studio** | **Conversational Roleplay & Feedback** | 8+ preset scenarios (salary negotiations, deadline pushbacks, presentation defense, behavioral interviews). Evaluates turns with **strictly enforced coaching feedback of ≤ 30 words**, grades Clarity, Tone, and Structure (0–100), and outputs comprehensive scorecards. Supports both text and real-time voice mode. |
| **4. Retention Tools** | **Timezone Streaks & Spaced Repetition** | Daily streaks calculated against the user's local IANA timezone (`Intl.DateTimeFormat`) rather than UTC, protected by weekly streak freezes. Spaced repetition review queue using SM-2 intervals (`[1, 3, 7, 14, 30]` days) and automated flashcard quiz generation. |

---

## 3. Headless-First Architecture

StashMind is built on the doctrine that **every capability in the web interface exists first as a first-class programmatic interface**:

```
                                  ┌───────────────────────────┐
                                  │   Autonomous AI Agents    │
                                  │   (Opencode / Anthropic)  │
                                  └─────────────┬─────────────┘
                                                │ (MCP JSON-RPC)
┌───────────────────────────┐                   ▼                   ┌───────────────────────────┐
│     Third-Party Apps      │──────► ┌─────────────────────┐ ◄──────│     Web Client / PWA      │
│   (Software Factory / LMS)│        │   REST API (/api)   │        │     (React 19 + Tailwind) │
└───────────────────────────┘        └──────────┬──────────┘        └───────────────────────────┘
                                                │
                                    ┌───────────┴───────────┐
                                    │  StashMind Domain     │
                                    │  Service Core         │
                                    └───────────┬───────────┘
                                                │
         ┌──────────────────────────────┬───────┴──────────────────────┬──────────────────────────────┐
         ▼                              ▼                              ▼                              ▼
┌─────────────────┐            ┌─────────────────┐            ┌─────────────────┐            ┌─────────────────┐
│ Ingestion & SSRF│            │ Lesson & Audio  │            │ Roleplay Studio │            │ Retention & SM2 │
│ Protection      │            │ Synthesizer     │            │ (<= 30 words)   │            │ Engine          │
└─────────────────┘            └─────────────────┘            └─────────────────┘            └─────────────────┘
```

1. **Public REST API (`/api/v1/*`):** Fully typed, schema-validated endpoints with an **OpenAPI 3.1 specification** published live at `/api/v1/openapi.json`.
2. **Model Context Protocol (MCP) Server (`/api/v1/mcp`):** Standard streamable JSON-RPC 2.0 tool endpoint providing 11 tools (`create_lesson`, `get_lesson`, `list_cards`, `search_library`, `save_card`, `start_practice`, `submit_practice_turn`, `get_due_reviews`, `grade_review`, `export_deck`, `get_usage`).
3. **Scoped API Keys:** Machine identities (`stm_live_<hex>`) shown once upon creation, stored hashed (`sha256`) at rest, with fine-grained scopes (`lessons:read`, `lessons:write`, `cards:read`, etc.).
4. **Signed Webhooks:** Outgoing lifecycle events (`lesson.ready`, `practice.completed`, `card.saved`) signed with HMAC-SHA256 (`X-StashMind-Signature`, `X-StashMind-Timestamp`).

---

## 4. Local Clone & Verification Playbook

Clone this repository and verify all claims directly on your local workstation:

### Step 1: Prerequisites
- **Node.js:** v20.x or higher
- **npm:** v10.x or higher

### Step 2: Install Dependencies
```bash
git clone <YOUR_REPO_URL> stashmind
cd stashmind
npm install
```

### Step 3: Run the Automated Test Suite (26 Tests)
Run Vitest to verify that all business logic, SSRF blocking, RLS isolation, feedback length caps, and retention algorithms pass:
```bash
npm run test
```
**Expected Output:**
```
✓ tests/config.test.ts (7 tests)
✓ tests/ingestion.test.ts (5 tests)
✓ tests/lessonEngine.test.ts (2 tests)
✓ tests/practice.test.ts (4 tests)
✓ tests/retention.test.ts (3 tests)
✓ tests/integration.test.ts (5 tests)

Test Files  6 passed (6)
     Tests  26 passed (26)
  Duration  ~2.3s
```

### Step 4: Strict Typecheck & Linting
Validate the codebase against TypeScript in strict mode:
```bash
npm run lint
npm run typecheck
```
*Zero errors or warnings.*

### Step 5: Start the Full-Stack Dev Server
Launch the Express server hosting the REST API, MCP tool server, and Vite dev middleware on port 3000:
```bash
npm run dev
```

### Step 6: Verify Live Endpoints via cURL

1. **Verify Health & Version:**
   ```bash
   curl -s http://localhost:3000/api/v1/health
   # Returns: {"status":"ok","version":"1.0.0",...}
   ```

2. **Verify OpenAPI 3.1 Spec:**
   ```bash
   curl -s http://localhost:3000/api/v1/openapi.json | grep -o '"openapi":"3.1.0"'
   # Returns: "openapi":"3.1.0"
   ```

3. **Verify MCP Tool Server (JSON-RPC):**
   ```bash
   curl -s -X POST http://localhost:3000/api/v1/mcp \
     -H "Content-Type: application/json" \
     -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
   # Returns full list of 11 MCP tool schemas
   ```

4. **Verify Seeded Lessons & Cards:**
   ```bash
   curl -s http://localhost:3000/api/v1/lessons | grep -o '"title":"Cellular Respiration & The Krebs Cycle"'
   ```

5. **Verify Anki CSV Deck Export:**
   ```bash
   curl -s "http://localhost:3000/api/v1/export/deck/les_seed_bio_01?format=csv"
   # Returns CSV formatted with "Front","Back","SourcePointer","AudioTimestamp","Tags"
   ```

---

## 5. Granular Git History (Phase by Phase)

This repository was constructed strictly layer-by-layer following the 11 phases. You can inspect the commit log using `git log --oneline`:

```text
032fadc feat(phase-10-11): complete mobile-first UI shell, 10 seed demo lessons, legal compliance drafts, and launch ledger
28805cd feat(phase-8): publish REST API v1, OpenAPI 3.1 spec, HMAC webhooks, and streamable MCP tool server (Part C, F18)
0db9957 feat(phase-7): implement timezone-correct streaks, weekly freeze, and spaced repetition review queue (F14, F15)
7d6a99d feat(phase-6): implement conversational practice engine with 30-word feedback limit and scorecards (F12, F13)
2cf58e1 feat(phase-3-5): add dual-host lesson generator, strict grounding, and Gemini TTS synthesis (F6, F8, F10, F17)
d542cb9 feat(phase-2): implement SSRF protection, content-hash deduplication, and ingestion (F2-F5, F11)
5b49ed0 feat(phase-1): add Supabase PostgreSQL migrations, RLS policies, and domain repository
133e037 feat(phase-0): scaffold repository, constitutional doctrine, central config, and ADRs
```

---

## 6. Codebase Architecture & File Map

```text
stashmind/
├── AGENTS.md                  # Operational guide & conventions for autonomous agents
├── BUILD_STATE.md             # Living phase tracker and requirement verification matrix
├── CONSTITUTION.md            # Non-negotiable security, privacy, and grounding laws
├── server.ts                  # Production Express 4 server (REST API, MCP, Vite middleware)
├── index.html                 # PWA HTML entry point with synchronized metadata
├── metadata.json              # AI Studio capability declaration
├── package.json               # Scripts (dev, build, test, lint, typecheck)
├── vitest.config.ts           # Vitest configuration
│
├── docs/                      # Architectural & Integration Documentation
│   ├── adr/                   # Architecture Decision Records (ADR-001 through ADR-007)
│   ├── integration/           # Integration guides for Software Factory, MCP, and REST
│   ├── launch/                # Launch checklist & operational runbooks
│   └── legal/                 # Draft Privacy Policy & Terms of Service for counsel
│
├── src/                       # Application Source
│   ├── config/index.ts        # SINGLE SOURCE OF TRUTH: Model IDs, prompt versions, quotas
│   ├── db/                    # Data Layer
│   │   ├── types.ts           # TypeScript domain entity types & schemas
│   │   └── repository.ts      # Storage engine enforcing Row Level Security (RLS)
│   ├── services/              # Headless Domain Services
│   │   ├── security.ts        # SSRF validator & HTML sanitization
│   │   ├── cache.ts           # Deterministic SHA-256 content hasher
│   │   ├── ingestion.ts       # Text, PDF, URL, and YouTube ingestors
│   │   ├── gemini.ts          # Server-side @google/genai SDK client (Flash, Pro, TTS)
│   │   ├── lessonEngine.ts    # Dual-host lesson generator with strict grounding pointers
│   │   ├── ttsEngine.ts       # WAV header stripper, PCM splicer, and device-TTS fallback
│   │   ├── practiceEngine.ts  # Roleplay simulator with strict <= 30 words feedback limit
│   │   ├── retentionEngine.ts # Timezone streaks, freeze mechanics, and SM-2 spaced reviews
│   │   ├── apiKeys.ts         # Scoped API key generator (stm_live_) with SHA-256 storage
│   │   ├── webhooks.ts        # HMAC-SHA256 signed event dispatcher
│   │   ├── mcpServer.ts       # Model Context Protocol server exposing 11 agent tools
│   │   ├── exportEngine.ts    # Markdown, JSON, and Anki CSV deck exporter
│   │   └── seedData.ts        # 10 preloaded demo lessons across Student/Learner/Pro presets
│   ├── server/                # API Server Layer
│   │   ├── openapi.ts         # OpenAPI 3.1 specification (/api/v1/openapi.json)
│   │   └── routes.ts          # Express Router (/api/v1/*)
│   ├── App.tsx                # Responsive mobile-first React 19 UI
│   └── main.tsx               # Client React DOM entry point
│
├── supabase/migrations/       # Versioned PostgreSQL DDL with RLS policies enabled
└── tests/                     # Automated Test Suites
    ├── config.test.ts         # Central configuration and quota invariant tests
    ├── ingestion.test.ts      # SSRF blocking, text bounds, and cache hash tests
    ├── lessonEngine.test.ts   # Structured lesson and strict grounding tests
    ├── practice.test.ts       # 30-word feedback limit, scoring, and safety tests
    ├── retention.test.ts      # Timezone streak math, freeze mechanics, and SM-2 tests
    └── integration.test.ts    # Two-user RLS isolation, API key, webhook, and MCP tests
```

---

## 7. Constitutional Non-Negotiables

StashMind operates under strict, code-enforced constitutional rules defined in [`CONSTITUTION.md`](CONSTITUTION.md):

1. **Security & Mandatory RLS:**
   - Row Level Security (RLS) is enabled on all 13 database tables.
   - Cross-user data leaks are verified as impossible via automated two-user isolation tests in `tests/integration.test.ts`.
   - Zero API secrets or `@google/genai` imports ever enter client-side bundles.
2. **SSRF Attack Immunity:**
   - Server-side URL fetching blocks all access to loopback (`127.0.0.1`), link-local (`169.254.169.254`), RFC 1918 subnets, and cloud metadata endpoints.
3. **Strict Source Grounding:**
   - Every card and host line is strictly derived from the input text. No invented statistics, quotes, or citations.
   - Every card contains a verifiable `source_section_pointer`.
4. **Concise Practice Feedback:**
   - Roleplay feedback is programmatically capped at **≤ 30 words per turn** to preserve conversational cadence.
5. **Cost Controls & Kill Switch:**
   - Normalized content is hashed (SHA-256) to eliminate redundant model generation costs.
   - A global spend kill switch (`DAILY_SPEND_KILL_SWITCH=true`) instantly halts audio generation and gracefully drops back to device-TTS.
6. **Minor Protection:**
   - Explicit age confirmation gate (13+ standard, 16+ GDPR).

---

## 8. Approved 2026 Model Roster

All model identifiers live exclusively in `src/config/index.ts`. Retired models (`gemini-1.5-*`, `gemini-2.0-*`) are strictly prohibited:

- **Fast Generation & Feedback:** `MODELS.FLASH` (`gemini-3.8-flash`)
- **Heavy Reasoning:** `MODELS.PRO` (`gemini-4-argon`)
- **Single-Speaker TTS:** `MODELS.TTS_LITE` (`gemini-3.8-flash-lite-tts`)
- **Dual-Host Podcasting TTS:** `MODELS.TTS_DUAL_HOST` (`gemini-3.8-flash-tts`)
- **Real-Time Voice Practice:** `MODELS.LIVE_VOICE` (`gemini-3.8-live`)

---

## 9. Environment Configuration (`.env.example`)

Copy `.env.example` to `.env` when deploying:

```bash
# GEMINI_API_KEY: Server-side Gemini API calls
GEMINI_API_KEY="your-gemini-api-key"

# APP_URL: Base URL for self-referential links & callbacks
APP_URL="http://localhost:3000"

# Supabase (Optional: Local isolated repository engine runs automatically if unset)
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_ANON_KEY="your-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

# Cost & Safety Controls
DAILY_SPEND_KILL_SWITCH="false"
DAILY_USER_LESSON_CAP="5"
WEBHOOK_SIGNING_SECRET="whsec_example_secret"
```

---

## 10. License

Built for StashMind. Apache-2.0.
