# StashMind Performance Context

## Quotas (`src/config/index.ts` QUOTAS)
- DAILY_LESSONS: free=5, student=20, pro=100, team=250
- MAX_SOURCE_TEXT_CHARS: 100,000
- MAX_SOURCE_PDF_BYTES: 15 MB
- MAX_SOURCE_PDF_PAGES: 40
- MAX_AUDIO_CHUNK_WORDS: 350
- MAX_PRACTICE_FEEDBACK_WORDS: 30
- SPACED_REPETITION_INTERVALS_DAYS: [1, 3, 7, 14, 30]
- STREAK_FREEZE_MAX_PER_WEEK: 1
- MINIMUM_USER_AGE: 13 (16 GDPR)

## Kill Switch
- `DAILY_SPEND_KILL_SWITCH` env var → `isDailySpendKillSwitchActive()` in config
- When active: GeminiService fast-fails, TtsEngine falls back to device-TTS

## Content Hash Cache
- `CacheService.computeContentHash()` — currently a custom non-SHA-256 hash
- Used to deduplicate model calls before generation

## Usage Counters
- `UsageCounter` type: lessons_created, tts_seconds_used, input_tokens, output_tokens
- `/api/v1/usage` returns hardcoded values (lessons_created_today: 1, tts_seconds_used_today: 45)

## Tier 0 Performance Gaps
1. Real SHA-256 content hash (not custom hash)
2. Real usage tracking tied to Supabase
3. Per-user rate limiting
4. Global spend kill switch with graceful text-only fallback

## Low-Bandwidth / Mobile-First Considerations (Tier 1)
- No low-bitrate Opus audio option
- No downloadable lessons for offline
- No "text only on weak signal" switch
- No audio compression for KES mobile data constraints
