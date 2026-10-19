# Sprint 03: Tier 1 — Mobile-First, Low-Bandwidth (African Users)

## Sprint Goal
Build features that decide whether real people actually use StashMind: Telegram bot ingestion, data-saver mode, ask-the-source with citations, card quality controls, study mode, Swahili, and M-Pesa payments.

## Tasks Completed
- [x] Telegram bot ingestion webhook (forward link/PDF/text → get audio lesson back)
- [x] Data-saver mode (toggle, downloadable WAV, TTS optimization flag)
- [x] Ask the source (chat with per-claim citations + confidence)
- [x] Card quality controls (thumbs up/down rating, edit headline/insight/takeaway)
- [x] Study mode (quiz + flashcards from notes/past papers, Anki CSV export)
- [x] Swahili lessons + audio (Kiswahili language support)
- [x] M-Pesa Daraja payments (STK push, KES pricing, student tier)

## Evidence
- `npm run typecheck` — zero errors
- `npm run test` — 26/26 passing
- `npm run verify` — 17/17 stability checks pass
