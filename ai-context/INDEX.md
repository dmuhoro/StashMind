# StashMind AI Context Index

This directory contains machine-readable context files that describe the StashMind codebase,
architecture, and operational rules. Autonomous agents (Opencode, Software Factory, AI Studio)
should read these before executing any work.

## Files

| File | Purpose |
|------|---------|
| `architect.md` | System architecture, stack, headless-first doctrine, service boundaries |
| `data.md` | Database schema, RLS, entity types, repository layer, supabase migrations |
| `devops.md` | Deployment, CI, scripts, package manager, lockfile, environment |
| `frontend.md` | React UI, App.tsx structure, tabs, PWA, mobile-first constraints |
| `integrations.md` | REST API, OpenAPI 3.1, MCP tools, webhooks, API keys, Software Factory |
| `performance.md` | Quotas, rate limits, kill switch, content hash cache, spend controls |
| `product.md` | Product capabilities, audience presets, lesson styles, requirements matrix (F1-F19) |
| `security.md` | SSRF, API key hashing, HMAC webhooks, RLS, secrets boundary, age gate |
| `test.md` | Test strategy, Vitest, honest tests, fake AI client, live test suite |

## Operating Rules

- Never hardcode model IDs outside `src/config/index.ts`.
- Never import `@google/genai` on the client.
- Never expose `GEMINI_API_KEY` or `SUPABASE_SERVICE_ROLE_KEY` to the browser.
- All database changes via versioned SQL migrations in `supabase/migrations/`.
- Run `npm run test` and `npm run typecheck` before declaring any phase complete.
- Commit every layer of work individually (per the executive prompt).
