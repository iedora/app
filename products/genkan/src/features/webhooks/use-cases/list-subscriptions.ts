import 'server-only'
import { desc, eq } from 'drizzle-orm'
import { db } from '@/shared/db/client'
import { webhookSubscription } from '@/shared/db/schema'

export type WebhookSubscriptionRow = {
  id: string
  name: string | null
  url: string
  secret: string
  events: string[] | null
  enabled: boolean
  createdAt: Date
  updatedAt: Date
}

export async function listAdminSubscriptions(): Promise<WebhookSubscriptionRow[]> {
  const rows = await db
    .select()
    .from(webhookSubscription)
    .orderBy(desc(webhookSubscription.createdAt))
    .limit(500)
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    url: r.url,
    secret: r.secret,
    events: r.events ?? null,
    enabled: r.enabled,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }))
}

export async function getSubscriptionById(
  id: string,
): Promise<WebhookSubscriptionRow | null> {
  const [row] = await db
    .select()
    .from(webhookSubscription)
    .where(eq(webhookSubscription.id, id))
    .limit(1)
  if (!row) return null
  return {
    id: row.id,
    name: row.name,
    url: row.url,
    secret: row.secret,
    events: row.events ?? null,
    enabled: row.enabled,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}
