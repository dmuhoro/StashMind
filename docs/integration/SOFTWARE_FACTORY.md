# Software Factory (Opencode) Integration Guide

This guide describes how to connect **StashMind** to Software Factory workflows and autonomous Opencode agent loops.

---

## 1. Natural Integrations
1. **Sprint & ADR Audio Briefings:**
   - Software Factory's unattended loop feeds the latest `docs/adr/` and `docs/sprints/` files into StashMind via `POST /api/v1/lessons` or MCP tool `create_lesson`.
   - StashMind generates a 5-minute dual-host audio lesson (Alex & Sam) summarizing what shipped this sprint, playable on mobile during commutes.
2. **Quality & Review Webhook Signals:**
   - Outgoing webhooks (`lesson.ready`, `practice.completed`) act as automated verification signals in CI/CD pipelines.

---

## 2. MCP Client Configuration (`opencode.json` or MCP Settings)

Add StashMind to your agent's MCP configuration:

```json
{
  "mcpServers": {
    "stashmind": {
      "url": "http://localhost:3000/api/v1/mcp",
      "headers": {
        "Authorization": "Bearer stm_live_YOUR_API_KEY_HERE"
      }
    }
  }
}
```

---

## 3. Autonomous Workflow Example (Opencode Agent Prompt)

```markdown
Read our latest sprint document at docs/sprints/sprint-01.md.
Call StashMind tool `create_lesson` with:
- source_type: "text"
- content: <contents of sprint-01.md>
- title: "Sprint 01 Engineering Briefing"
- preset: "professional"
- style: "tldr"
- duration_minutes: 5

Verify the returned `lesson_id` and report the generated insight cards.
```
