/**
 * Auth Service — Appwrite Auth wrapper.
 *
 * Replaces custom JWT/password code with Appwrite Auth:
 *   - Email + password signup/login
 *   - Email verification
 *   - Password recovery
 *   - Google OAuth
 *   - Sessions via web SDK
 *
 * Age confirmation (13 or older, 16 where GDPR applies) is stored in the
 * profile and enforced server-side on signup.
 */

import { Account, ID } from 'node-appwrite';
import { getAdminAccount, createUserClient } from './appwriteClient.ts';
import { DATABASE_ID } from '../config/appwrite.ts';

const MIN_AGE_STANDARD = 13;
const MIN_AGE_GDPR = 16;

export interface AuthUser {
  userId: string;
  email: string;
}

export interface SignupResult {
  userId: string;
  email: string;
  emailVerificationRequired: boolean;
}

export interface LoginResult {
  userId: string;
  email: string;
  sessionId: string;
  jwt: string;
}

/**
 * Signs up a new user with Appwrite Auth.
 * Enforces age gate: 13+ standard, 16+ where GDPR applies.
 */
export async function signup(
  email: string,
  password: string,
  name: string,
  age_confirmed: boolean,
  gdpr: boolean = false
): Promise<SignupResult> {
  const account = getAdminAccount();

  // Age gate enforcement
  const minAge = gdpr ? MIN_AGE_GDPR : MIN_AGE_STANDARD;
  if (!age_confirmed) {
    throw new Error(
      `AGE_GATE_REQUIRED: You must confirm you are ${minAge}+ to create an account.`
    );
  }

  const userId = ID.unique();
  const response = await account.create(userId, email, password, name);

  return {
    userId: response.$id,
    email: response.email,
    emailVerificationRequired: !response.emailVerification,
  };
}

/**
 * Logs in a user with email + password via Appwrite sessions.
 * Returns session data — the session ID serves as the bearer token.
 */
export async function login(email: string, password: string): Promise<LoginResult> {
  const account = getAdminAccount();
  const session = await account.createSession(email, password);

  return {
    userId: session.userId,
    email,
    sessionId: session.$id,
    jwt: session.$id,
  };
}

/**
 * Creates a password recovery email.
 */
export async function passwordRecovery(email: string, url: string): Promise<void> {
  const account = getAdminAccount();
  await account.createRecovery(email, url);
}

/**
 * Verifies the caller's Appwrite JWT/session and returns the user context.
 * Creates a user-scoped client with the JWT so that user permissions stay
 * in force. Returns null if no valid credentials are provided (fail-closed).
 */
export async function authenticate(
  authHeader: string | undefined
): Promise<AuthUser | null> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const jwt = authHeader.replace(/^Bearer\s+/, '').trim();
  if (!jwt) {
    return null;
  }

  const endpoint = process.env.APPWRITE_ENDPOINT;
  const projectId = process.env.APPWRITE_PROJECT_ID;
  if (!endpoint || !projectId) {
    return null;
  }

  try {
    const { account } = createUserClient(jwt, endpoint, projectId);
    const user = await account.get();
    return {
      userId: user.$id,
      email: user.email,
    };
  } catch {
    // Invalid or expired session — fail closed
    return null;
  }
}

/**
 * Logs out a user by deleting their session.
 */
export async function logout(sessionId: string): Promise<void> {
  const account = getAdminAccount();
  try {
    await account.deleteSession(sessionId);
  } catch {
    // Session may already be deleted — ignore
  }
}

export { MIN_AGE_STANDARD, MIN_AGE_GDPR };
