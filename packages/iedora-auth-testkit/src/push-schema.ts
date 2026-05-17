import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'

/**
 * Resolve the absolute path to genkan's `drizzle/` folder by walking up from
 * THIS file's directory until we find the workspace root (the directory
 * holding the `package.json` whose `workspaces` array contains
 * `products/genkan`). This keeps the testkit relocatable: rename the
 * monorepo, move the package, none of that breaks.
 *
 * Cached because every `startTestGenkan()` call asks the same question.
 */
let cachedDrizzleDir: string | null = null

export function findGenkanDrizzleDir(): string {
  if (cachedDrizzleDir) return cachedDrizzleDir
  const here = path.dirname(fileURLToPath(import.meta.url))
  let dir = here
  // Cap the walk — workspace root will be within ~6 levels at most;
  // anything deeper means we're outside the monorepo entirely.
  for (let i = 0; i < 10; i++) {
    const candidate = path.join(dir, 'products/genkan/drizzle')
    if (fs.existsSync(candidate)) {
      cachedDrizzleDir = candidate
      return candidate
    }
    const parent = path.dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  throw new Error(
    `[auth-testkit] could not locate products/genkan/drizzle/ from ${here}. ` +
      `Is the testkit installed inside the iedora monorepo?`,
  )
}

/**
 * Apply every `.sql` file under genkan's drizzle/ folder to the given PGLite
 * client in lexicographic order. We don't use drizzle-orm's migrator here
 * because (a) we want to skip the journal-table bookkeeping (each test gets
 * a fresh DB anyway) and (b) PGLite's transaction semantics around
 * `CREATE INDEX` statements occasionally conflict with the migrator's
 * implicit `BEGIN ... COMMIT` wrapping. Splitting on the drizzle
 * `--> statement-breakpoint` sentinel and running each statement raw is
 * boring, robust, and fast.
 */
export async function pushGenkanSchema(client: {
  exec: (sql: string) => Promise<unknown>
}): Promise<void> {
  const drizzleDir = findGenkanDrizzleDir()
  const files = fs
    .readdirSync(drizzleDir)
    .filter((f) => f.endsWith('.sql'))
    .sort()
  for (const file of files) {
    const sql = fs.readFileSync(path.join(drizzleDir, file), 'utf8')
    const statements = sql
      .split('--> statement-breakpoint')
      .map((s) => s.trim())
      .filter(Boolean)
    for (const statement of statements) {
      await client.exec(statement)
    }
  }
}
