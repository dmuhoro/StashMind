/**
 * Local TTS: Piper or Kokoro for offline audio generation.
 *
 * Used in the EasyTutor merge for offline mode where Gemini TTS is unavailable.
 * Falls back gracefully if neither Piper nor Kokoro is installed.
 */

export type LocalTtsEngine = 'piper' | 'kokoro' | 'browser';

export interface LocalTtsConfig {
  engine: LocalTtsEngine;
  piperBinary?: string;
  piperModel?: string;
  kokoroBaseUrl?: string;
}

export const DEFAULT_TTS_CONFIG: LocalTtsConfig = {
  engine: 'browser',
  piperBinary: process.env.PIPER_BINARY || 'piper',
  piperModel: process.env.PIPER_MODEL || '',
  kokoroBaseUrl: process.env.KOKORO_BASE_URL || 'http://localhost:8880',
};

export interface LocalTtsResult {
  audioBuffer: Buffer;
  audioSeconds: number;
  engine: LocalTtsEngine;
}

export class LocalTtsService {
  /**
   * Synthesize text to audio using a local TTS engine.
   * Falls back through piper -> kokoro -> browser.
   */
  static async synthesize(
    text: string,
    config: LocalTtsConfig = DEFAULT_TTS_CONFIG
  ): Promise<LocalTtsResult> {
    // Try Piper (offline, local binary)
    if (config.engine === 'piper' || config.engine === 'browser') {
      try {
        return await this.viaPiper(text, config);
      } catch {
        // Fall through to next engine
      }
    }

    // Try Kokoro (local server)
    if (config.engine === 'kokoro' || config.engine === 'browser') {
      try {
        return await this.viaKokoro(text, config);
      } catch {
        // Fall through
      }
    }

    // Final fallback: return empty buffer (client uses browser speech API)
    return {
      audioBuffer: Buffer.alloc(0),
      audioSeconds: Math.ceil(text.split(/\s+/).length / 140) * 60,
      engine: 'browser',
    };
  }

  private static async viaPiper(text: string, config: LocalTtsConfig): Promise<LocalTtsResult> {
    const { spawn } = await import('child_process');
    const { writeFile, readFile } = await import('fs/promises');

    const piperInputPath = '/tmp/stashmind_tts_input.txt';
    const piperOutputPath = '/tmp/stashmind_tts_output.wav';

    await writeFile(piperInputPath, text, 'utf8');

    return new Promise<LocalTtsResult>((resolve, reject) => {
      const piper = spawn(config.piperBinary, [
        '-m', config.piperModel || '',
        '-f', piperOutputPath,
      ]);

      let stderrOutput = '';
      piper.stderr.on('data', (data) => {
        stderrOutput += data.toString();
      });

      piper.on('close', async (code) => {
        if (code !== 0) {
          reject(new Error(`Piper exited with code ${code}: ${stderrOutput}`));
          return;
        }
        try {
          const buffer = await readFile(piperOutputPath);
          const audioSeconds = Math.ceil(buffer.length / 48000 / 2);
          resolve({ audioBuffer: buffer, audioSeconds, engine: 'piper' });
        } catch (err) {
          reject(err);
        }
      });

      piper.on('error', reject);
    });
  }

  private static async viaKokoro(text: string, config: LocalTtsConfig): Promise<LocalTtsResult> {
    const res = await fetch(`${config.kokoroBaseUrl}/api/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice: 'af_bella' }),
    });

    if (!res.ok) throw new Error(`Kokoro error: ${res.status}`);

    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const audioSeconds = Math.ceil(buffer.length / 48000 / 2);

    return { audioBuffer: buffer, audioSeconds, engine: 'kokoro' };
  }
}
