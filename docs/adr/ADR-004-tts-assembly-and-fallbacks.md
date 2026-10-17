# ADR-004: Dual-Host TTS Assembly and Fallback Strategy

## Context
Dual-host educational lessons require distinct conversational voices (Alex & Sam) with realistic dialogue pacing, backchanneling (`|yeah|`, `|mhm|`), and vocal bursts (`<laugh>`, `<gasp>`). Additionally, unary Gemini TTS returns 44-byte RIFF WAV headers, which cause audible clicks or playback corruption if concatenated naively as raw bytes. When daily spend limits are hit or offline, users still need playable lessons.

## Decision
1. Use `MODELS.TTS_DUAL_HOST` (`gemini-3.8-flash-tts`) with `multiSpeakerVoiceConfig` (Alex: Puck, Sam: Kore).
2. For multiple audio chunks, decode base64, strip the 44-byte WAV header from all chunks after the first, concatenate raw PCM buffers, recalculate ChunkSize and Subchunk2Size, and re-encode to a single valid WAV stream.
3. Provide an automatic fallback to device-TTS (client-side speech synthesis) and transcript-only mode when `DAILY_SPEND_KILL_SWITCH` is enabled or network limits are exceeded.

## Consequences
- Guaranteed glitch-free audio concatenation.
- Zero downtime when model quotas are exhausted: users seamlessly transition to device TTS.
