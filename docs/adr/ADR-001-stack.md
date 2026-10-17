# ADR-001: Technology Stack and Runtime Feasibility

## Context
The executive prompt specifies a target stack for StashMind:
- TypeScript in strict mode
- Tailwind CSS
- PWA-first, mobile-first design responsive down to 360px viewport width
- Supabase (Postgres, Auth, Storage, Row Level Security)
- Google Gemini API via the official `@google/genai` TypeScript SDK (Flash, Pro, TTS, Live)
- Headless API layer (/api/v1/*) with OpenAPI 3.1, Webhooks, and Model Context Protocol (MCP) tool server
- Framework requirement: Next.js App Router for Vercel deployment; or Full-Stack Express + Vite React SPA in local/container environments.

We evaluated the execution environment:
AI Studio provides a Node.js full-stack container with Vite 8, React 19, Express 4.21, and `tsx` running on port 3000. In this environment:
- The backend runs Express (`server.ts` or Vite dev middleware) providing the `/api/v1/*` REST routes, webhooks, and MCP endpoint.
- The frontend runs React 19 with Tailwind CSS v4, Motion, Lucide icons, and PWA capabilities.
- The business logic, schemas, Supabase client code, and API contracts are written cleanly in standard TypeScript so they run identically in Node.js/Express and can be deployed directly or ported to Next.js App Router route handlers without architectural alteration.

## Decision
1. **Frontend & App Shell:** React 19 + TypeScript (strict) + Vite 8 + Tailwind CSS v4. Mobile-first at 360px width with PWA manifest and offline caching.
2. **Backend & API Layer:** Express 4.21 with Node.js/tsx serving `/api/v1/*` endpoints, OpenAPI 3.1 specification, outgoing HMAC-SHA256 signed webhooks, and streamable MCP tool handlers.
3. **Database & Storage:** Supabase PostgreSQL with versioned migrations, Row Level Security (RLS) on all user-owned tables, and Supabase Storage for audio artifacts.
4. **AI & Speech Generation:** Official `@google/genai` SDK isolated on the server. Models managed via `src/config/index.ts`:
   - `gemini-3.8-flash` for fast synthesis, lesson generation, and practice feedback.
   - `gemini-4-argon` for heavy reasoning tasks.
   - `gemini-3.8-flash-lite-tts` for high-throughput single-speaker audio.
   - `gemini-3.8-flash-tts` for dual-speaker screenplay dialogue with backchanneling (`|yeah|`) and vocal bursts (`<laugh>`, `<breath>`).
   - `gemini-3.8-live` for bidirectional real-time voice practice.
5. **Testing & CI:** Vitest for unit tests (configuration, hashing, streak calculations, spaced repetition, RLS policies), TypeScript compiler (`tsc --noEmit`) for strict linting/typechecking.

## Consequences
- **Feasibility:** Fully feasible in this environment. The server listens on port 3000 and fulfills both the browser UI and the headless REST/MCP interfaces.
- **Portability:** All route handlers, schemas, and services are decoupled from framework internals, allowing smooth export to Vercel/Next.js if desired.
- **Security:** Zero model keys or service credentials leak to the browser.
