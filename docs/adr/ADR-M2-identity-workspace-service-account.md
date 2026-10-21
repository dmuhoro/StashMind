# ADR-M2: Identity — EasyTutor as a StashMind workspace with service account

## Context
EasyTutor learners must not log in twice, and the StashMind service key must never reach a phone. EasyTutor runs its own server (Supabase-backed) and an Expo mobile app. StashMind runs Appwrite Auth. The integration needs an on-behalf-of mechanism so EasyTutor's server can act for a learner without the learner holding StashMind credentials.

## Decision
1. **EasyTutor is a workspace in StashMind** with a service account. StashMind service credentials exist only on the EasyTutor server side — never in the mobile bundle, repos, logs, or reports.
2. **Identity mapping:** a `(workspace_id, external_user_id) → stashmind_user_id` mapping is stored in StashMind (Appwrite table). EasyTutor's Supabase `stashmind_links` table (row-level security) mirrors the link with RLS.
3. **On-behalf-of mechanism:** EasyTutor's server holds the StashMind service-account key and calls StashMind APIs on behalf of the learner, passing a correlation ID and the mapped StashMind user context. The mobile app talks only to EasyTutor's server.
4. **No second login:** learners authenticate to EasyTutor as today; EasyTutor's server resolves the StashMind identity transparently.
5. **Per-workspace quotas and rate limits** enforced in StashMind; audit log records cross-system calls; deletion-propagation endpoint removes linked data when a learner is deleted.

## Consequences
- **Positive:** Single login for learners; StashMind key never on device; server-side secret boundary; auditability and deletion propagation.
- **Negative:** EasyTutor server becomes a trusted intermediary; compromise of the service-account key affects all linked learners (mitigated by server-side-only storage, rotation, and H3 staging key review). Requires H3 (staging service-account key + EasyTutor staging settings) before live verification.
- **Cross-links:** ADR-M1 (integration), ADR-M4 (packaging), ADR-M8 (privacy). EasyTutor mirrors in `docs/adr/`.
