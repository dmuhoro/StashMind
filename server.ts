/**
 * StashMind Full-Stack Server
 * Express 4 server hosting `/api/v1/*` REST API, MCP tool server, and Vite dev middleware on port 3000.
 */

import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { apiV1Router } from './src/server/routes.ts';

async function bootstrap() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;
  const isProd = process.env.NODE_ENV === 'production';

  // Request parsing with generous limit for PDF/text uploads (15MB)
  app.use(express.json({ limit: '15mb' }));
  app.use(express.urlencoded({ extended: true, limit: '15mb' }));

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
