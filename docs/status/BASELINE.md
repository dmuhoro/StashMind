# StashMind C00 Baseline — Appwrite Edition Completion Kit

**Branch:** completion/appwrite  
**Baseline date:** October 20, 2026  
**Doctor script:** stashmind-doctor.sh v3.0 (Appwrite edition)

## Doctor baseline report

| Metric | Count |
|--------|-------|
| PASS | 47 |
| WARN | 21 |
| FAIL | 19 |
| FIXED | 2 |

## Repository state at baseline

- Total commits: 31
- Layer-style commits: 7
- Working tree: clean (after C01 hygiene fixes)
- Branch: completion/appwrite (no upstream yet)
- Remote: https://github.com/dmuhoro/stashmind.git

## Tier 0 and Tier 1 feature status at baseline

Features with code present but **zero tests** (per doctor script, test count static at 26):

| Feature | Status | Tests |
|---------|--------|-------|
| Telegram bot ingestion | IMPLEMENTED-UNTESTED | 0 |
| Data-saver mode | IMPLEMENTED-UNTESTED | 0 |
| Ask the source | IMPLEMENTED-UNTESTED | 0 |
| Card quality controls | IMPLEMENTED-UNTESTED | 0 |
| Study mode / quiz / Anki export | IMPLEMENTED-UNTESTED | 0 |
| Swahili lessons + audio | IMPLEMENTED-UNTESTED | 0 |
| M-Pesa Daraja payments | IMPLEMENTED-UNTESTED | 0 |
| Model router (Tier 2) | IMPLEMENTED-UNTESTED | 0 |
| Local TTS (Tier 2) | IMPLEMENTED-UNTESTED | 0 |
| Shared core package (Tier 2) | IMPLEMENTED-UNTESTED | 0 |

## Known gaps (from doctor script FAIL items)

1. No live database — in-memory Map storage, no @supabase replacement yet
2. Custom JWT auth still in place (needs Appwrite Auth)
3. Demo user fallback still present
4. No Appwrite SDK installed
5. No appwrite.config.json schema
6. Supabase references still in code and docs
7. Retired/doubtful Gemini model IDs hard-coded outside config
8. No readiness endpoint (/ready)
9. No real PDF parser dependency
10. YouTube ingestion uses hard-coded fallback
11. No device TTS (browser speech API)
12. Webhooks are simulated, not real HTTP
13. No PWA service worker or manifest
14. Zero aria-* accessibility attributes
15. No Dockerfile
16. No docs/evals, docs/runbooks, audit/matrix.json, audit/GAP_BACKLOG.md
17. No ADR for Appwrite decision

## Human gates open

- G1: Appwrite project restore (project paused in console), scoped API key, database ID, platform hostnames, SMTP
- G2: Gemini API key (paid tier for real users)
- G3: Safaricom Daraja sandbox credentials
- G4: Telegram bot token from BotFather
- G5: Native Swahili speaker review
- G6: Real audio listening and device tests
- G7: Hosting account, domain, production secrets
- G8: Legal review of drafts

## Next layer

C02: Appwrite Foundation — ADR superseding Supabase, node-appwrite SDK, appwrite.config.json, provisioning scripts.
