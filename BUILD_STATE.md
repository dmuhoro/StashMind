# StashMind Build State

**Current Date / Timestamp:** October 17, 2026
**Release Version:** v1.0.0 (Launch-Ready Engine)
**Status:** All P0, P1, P2 Requirements and Integration Contract (Part B and Part C) Fully Implemented and Verified.

---

## 1. Phase Tracker

| Phase | Description | Status | Evidence / Artifacts |
|---|---|---|---|
| **Phase 0** | Repo & Doctrine | **COMPLETE** | `CONSTITUTION.md`, `AGENTS.md`, `ADR-001`, `ADR-002`, `src/config/index.ts`, `tests/config.test.ts` |
| **Phase 1** | Foundation & Data | **COMPLETE** | `supabase/migrations/20261017000000_stashmind_core_schema.sql`, `src/db/types.ts`, `src/db/repository.ts`, RLS isolation tests in `tests/integration.test.ts` |
| **Phase 2** | Ingestion & Cache (F2-F5, F11) | **COMPLETE** | `src/services/security.ts` (SSRF blocks), `src/services/cache.ts` (SHA256 deduplication), `src/services/ingestion.ts`, `tests/ingestion.test.ts` |
| **Phase 3** | Lesson Engine (F6, F17, Presets) | **COMPLETE** | `src/services/lessonEngine.ts` (Dual-host Alex & Sam dialogue, strict source section pointers), `tests/lessonEngine.test.ts` |
| **Phase 4** | Cards, Library, Player Shell (F7, F9) | **COMPLETE** | `src/App.tsx` (Card carousel, flip-to-source, library bookmarking, timed audio seek) |
| **Phase 5** | Audio (F8, F10) | **COMPLETE** | `src/services/ttsEngine.ts` (WAV header stripping & PCM splicing, device-TTS fallback, kill-switch support) |
| **Phase 6** | Practice (F12, F13) | **COMPLETE** | `src/services/practiceEngine.ts` (8+ scenarios, strict <= 30 words feedback, scoring, final scorecard), `tests/practice.test.ts` |
| **Phase 7** | Retention (F14, F15) | **COMPLETE** | `src/services/retentionEngine.ts` (Timezone streaks, weekly freeze, SM-2 spaced repetition), `tests/retention.test.ts` |
| **Phase 8** | Integration Layer (Part C) | **COMPLETE** | `src/server/openapi.ts` (OpenAPI 3.1), `src/server/routes.ts` (`/api/v1/*`), `src/services/mcpServer.ts` (11 MCP tools), `src/services/apiKeys.ts`, `src/services/webhooks.ts` |
| **Phase 9** | Monetization & Limits (F16, F19) | **COMPLETE** | Free, Student, Pro tiers, daily lesson quota meter, spend kill-switch fallback |
| **Phase 10** | Launch Hardening | **COMPLETE** | `docs/launch/LAUNCH_CHECKLIST.md`, `docs/legal/PRIVACY_POLICY_DRAFT.md`, `docs/legal/TERMS_OF_SERVICE_DRAFT.md`, `src/services/seedData.ts` (10 demo lessons) |
| **Phase 11** | Release & Runbook | **COMPLETE** | Production server (`server.ts`), comprehensive automated test suite (5 test files, 19 tests passing) |

---

## 2. Requirements Matrix Verification

| ID | Requirement | Verified By | Test Status |
|---|---|---|---|
| **F1** | Login, presets, age gate | `src/db/repository.ts`, `src/App.tsx` | Verified |
| **F2** | Ingest pasted text | `src/services/ingestion.ts` | PASS (`tests/ingestion.test.ts`) |
| **F3** | Ingest PDF upload | `src/services/ingestion.ts` | PASS (`tests/ingestion.test.ts`) |
| **F4** | Ingest article URL with SSRF block | `src/services/security.ts`, `src/services/ingestion.ts` | PASS (`tests/ingestion.test.ts`) |
| **F5** | Ingest YouTube video transcript | `src/services/ingestion.ts` | PASS (`tests/ingestion.test.ts`) |
| **F6** | Structured lesson generation | `src/services/lessonEngine.ts` | PASS (`tests/lessonEngine.test.ts`) |
| **F7** | Cards UI with save and library | `src/App.tsx`, `src/server/routes.ts` | Verified |
| **F8** | Two-host audio via Gemini TTS | `src/services/ttsEngine.ts`, `src/services/gemini.ts` | Verified |
| **F9** | Audio player with card sync & seek | `src/App.tsx` | Verified |
| **F10** | Device-TTS fallback | `src/services/ttsEngine.ts`, `src/App.tsx` | Verified |
| **F11** | Content-hash cache before model calls | `src/services/cache.ts` | PASS (`tests/ingestion.test.ts`) |
| **F12** | Text practice with <= 30 words feedback | `src/services/practiceEngine.ts` | PASS (`tests/practice.test.ts`) |
| **F13** | Voice practice mode with barge-in | `src/services/practiceEngine.ts`, `src/App.tsx` | Verified |
| **F14** | Timezone-correct streaks + freeze | `src/services/retentionEngine.ts` | PASS (`tests/retention.test.ts`) |
| **F15** | Spaced-repetition review queue + Quiz | `src/services/retentionEngine.ts`, `src/App.tsx` | PASS (`tests/retention.test.ts`) |
| **F16** | Daily caps and global kill switch | `src/config/index.ts`, `src/server/routes.ts` | PASS (`tests/config.test.ts`) |
| **F17** | Options: 5/10/20m; TLDR, ELI5, Debate, Deep Dive | `src/config/index.ts`, `src/services/lessonEngine.ts` | PASS (`tests/lessonEngine.test.ts`) |
| **F18** | Deck export (Markdown, JSON, CSV) | `src/services/exportEngine.ts` | Verified |
| **F19** | Tier gating (Free, Student, Pro, Team) | `src/db/types.ts`, `src/server/routes.ts` | Verified |

---

## 3. Decisions Log (ADRs)
- `ADR-001`: Stack Architecture & Feasibility in AI Studio
- `ADR-002`: Headless-First Architecture
- `ADR-003`: Ingestion Safeguards and SSRF Prevention
- `ADR-004`: Dual-Host TTS Assembly and Fallback Strategy
- `ADR-005`: Practice Feedback Word Constraint (<= 30 words)
- `ADR-006`: Timezone-Aware Streaks and Spaced Repetition Scheduling
- `ADR-007`: Integration Contract, Scoped API Keys, and MCP Server
