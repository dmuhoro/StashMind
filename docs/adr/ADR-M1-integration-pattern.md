# ADR-M1: Integration pattern — shared core package plus typed API client

## Context
StashMind (Vite + React + Express, Appwrite Auth/TablesDB/Storage, Gemini) and EasyTutor (Expo SDK 57 + React Native, Supabase + pgvector, Ollama/Anthropic/Groq) must integrate without merging their data stores. The directive's one-to-one pairing (portals with presets, pgvector RAG with Appwrite, routers with routers) would require migrating data between systems, adding risk with no user value.

The StashMind x EasyTutor Merge Job executive prompt (v1.0, 2026-10-21) specifies the target shape:
- Shared core package `@stashmind/core`: schemas, prompts, scheduler, model-provider interface. React Native / Metro safe (no Node-only modules, no `process.env` or `Buffer` assumptions).
- Typed API client `@stashmind/client` generated from StashMind's OpenAPI file.
- EasyTutor is a workspace on StashMind with a service account; EasyTutor's server calls StashMind on behalf of each learner.
- StashMind owns lessons, cards, audio, ask-the-source threads. EasyTutor owns learner profile, curriculum, roadmaps, pgvector RAG corpus and progress, linked by an ID table.
- Offline mode stays intact via local Ollama + device voice; dual-host audio online-only.
- Model-router convergence is gradual (strangler): shared interface + conformance tests first, adoption behind flags, duplicates removed later.
- Everything new behind flags defaulting OFF; separate repos; nothing merged to main without human review.

## Decision
1. **No database merge, no data migration.** StashMind and EasyTutor remain separate systems of record, coupled only through a versioned package (`@stashmind/core`) and StashMind's HTTP API (OpenAPI 3.1).
2. **Shared core package `@stashmind/core`** lives in the StashMind repo (`packages/core`), built to ESM + CJS + types with an `exports` map, React Native / Metro safe. Version 1.1.0 with changelog. Published to a private registry (H2) or installed from a tagged git dependency if no registry token exists.
3. **Typed API client `@stashmind/client`** generated from StashMind's OpenAPI file (`api/server.ts` → `openapi.json`). Lives in StashMind, consumed by EasyTutor's server.
4. **System-of-record split:** StashMind = lessons, cards, audio, ask-the-source threads. EasyTutor = learner profile, curriculum, roadmaps, RAG corpus, progress. Linked by the `stashmind_links` ID table (M4).
5. **Feature flags** default OFF; no behaviour change for existing users (M7).

## Consequences
- **Positive:** Zero data-migration risk; each repo keeps its own data store; cross-repo coupling is explicit and versioned; EasyTutor mobile never holds a StashMind key; flags allow safe staged rollout and rollback.
- **Negative:** Two systems to operate; correlation IDs required for observability (ADR-M8); conformance tests needed to keep core schemas in sync across repos (ADR-M5).
- **Cross-links:** ADR-M2 (identity), ADR-M3 (offline), ADR-M4 (packaging), ADR-M5 (model router), ADR-M6 (portal mapping), ADR-M7 (rollout), ADR-M8 (privacy). EasyTutor mirrors these ADRs in its own `docs/adr/` with cross-reference links.
