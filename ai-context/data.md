# StashMind Data Context

## Database State (REALITY CHECK)
- `supabase/migrations/20261017000000_stashmind_core_schema.sql` — migration file EXISTS but is NOT applied to a live database
- `src/db/repository.ts` — uses in-memory `Map`-based store (`StashMindStore`), NOT Supabase
- `src/db/types.ts` — TypeScript interfaces for 21 entities (Profile, Workspace, Source, Lesson, Card, Streak, SpacedReview, ApiKeyRecord, WebhookRecord, AuditLogRecord, etc.)
- No `@supabase/supabase-js` in package.json dependencies

## RLS
- Claimed: RLS enforced on 13 PostgreSQL tables
- Reality: RLS simulated in TypeScript code (`RLS_VIOLATION` errors thrown manually)
- `tests/integration.test.ts` verifies two-user isolation on the in-memory store

## Entity Types (from types.ts)
- UserTier: free \| student \| pro \| team
- SourceType: text \| pdf \| url \| youtube
- LessonStatus: pending \| processing \| ready \| failed
- PracticeMode: text \| voice
- WorkspaceRole: owner \| admin \| member \| viewer

## Tier 0 Data Gaps
1. Install `@supabase/supabase-js` and wire real Supabase client
2. Apply migration to live Supabase project
3. Replace in-memory store with Supabase queries enforcing real RLS
4. Remove demo-user fallback; implement JWT verification
5. Add age gate enforcement at signup (13+ / 16+ GDPR)
