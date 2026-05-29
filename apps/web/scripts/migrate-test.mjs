// Applies every product schema migration the unified E2E suite needs.
//
// Invoked via `bun --env-file=.env.test scripts/migrate-test.mjs`, so the
// _test database URLs are already in process.env and inherited by the
// spawned migrate scripts. One source of truth for the product list:
// the `migrators` array below.
//
// Add a product = append an entry to `migrators`.

import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')

const migrators = [
  { name: 'core',    cwd: 'packages/core-auth' },
  { name: 'menu',    cwd: 'products/menu' },
  { name: 'imopush', cwd: 'products/imopush' },
]

for (const { name, cwd } of migrators) {
  const r = spawnSync('bun', ['scripts/migrate.mjs'], {
    cwd: resolve(repoRoot, cwd),
    stdio: 'inherit',
  })
  if (r.status !== 0) {
    console.error(`migrate:${name} failed (exit ${r.status})`)
    process.exit(r.status ?? 1)
  }
}
