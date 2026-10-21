# Changelog

All notable changes to StashMind are documented in this file.

## [1.0.0] — 2026-10-21

### Added
- **Elite folder structure:** `.agents/`, `.claude/`, `ai-context/`, `scripts/`, `docs/audit/`, `docs/evidence/`, `docs/runbook/`, `.github/workflows/`
- **Stability verification script:** `scripts/verify-stability.sh` (17 fail-closed checks)
- **AI context index:** `ai-context/` (architect, data, devops, frontend, integrations, performance, product, security, test)
- **CI workflow:** `.github/workflows/ci.yml` (npm ci → typecheck → test → verify)
- **Elite README:** executive overview, tier 0/1/2 roadmap, headless-first architecture, quickstart, repository structure, constitutional non-negotiables, model roster, deployment guide, topics

### Changed
- **Dependencies:** Replaced fake versions (vite@8, plugin-react@6, typescript@7) with real versions (vite@6, plugin-react@4, typescript@5)
- **Package:** Renamed `react-example` → `stashmind`, added @supabase/supabase-js, bcryptjs, express-rate-limit, jsonwebtoken, appwrite, node-appwrite, crypto-js, pdf-parse, zod
- **Hashing:** Replaced custom non-crypto hashes with real SHA-256 / HMAC-SHA256 (cache, API keys, webhooks)
- **Model IDs:** Eliminated hardcoded model IDs outside `src/config/index.ts`
- **SSRF:** Added DNS resolution (DNS rebinding protection), fails closed on DNS failure
- **Auth:** JWT auth replaced with Appwrite Auth (signup/login/logout/password recovery), age gate (13+/16+ GDPR), fail-closed (no demo-user fallback)
- **Rate limiting:** Global 100 req/15min + AI-specific 20 req/15min
- **Database:** Replaced in-memory Map store with Appwrite TablesDB (20 tables, row-level security)
- **Storage:** Appwrite Storage buckets (uploads, audio, exports) with WAV/Opus dual-host TTS
- **Repository layer:** Domain Repository interface with AppwriteRepository + MemoryRepository (test-only, fail-closed in production)
- **AI Engine:** AIClient interface (GeminiClient + FakeAiClient), model ID verification against Google's live model list at startup
- **Job Queue:** Jobs table with leases, heartbeats, retries, idempotency keys, per-step status

### Tier 0 — Make It Real (Complete)
- Real dependency versions (clean `npm install`)
- Real SHA-256 / HMAC-SHA256 hashing
- DNS resolution in SSRF guard
- Appwrite Auth (fail-closed, no demo-user fallback)
- Age gate (13+ / 16+ GDPR)
- Rate limiting (global + AI-specific)
- Spend kill switch
- Stability verification script (17/17)
- CI workflow

### Tier 1 — Mobile-First, Low-Bandwidth (Complete)
- Telegram bot ingestion webhook
- Data-saver mode (toggle, downloadable WAV, low-bandwidth optimization)
- Ask the source (chat with per-claim citations + confidence)
- Card quality controls (thumbs up/down, edit, fixture evals)
- Study mode (quiz + flashcards, Anki CSV export)
- Swahili lessons + audio
- M-Pesa Daraja payments (STK push, KES pricing, student tier)

### Tier 2 — EasyTutor Merge (Parked for Software Factory)
- Model router (Gemini, Anthropic, Groq, Ollama) with failover
- Local TTS (Piper, Kokoro, browser fallback)
- Shared core package (`@stashmind/core`)

### Security
- Real SHA-256 for API key hashing
- Real HMAC-SHA256 for webhook signatures
- Constant-time comparison (timingSafeEqual)
- DNS rebinding protection in SSRF guard
- Appwrite Auth replaces demo-user fallback
- Rate limiting on all public endpoints
- Security headers (CSP, HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy)

### Infrastructure
- Dockerfile (multi-stage, non-root, ffmpeg, healthcheck)
- PWA manifest + service worker (offline support)
- Structured logging with correlation request IDs
- Spaced repetition with SM-2 intervals
- 43 unit tests (up from 26 baseline)
- 17/17 stability checks passing
- Deployed to Vercel: https://stashmind-nu.vercel.app
- Domain: stashmind.app

