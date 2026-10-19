/**
 * Cache Service: Cryptographic Content-Hashing & Deduplication
 * Uses real SHA-256 from src/services/crypto.ts
 */

import { sha256 } from './crypto.ts';

export class CacheService {
  /**
   * Normalizes text by trimming whitespace, normalizing line endings,
   * and folding whitespace sequences.
   */
  static normalizeText(text: string): string {
    return text
      .trim()
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n');
  }

  /**
   * Generates a deterministic SHA-256 hash of the normalized source text
   * combined with the generation options (preset, style, duration, prompt version).
   */
  static computeContentHash(
    sourceText: string,
    options?: {
      audiencePreset?: string;
      style?: string;
      durationMinutes?: number;
      promptVersion?: string;
      language?: string;
    }
  ): string {
    const normalized = this.normalizeText(sourceText);
    const keyParts = [
      normalized,
      options?.audiencePreset ?? 'default',
      options?.style ?? 'default',
      options?.durationMinutes?.toString() ?? '10',
      options?.promptVersion ?? 'v1',
      options?.language ?? 'en',
    ].join('||');

    return `sha256_${sha256(keyParts)}`;
  }
}
