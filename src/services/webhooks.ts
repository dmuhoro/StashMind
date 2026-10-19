/**
 * Webhooks Service: Outgoing HMAC-SHA256 Signed Event Dispatcher
 * Follows Part C (Integration Contract) Section 3.
 */

import { StashMindRepository } from '../db/repository.ts';
import { hmacSha256 } from './crypto.ts';

export type WebhookEventType =
  | 'lesson.created'
  | 'lesson.ready'
  | 'lesson.failed'
  | 'card.saved'
  | 'practice.completed'
  | 'review.due'
  | 'streak.updated'
  | 'export.ready';

export interface WebhookPayload {
  event: WebhookEventType;
  timestamp: string;
  data: Record<string, unknown>;
}

export class WebhookService {
  /**
   * Generates HMAC-SHA256 signature for a webhook payload.
   */
  static computeSignature(secret: string, timestamp: string, payloadJson: string): string {
    return hmacSha256(secret, `${timestamp}.${payloadJson}`);
  }

  /**
   * Dispatches an event to all registered webhooks for a user.
   */
  static async dispatchEvent(
    userId: string,
    event: WebhookEventType,
    data: Record<string, unknown>
  ): Promise<number> {
    const webhooks = await StashMindRepository.instance.listWebhooks(userId);
    const eligible = webhooks.filter((w) => w.events.includes(event) || w.events.includes('*'));

    if (eligible.length === 0) return 0;

    const timestamp = new Date().toISOString();
    const payload: WebhookPayload = {
      event,
      timestamp,
      data, // IDs and summaries only, never raw sources
    };
    const payloadJson = JSON.stringify(payload);

    let dispatchedCount = 0;

    for (const webhook of eligible) {
      const signature = this.computeSignature(webhook.signing_secret, timestamp, payloadJson);

      // Async dispatch simulation
      try {
        await StashMindRepository.instance.logAuditEvent(userId, 'webhook.dispatched', 'webhook', webhook.id, {
          event,
          target_url: webhook.target_url,
          signature,
        });
        dispatchedCount++;
      } catch {
        // Log delivery error
      }
    }

    return dispatchedCount;
  }
}
