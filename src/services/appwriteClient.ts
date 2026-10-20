/**
 * Appwrite Client Factory — two-client model per ADR-008.
 *
 * userClient: created per-request with the caller's Appwrite JWT/session.
 *   Everything a user triggers uses this client, so user permissions stay in force.
 * adminClient: created once with the API key. Restricted to ADR-listed system
 *   tasks (job queue, webhook deliveries, usage counters, API-key lookup,
 *   payment callbacks, kill switch).
 */

export { ID } from 'node-appwrite';

import { Client, Account, Databases, Storage } from 'node-appwrite';
let adminClient: Client | null = null;
let adminAccount: Account | null = null;
let adminDb: Databases | null = null;
let adminStorage: Storage | null = null;

export function getAdminClient(): Client {
  if (!adminClient) {
    const endpoint = process.env.APPWRITE_ENDPOINT;
    const projectId = process.env.APPWRITE_PROJECT_ID;
    const apiKey = process.env.APPWRITE_API_KEY;

    if (!endpoint || !projectId || !apiKey) {
      throw new Error(
        'Appwrite admin client requires APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, and APPWRITE_API_KEY. ' +
        'Production refuses to start without valid Appwrite configuration.'
      );
    }

    adminClient = new Client()
      .setEndpoint(endpoint)
      .setProject(projectId)
      .setKey(apiKey);
    adminAccount = new Account(adminClient);
    adminDb = new Databases(adminClient);
    adminStorage = new Storage(adminClient);
  }
  return adminClient;
}

export function getAdminAccount(): Account {
  getAdminClient(); // ensure initialized
  return adminAccount!;
}

export function getAdminDb(): Databases {
  getAdminClient(); // ensure initialized
  return adminDb!;
}

export function getAdminStorage(): Storage {
  getAdminClient(); // ensure initialized
  return adminStorage!;
}

/**
 * Creates a user-scoped Appwrite client with the caller's JWT/session.
 * This client acts on behalf of the user — Appwrite enforces row-level
 * permissions based on the caller's identity.
 */
export function createUserClient(
  jwt: string,
  endpoint: string,
  projectId: string
): { client: Client; account: Account; databases: Databases; storage: Storage } {
  if (!endpoint || !projectId) {
    throw new Error('User client requires APPWRITE_ENDPOINT and APPWRITE_PROJECT_ID');
  }

  const client = new Client()
    .setEndpoint(endpoint)
    .setProject(projectId)
    .setSession(jwt);

  return {
    client,
    account: new Account(client),
    databases: new Databases(client),
    storage: new Storage(client),
  };
}
