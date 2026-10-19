# StashMind Security Context

## SSRF Protection (`src/services/security.ts`)
- Blocks: 127.x, 0.x, 10.x, 172.16-31.x, 192.168.x, 169.254.x, ::1, fe80, fc00, fd00
- Blocked hostnames: localhost, metadata.google.internal, metadata.internal, instance-data, 169.254.169.254
- **GAP**: No DNS resolution — validates hostname string only, doesn't resolve to IP
- **GAP**: No IPv6 link-local beyond listed patterns

## API Keys (`src/services/apiKeys.ts`)
- Format: `stm_live_<32 hex>`
- **GAP**: `hashKey()` uses djb2-style hash, NOT SHA-256 (despite "SHA-256" claims in docs)

## Webhooks (`src/services/webhooks.ts`)
- **GAP**: `computeSignature()` uses custom hash, NOT HMAC-SHA256 (despite docs claiming HMAC-SHA256)

## Secrets Boundary
- `@google/genai` imported only in `src/services/gemini.ts` (server-side) ✓
- `GEMINI_API_KEY` read from `process.env` server-side only ✓
- No secrets in client bundle (verified by verify-stability.sh) ✓

## Authentication
- **GAP**: `authenticateRequest()` falls back to `user_student_demo` — no JWT, no Supabase Auth
- **GAP**: No age gate enforcement at signup (13+ / 16+ GDPR)

## RLS
- **GAP**: Simulated in TypeScript, not real PostgreSQL RLS

## Audit Log
- `AuditLogRecord` type exists; `logAuditEvent()` writes to in-memory array
- No immutable persistence

## Tier 0 Security Gaps
1. Replace custom hashes with real SHA-256 / HMAC-SHA256 (crypto module)
2. Add DNS resolution to SSRF guard
3. Implement real Supabase Auth + JWT verification, remove demo-user fallback
4. Apply supabase migration to live DB with real RLS
5. Add rate limiting on AI-backed and public endpoints
6. Add age-gate signup enforcement
