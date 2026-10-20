/**
 * Appwrite schema drift check.
 *
 * Compares the live Appwrite schema against appwrite.config.json and reports
 * any missing tables, attributes, indexes, or buckets. Does not modify data.
 *
 * Usage:
 *   APPWRITE_ENDPOINT=... APPWRITE_PROJECT_ID=... APPWRITE_API_KEY=... \
 *     npx tsx scripts/check-appwrite-schema.ts
 *
 * Exits 0 if schema matches; exits 1 if drift detected.
 */

import { Client, Databases, Storage } from 'node-appwrite';
import config from '../appwrite.config.json' assert { type: 'json' };

const ENDPOINT = process.env.APPWRITE_ENDPOINT;
const PROJECT_ID = process.env.APPWRITE_PROJECT_ID;
const API_KEY = process.env.APPWRITE_API_KEY;

if (!ENDPOINT || !PROJECT_ID || !API_KEY) {
  console.error('Missing APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, or APPWRITE_API_KEY');
  process.exit(1);
}

const client = new Client()
  .setEndpoint(ENDPOINT)
  .setProject(PROJECT_ID)
  .setKey(API_KEY);

const databases = new Databases(client);
const storage = new Storage(client);

const DB_ID = config.database.id;
let drift = 0;

function report(msg: string) {
  console.log(msg);
  drift++;
}

async function main() {
  console.log(`[check] Appwrite schema drift check`);
  console.log(`[check] endpoint: ${ENDPOINT}`);
  console.log(`[check] project: ${PROJECT_ID}`);

  // Check database
  let dbId: string;
  try {
    const db = await databases.get(DB_ID);
    dbId = db.$id;
    console.log(`[check] database ${DB_ID} exists`);
  } catch (e: any) {
    if (e.code === 404) {
      report(`[DRIFT] database ${DB_ID} missing`);
      return;
    }
    throw e;
  }

  // Check tables
  const configTables = new Map(config.tables.map((t: any) => [t.id, t]));
  const liveTables = await databases.listCollections(DB_ID);
  const liveTableIds = new Set(liveTables.collections.map((t: any) => t.$id));

  for (const [tableId, table] of configTables) {
    if (!liveTableIds.has(tableId)) {
      report(`[DRIFT] table ${tableId} missing`);
      continue;
    }
    // Check attributes
    const liveAttrs = await databases.listAttributes(DB_ID, tableId);
    const liveAttrIds = new Set(liveAttrs.attributes.map((a: any) => a.key));
    for (const attr of table.attributes) {
      if (!liveAttrIds.has(attr.key)) {
        report(`[DRIFT] table ${tableId}.${attr.key} attribute missing`);
      }
    }
    // Check indexes
    const liveIndexes = await databases.listIndexes(DB_ID, tableId);
    const liveIndexIds = new Set(liveIndexes.indexes.map((i: any) => i.key));
    for (const idx of table.indexes) {
      if (!liveIndexIds.has(idx.key)) {
        report(`[DRIFT] table ${tableId}.${idx.key} index missing`);
      }
    }
  }

  // Check for extra tables (not in config)
  for (const tableId of liveTableIds) {
    if (!configTables.has(tableId)) {
      report(`[DRIFT] table ${tableId} exists in Appwrite but not in config`);
    }
  }

  // Check buckets
  const configBuckets = new Set(config.buckets.map((b: any) => b.id));
  const liveBuckets = await storage.listBuckets();
  const liveBucketIds = new Set(liveBuckets.buckets.map((b: any) => b.$id));

  for (const bucketId of configBuckets) {
    if (!liveBucketIds.has(bucketId)) {
      report(`[DRIFT] bucket ${bucketId} missing`);
    }
  }
  for (const bucketId of liveBucketIds) {
    if (!configBuckets.has(bucketId)) {
      report(`[DRIFT] bucket ${bucketId} exists in Appwrite but not in config`);
    }
  }

  if (drift === 0) {
    console.log(`[check] schema matches appwrite.config.json — no drift`);
    process.exit(0);
  } else {
    console.log(`[check] ${drift} drift item(s) found — run scripts/provision-appwrite.ts`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('[check] fatal error:', err);
  process.exit(1);
});
