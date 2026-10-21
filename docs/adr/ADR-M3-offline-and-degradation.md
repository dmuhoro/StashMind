# ADR-M3: Offline and degradation

## Context
EasyTutor must keep working offline and during StashMind outages. Online, StashMind provides audio lessons, cards, and ask-the-source. Offline, EasyTutor uses local Ollama (with core prompts/schemas from `@stashmind/core`) for cards and quizzes, and device text-to-speech. Dual-host audio (Gemini TTS via StashMind) is online-only until a local voice is added later.

## Decision
1. **Online mode:** EasyTutor's server calls StashMind for audio lessons, cards, and ask-the-source (behind flag `stashmind_enabled`, default OFF).
2. **Offline / outage mode:** EasyTutor's local stack uses Ollama with the core prompts and schemas for card and quiz generation, and device text-to-speech (expo-speech) for audio output. The local-first Zustand/AsyncStorage stores keep working.
3. **Dual-host audio is online-only:** Gemini TTS audio assembly happens on StashMind; not available offline. A local voice may be added in a later sprint (behind its own flag).
4. **Clear states:** UI shows online / offline / outage states; an offline queue holds lesson requests for replay on recovery.
5. **EasyTutor's existing online (Anthropic/Groq) and offline (local Ollama) modes both keep working** — non-negotiable; the 181 existing tests stay untouched and green.

## Consequences
- **Positive:** Offline continuity preserved; no regression for existing users; graceful degradation during StashMind outages.
- **Negative:** Offline card/quiz quality depends on local Ollama model capability; device TTS quality varies by platform; offline queue requires idempotent replay (M8).
- **Cross-links:** ADR-M1 (integration), ADR-M4 (core schemas used offline), ADR-M5 (Ollama adapter), ADR-M7 (flag rollout). EasyTutor mirrors in `docs/adr/`.
