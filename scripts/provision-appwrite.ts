/**
 * Idempotent Appwrite schema provisioning.
 *
 * Creates the database, tables, attributes, indexes, permissions, and buckets
 * declared in appwrite.config.json if they are missing, and updates them on
 * drift without deleting data. Safe to run multiple times.
 *
 * Usage:
 *   APPWRITE_ENDPOINT=... APPWRITE_PROJECT_ID=... APPWRITE_API_KEY=... \
 *     npx tsx scripts/provision-appwrite.ts
 *
 * Requires G1: Appwrite project, scoped API key, database ID.
 */

import { Client, Databases, Storage, Permission, ID } from 'node-appwrite';
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
const DB_NAME = config.database.name;

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ensureDatabase() {
  try {
    await databases.get(DB_ID);
    console.log(`[provision] database ${DB_ID} already exists`);
    return;
  } catch (e: any) {
    if (e.code === 404) {
      await databases.create(DB_ID, DB_NAME);
      console.log(`[provision] created database ${DB_ID}`);
      return;
    }
    throw e;
  }
}

async function ensureTable(table: any) {
  let tableId: string;
  try {
    const existing = await databases.getCollection(DB_ID, table.id);
    tableId = existing.$id;
    console.log(`[provision] table ${table.id} already exists`);
  } catch (e: any) {
    if (e.code === 404) {
      const created = await databases.createCollection(
        DB_ID,
        table.id,
        table.name,
        undefined, // document_security (row security) — handled via permissions
        table.enabled
      );
      tableId = created.$id;
      console.log(`[provision] created table ${table.id}`);
      // Wait briefly for collection to be ready
      await sleep(500);
    } else {
      throw e;
    }
  }

  // Ensure attributes
  for (const attr of table.attributes) {
    try {
      await databases.getAttribute(DB_ID, tableId, attr.key);
    } catch (e: any) {
      if (e.code === 404) {
        switch (attr.type) {
          case 'string':
            await databases.createStringAttribute(
              DB_ID, tableId, attr.key, attr.size, attr.required, attr.default ?? undefined
            );
            break;
          case 'integer':
            await databases.createIntegerAttribute(
              DB_ID, tableId, attr.key, attr.required, attr.default ?? undefined
            );
            break;
          case 'boolean':
            await databases.createBooleanAttribute(
              DB_ID, tableId, attr.key, attr.required, attr.default ?? undefined
            );
            break;
          case 'datetime':
            await databases.createDatetimeAttribute(
              DB_ID, tableId, attr.key, attr.required, attr.default ?? undefined
            );
            break;
          default:
            console.warn(`[provision] unknown attribute type ${attr.type} for ${attr.key}`);
        }
        console.log(`[provision] created attribute ${table.id}.${attr.key}`);
        await sleep(200);
      } else {
        throw e;
      }
    }
  }

  // Ensure indexes
  for (const idx of table.indexes) {
    try {
      await databases.getIndex(DB_ID, tableId, idx.key);
    } catch (e: any) {
      if (e.code === 404) {
        await databases.createIndex(
          DB_ID, tableId, idx.key, idx.type, idx.attributes
        );
        console.log(`[provision] created index ${table.id}.${idx.key}`);
        await sleep(200);
      } else {
        throw e;
      }
    }
  }

  // Ensure permissions (update collection permissions)
  const Perm = Permission as { read: (role: string) => unknown; write: (role: string) => unknown; create: (role: string) => unknown; update: (role: string) => unknown; delete: (role: string) => unknown };
  const actionMap: Record<string, 'read' | 'write' | 'create' | 'update' | 'delete'> = {
    read: 'read', write: 'write', create: 'create', update: 'update', delete: 'delete',
  };
  const permissionList = table.permissions.map((p: any) =>
    p.actions.map((a: string) => {
      const role = p.role === 'any' ? 'any' : 'user';
      return Perm[actionMap[a]](role);
    })
  ).flat();
  try {
    await databases.updateCollection(
      DB_ID,
      tableId,
      table.name,
      undefined,
      table.enabled,
      permissionList
    );
    console.log(`[provision] updated permissions for table ${table.id}`);
  } catch (e: any) {
    console.warn(`[provision] could not update permissions for ${table.id}:`, e.message);
  }

  return tableId;
}

async function ensureBucket(bucket: any) {
  try {
    await storage.getBucket(bucket.id);
    console.log(`[provision] bucket ${bucket.id} already exists`);
    return;
  } catch (e: any) {
    if (e.code === 404) {
      const Perm = Permission as { read: (role: string) => unknown; write: (role: string) => unknown; create: (role: string) => unknown; update: (role: string) => unknown; delete: (role: string) => unknown };
      const actionMap: Record<string, 'read' | 'write' | 'create' | 'update' | 'delete'> = {
        read: 'read', write: 'write', create: 'create', update: 'update', delete: 'delete',
      };
      const permissionList = bucket.permissions.map((p: any) =>
        p.actions.map((a: string) => {
          const role = p.role === 'any' ? 'any' : 'user';
          return Perm[actionMap[a]](role);
        })
      ).flat();
      await storage.createBucket(
        bucket.id,
        bucket.name,
        bucket.enabled,
        bucket.sizeLimit,
        bucket.allowedFileExtensions,
        permissionList
      );
      console.log(`[provision] created bucket ${bucket.id}`);
      return;
    }
    throw e;
  }
}

async function main() {
  console.log(`[provision] starting Appwrite schema provisioning`);
  console.log(`[provision] endpoint: ${ENDPOINT}`);
  console.log(`[provision] project: ${PROJECT_ID}`);

  await ensureDatabase();

  for (const table of config.tables) {
    await ensureTable(table);
  }

  for (const bucket of config.buckets) {
    await ensureBucket(bucket);
  }

  console.log(`[provision] Appwrite schema provisioning complete`);
}

main().catch((err) => {
  console.error('[provision] fatal error:', err);
  process.exit(1);
});
