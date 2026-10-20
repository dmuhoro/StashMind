/**
 * Appwrite Configuration — validated with zod, fail-fast in production.
 *
 * Required environment variables:
 *   APPWRITE_ENDPOINT       — e.g. https://fra.cloud.appwrite.io/v1
 *   APPWRITE_PROJECT_ID     — project ID from console
 *   APPWRITE_API_KEY        — server-side only, minimum scopes
 *   APPWRITE_DATABASE_ID    — database ID (provisioned by scripts/provision-appwrite.ts)
 *   APPWRITE_BUCKET_UPLOADS — bucket ID for user uploads
 *   APPWRITE_BUCKET_AUDIO   — bucket ID for audio files
 *   APPWRITE_BUCKET_EXPORTS — bucket ID for exports
 *
 * Two clients are created:
 *   - adminClient: API key, bypasses user permissions (system tasks only)
 *   - userClient:  caller's JWT, keeps user permissions in force
 */

import { z } from 'zod';

const envSchema = z.object({
  APPWRITE_ENDPOINT: z.string().url(),
  APPWRITE_PROJECT_ID: z.string().min(1),
  APPWRITE_API_KEY: z.string().min(1),
  APPWRITE_DATABASE_ID: z.string().min(1),
  APPWRITE_BUCKET_UPLOADS: z.string().min(1),
  APPWRITE_BUCKET_AUDIO: z.string().min(1),
  APPWRITE_BUCKET_EXPORTS: z.string().min(1),
});

export type AppwriteEnv = z.infer<typeof envSchema>;

/**
 * Validated Appwrite environment. Throws in production if any required
 * variable is missing or malformed — fail closed.
 */
export function loadAppwriteEnv(): AppwriteEnv {
  const raw = {
    APPWRITE_ENDPOINT: process.env.APPWRITE_ENDPOINT,
    APPWRITE_PROJECT_ID: process.env.APPWRITE_PROJECT_ID,
    APPWRITE_API_KEY: process.env.APPWRITE_API_KEY,
    APPWRITE_DATABASE_ID: process.env.APPWRITE_DATABASE_ID,
    APPWRITE_BUCKET_UPLOADS: process.env.APPWRITE_BUCKET_UPLOADS,
    APPWRITE_BUCKET_AUDIO: process.env.APPWRITE_BUCKET_AUDIO,
    APPWRITE_BUCKET_EXPORTS: process.env.APPWRITE_BUCKET_EXPORTS,
  };

  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    const missing = Object.keys(parsed.error.flatten().fieldErrors);
    const isProd = process.env.NODE_ENV === 'production';
    const msg = `Appwrite configuration invalid. Missing or malformed: ${missing.join(', ')}. ${
      isProd
        ? 'Production refuses to start without valid Appwrite configuration.'
        : 'Set these in .env for local development.'
    }`;
    if (isProd) {
      throw new Error(msg);
    }
    // In non-production, return a clearly invalid env so callers fail fast
    console.warn(`[Appwrite] ${msg}`);
    return parsed.data as AppwriteEnv;
  }

  return parsed.data;
}

/**
 * Admin scopes — the minimum set of system tasks allowed to use the API key.
 * Everything user-triggered must use the caller's JWT via userClient.
 */
export const ADMIN_SCOPES = [
  'job_queue',
  'webhook_deliveries',
  'usage_counters',
  'api_key_lookup',
  'payment_callbacks',
  'kill_switch',
] as const;

export type AdminScope = (typeof ADMIN_SCOPES)[number];

/**
 * Bucket names declared in appwrite.config.json.
 */
export const BUCKETS = {
  UPLOADS: 'uploads',
  AUDIO: 'audio',
  EXPORTS: 'exports',
} as const;

export type BucketName = (typeof BUCKETS)[keyof typeof BUCKETS];

/**
 * Table names declared in appwrite.config.json.
 */
export const TABLES = {
  PROFILES: 'profiles',
  SOURCES: 'sources',
  LESSONS: 'lessons',
  CARDS: 'cards',
  SAVED_CARDS: 'saved_cards',
  PRACTICE_SESSIONS: 'practice_sessions',
  ACTIVITY_LOG: 'activity_log',
  STREAKS: 'streaks',
  USAGE_COUNTERS: 'usage_counters',
  API_KEYS: 'api_keys',
  WEBHOOKS: 'webhooks',
  WEBHOOK_DELIVERIES: 'webhook_deliveries',
  AUDIT_LOG: 'audit_log',
  JOBS: 'jobs',
  PAYMENTS: 'payments',
  SUBSCRIPTIONS: 'subscriptions',
  TELEGRAM_LINKS: 'telegram_links',
  CARD_FEEDBACK: 'card_feedback',
  ASK_THREADS: 'ask_threads',
  SYSTEM_FLAGS: 'system_flags',
} as const;

export type TableName = (typeof TABLES)[keyof typeof TABLES];

/**
 * Collection-level permissions declared in appwrite.config.json.
 * Row Security is on for every table; no 'any' role except explicitly public
 * content (activity_log, audit_log, system_flags read).
 */
export const TABLE_PERMISSIONS = {
  // User-scoped tables — creator can CRUD their own rows only
  USER_SCOPED: ['profiles', 'sources', 'lessons', 'cards', 'saved_cards',
    'practice_sessions', 'streaks', 'usage_counters', 'api_keys', 'webhooks',
    'webhook_deliveries', 'jobs', 'payments', 'subscriptions', 'telegram_links',
    'card_feedback', 'ask_threads'],
  // Public-read tables
  PUBLIC_READ: ['activity_log', 'audit_log', 'system_flags'],
} as const;
