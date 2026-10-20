/**
 * Vercel serverless entrypoint for StashMind.
 *
 * Self-contained Express app: creates the app, applies middleware,
 * mounts /api/v1 routes, and exports as the default handler for
 * Vercel's @vercel/node runtime. No imports from outside api/ or src/.
 */

import express from 'express';
import rateLimit from 'express-rate-limit';
import { apiV1Router } from '../src/server/routes.ts';

let app: any = null;
let appReady: Promise<void> | null = null;

async function ensureApp(): Promise<void> {
  if (!appReady) {
    appReady = (async () => {
      const a = express();
      a.use(express.json({ limit: '15mb' }));
      a.use(express.urlencoded({ extended: true, limit: '15mb' }));

      // Global rate limiting (Constitution: rate-limit all public endpoints)
      a.use('/api/v1', rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 100,
        message: { error: { code: 'RATE_LIMITED', message: 'Too many requests.' } },
        standardHeaders: true,
        legacyHeaders: false,
      }));

      // Stricter limit on AI-backed endpoints
      a.use('/api/v1/lessons', rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 20,
        message: { error: { code: 'AI_RATE_LIMITED', message: 'AI rate limit exceeded.' } },
        standardHeaders: true,
        legacyHeaders: false,
      }));
      a.use('/api/v1/mcp', rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 20,
        message: { error: { code: 'AI_RATE_LIMITED', message: 'AI rate limit exceeded.' } },
        standardHeaders: true,
        legacyHeaders: false,
      }));

      // CORS
      a.use((req: any, res: any, next: any) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Idempotency-Key, X-StashMind-User-Id');
        if (req.method === 'OPTIONS') {
          res.sendStatus(204);
          return;
        }
        next();
      });

      // Mount API v1 routes
      a.use('/api/v1', apiV1Router);

      app = a;
    })();
  }
  await appReady;
}

export default async (req: any, res: any): Promise<void> => {
  await ensureApp();
  return app(req, res);
};
