/**
 * Applies imopush's Drizzle migrations against the `imopush` Postgres
 * database. Real work lives in @iedora/db/scripts/run-migrations — this
 * file just picks the env var, computes the migrations folder path, and
 * supplies the schema + lock name.
 *
 * Runs in three places:
 *   1. local dev — `bun run dev:migrate` (root).
 *   2. CI — apps/web/scripts/migrate-test.mjs spawns it before e2e build.
 *   3. prod — Kamal pre-deploy hook before the app container hot-swap.
 */

import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { runMigrations } from '@iedora/db/scripts/run-migrations'

const url = process.env.IMOPUSH_DATABASE_URL
if (!url) {
  console.error('IMOPUSH_DATABASE_URL is not set')
  process.exit(1)
}

const here = dirname(fileURLToPath(import.meta.url))

try {
  await runMigrations({
    databaseUrl: url,
    migrationsFolder: join(here, '..', 'drizzle'),
    migrationsSchema: 'imopush',
    lockName: 'iedora-imopush-migrate',
    label: 'imopush',
  })
} catch (err) {
  console.error('[migrate:imopush] failed:', err)
  process.exit(1)
}
