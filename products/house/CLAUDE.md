# products/house — apex brand landing

Tiny product: a single React component + metadata, mounted at
`iedora.com` (apex + www) via `apps/web`'s `proxy.ts` host rewrite
(apex → `/house/*`).

Repo-level conventions: [`../../AGENTS.md`](../../AGENTS.md).

## File layout

```
products/house/
  src/
    landing-page.tsx    the page module (default export + metadata)
    index.ts            re-exports landing-page
  package.json          dep on @iedora/design-system
  tsconfig.json, eslint.config.mjs, vitest.config.ts
```

## Mounting

`apps/web/src/app/house/page.tsx` is a 1-line re-export:

```ts
export { default, metadata } from '@iedora/product-house'
```

`apps/web/src/proxy.ts` rewrites `iedora.com/*` → `/house/*` so the
user-visible URL stays clean.

## When to grow this

Adding a second page (e.g. `/manifesto`, `/contact`) =
1. `products/house/src/<route>/page.tsx`
2. `apps/web/src/app/house/<route>/page.tsx` → 1-line re-export

If house grows past 3-4 pages or needs interactive client components
worth their own slices, consider promoting it to the standard
`products/<x>/src/{app,features,shared}` layout that menu + core use.

CI: `[product:house] CI` at `.github/workflows/product-house.yml`.
