# Changelog

All notable changes to StashMind are documented in this file.

## [1.0.0] — 2026-10-19

### Added
- **Elite folder structure:** `.agents/`, `.claude/`, `ai-context/`, `scripts/`, `docs/audit/`, `docs/evidence/`, `docs/runbook/`, `.github/workflows/`
- **Stability verification script:** `scripts/verify-stability.sh` (17 fail-closed checks)
- **AI context index:** `ai-context/` (architect, data, devops, frontend, integrations, performance, product, security, test)
- **CI workflow:** `.github/workflows/ci.yml` (npm ci → typecheck → test → verify)

### Changed
- **Dependencies:** Replaced fake versions (vite@8, plugin-react@6, typescript@7) with real versions (vite@6, plugin-react@4, typescript@5)
- **Package:** Renamed `react-example` → `stashmind`, added @supabase/supabase-js, bcryptjs, express-rate-limit, jsonwebtoken
- **Hashing:** Replaced custom non-crypto hashes with real SHA-256 / HMAC-SHA256 (cache, API keys, webhooks)
- **Model IDs:** Eliminated hardcoded model IDs outside `src/config/index.ts`
- **SSRF:** Added DNS resolution (DNS rebinding protection), fails closed on DNS failure
- **Auth:** JWT signup/login/refresh, fail-closed (no demo-user fallback), age gate (13+/16+ GDPR)
- **Rate limiting:** Global 100 req/15min + AI-specific 20 req/15min

### Tier 1 (Mobile-First, Low-Bandwidth)
- Telegram bot ingestion webhook
- Data-saver mode (toggle, downloadable WAV, low-bandwidth optimization)
- Ask the source (chat with per-claim citations + confidence)
- Card quality controls (thumbs up/down, edit)
- Study mode (quiz + flashcards, Anki CSV export)
- Swahili lessons + audio
- M-Pesa Daraja payments (STK push, KES pricing, student tier)

### Tier 2 (EasyTutor Merge)
- Model router (Gemini, Anthropic, Groq, Ollama) with failover
- Local TTS (Piper, Kokoro, browser fallback)
- Shared core package (`@stashmind/core`)

### Security
- Real SHA-256 for API key hashing
- Real HMAC-SHA256 for webhook signatures
- Constant-time comparison (timingSafeEqual)
- DNS rebinding protection in SSRF guard
- JWT auth replaces demo-user fallback
- Rate limiting on all public endpoints
