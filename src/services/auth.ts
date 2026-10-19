/**
 * Auth Service: JWT-based authentication (replaces demo-user fallback)
 *
 * Issues access + refresh JWT pairs on login/signup.
 * verifyAccessToken() validates incoming Bearer JWT tokens.
 * No demo-user fallback: every request must present a valid API key or JWT.
 */

import { sign, verify, type JwtPayload } from 'jsonwebtoken';
import { sha256 } from './crypto.ts';

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || '';
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || '';
const ACCESS_TTL = '15m';
const REFRESH_TTL = '7d';

export interface TokenPayload extends JwtPayload {
  userId: string;
  email: string;
  tier: 'free' | 'student' | 'pro' | 'team';
  age_confirmed: boolean;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  accessExpiresAt: string;
}

/**
 * Signs a new access + refresh token pair for a user.
 */
export function signTokenPair(payload: Omit<TokenPayload, 'iat' | 'exp'>): TokenPair {
  const now = Math.floor(Date.now() / 1000);
  const accessToken = sign(payload, ACCESS_SECRET, { expiresIn: ACCESS_TTL });
  const refreshToken = sign({ userId: payload.userId }, REFRESH_SECRET, { expiresIn: REFRESH_TTL });

  return {
    accessToken,
    refreshToken,
    accessExpiresAt: new Date(now * 1000 + 15 * 60 * 1000).toISOString(),
  };
}

/**
 * Verifies an access token and returns its payload.
 * Throws if the token is invalid, expired, or signed with the wrong secret.
 */
export function verifyAccessToken(token: string): TokenPayload {
  const decoded = verify(token, ACCESS_SECRET) as TokenPayload;
  return decoded;
}

/**
 * Verifies a refresh token and returns the userId.
 * Throws if the token is invalid or expired.
 */
export function verifyRefreshToken(token: string): { userId: string } {
  const decoded = verify(token, REFRESH_SECRET) as { userId: string };
  return { userId: decoded.userId };
}

/**
 * Hashes a plaintext password (server-side only).
 * Uses SHA-256 (not bcrypt) to keep the server dependency surface minimal;
 * in production, consider bcrypt/argon2 via @supabase/supabase-js Auth.
 */
export function hashPassword(password: string): string {
  return sha256(password);
}
