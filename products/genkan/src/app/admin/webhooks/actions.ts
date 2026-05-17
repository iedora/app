'use server'

import { randomBytes } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { requireAdmin } from '@/features/admin'
import { emit } from '@/features/webhooks'
import { db } from '@/shared/db/client'
import { webhookSubscription } from '@/shared/db/schema'
import { KNOWN_IDENTITY_EVENTS } from './_events'

type Result = { ok: true } | { ok: false; error: string }
type RegisterResult =
  | { ok: true; id: string }
  | { ok: false; error: string }

function toMessage(e: unknown, fallback: string): string {
  if (e && typeof e === 'object') {
    const obj = e as { message?: unknown }
    if (typeof obj.message === 'string') return obj.message
  }
  return fallback
}

function generateId(): string {
  return `whs_${randomBytes(12).toString('hex')}`
}

function generateSecret(): string {
  // 32 bytes = 64 hex chars — far more entropy than HMAC-SHA256 needs,
  // but a uniform sized secret is easier to validate by sight.
  return randomBytes(32).toString('hex')
}

function parseEvents(formData: FormData): string[] | null {
  const all = formData.get('events_all')
  if (all === 'on') return null
  const picked = formData
    .getAll('event')
    .map((v) => String(v))
    .filter((v) =>
      (KNOWN_IDENTITY_EVENTS as readonly string[]).includes(v),
    )
  return picked
}

export async function registerSubscriptionAction(
  formData: FormData,
): Promise<RegisterResult> {
  await requireAdmin()
  const name = String(formData.get('name') ?? '').trim() || null
  const url = String(formData.get('url') ?? '').trim()
  const events = parseEvents(formData)

  if (!url) return { ok: false, error: 'URL is required.' }
  try {
    const u = new URL(url)
    if (!u.protocol.startsWith('http')) {
      return { ok: false, error: 'URL must be http(s).' }
    }
  } catch {
    return { ok: false, error: 'URL is not a valid URL.' }
  }
  if (events !== null && events.length === 0) {
    return {
      ok: false,
      error: 'Pick at least one event, or check "All events".',
    }
  }

  const id = generateId()
  try {
    await db.insert(webhookSubscription).values({
      id,
      name,
      url,
      secret: generateSecret(),
      events,
      enabled: true,
    })
  } catch (e) {
    return { ok: false, error: toMessage(e, 'Could not create subscription.') }
  }
  revalidatePath('/admin/webhooks')
  return { ok: true, id }
}

export async function updateSubscriptionAction(
  id: string,
  formData: FormData,
): Promise<Result> {
  await requireAdmin()
  const name = String(formData.get('name') ?? '').trim() || null
  const url = String(formData.get('url') ?? '').trim()
  const enabled = formData.get('enabled') === 'on'
  const events = parseEvents(formData)

  if (!url) return { ok: false, error: 'URL is required.' }
  try {
    const u = new URL(url)
    if (!u.protocol.startsWith('http')) {
      return { ok: false, error: 'URL must be http(s).' }
    }
  } catch {
    return { ok: false, error: 'URL is not a valid URL.' }
  }
  if (events !== null && events.length === 0) {
    return {
      ok: false,
      error: 'Pick at least one event, or check "All events".',
    }
  }

  try {
    await db
      .update(webhookSubscription)
      .set({
        name,
        url,
        events,
        enabled,
        updatedAt: new Date(),
      })
      .where(eq(webhookSubscription.id, id))
  } catch (e) {
    return { ok: false, error: toMessage(e, 'Could not update subscription.') }
  }
  revalidatePath(`/admin/webhooks/${id}`)
  revalidatePath('/admin/webhooks')
  return { ok: true }
}

export async function deleteSubscriptionAction(
  id: string,
): Promise<Result> {
  await requireAdmin()
  try {
    await db
      .delete(webhookSubscription)
      .where(eq(webhookSubscription.id, id))
  } catch (e) {
    return { ok: false, error: toMessage(e, 'Could not delete subscription.') }
  }
  revalidatePath('/admin/webhooks')
  redirect('/admin/webhooks')
}

/**
 * Fire a synthetic `user.role_changed` event so the operator can verify
 * the subscriber actually accepts deliveries. Useful right after adding
 * a new subscription. The event hits ALL enabled subscribers — not just
 * the one whose page you're on — since that's what the sender does in
 * production.
 */
export async function sendTestEventAction(): Promise<Result> {
  await requireAdmin()
  try {
    await emit({
      event: 'user.role_changed',
      payload: { user_id: '__test__', role: 'admin' },
    })
  } catch (e) {
    return { ok: false, error: toMessage(e, 'Test emit failed.') }
  }
  return { ok: true }
}
