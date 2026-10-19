import { describe, it, expect } from 'vitest';
import { SecurityService } from '../src/services/security.ts';
import { CacheService } from '../src/services/cache.ts';
import { IngestionService } from '../src/services/ingestion.ts';

describe('Ingestion & SSRF Protection (Requirements F2, F3, F4, F5, F11)', () => {
  it('should block SSRF attempts to localhost, private IPs, and cloud metadata', async () => {
    const maliciousUrls = [
      'http://127.0.0.1:80/admin',
      'http://localhost:3000/api',
      'http://169.254.169.254/latest/meta-data/', // AWS metadata
      'http://metadata.google.internal/computeMetadata/v1/', // GCP metadata
      'http://10.0.0.1/internal',
      'http://192.168.1.1/router',
      'http://172.16.0.1/secrets',
    ];

    for (const url of maliciousUrls) {
      const result = await SecurityService.validateSafeUrl(url);
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    }
  });

  it('should allow valid public HTTPS URLs', async () => {
    const safeUrls = [
      'https://en.wikipedia.org/wiki/Photosynthesis',
      'https://news.ycombinator.com',
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    ];

    for (const url of safeUrls) {
      const result = await SecurityService.validateSafeUrl(url);
      expect(result.valid).toBe(true);
    }
  });

  it('should compute deterministic content hashes for cache deduplication', () => {
    const source = 'Photosynthesis is a process used by plants and other organisms.';
    const hash1 = CacheService.computeContentHash(source, { audiencePreset: 'student' });
    const hash2 = CacheService.computeContentHash(source, { audiencePreset: 'student' });
    const hashDifferentPreset = CacheService.computeContentHash(source, { audiencePreset: 'professional' });

    expect(hash1).toBe(hash2);
    expect(hash1).not.toBe(hashDifferentPreset);
  });

  it('should reject text that is too short or exceeds maximum size limit', () => {
    expect(() => IngestionService.ingestPastedText('Too short')).toThrowError(/SOURCE_TOO_SHORT/);

    const hugeText = 'A'.repeat(100_001);
    expect(() => IngestionService.ingestPastedText(hugeText)).toThrowError(/SOURCE_TOO_LARGE/);
  });

  it('should segment valid text into sections with a title', () => {
    const validText = 'Understanding Raft Consensus.\n\nRaft is a consensus algorithm designed to be easy to understand. It is equivalent to Paxos in fault-tolerance and performance.\n\nThe consensus problem is solved by electing a leader first.';
    const result = IngestionService.ingestPastedText(validText);

    expect(result.sourceType).toBe('text');
    expect(result.charCount).toBeGreaterThan(50);
    expect(result.sectionBreakdown.length).toBeGreaterThan(0);
  });
});
