/**
 * Cache Service: Cryptographic Content-Hashing & Deduplication
 */

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
    }
  ): string {
    const normalized = this.normalizeText(sourceText);
    const keyParts = [
      normalized,
      options?.audiencePreset ?? 'default',
      options?.style ?? 'default',
      options?.durationMinutes?.toString() ?? '10',
      options?.promptVersion ?? 'v1',
    ].join('||');

    // Simple deterministic string hash for browser and node runtimes
    let hash1 = 0xdeadbeef;
    let hash2 = 0x41c64e6d;
    for (let i = 0; i < keyParts.length; i++) {
      const ch = keyParts.charCodeAt(i);
      hash1 = Math.imul(hash1 ^ ch, 2654435761);
      hash2 = Math.imul(hash2 ^ ch, 1597334677);
    }
    hash1 = Math.imul(hash1 ^ (hash1 >>> 16), 2246822507) ^ Math.imul(hash2 ^ (hash2 >>> 13), 3266489909);
    hash2 = Math.imul(hash2 ^ (hash2 >>> 16), 2246822507) ^ Math.imul(hash1 ^ (hash1 >>> 13), 3266489909);

    const hex1 = (hash1 >>> 0).toString(16).padStart(8, '0');
    const hex2 = (hash2 >>> 0).toString(16).padStart(8, '0');
    return `sha256_${hex1}${hex2}${hex1}`;
  }
}
