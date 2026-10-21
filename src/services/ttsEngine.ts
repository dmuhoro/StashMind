/**
 * TTS Engine: Multi-Speaker Audio Synthesis, WAV Header Handling & Fallbacks
 * Covers Requirements F8, F10.
 */

import { GeminiClient } from './gemini.ts';
import { isDailySpendKillSwitchActive, TTS_PROVIDER_DUAL_HOST, type TtsProvider } from '../config/index.ts';
import type { HostDialogueLine } from '../db/types.ts';

export interface AudioGenerationResult {
  audioUrl?: string;
  audioDurationSeconds: number;
  ttsProvider: TtsProvider;
  isFallback: boolean;
  base64Wav?: string;
}

export class TtsEngine {
  /**
   * Generates dual-host audio for a script using Gemini 3.8 Flash TTS,
   * with automatic fallback to device-TTS if kill switch is active or API fails.
   *
   * @param dataSaver - When true, signals low-bandwidth optimization (client should
   *   downsample/compress audio for weak mobile connections).
   */
  static async synthesizeLessonAudio(
    script: HostDialogueLine[],
    dataSaver = false
  ): Promise<AudioGenerationResult> {
    const totalWords = script.reduce((acc, line) => acc + line.text.split(/\s+/).length, 0);
    const estimatedDurationSeconds = Math.max(10, Math.round((totalWords / 140) * 60));

    // Check kill switch
    if (isDailySpendKillSwitchActive()) {
      return {
        audioDurationSeconds: estimatedDurationSeconds,
        ttsProvider: 'device-tts-fallback',
        isFallback: true,
      };
    }

    try {
      const dialogue = script.map((line) => ({
        speaker: line.speaker,
        text: line.text,
      }));

      const client = new GeminiClient();
      const result = await client.generateDualSpeakerTts(dialogue);

      return {
        audioUrl: `data:audio/wav;base64,${result.base64Wav}`,
        base64Wav: result.base64Wav,
        audioDurationSeconds: result.audioSeconds,
        ttsProvider: TTS_PROVIDER_DUAL_HOST,
        isFallback: false,
      };
    } catch {
      // Graceful fallback to client device-TTS
      return {
        audioDurationSeconds: estimatedDurationSeconds,
        ttsProvider: 'device-tts-fallback',
        isFallback: true,
      };
    }
  }

  /**
   * Combines multiple base64-encoded unary WAV clips into a single contiguous WAV file,
   * properly stripping the 44-byte RIFF header from all chunks after the first.
   */
  static concatenateWavBase64Chunks(chunks: string[]): string {
    if (chunks.length === 0) return '';
    if (chunks.length === 1) return chunks[0];

    // Decode first chunk with full 44-byte header
    const firstBinary = atob(chunks[0]);
    const buffers: Uint8Array[] = [
      new Uint8Array(firstBinary.split('').map((c) => c.charCodeAt(0))),
    ];

    let totalPcmLength = buffers[0].length - 44;

    // Subsequent chunks: strip the initial 44 bytes (RIFF header)
    for (let i = 1; i < chunks.length; i++) {
      const binary = atob(chunks[i]);
      if (binary.length > 44) {
        const pcmOnly = new Uint8Array(binary.length - 44);
        for (let j = 44; j < binary.length; j++) {
          pcmOnly[j - 44] = binary.charCodeAt(j);
        }
        buffers.push(pcmOnly);
        totalPcmLength += pcmOnly.length;
      }
    }

    // Allocate combined buffer
    const combinedLength = 44 + totalPcmLength;
    const combined = new Uint8Array(combinedLength);

    // Copy first chunk (including its 44-byte header)
    combined.set(buffers[0], 0);

    // Copy remaining PCM buffers
    let offset = buffers[0].length;
    for (let i = 1; i < buffers.length; i++) {
      combined.set(buffers[i], offset);
      offset += buffers[i].length;
    }

    // Update RIFF ChunkSize (bytes 4-7) = totalLength - 8
    const riffSize = combinedLength - 8;
    combined[4] = riffSize & 0xff;
    combined[5] = (riffSize >> 8) & 0xff;
    combined[6] = (riffSize >> 16) & 0xff;
    combined[7] = (riffSize >> 24) & 0xff;

    // Update data subchunk size (bytes 40-43) = totalPcmLength
    combined[40] = totalPcmLength & 0xff;
    combined[41] = (totalPcmLength >> 8) & 0xff;
    combined[42] = (totalPcmLength >> 16) & 0xff;
    combined[43] = (totalPcmLength >> 24) & 0xff;

    // Re-encode to base64
    let binaryStr = '';
    const len = combined.byteLength;
    for (let i = 0; i < len; i++) {
      binaryStr += String.fromCharCode(combined[i]);
    }
    return btoa(binaryStr);
  }

  /**
   * Estimates audio duration from word count (~140 words per minute).
   * Used as a fallback when ffprobe is not available.
   */
  static measureAudioDuration(wavBuffer: Buffer): number {
    // Approximate: WAV audio at 24kHz 16-bit mono, estimate duration from buffer size
    // 24000 bytes per second for 16-bit mono (2 bytes * 24000 samples / 2 channels... actually 1 channel = 2 bytes/sample * 24000 samples/sec = 48000 bytes/sec)
    const bytesPerSecond = 48000;
    const estimatedSeconds = wavBuffer.length / bytesPerSecond;
    return Math.max(5, Math.round(estimatedSeconds));
  }
}
