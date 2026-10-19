/**
 * API Key Service: Secure Key Generation, Scopes & Hashing
 * Follows Part C (Integration Contract) Section 2.
 */

import { StashMindRepository } from '../db/repository.ts';
import type { ApiKeyRecord } from '../db/types.ts';
import { sha256 } from './crypto.ts';

export const API_SCOPES = [
  'lessons:read',
  'lessons:write',
  'cards:read',
  'cards:write',
  'practice:write',
  'reviews:read',
  'reviews:write',
  'export:read',
  'webhooks:manage',
] as const;

export type ApiScope = typeof API_SCOPES[number];

export class ApiKeyService {
  /**
   * Generates a new API key.
   * Returns the plaintext key ONCE (with `stm_` prefix) and stores its SHA-256 hash.
   */
  static async generateKey(
    userId: string,
    name: string,
    scopes: string[] = ['lessons:read', 'lessons:write', 'cards:read']
  ): Promise<{ plaintextKey: string; keyRecord: ApiKeyRecord }> {
    const randomHex = Array.from({ length: 32 }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join('');

    const plaintextKey = `stm_live_${randomHex}`;
    const keyPrefix = plaintextKey.slice(0, 12);
    const keyHash = await this.hashKey(plaintextKey);

    const keyRecord = await StashMindRepository.instance.createApiKey(
      userId,
      name,
      keyPrefix,
      keyHash,
      scopes
    );

    await StashMindRepository.instance.logAuditEvent(userId, 'api_key.created', 'api_key', keyRecord.id, {
      name,
      prefix: keyPrefix,
      scopes,
    });

    return { plaintextKey, keyRecord };
  }

  /**
   * Verifies an incoming Bearer key from a REST/MCP request.
   */
  static async verifyKey(
    rawKey: string,
    requiredScope?: ApiScope
  ): Promise<{ valid: boolean; userId?: string; error?: string }> {
    if (!rawKey || !rawKey.startsWith('stm_')) {
      return { valid: false, error: 'Invalid API key format. Expected stm_ prefix.' };
    }

    const keyHash = await this.hashKey(rawKey);
    const record = await StashMindRepository.instance.findApiKeyByHash(keyHash);

    if (!record) {
      return { valid: false, error: 'API key not recognized or revoked.' };
    }

    if (requiredScope && !record.scopes.includes(requiredScope)) {
      return { valid: false, error: `Key lacks required scope: ${requiredScope}` };
    }

    return { valid: true, userId: record.user_id };
  }

  static async hashKey(key: string): Promise<string> {
    return `sha256_${sha256(key)}`;
  }
}
