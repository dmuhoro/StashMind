# ADR-M5: Model-router convergence — ModelProvider interface with conformance suite

## Context
StashMind uses Gemini; EasyTutor routes Anthropic / Groq / Ollama. The integration needs a shared `ModelProvider` interface in `@stashmind/core` with conformance tests, plus adapters for Gemini, Anthropic, Groq, and Ollama. Adoption is gradual (strangler): each repo adopts behind a flag only after parity is proven on shared fixtures. Duplicates removed only in a later sprint.

## Decision
1. **`ModelProvider` interface** in `@stashmind/core`: `generate(options): Promise<GenerationResult>`, with schemas from core for cards, quizzes, roadmap nodes.
2. **Adapters:** Gemini (StashMind), Anthropic, Groq, Ollama (EasyTutor).
3. **Conformance suite:** shared fixtures; adapters must produce the same outputs within tolerance and consistent token accounting.
4. **StashMind adopts behind a flag** once Gemini adapter passes conformance.
5. **EasyTutor adopts behind a flag only after parity** on shared fixtures (same outputs within tolerance, token accounting). The existing 181 EasyTutor tests stay untouched and green; EasyTutor's online (Anthropic/Groq) and offline (Ollama) modes both keep working.

## Consequences
- **Positive:** Single model contract; parity-tested adapters; no forced migration; duplicates removed only after proven parity.
- **Negative:** Conformance suite maintenance; tolerance thresholds are product decisions; dual routing during transition adds complexity.
- **Cross-links:** ADR-M1 (integration), ADR-M4 (core hosts the interface), ADR-M3 (Ollama adapter for offline), ADR-M7 (flags). EasyTutor mirrors in `docs/adr/`.
