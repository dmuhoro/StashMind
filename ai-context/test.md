# StashMind Test Context

## Test Suite (Vitest)
- 6 test files, 26 tests, all passing
- `tests/config.test.ts` — config/model/quota invariants (7 tests)
- `tests/ingestion.test.ts` — SSRF blocking, text bounds, content hash (5 tests)
- `tests/lessonEngine.test.ts` — structured lesson, grounding, presets (2 tests)
- `tests/practice.test.ts` — 30-word feedback cap, scoring, safety (4 tests)
- `tests/retention.test.ts` — timezone streaks, freeze, SM-2 (3 tests)
- `tests/integration.test.ts` — RLS isolation, API keys, webhooks, MCP, OpenAPI (5 tests)

## Honest Test Requirements (CONSTITUTION.md + AGENTS.md)
- Inject a FAKE AI client in tests (not real Gemini calls)
- Keep a separate opt-in LIVE test suite for real API calls
- "26 passing" must mean something — tests exercise real service logic, not stubs
- All core business logic must have unit tests in `tests/`

## Current Test Limitations
- Tests run against in-memory repository, not real Supabase
- No fake AI client injection — GeminiService fast-fails in test env (accidental honesty)
- No live/opt-in test suite
- No RLS tests against real PostgreSQL
- No end-to-end tests for core workflows

## Tier 0 Test Gaps
1. Add fake AI client for deterministic tests
2. Add separate opt-in live test suite (GEMINI_API_KEY required)
3. Add RLS isolation tests against real Supabase
4. Add E2E tests for lesson → card → practice → review workflow
5. Add test for npm install (clean install without --legacy-peer-deps)
