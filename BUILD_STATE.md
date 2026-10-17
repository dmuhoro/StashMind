# StashMind Build State

**Current Date / Timestamp:** October 17, 2026
**Current Phase:** PHASE 0 (Repo and Doctrine)
**Status:** Phase 0 Complete — Awaiting confirmation to proceed to Phase 1

---

## 1. Phase Tracker

| Phase | Description | Status | Evidence / Artifacts |
|---|---|---|---|
| **Phase 0** | Repo & Doctrine | **COMPLETE** | `CONSTITUTION.md`, `AGENTS.md`, `docs/adr/ADR-001-stack.md`, `docs/adr/ADR-002-headless-first.md`, `docs/sprints/sprint-01.md`, `src/config/index.ts`, `tests/config.test.ts` |
| **Phase 1** | Foundation & Data | PENDING | Schemas, RLS policies, Auth, Onboarding preset selection, Isolation tests |
| **Phase 2** | Ingestion & Cache (F2-F5, F11) | PENDING | Text/PDF/URL/YouTube normalizer, SHA256 cache, SSRF protection |
| **Phase 3** | Lesson Engine (F6, F17, Presets) | PENDING | Dual-host generator, Grounding verification, JSON schema repair, Eval harness |
| **Phase 4** | Cards, Library, Player Shell (F7, F9) | PENDING | Swipeable cards, Timed sync player, Library search & tags |
| **Phase 5** | Audio (F8, F10) | PENDING | Multi-speaker TTS assembler, Device-TTS fallback, Usage counters |
| **Phase 6** | Practice (F12, F13) | PENDING | Roleplay scenarios, 30-word feedback, Scorecard, Voice loop |
| **Phase 7** | Retention (F14, F15) | PENDING | Timezone streaks, Streak freeze, Spaced repetition review queue, Quiz mode |
| **Phase 8** | Integration Layer (API, MCP, Webhooks) | PENDING | OpenAPI 3.1, HMAC webhooks, MCP server, Workspace separation |
| **Phase 9** | Monetization & Limits (F16, F19) | PENDING | Free/Student/Pro tiers, Billing provider interface, Spend kill-switch |
| **Phase 10** | Launch Hardening | PENDING | OWASP audit, Lighthouse mobile 90+, Cost dashboard, PWA offline, Legal drafts |
| **Phase 11** | Release | PENDING | Runbook, Disaster drill, Changelog, V1 launch |

---

## 2. Requirements Matrix

| ID | Requirement | Planned Phase | Status |
|---|---|---|---|
| **F1** | Login (Email & Google) + Age gate | Phase 1 | Pending Gate |
| **F2** | Ingest pasted text | Phase 2 | Planned |
| **F3** | Ingest PDF upload | Phase 2 | Planned |
| **F4** | Ingest article URL (Readability + SSRF block) | Phase 2 | Planned |
| **F5** | Ingest YouTube (Transcript/summarizer) | Phase 2 | Planned |
| **F6** | Structured lesson generation (dual-host, cards, markers) | Phase 3 | Planned |
| **F7** | Cards UI with save and library | Phase 4 | Planned |
| **F8** | Two-host audio via Gemini TTS (`gemini-3.8-flash-tts`) | Phase 5 | Planned |
| **F9** | Audio player with card sync & seek | Phase 4 | Planned |
| **F10** | Device-TTS fallback & transcript-only state | Phase 5 | Planned |
| **F11** | Content-hash cache before model call | Phase 2 | Planned |
| **F12** | Text practice with per-turn feedback (<= 30 words) | Phase 6 | Planned |
| **F13** | Voice practice with barge-in | Phase 6 | Planned |
| **F14** | Timezone-correct streaks + freeze | Phase 7 | Planned |
| **F15** | Spaced-repetition review queue + Quiz mode | Phase 7 | Planned |
| **F16** | Per-user caps + Global kill switch | Phase 9 | Planned |
| **F17** | Lesson options (5, 10, 20 min; TL;DR, ELI5, Debate, Deep Dive) | Phase 3 | Planned |
| **F18** | Deck export (Markdown, JSON, CSV) | Phase 8 | Planned |
| **F19** | Payments and tier gating | Phase 9 | Planned |

---

## 3. Decisions Log (ADRs)
- **ADR-001**: Stack Architecture & Feasibility in AI Studio (React 19 + Vite + Express Full-Stack + Supabase + Official Gemini SDK `@google/genai`).
- **ADR-002**: Headless-First Architecture (Unified Service Core exposed via REST API, Webhooks, MCP server, and React UI).

---

## 4. Open Risks & Issues
- **Feasibility Confirmation**: Environment is a Node.js full-stack container running port 3000. In AI Studio, dev server runs Vite + Express. Vite dev server handles client React 19 SPA; backend API routes `/api/v1/*` run on Express with middleware. All contracts and schemas are portable to Next.js if deployed on Vercel.
- **Phase 1 Human Gate**: Supabase keys (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) and Gemini API key (`GEMINI_API_KEY`).

---

## 5. Needs from Human
- **Gate 1 (Phase 1 preparation)**: Provide Supabase credentials or confirm use of local mock/in-memory PostgreSQL client until live project keys are attached.
- Review Phase 0 and reply **'continue'** to initiate Phase 1.
