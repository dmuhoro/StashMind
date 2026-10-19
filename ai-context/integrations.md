# StashMind Integrations Context

## REST API (`src/server/routes.ts`)
- Base: `/api/v1`
- Endpoints: health, openapi.json, me (GET/PATCH), lessons (POST/GET/GET:id), cards, library/saved, library/search, practice, reviews/due, reviews/:card_id/grade, streak, export/deck/:id, usage, api-keys, webhooks, mcp/tools, mcp
- Authentication: Bearer API key (`stm_live_*`) OR `x-stashmind-user-id` header OR demo-user fallback

## OpenAPI 3.1 (`src/server/openapi.ts`)
- `openapi: "3.1.0"`, version 1.0.0
- Schemas: Lesson, Card
- Security: BearerAuth with scoped permissions

## MCP Server (`src/services/mcpServer.ts`)
- 11 tools: create_lesson, get_lesson, list_cards, search_library, save_card, start_practice, submit_practice_turn, get_due_reviews, grade_review, export_deck, get_usage
- JSON-RPC 2.0 at `/api/v1/mcp`

## Webhooks (`src/services/webhooks.ts`)
- Events: lesson.created, lesson.ready, lesson.failed, card.saved, practice.completed, review.due, streak.updated, export.ready
- HMAC signatures (currently non-SHA-256 custom hash — Tier 0 gap)

## API Keys (`src/services/apiKeys.ts`)
- Format: `stm_live_<32 hex>`
- Prefix stored visibly, hash at rest (currently non-SHA-256 — Tier 0 gap)
- Scopes: lessons:read/write, cards:read/write, practice:write, reviews:read/write, export:read, webhooks:manage

## Software Factory Integration
- `docs/integration/SOFTWARE_FACTORY.md` — sprint/ADR audio briefings via `create_lesson`
- MCP client config example for opencode.json

## Tier 0 Integration Gaps
1. Replace non-SHA-256 hashes with real crypto.subtle/crypto SHA-256
2. Real JWT verification instead of demo-user fallback
3. Rate limiting on public endpoints
4. Webhook delivery with retry + exponential backoff (currently just audit-log simulation)
