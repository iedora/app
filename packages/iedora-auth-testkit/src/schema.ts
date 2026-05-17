/**
 * Re-export of genkan's Drizzle schema. The testkit always mounts the EXACT
 * tables genkan runs in production — `auth-testkit` must never carry its own
 * copy of the schema, otherwise it would silently drift from genkan and the
 * tests using it would mask the very integration bugs they exist to catch.
 *
 * The relative import is deliberate. Genkan's `src/shared/db/schema.ts` is
 * self-contained — it only imports `drizzle-orm` primitives — so reaching
 * across the workspace boundary here doesn't pull in any genkan runtime
 * (no env validation, no Next.js, no DB client). If schema.ts ever grows
 * a non-trivial import, the typecheck here will fail loudly.
 */
export * from '../../../products/genkan/src/shared/db/schema'
