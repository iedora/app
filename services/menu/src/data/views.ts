import { type Kysely, sql } from "kysely";

import type { Restaurant } from "../domain";
import type { MenuDB } from "../schema";

// Public-view metrics, two-table atomic pattern — ports Go internal/menu/
// views.go. view_seen dedups one count per visitor/restaurant/hour; daily_view
// accumulates per-day-per-language counters. All bucketing is UTC.

function dayString(t: Date): string {
  return t.toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
}

function hourBucket(t: Date): string {
  return `${dayString(t)}-${String(t.getUTCHours()).padStart(2, "0")}`; // YYYY-MM-DD-HH
}

// recordView counts one public menu view in a single atomic statement: the
// dedup insert wins at most once per visitor/restaurant/hour, and only that
// winning row drives the daily-counter increment (CTE → conditional upsert).
// Genuinely idempotent under retries.
export async function recordView(
  db: Kysely<MenuDB>,
  r: Restaurant,
  visitorId: string,
  language: string,
  now: Date,
): Promise<void> {
  await sql`
    WITH won AS (
      INSERT INTO view_seen (visitor_id, restaurant_id, hour_bucket)
      VALUES (${visitorId}, ${r.id}, ${hourBucket(now)}) ON CONFLICT DO NOTHING
      RETURNING 1)
    INSERT INTO daily_view (restaurant_id, tenant_id, day, language, count)
    SELECT ${r.id}, ${r.tenantId}, ${dayString(now)}, ${language}, 1 FROM won
    ON CONFLICT (restaurant_id, day, language) DO UPDATE SET count = daily_view.count + 1
  `.execute(db);
}

// recordItemView counts one per-item view, same two-table dedup pattern as
// recordView but bucketed per visitor/item/DAY (a diner browsing the menu
// shouldn't inflate a dish by scrolling past it twice). The item must belong
// to the restaurant — enforced by the caller (public route resolves the slug).
export async function recordItemView(
  db: Kysely<MenuDB>,
  r: Restaurant,
  itemId: string,
  visitorId: string,
  now: Date,
): Promise<void> {
  await sql`
    WITH won AS (
      INSERT INTO item_view_seen (visitor_id, item_id, day)
      VALUES (${visitorId}, ${itemId}, ${dayString(now)}) ON CONFLICT DO NOTHING
      RETURNING 1),
    owned AS (
      SELECT id FROM items WHERE id = ${itemId} AND restaurant_id = ${r.id})
    INSERT INTO item_view (restaurant_id, tenant_id, item_id, day, count)
    SELECT ${r.id}, ${r.tenantId}, ${itemId}, ${dayString(now)}, 1
    FROM won CROSS JOIN owned
    ON CONFLICT (item_id, day) DO UPDATE SET count = item_view.count + 1
  `.execute(db);
}

// recordSession stores one guest session duration (clamped to a sane range so
// a tab left open overnight doesn't skew the average). Raw rows; the average
// is computed at read time over the requested range.
export async function recordSession(
  db: Kysely<MenuDB>,
  r: Restaurant,
  durationSeconds: number,
  now: Date,
): Promise<void> {
  const clamped = Math.max(1, Math.min(3600, Math.round(durationSeconds)));
  await sql`
    INSERT INTO menu_session (restaurant_id, tenant_id, day, duration_seconds)
    VALUES (${r.id}, ${r.tenantId}, ${dayString(now)}, ${clamped})
  `.execute(db);
}
