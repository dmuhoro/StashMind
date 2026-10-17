# StashMind REST API Quickstart

Base URL: `/api/v1`  
OpenAPI 3.1 Spec: `/api/v1/openapi.json`

---

## 1. Authentication
Include your API key as a Bearer token:
```http
Authorization: Bearer stm_live_YOUR_KEY
```

---

## 2. Common Endpoints & Examples

### Ingest & Create a Lesson
```bash
curl -X POST http://localhost:3000/api/v1/lessons \
  -H "Authorization: Bearer stm_live_YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "source_type": "text",
    "content": "A compiler translates high-level source code into low-level machine code...",
    "title": "Compiler Construction Fundamentals",
    "preset": "student",
    "style": "tldr",
    "duration_minutes": 10
  }'
```

### Fetch Lesson with Cards
```bash
curl -X GET http://localhost:3000/api/v1/lessons/les_seed_bio_01 \
  -H "Authorization: Bearer stm_live_YOUR_KEY"
```

### Export Deck to Anki CSV
```bash
curl -X GET "http://localhost:3000/api/v1/export/deck/les_seed_bio_01?format=csv" \
  -H "Authorization: Bearer stm_live_YOUR_KEY" \
  -o bio_deck.csv
```

### Grade a Spaced Review
```bash
curl -X POST http://localhost:3000/api/v1/reviews/card_seed_bio_1/grade \
  -H "Authorization: Bearer stm_live_YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"grade": "good"}'
```
