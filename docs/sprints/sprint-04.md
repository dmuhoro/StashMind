# Sprint 04: Tier 2 — EasyTutor Merge (Your Own Edge)

## Sprint Goal
Build the model router (Gemini, Anthropic, Groq, Ollama), local TTS (Piper/Kokoro), and shared core package for the StashMind + EasyTutor merge.

## Tasks Completed
- [x] Model router (Gemini, Anthropic, Groq, Ollama) with automatic failover
- [x] Local TTS (Piper offline binary, Kokoro local server, browser fallback)
- [x] Shared core package (@stashmind/core) for both StashMind and EasyTutor

## Evidence
- `npm run typecheck` — zero errors
- `npm run test` — 26/26 passing
