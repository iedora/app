# products/core — auth + admin surface

The `core` product serves `core.iedora.com` — the canonical sign-in /
sign-up / sign-out flows for every iedora product, plus the iedora-staff
admin tools (sessions list today, audit + user mgmt later).

Repo-level conventions: [`../../AGENTS.md`](../../AGENTS.md).
Auth SDK contract: [`../../packages/auth/README.md`](../../packages/auth/README.md).

## What this is

- Pages + components + server functions for the auth surface.
- Mounted by `apps/web` via wildcard subpath exports — every
  `src/<route>/page.tsx` becomes available as
  `@iedora/product-core/<route>/page` and gets a 1-line re-export
  under `apps/web/src/app/core/<route>/page.tsx`.

## Hard rules

1. **Sign-in / sign-up / sign-out live ONLY here.** Every other
   product redirects cross-origin to `core.iedora.com/sign-in` (built
   via `signInUrl()` from `@iedora/brand`). No product mounts its own
   `/sign-in` route.

2. **Admin surfaces are gated by `iedora-admin` role.** The
   `src/guards.ts::requireIedoraAdmin()` helper redirects unauth
   callers to `/sign-in` and `notFound()` non-admin users.

3. **No menu / restaurant code here.** Sessions admin reads via
   `auth.api.listUsers` + `auth.api.listUserSessions` — never queries
   menu's `restaurant` table. The product-menu boundary is enforced
   even though both run in the same Next.js process.

4. **Adding a new page or admin tool**:
   1. `products/core/src/<route>/page.tsx`
   2. `apps/web/src/app/core/<route>/page.tsx` → 1-liner
      `export { default } from '@iedora/product-core/<route>/page'`

   Zero `package.json` edits.

## File layout

```
products/core/
  src/
    page.tsx                  /core/ landing — redirects to /sign-in
                              or APP_URL based on session
    layout.tsx                shared chrome
    sign-in/{page,form}.tsx   email+password sign-in via authClient
    sign-up/{page,form}.tsx   create-account flow
    sign-out/{page,action}.tsx
    admin/page.tsx            admin landing
    admin/sessions/{page,session-row}.tsx
                              cross-tenant sessions list + revoke
    guards.ts                 getSession() + requireIedoraAdmin() —
                              thin wrappers over @iedora/auth's API
    index.ts                  package barrel (rarely imported directly)
  package.json                exports: { "./*": "./src/*.tsx" }
  tsconfig.json, eslint.config.mjs, vitest.config.ts
```

## Commands

- `bun run typecheck`
- `bun run lint`
- `bun run test` — vitest (no tests yet; placeholder).

CI: `[product:core] CI` workflow at `.github/workflows/product-core.yml`.
