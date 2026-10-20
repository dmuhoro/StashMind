/**
 * Vercel serverless entrypoint for StashMind.
 *
 * Lazily initializes the Express app and routes every request
 * (API + SPA fallback) through it. Works on Vercel's @vercel/node runtime.
 */

import { createApp } from '../server.ts';

let app: any = null;
let appReady: Promise<void> | null = null;

async function ensureApp(): Promise<void> {
  if (!appReady) {
    appReady = createApp().then((a: any) => {
      app = a;
    });
  }
  await appReady;
}

export default async (req: any, res: any): Promise<void> => {
  await ensureApp();
  return app(req, res);
};
