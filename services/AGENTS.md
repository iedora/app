# Backend services (Bun + Hono) — conventions

The iedora backend services live here, ported from Go during the strangler
migration (see `/.claude/plans/…` or the migration commits). They run on **Bun**
with **Hono**, **Kysely** (on Bun's native `SQL`), **jose**, and share runtime
infrastructure via `@iedora/server-kit` and payload contracts via
`@iedora/contracts`.

## Vertical slice architecture

Organize each service by **feature slice**, not by technical layer — mirroring
the frontend's `src/features/<slice>/` convention. A slice owns everything for
one capability: its route(s), request/response handling, business logic, and
data access, colocated.

```
services/<svc>/src/
  index.ts                      # Bun entrypoint: load env, wire deps, serve()
  app.ts                        # composition root: mount each slice's routes
  deps.ts                       # cross-slice deps (DB handle, verifiers) wired at boot
  schema.ts                     # Kysely DB types for this service's database
  migrate.ts                    # one-shot migration CLI
  migrations/*.sql              # the goose SQL (applied verbatim by server-kit/migrate)
  features/
    <slice>/
      <slice>.routes.ts         # Hono routes for this feature (exported factory)
      <slice>.query.ts          # data access (Kysely) for this feature
      <slice>.service.ts        # business logic, when a slice has more than a query
```

Rules:
- **No cross-layer folders** (`store/`, `handlers/`, `services/`). Code is grouped
  by feature, so a change to one capability touches one slice.
- **`app.ts` stays thin** — it only mounts slice route factories and exposes `/up`.
  No business logic.
- A slice route factory takes `deps` and returns a Hono instance:
  `export function <slice>Routes(deps): Hono { … }`; `app.route("/<base>", …)`.
- **Shared, service-wide** concerns (DB schema types, the deps interface) sit at
  `src/` root; truly cross-service code goes in `packages/server/*` or
  `packages/platform/contracts`.
- Validate at the slice edge with the shared **zod contracts**; never duplicate a
  payload type the frontend also consumes.

## Testing

Services run on `bun test` (they need Bun's `SQL`; testcontainers-node hangs
under Bun). Tests provision a throwaway database on a real Postgres —
`TEST_DATABASE_URL`, defaulting to the OrbStack dev Postgres (`bun run api:up`).
