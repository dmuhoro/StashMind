# StashMind Permissions and Isolation Matrix

**Appwrite Edition — ADR-008**  
**Date:** October 20, 2026  
**Status:** Implemented (live two-user tests pending G1 gate)

## Permission Model

Appwrite TablesDB uses table-level and row-level permissions. Row Security is enabled on every table. There is no PostgreSQL RLS — permissions are enforced by Appwrite's permission system.

### Two Clients (ADR-008)

| Client | Credential | Permissions in Force | Allowed Tasks |
|--------|-----------|---------------------|---------------|
| User-scoped | Caller's Appwrite JWT/session | User's row-level permissions | Everything a user triggers (create, read, update, delete own data) |
| Admin | API key | Bypasses user permissions (administrator) | System tasks only: job queue, webhook deliveries, usage counters, API-key lookup, payment callbacks, kill switch |

The API key is used sparingly and only for the ADR-listed system tasks. Every user-facing request uses the caller's JWT so that Appwrite's row-level permissions remain in force.

## Table Permission Matrix

| Table | Create | Read | Update | Delete | Row Security | Notes |
|-------|--------|------|--------|--------|--------------|-------|
| `profiles` | user | any | user | user | ON | Users create their own profile; public can read profiles |
| `sources` | user | user | user | user | ON | User owns their sources |
| `lessons` | user | user | user | user | ON | User owns their lessons; audio and cards are separate |
| `cards` | user | user | user | user | ON | User owns their cards; linked to lesson |
| `saved_cards` | user | user | user | user | ON | User owns their saved cards |
| `practice_sessions` | user | user | user | user | ON | User owns their practice sessions |
| `streaks` | user | user | user | user | ON | User owns their streak |
| `usage_counters` | user | user | user | user | ON | User owns their usage data |
| `api_keys` | user | user | user | user | ON | User owns their API keys; hashed storage |
| `webhooks` | user | user | user | user | ON | User owns their webhook subscriptions |
| `webhook_deliveries` | user | user | — | — | ON | Append-only delivery log |
| `audit_log` | user | any | — | — | ON | Users create audit entries; public can read |
| `jobs` | user | user | user | user | ON | User owns their async jobs |
| `payments` | user | user | user | user | ON | User owns their payment records |
| `subscriptions` | user | user | user | user | ON | User owns their subscription |
| `telegram_links` | user | user | user | user | ON | User owns their Telegram link |
| `card_feedback` | user | user | user | user | ON | User owns their card ratings |
| `ask_threads` | user | user | user | user | ON | User owns their Q&A threads |
| `system_flags` | user | any | user | user | ON | System-wide flags; public can read |

**Role key:** `user` = authenticated user (Role.user(id)); `any` = public (Role.any())

## Bucket Permission Matrix

| Bucket | Create | Read | Delete | File Security | Max Size | Allowed Types |
|--------|--------|------|--------|-------------|----------|---------------|
| `uploads` | user | user | user | ON | 15 MB | pdf, txt, md |
| `audio` | user | user | user | ON | 50 MB | wav, mp3, opus |
| `exports` | user | user | user | ON | 10 MB | json, csv, md |

## Isolation Rules

1. **Row ownership:** Every row is created with `Role.user(owner)` permissions. Only the creator can read, update, or delete their own rows.
2. **No cross-user access:** User B cannot read, list, update, or delete User A's rows through the API or Appwrite SDK with B's session.
3. **No `any` role for writes:** Only read operations on public tables (profiles, audit_log, system_flags) use Role.any(). All writes require Role.user().
4. **API key scopes:** API keys have scoped permissions (lessons:read, lessons:write, cards:read, cards:write, etc.). Scope checks are enforced on every API key request.
5. **Admin key:** Used only for system tasks. Never for user-facing operations.

## API Key Scopes

| Scope | Allows |
|-------|--------|
| `lessons:read` | Read own lessons |
| `lessons:write` | Create/update/delete own lessons |
| `cards:read` | Read own cards |
| `cards:write` | Create/update/delete own cards |
| `practice:write` | Create practice sessions and submit turns |
| `reviews:read` | Read due reviews |
| `reviews:write` | Grade reviews |
| `export:read` | Export lesson decks |
| `webhooks:manage` | Create/manage webhooks |

## Live Two-User Isolation Tests (Pending G1)

These tests run against a live Appwrite instance once G1 (Appwrite project, scoped API key, database ID) is available:

1. User A creates a lesson; User B attempts GET /api/v1/lessons/{lessonId} → 404 or null
2. User A creates a card; User B attempts PATCH /api/v1/cards/{cardId} → 403 or 404
3. User A creates a practice session; User B attempts POST /api/v1/practice/{sessionId}/turn → 403 or 404
4. User A creates a webhook; User B attempts GET /api/v1/webhooks → empty list
5. API key with `lessons:read` scope cannot POST /api/v1/lessons → 403

See `tests/integration.test.ts` for the MemoryRepository versions of these tests. Live Appwrite versions run under `npm run test:live` once G1 is provisioned.

## Row Security Verification

Row Security is ON for all 20 tables declared in `appwrite.config.json`. No table has `rowSecurity: false`. No `any` role has write permissions on any table.

## Related Documents

- `docs/adr/ADR-008-appwrite-backend.md` — Appwrite backend decision
- `appwrite.config.json` — Declared schema with permissions
- `src/db/appwriteRepository.ts` — Two-client implementation
