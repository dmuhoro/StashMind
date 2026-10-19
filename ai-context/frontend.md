# StashMind Frontend Context

## UI
- `src/App.tsx` — single-file React app, ~1,480 lines
- 6 tabs: deck (player+cards), create (ingest), practice, review, api, settings
- Mobile-first, Tailwind CSS, responsive down to 360px
- Lucide React icons, framer-motion

## State (all local, no auth)
- `activeTab`, `activePreset` (student/learner/professional)
- `currentLesson`, `currentCards` (seeded from SEED_LESSONS[0])
- `savedCardIds`, `searchQuery`, `isGenerating`
- Audio: `isPlaying`, `playbackTime`, `playbackSpeed`, `activeCardIndex`, `deviceTtsFallback`
- Practice: `practiceSession`, `practiceInput`, `isSubmittingTurn`, `isVoiceMode`
- Retention: `streakCount` (hardcoded 4), `freezesRemaining` (hardcoded 1) — NOT wired to API
- API: `generatedApiKey`, `apiConsoleResponse`, `webhookStatus`

## Auth
- No real login. `authenticateRequest()` falls back to `user_student_demo` for browser UI.
- API key generation UI exists but hits the in-memory store.

## Tier 0 Frontend Gaps
1. Wire frontend to real Supabase Auth (JWT), remove demo-user fallback
2. Wire streak/freezes to real API (`/api/v1/streak`, `/api/v1/usage`)
3. Add age-gate signup screen (13+ / 16+ GDPR)
4. Add device-TTS that actually calls browser SpeechSynthesis API
