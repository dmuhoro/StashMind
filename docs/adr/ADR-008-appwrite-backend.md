# ADR-008: Appwrite as Backend (supersedes Supabase)

## Status
Accepted

## Date
2026-10-20

## Context
StashMind was originally designed around Supabase (PostgreSQL with Row Level Security). The deep audit revealed that the Supabase integration was never actually connected to a live project — the repository layer uses an in-memory `Map` store, and the `supabase/migrations/` SQL was never applied to a live database. The product needs a real, managed backend with Auth, database, storage, and realtime that works for low-bandwidth, mobile-first African users.

Appwrite Cloud was selected because:
- The project already has an Appwrite Cloud project in Frankfurt (FRA) — data residency close to African and European users.
- Appwrite provides Auth, TablesDB, Storage, Realtime, and Functions in one managed platform — no separate infrastructure to operate.
- TablesDB uses table-level and row-level permissions (not PostgreSQL RLS), which maps cleanly to StashMind's user-scoped access model.
- Appwrite Storage is needed for audio files (TTS output) and exports, which must not live in database rows due to size limits.
- Appwrite Functions are available for future worker jobs (ingestion, TTS assembly) without a separate compute platform.
- Free tier is available for staging; Pro tier auto-scales with budget caps for production.

## Decision
Replace Supabase with Appwrite as the backend for StashMind:

1. **Appwrite Auth** for identity — email/password, email verification, password recovery, Google OAuth, sessions. Replaces custom JWT/login code.
2. **TablesDB** for data — databases, tables, rows with table-level and row-level permissions. Row Security on. Every row created with `Role.user(owner)` permissions, or a team role for shared workspaces. No `any` role except explicitly public demo content.
3. **Storage** for files — private buckets for uploads, audio, and exports. Large JSON (lesson scripts) and all audio stored in Storage; only pointers kept in rows.
4. **Realtime** for status updates — lesson generation progress, payment status, streak updates.
5. **Express stays** as the API and worker host — a long-running Node service. Appwrite Sites time out at 30 seconds, so TTS and ingestion jobs (longer than 30s) stay in Express.
6. **Two SDK clients only**:
   - User-scoped client using the caller's Appwrite JWT for everything a user triggers — keeps user permissions in force.
   - Admin client using the API key, restricted to a short ADR-listed set of system tasks (job queue, webhook deliveries, usage counters, API-key lookup, payment callbacks, kill switch). Admin key scopes are minimum needed.
7. **No multi-row transaction assumptions** — Appwrite TablesDB does not support multi-row transactions. Operations are idempotent with unique indexes for deduplication.

## Consequences
- All earlier claims about PostgreSQL RLS are rewritten to Appwrite table/row permissions.
- `supabase/migrations/` SQL is archived to `docs/archive/`; no longer applied.
- `@supabase/supabase-js` removed; `node-appwrite` (server) and `appwrite` (web) added.
- `SUPABASE_*` environment variables removed; `APPWRITE_*` variables added.
- Data modelling must respect Appwrite column and row size limits — large JSON and audio go to Storage.
- No multi-row transactions — idempotency keys and unique indexes replace transactional guarantees.
- Appwrite Cloud Free tier: 2 projects per organization, shared resources. Production needs Pro tier or careful budget caps.

## Supersedes
ADR decisions that referenced Supabase, PostgreSQL, or Row Level Security are superseded by this ADR.
