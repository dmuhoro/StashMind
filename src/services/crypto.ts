/**
 * Crypto Service: Real SHA-256 and HMAC-SHA256
 *
 * Replaces all custom non-cryptographic hashes across the codebase.
 * Uses Node.js `crypto` module (server-side only).
 *
 * Security rule: These functions must never be imported in client code.
 * API keys are hashed at rest with SHA-256. Webhooks are signed with HMAC-SHA256.
 */

import { createHash, createHmac, timingSafeEqual } from 'crypto';

/**
 * Computes a real SHA-256 hash of the input string.
 * Returns lowercase hex digest.
 */
export function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

/**
 * Computes an HMAC-SHA256 signature.
 * Returns `sha256=<hex>`.
 */
export function hmacSha256(secret: string, message: string): string {
  return `sha256=${createHmac('sha256', secret).update(message).digest('hex')}`;
}

/**
 * Constant-time comparison to prevent timing attacks.
 * Returns true if the two strings are equal.
 */
export function secureCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  return timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
}
