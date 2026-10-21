# ADR-M8: Cross-system privacy and observability

## Context
Data flows between StashMind and EasyTutor via the EasyTutor server holding StashMind service credentials. Privacy sign-off (H6) is required on cross-system data flows. Correlation IDs must trace requests across both systems. Deletion must propagate. The list of data processors must be updated in both repos.

## Decision
1. **Correlation IDs** across both systems: every cross-system call carries a correlation ID propagated from EasyTutor's server into StashMind requests, logged on both sides.
2. **Updated data-processor list** in both repos' privacy documents, covering StashMind (Appwrite, Gemini) and EasyTutor (Supabase, Ollama, Anthropic, Groq).
3. **Consent:** lesson summaries enter EasyTutor's pgvector RAG only with explicit user consent (M8 stretch). Consent recorded per user.
4. **Deletion propagation:** StashMind exposes a deletion-propagation endpoint; EasyTutor calls it when a learner/data is deleted; the `stashmind_links` table is cleaned up with RLS.
5. **No secrets in mobile bundle, repos, logs, or reports:** StashMind service credentials server-side only on EasyTutor.

## Consequences
- **Positive:** Traceable cross-system requests; auditable data flows; deletion honoured; processor lists current; secret boundary preserved.
- **Negative:** Correlation ID plumbing across service boundaries; consent UI/state management; H6 privacy sign-off required before cross-system data flows go live.
- **Cross-links:** ADR-M1 (integration), ADR-M2 (service account + audit log), ADR-M4 (packaging/secrets), ADR-M7 (flags). EasyTutor mirrors in `docs/adr/`.
