# Sprint 01: Repo and Doctrine (Phase 0)

## 1. Sprint Goal
Establish the foundational repository structure, architectural doctrine, testing infrastructure, configuration management, and feasibility assessment for StashMind.

## 2. Tasks
- [x] Scaffold project repository and development configuration
- [x] Configure CI toolchain: TypeScript strict linting, typechecking (`tsc --noEmit`), and Vitest test runner
- [x] Establish single source of truth configuration module (`src/config/index.ts`) for models, prompt versions, quotas, and feature flags
- [x] Write `CONSTITUTION.md` defining core non-negotiable rules (Security, Privacy, Cost, Reliability, Honesty, Accessibility, Minors)
- [x] Write `BUILD_STATE.md` with phase tracking, requirements matrix, and gate definitions
- [x] Write `AGENTS.md` as operational runbook for engineers and autonomous coding agents
- [x] Record `docs/adr/ADR-001-stack.md` (Technology Stack & Environment Feasibility)
- [x] Record `docs/adr/ADR-002-headless-first.md` (Headless-First Architecture & Multi-Surface Consumption)
- [x] Update `.env.example` with full configuration schema and security guidance
- [x] Sync `metadata.json` and `index.html` with product identity and PWA meta tags
- [x] Implement unit test suite verifying configuration constraints, model isolation, and validation helpers
- [x] Verify compile, typecheck, and test execution

## 3. Evidence
- **Build Verification:** `npm run build` succeeds without warnings.
- **Typecheck Verification:** `npm run typecheck` (`tsc --noEmit`) passes cleanly with zero errors.
- **Test Suite:** `npm run test` executes and passes all test assertions in `tests/config.test.ts`.
- **Environment Feasibility:** Node.js/Express full-stack container on port 3000 verified capable of serving both React SPA and `/api/v1` REST + MCP server endpoints.

## 4. Result
Phase 0 acceptance criteria met in full. Repository is ready for Phase 1 (Foundation and Data).
