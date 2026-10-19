# StashMind DevOps Context

## Package Manager
- Declared: npm (package.json scripts use `npm run ...`)
- Artifact: `bun.lock` exists (suggests bun was used at some point) — Tier 0: standardize on ONE package manager with committed lockfile
- `npm install` FAILS without `--legacy-peer-deps` due to fake dependency versions

## Fake Dependency Versions (blocking clean install)
| Package | Declared | Reality |
|---------|----------|---------|
| vite | ^8.3.0 | Does not exist (max 6.x) |
| @vitejs/plugin-react | ^6.1.1 | Does not exist (max 4.x) |
| typescript | ^7.0.2 | Does not exist (max 5.x) |

## Scripts
- `scripts/verify-stability.sh` — prerequisite verification (NEW)
- No CI workflows yet (`.github/workflows/` is empty)

## Environment
- `.env.example` present with GEMINI_API_KEY, SUPABASE_*, DAILY_SPEND_KILL_SWITCH, etc.
- `.env` must be created locally, gitignored, never committed

## Tier 0 DevOps Gaps
1. Fix package.json dependency versions to real, compatible ranges
2. Choose one package manager (npm), commit a real lockfile
3. Add `.github/workflows/ci.yml` (install → typecheck → test)
4. Create `.env` from `.env.example` with real values
5. Add `scripts/` for verify, setup, release
