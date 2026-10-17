# ADR-007: Integration Contract, Scoped API Keys, and Model Context Protocol

## Context
StashMind must serve as a headless educational engine connectable to external software ecosystems (Software Factory, EasyTutor, third-party workspaces) and autonomous AI coding agents (Opencode).

## Decision
1. **Public REST API (`/api/v1`):** Published OpenAPI 3.1 specification at `/api/v1/openapi.json`. Consistent error envelope `{error: {code, message, request_id}}`.
2. **API Keys:** Format `stm_live_<hex>`, shown once upon creation, stored hashed at rest (`sha256`), supporting scopes: `lessons:read`, `lessons:write`, `cards:read`, `cards:write`, `practice:write`, `reviews:read`, `reviews:write`, `export:read`, `webhooks:manage`.
3. **Webhooks:** Outgoing events (`lesson.ready`, `practice.completed`, etc.) signed with HMAC-SHA256 headers (`X-StashMind-Signature`, `X-StashMind-Timestamp`).
4. **MCP Tool Server:** Streamable JSON-RPC 2.0 endpoint at `/api/v1/mcp` providing 11 standard tools (`create_lesson`, `get_lesson`, `list_cards`, `search_library`, `save_card`, `start_practice`, `submit_practice_turn`, `get_due_reviews`, `grade_review`, `export_deck`, `get_usage`).

## Consequences
- Enables seamless unattended integration by Software Factory loops and external products.
- Standardized security, rate limiting, and scope validation across both human and agent clients.
