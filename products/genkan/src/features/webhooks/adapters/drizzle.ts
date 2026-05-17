import 'server-only'
import { eq } from 'drizzle-orm'
import type { WebhookSubscription } from '@iedora/identity'
import { db } from '@/shared/db/client'
import { webhookSubscription } from '@/shared/db/schema'

/**
 * Drizzle-backed implementation of `@iedora/identity`'s subscription port.
 * Loaded by the singleton in `sender.ts` once per process.
 *
 * The cast from `string[]` → `IdentityEventName[]` is deliberately loose
 * — admin-UI input is the trust boundary, and the sender's filter is a
 * plain string-equality check anyway. If a row carries a now-removed
 * event tag the filter silently won't match, which is the desired
 * fail-soft behavior.
 */
export async function listSubscriptions(): Promise<WebhookSubscription[]> {
  const rows = await db
    .select({
      url: webhookSubscription.url,
      secret: webhookSubscription.secret,
      events: webhookSubscription.events,
    })
    .from(webhookSubscription)
    .where(eq(webhookSubscription.enabled, true))

  return rows.map((r) => ({
    url: r.url,
    secret: r.secret,
    events: r.events
      ? (r.events as WebhookSubscription['events'])
      : undefined,
  }))
}
