# ADR-002: Headless-First Architecture and Multi-Surface Consumption

## Context
StashMind must serve three primary classes of users:
1. End-users interacting through the mobile-first web / PWA user interface.
2. External client applications (e.g. Software Factory, EasyTutor, partner clinics/workspaces, third-party LMS platforms).
3. Autonomous AI agents interacting over the Model Context Protocol (MCP).

If capabilities were implemented directly in frontend UI components or tight page controllers, other consumers would be relegated to second-class citizens, creating duplicated logic, fragmented security models, and maintenance divergence.

## Decision
We adopt a **Headless-First Architecture**:
1. **Core Service Domain:**
   - All core capabilities (source ingestion, normalisation & hashing, lesson generation, card extraction, audio generation, practice turns, spaced repetition review, and deck export) are implemented as pure, headless TypeScript service modules.
2. **First-Class External Interfaces:**
   - **REST API (`/api/v1`):** Complete OpenAPI 3.1 specification. Endpoints validate schemas via standard validators, enforce scoped API keys, support idempotency headers, rate-limiting, and cursor pagination.
   - **Webhooks:** Asynchronous lifecycle events (`lesson.created`, `lesson.ready`, `lesson.failed`, `practice.completed`, `review.due`, etc.) signed with HMAC-SHA256 headers (`X-StashMind-Signature`).
   - **MCP Server:** Exposes domain capabilities (`create_lesson`, `get_lesson`, `list_cards`, `start_practice`, `submit_practice_turn`, `get_due_reviews`, etc.) as standard MCP tools with strict input JSON schemas for AI agents like Opencode.
3. **Web UI as Client:**
   - The React frontend consumes the exact same REST endpoints and data schemas. No special private backend shortcuts bypass the API contracts.
4. **Tenant Workspaces:**
   - Resources are partitioned by user ID and workspace ID to allow multi-tenant isolation, distinct API keys, and independent rate limits.

## Consequences
- Every feature developed in subsequent phases automatically benefits all surfaces.
- Automated testing can directly target the service and REST layers with deterministic contract tests.
- Agents (such as Software Factory unattended loops) can orchestrate lessons, review cards, and execute practice scenarios programmatically.
