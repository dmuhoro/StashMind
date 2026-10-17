# StashMind Constitution

## 1. Headless-First Rule
Every capability that exists in the UI must also exist as:
1. An authenticated REST endpoint (`/api/v1/*`)
2. A webhook event where it makes sense
3. An MCP (Model Context Protocol) tool

Other software systems and AI agents are first-class users. The user interface is merely one client of the underlying headless engine.

## 2. Non-Negotiables

### Security
- Row Level Security (RLS) is enabled and enforced on every user-owned database table. Never disable RLS.
- Secrets live strictly on the server. Service-role keys never reach client code.
- All input is validated against schemas with strict size and type limits.
- Block all server-side URL fetching to private, loopback, or link-local addresses (SSRF prevention).
- Rate-limit all AI-backed and public endpoints.
- API keys are hashed at rest (`sha256`) with a readable prefix. Outgoing webhooks are signed with HMAC-SHA256.
- Maintain an immutable audit log for sensitive events (key generation, key revocation, data export, role changes).

### Privacy
- User uploads are strictly private by default.
- The shared content cache stores only transformed outputs, never raw uploaded documents.
- Provide full account data export and one-click account deletion.
- Never log raw document contents, PII, or secrets in application logs.

### Cost
- Compute a cryptographic content hash of normalized input before any Gemini model invocation.
- Enforce per-user daily lesson creation caps based on tier.
- Provide a global spend kill switch (`DAILY_SPEND_KILL_SWITCH`) that falls back gracefully to text-only mode and device TTS when active.
- Log model ID, input tokens, output tokens, and TTS audio seconds for every generation.

### Reliability
- Every async job has a timeout, a retry policy with exponential backoff, and a terminal failed state.
- No job stays in a `processing` state indefinitely.
- Failures display a human-readable explanation and an actionable retry trigger.

### Quality and Honesty
- Every insight card and every host line must be directly grounded in the source text.
- No invented quotes, imaginary statistics, or fabricated citations.
- Every insight card carries a specific pointer back to the relevant source section.
- If the source is thin or low information density, acknowledge it candidly and generate fewer cards.
- Practice feedback must be specific, constructive, short (under 30 words per turn), and kind.

### Accessibility
- Provide an accurate text transcript for every generated audio lesson.
- Ensure the application is completely operable via keyboard.
- Maintain WCAG AA color contrast standards.
- Respect user operating system preferences for captions and reduced motion.
- Provide descriptive screen-reader labels for all interactive elements.

### Content and Rights
- Summarize and transform input; never regurgitate long verbatim passages of copyrighted text.
- Respect `robots.txt` and terms of service when fetching remote web pages.
- Provide an active, monitored takedown and copyright reporting workflow.

### Minors
- Require users to be 13 years of age or older (16 in jurisdictions governed by the GDPR), verified by an explicit age gate at signup.
- Do not collect surplus personal data.

## 3. Code Standards
- TypeScript in strict mode (`"strict": true`). No `any` without an explicit justifying comment.
- Small, single-responsibility modules.
- Changes to database schemas must occur solely via versioned SQL migrations.
- Comprehensive test coverage: unit tests for business logic, integration tests for API endpoints and RLS isolation, end-to-end tests for core workflows.
- Structured logging with unique correlation Request IDs (`request_id`).
