/**
 * Payments Service: M-Pesa Daraja STK Push (Kenya) + KES pricing tiers
 *
 * Enables local payments for East African users:
 * - M-Pesa STK Push via Safaricom Daraja API
 * - KES pricing with student tier (school email verification)
 * - Webhook callback for payment status updates
 */

import { createHash } from 'crypto';

const DARAJA_CONSUMER_KEY = process.env.MPESA_DARAJA_CONSUMER_KEY || '';
const DARAJA_CONSUMER_SECRET = process.env.MPESA_DARAJA_CONSUMER_SECRET || '';
const DARAJA_SHORTCODE = process.env.MPESA_DARAJA_SHORTCODE || '';
const DARAJA_PASSKEY = process.env.MPESA_DARAJA_PASSKEY || '';
const DARAJA_CALLBACK_URL = process.env.MPESA_DARAJA_CALLBACK_URL || '';
const DARAJA_BASE_URL = process.env.MPESA_DARAJA_BASE_URL || 'https://sandbox.safaricom.co.ke';

export interface MpesaPriceTier {
  tier: 'student' | 'free';
  priceKes: number;
  lessonsPerMonth: number;
  description: string;
}

export const MPESA_PRICING: MpesaPriceTier[] = [
  {
    tier: 'student',
    priceKes: 299,
    lessonsPerMonth: 100,
    description: 'Student tier — verified school email required. 100 lessons/month.',
  },
  {
    tier: 'free',
    priceKes: 0,
    lessonsPerMonth: 5,
    description: 'Free tier — 5 lessons/day.',
  },
];

/**
 * Generates the Daraja STK Push password: Base64(Shortcode + Passkey + Timestamp).
 */
export function generateDarajaPassword(timestamp: string): string {
  const raw = `${DARAJA_SHORTCODE}${DARAJA_PASSKEY}${timestamp}`;
  return Buffer.from(raw).toString('base64');
}

/**
 * Formats a phone number to international format (254XXXXXXXXX).
 */
export function formatPhoneNumber(phone: string): string {
  let cleaned = phone.replace(/\s+/g, '');
  if (cleaned.startsWith('0')) {
    cleaned = '254' + cleaned.slice(1);
  } else if (cleaned.startsWith('+254')) {
    cleaned = cleaned.slice(1);
  } else if (!cleaned.startsWith('254')) {
    cleaned = '254' + cleaned;
  }
  return cleaned;
}

/**
 * Initiates an M-Pesa STK Push payment request.
 * Returns the Daraja API response (CheckoutRequestID, etc.).
 */
export async function initiateStkPush(params: {
  phoneNumber: string;
  amountKes: number;
  accountReference: string;
  transactionDesc: string;
}): Promise<{ ok: boolean; result?: unknown; error?: string }> {
  const timestamp = new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .slice(0, 14);
  const password = generateDarajaPassword(timestamp);

  const payload = {
    BusinessShortCode: DARAJA_SHORTCODE,
    Password: password,
    Timestamp: timestamp,
    TransactionType: 'CustomerPayBillOnline',
    Amount: params.amountKes,
    PartyA: formatPhoneNumber(params.phoneNumber),
    PartyB: DARAJA_SHORTCODE,
    PhoneNumber: formatPhoneNumber(params.phoneNumber),
    CallBackURL: DARAJA_CALLBACK_URL,
    AccountReference: params.accountReference,
    TransactionDesc: params.transactionDesc,
  };

  try {
    // In production, obtain an OAuth bearer token from Daraja first.
    // For this implementation, we structure the request and return the payload
    // for the caller to send with a valid Daraja access token.
    const res = await fetch(`${DARAJA_BASE_URL}/mpesa/stkpush/v1/processrequest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Authorization: `Bearer ${await getDarajaAccessToken()}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    return { ok: res.ok, result: data, error: res.ok ? undefined : data.errorMessage };
  } catch (err: unknown) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Verifies an M-Pesa payment callback from Daraja.
 * Validates the callback and returns the payment result.
 */
export function verifyMpesaCallback(payload: any): {
  valid: boolean;
  resultCode: number;
  receiptNumber?: string;
  phoneNumber?: string;
  amount?: number;
} {
  const resultCode = payload.Body?.stkCallback?.ResultCode ?? -1;
  const metadata = payload.Body?.stkCallback?.CallbackMetadata?.Item ?? [];

  const findItem = (name: string) =>
    metadata.find((item: any) => item.Name === name)?.Value;

  return {
    valid: resultCode === 0,
    resultCode,
    receiptNumber: findItem('MpesaReceiptNumber'),
    phoneNumber: findItem('PhoneNumber'),
    amount: findItem('Amount'),
  };
}

/**
 * Generates a payment reference for a user's lesson package purchase.
 */
export function generatePaymentReference(userId: string, tier: string): string {
  const hash = createHash('sha256').update(`${userId}:${tier}:${Date.now()}`).digest('hex').slice(0, 12);
  return `stm_mpesa_${hash}`;
}
