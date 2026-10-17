/**
 * Gemini SDK Adapter Service (Server-side only)
 * Follows 2026 @google/genai guidelines with central configuration.
 */

import { GoogleGenAI, Type } from '@google/genai';
import {
  MODELS,
  HTTP_CLIENT_HEADERS,
  isDailySpendKillSwitchActive,
} from '../config/index.ts';

let genAiClient: GoogleGenAI | null = null;

function getGenAiClient(): GoogleGenAI {
  if (!genAiClient) {
    const apiKey = typeof process !== 'undefined' ? process.env?.GEMINI_API_KEY : undefined;
    genAiClient = new GoogleGenAI({
      apiKey: apiKey || 'dummy-key-for-local-development',
      httpOptions: {
        headers: {
          'User-Agent': HTTP_CLIENT_HEADERS.USER_AGENT,
        },
      },
    });
  }
  return genAiClient;
}

export class GeminiService {
  /**
   * Generates structured JSON with schema validation and automatic 1-retry repair.
   */
  static async generateStructuredJson<T>(params: {
    systemInstruction: string;
    prompt: string;
    schema: Record<string, unknown>;
    model?: string;
  }): Promise<{ data: T; inputTokens: number; outputTokens: number }> {
    const apiKey = typeof process !== 'undefined' ? process.env?.GEMINI_API_KEY : undefined;
    const isTestEnvironment = typeof process !== 'undefined' && (process.env?.VITEST === 'true' || process.env?.NODE_ENV === 'test');
    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey.startsWith('dummy-key') || isTestEnvironment) {
      throw new Error('FAST_FAIL_TEST_MODE: API key not set or running in test mode. Fast-falling back to deterministic synthesis.');
    }

    const ai = getGenAiClient();
    const model = params.model || MODELS.FLASH;

    const requestConfig = {
      systemInstruction: params.systemInstruction,
      responseMimeType: 'application/json',
      responseSchema: params.schema as unknown,
    };

    try {
      const response = await ai.models.generateContent({
        model,
        contents: params.prompt,
        config: requestConfig,
      });

      const text = response.text || '';
      const parsed = JSON.parse(text) as T;

      return {
        data: parsed,
        inputTokens: response.usageMetadata?.promptTokenCount ?? 120,
        outputTokens: response.usageMetadata?.candidatesTokenCount ?? 350,
      };
    } catch (primaryError) {
      // Automatic Repair Retry
      try {
        const retryPrompt = `${params.prompt}\n\nIMPORTANT: Your previous output did not match valid JSON. Return ONLY the strict JSON object matching the requested schema.`;
        const retryResponse = await ai.models.generateContent({
          model,
          contents: retryPrompt,
          config: requestConfig,
        });

        const retryText = retryResponse.text || '';
        const repaired = JSON.parse(retryText) as T;

        return {
          data: repaired,
          inputTokens: retryResponse.usageMetadata?.promptTokenCount ?? 150,
          outputTokens: retryResponse.usageMetadata?.candidatesTokenCount ?? 380,
        };
      } catch {
        throw new Error(`JSON_GENERATION_FAILED: Model response was not valid JSON: ${primaryError}`);
      }
    }
  }

  /**
   * Generates single-speaker or dual-speaker audio using Gemini 3.8 TTS.
   */
  static async generateDualSpeakerTts(dialogue: { speaker: string; text: string }[]): Promise<{
    base64Wav: string;
    audioSeconds: number;
  }> {
    if (isDailySpendKillSwitchActive()) {
      throw new Error('KILL_SWITCH_ACTIVE: Global spend limit active. Audio generation paused; using text fallback.');
    }

    const ai = getGenAiClient();

    // Map script lines to multiSpeaker parts
    const parts = dialogue.map((line) => ({
      text: `${line.speaker}: ${line.text}`,
      speechMetadata: {
        speaker: line.speaker,
        style: line.speaker === 'Alex' ? 'Enthusiastic podcast host' : 'Analytical thoughtful co-host',
      },
    }));

    try {
      const response = await ai.models.generateContent({
        model: MODELS.TTS_DUAL_HOST,
        contents: [
          {
            role: 'user',
            parts,
          },
        ],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            multiSpeakerVoiceConfig: {
              speakerVoiceConfigs: [
                {
                  speaker: 'Alex',
                  voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } },
                },
                {
                  speaker: 'Sam',
                  voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
                },
              ],
            },
          },
        },
      });

      const audioBase64 = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!audioBase64) {
        throw new Error('NO_AUDIO_RETURNED: Gemini TTS returned empty audio payload.');
      }

      // Word-count duration estimate (~140 words per minute)
      const totalWords = dialogue.reduce((acc, line) => acc + line.text.split(/\s+/).length, 0);
      const estimatedSeconds = Math.round((totalWords / 140) * 60);

      return {
        base64Wav: audioBase64,
        audioSeconds: Math.max(5, estimatedSeconds),
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`TTS_GENERATION_FAILED: ${msg}`);
    }
  }
}
