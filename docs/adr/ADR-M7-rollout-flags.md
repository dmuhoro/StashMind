# ADR-M7: Rollout — flags default OFF, staged rollout, rollback by flag

## Context
Every new merge capability must sit behind a feature flag defaulting OFF, so existing users see no behaviour change. Rollout is staged: internal → small percentage → everyone. Rollback is by flag (no code redeploy required).

## Decision
1. **Flags default OFF:** `stashmind_enabled` (EasyTutor bridge), plus per-capability flags in core config.
2. **Staged rollout:** internal dogfood → small percentage → everyone, each gated on metrics and no regressions.
3. **Rollback by flag:** flip the flag OFF; no revert of code required; data written while ON remains but is not read.
4. **No behaviour change for existing users** with all flags OFF; EasyTutor's existing end-to-end tests pass unchanged.
5. **EasyTutor's online (Anthropic/Groq) and offline (Ollama) modes both keep working** regardless of flag state.

## Consequences
- **Positive:** Safe, reversible rollout; no regression risk for existing users; operational kill switch per capability.
- **Negative:** Flag debt must be retired after full rollout (later sprint); duplicate code paths maintained during transition.
- **Cross-links:** ADR-M1 (integration), ADR-M2 (identity behind flag), ADR-M3 (offline independent of flag), ADR-M5 (model router behind flag). EasyTutor mirrors in `docs/adr/`.
