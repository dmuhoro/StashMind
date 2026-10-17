# MCP Agent Quickstart

StashMind implements a full **Model Context Protocol (MCP)** server over streamable HTTP at `/api/v1/mcp`.

---

## 1. Available Tools
1. `create_lesson`: Ingest raw text/URL/YouTube and generate dual-host lesson with cards.
2. `get_lesson`: Fetch lesson status, script, audio URL, and cards by ID.
3. `list_cards`: List all insight cards for a lesson.
4. `search_library`: Full-text query over saved cards and summaries.
5. `save_card`: Bookmark card to personal library.
6. `start_practice`: Begin a roleplay scenario (e.g. salary negotiation, deadline defense).
7. `submit_practice_turn`: Submit conversational response; get <= 30 words feedback & scores.
8. `get_due_reviews`: Retrieve spaced repetition items due.
9. `grade_review`: Log performance (Again, Hard, Good, Easy) and reschedule.
10. `export_deck`: Export in Markdown, JSON, or CSV (Anki/Quizlet).
11. `get_usage`: Read daily lesson quota and streak state.

---

## 2. Calling via JSON-RPC

Send a standard JSON-RPC 2.0 POST request:

```bash
curl -X POST http://localhost:3000/api/v1/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer stm_live_YOUR_KEY" \
  -d '{
    "jsonrpc": "2.0",
    "id": "1",
    "method": "tools/call",
    "params": {
      "name": "get_usage",
      "arguments": {}
    }
  }'
```

Response:
```json
{
  "jsonrpc": "2.0",
  "id": "1",
  "result": {
    "tier": "student",
    "current_streak": 4,
    "freezes_available": 1,
    "daily_lesson_cap": 20
  }
}
```
