/**
 * StashMind Full-Stack Server
 * Express 4 server hosting `/api/v1/*` REST API, MCP tool server, and Vite dev middleware on port 3000.
 *
 * Exports `createApp()` so the same Express app can be:
 * - Listened on port 3000 locally (via `bootstrap()`)
 * - Served as a Vercel serverless function (via `api/server.ts`)
 */

import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import rateLimit from 'express-rate-limit';
import { apiV1Router } from './src/server/routes.ts';

export async function createApp(): Promise<express.Application> {
  const app = express();
  const isProd = process.env.NODE_ENV === 'production';

  // Request parsing with generous limit for PDF/text uploads (15MB)
  app.use(express.json({ limit: '15mb' }));
  app.use(express.urlencoded({ extended: true, limit: '15mb' }));

  // Global rate limiting: 100 requests per 15 minutes per IP (Constitution: rate-limit all public endpoints)
  const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per window
    message: { error: { code: 'RATE_LIMITED', message: 'Too many requests. Please try again later.' } },
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use('/api/v1', globalLimiter);

  // Stricter rate limit on AI-backed endpoints: 20 requests per 15 minutes per IP
  const aiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: { error: { code: 'AI_RATE_LIMITED', message: 'AI generation rate limit exceeded. Please try again later.' } },
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use('/api/v1/lessons', aiLimiter);
  app.use('/api/v1/mcp', aiLimiter);

  // CORS and Request Correlation ID middleware
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Idempotency-Key, X-StashMind-User-Id');
    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }
    next();
  });

  // Mount API v1 Router
  app.use('/api/v1', apiV1Router);

  // Mount Vite middleware in dev or static files in production
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(import.meta.dirname ?? '.', 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  return app;
}

async function bootstrap() {
  const app = await createApp();
  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[StashMind] Full-stack engine running on http://0.0.0.0:${PORT}`);
    console.log(`[StashMind] REST API: http://0.0.0.0:${PORT}/api/v1`);
    console.log(`[StashMind] OpenAPI Spec: http://0.0.0.0:${PORT}/api/v1/openapi.json`);
    console.log(`[StashMind] MCP Endpoint: http://0.0.0.0:${PORT}/api/v1/mcp`);
  });
}

bootstrap().catch((err) => {
  console.error('[StashMind] Fatal server startup error:', err);
  process.exit(1);
});
