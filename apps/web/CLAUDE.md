# apps/web — the Next.js shell

This is the deployable Next.js instance. It mounts every iedora product
through host-based rewrites in `src/proxy.ts` and 1-line page re-exports
under `src/app/`.

Repo-level conventions live in [`../../AGENTS.md`](../../AGENTS.md).

## What this is (and isn't)

- **It is** the Next.js boot + root layout + global CSS + the host
  dispatcher (`proxy.ts`) + the better-auth catch-all route + the
  `/up` health check + per-product page re-exports.
- **It is not** where product code lives. Slices, server actions,
  domain types, and product-specific shared modules live in
  `products/<x>/src/`. apps/web imports from `@iedora/product-{menu,core,house}`.

## Hard rules

1. **No business logic here.** Every `src/app/<route>/page.tsx` must be
   a 1-line re-export from `@iedora/product-*`. If a route file grows
   imports, the imports belong in the product.

2. **`src/proxy.ts` owns host dispatch only.** Optimistic cookie
   checks for protected paths are fine; real auth lives in the DAL of
   the product the route belongs to.

3. **`src/app/layout.tsx` + `globals.css` are the only shared chrome.**
   Per-product layouts live in `products/<x>/src/layout.tsx` and are
   re-exported under `src/app/<host>/layout.tsx`.

4. **No `@/features/...` or `@/shared/...` imports.** apps/web has no
   feature slices and no menu-shaped shared modules. Path aliases
   reaching `@/...` resolve to the menu product as a fallback
   (`tsconfig.json::paths`) — that is for the moved page re-exports to
   keep working, not a license for apps/web to grow new local code.

5. **One image, three hosts.** The Docker image published as
   `ghcr.io/eduvhc/web` serves `menu.iedora.com`, `core.iedora.com`,
   and `iedora.com` from the same node process. Adding a product = new
   package under `products/`, a new entry to `transpilePackages` in
   `next.config.ts`, a new host branch in `proxy.ts`, and a new
   re-export under `src/app/<host>/page.tsx`.

## File layout

```
apps/web/
  src/
    app/
      api/auth/[...all]/route.ts   better-auth catch-all (shell)
      api/track/[slug]/route.ts    1-line re-export → @iedora/product-menu
      core/**                      1-line re-exports → @iedora/product-core
      dashboard/** + onboarding/** + r/** + q/** + showcase/**
                                   1-line re-exports → @iedora/product-menu
      house/page.tsx               1-line re-export → @iedora/product-house
      up/route.ts                  health check (shell)
      layout.tsx, globals.css      root layout + global styles
      favicon.ico
    proxy.ts                       host-based rewrite (menu / core / iedora.com)
  next.config.ts                   transpilePackages, outputFileTracing*
  tsconfig.json                    paths: @/* falls back to products/menu/src
  Dockerfile, next-env.d.ts, postcss.config.mjs
```

## Commands

- `bun run dev` — Next.js dev server (Turbopack).
- `bun run build` — production build (standalone output for Docker).
- `bun run start` — start the standalone server.
- `bun run typecheck` — TS check without emit.
- `bun run lint` — ESLint (`next` recommended).

Real tests live with the products: `bun run --cwd products/menu test` /
`test:e2e`, `bun run --cwd packages/auth test`, etc.

## Deployable artefact

CI workflow `[apps:web] CI` builds + pushes `ghcr.io/eduvhc/web:<sha>`
(arm64). Stage 4 (`bin/iedora-env bin/iedora deploy web`) SSHes to the
Hetzner box, hot-swaps the `infra-web` container. See
[`../../docs/deploy.md`](../../docs/deploy.md).
