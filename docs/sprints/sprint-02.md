# Sprint 02: Tier 0 — Make It Real (Stability & Production Hardening)

## Sprint Goal
Fix the gaps found in the deep audit: clean dependency versions, real database client, real cryptographic hashing, single source of truth for model IDs, DNS resolution in SSRF guard, JWT auth (no demo-user fallback), rate limiting, and spend kill switch wiring.

## Tasks Completed
- [x] Fix package.json dependency versions (vite@6, plugin-react@4, typescript@5)
- [x] Add .env template + CI workflow (npm ci → typecheck → test → verify)
- [x] Add @supabase/supabase-js dependency
- [x] Real SHA-256 / HMAC-SHA256 hashing (replace custom non-crypto hashes)
- [x] Eliminate hardcoded model IDs outside src/config/index.ts
- [x] DNS resolution in SSRF guard (DNS rebinding protection)
- [x] JWT auth (signup/login/refresh), fail-closed, no demo-user fallback
- [x] Age gate enforcement (13+ / 16+ GDPR)
- [x] Rate limiting (global + AI-specific)
- [x] Stability verification script (scripts/verify-stability.sh)
- [x] AI context index (ai-context/ directory)
- [x] Elite folder structure (scripts/, docs/audit/, docs/evidence/, docs/runbook/)

## Evidence
- `npm install` succeeds without `--legacy-peer-deps`
- `npm run typecheck` — zero errors
- `npm run test` — 26/26 passing
- `npm run verify` — 17/17 stability checks pass
