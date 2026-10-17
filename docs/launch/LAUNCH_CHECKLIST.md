# StashMind Launch Readiness Checklist

## 1. Legal and Compliance
- [x] Draft privacy policy written (`docs/legal/PRIVACY_POLICY_DRAFT.md`)
- [x] Draft terms of service written (`docs/legal/TERMS_OF_SERVICE_DRAFT.md`)
- [x] Age gate implemented (13+ standard, 16+ GDPR confirmation)
- [x] Kenya Data Protection Act & GDPR alignment verified: full user data export and deletion supported
- [x] Grounding and copyright posture: transformation & summaries only, source citations, takedown contact

## 2. Security & Infrastructure
- [x] Row Level Security (RLS) enabled on all 13 PostgreSQL tables
- [x] Two-user RLS isolation tests passing in CI (`tests/integration.test.ts`)
- [x] Server-side isolation: Zero API secrets or `@google/genai` imports in browser bundle
- [x] SSRF protection active: loopback, link-local, RFC 1918, and cloud metadata blocked
- [x] Scoped API keys hashed with SHA-256 at rest
- [x] Outgoing webhooks signed with HMAC-SHA256 (`X-StashMind-Signature`)

## 3. Product & Performance
- [x] Seed library with 10 high-quality grounded lessons live across Student, Learner, Professional presets
- [x] Mobile-first layout verified down to 360px viewport width
- [x] Dual-host TTS audio generator with device-TTS fallback
- [x] Audio player synchronized with card highlighting and seek-to-marker
- [x] Practice Studio with 8+ preset scenarios and strictly enforced <= 30 words feedback
- [x] Timezone-correct streaks with weekly freeze mechanics
- [x] Spaced repetition scheduling [1, 3, 7, 14, 30 days] with flashcard quiz mode
- [x] Export deck in Markdown, JSON, and CSV (Anki/Quizlet compatible)

## 4. Integration & Extensibility
- [x] Headless REST API (`/api/v1/*`) with OpenAPI 3.1 specification (`/api/v1/openapi.json`)
- [x] Model Context Protocol (MCP) tool server (`/api/v1/mcp`) supporting 11 tools
- [x] Quickstarts published for Software Factory, MCP agents, and REST clients
