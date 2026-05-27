# E2E implementation checklist

Phased rollout per [`e2e-architecture.md`](../e2e-architecture.md).

---

## Phase 1: Menu E2E specs ✅

> Harness complete. Specs pending.

- [ ] `src/features/auth/e2e/sign-in.spec.ts` — sign-in happy path, redirect, session
- [ ] `src/features/auth/e2e/sign-up.spec.ts` — create account, first-instance bootstrap
- [ ] `src/features/restaurant-identity/e2e/create-restaurant.spec.ts` — CRUD
- [ ] `src/features/menu-builder/e2e/create-menu.spec.ts` — create menu, category, item
- [ ] `src/features/menu-publishing/e2e/publish-menu.spec.ts` — publish, view public menu
- [ ] `tests/e2e/journeys/onboarding.spec.ts` — sign-up → restaurant → menu → publish
- [ ] `tests/e2e/fixtures.ts` — create the file (referenced but doesn't exist yet)

---

## Phase 2: Core E2E harness

> Create the E2E infrastructure for `products/core/`.

### 2a — Update e2e-run composite action

- [ ] Add `needs_product_migrations` input to `.github/actions/e2e-run/action.yml`
- [ ] Add core DB migration step (step 2): `node packages/auth/scripts/migrate.mjs`
- [ ] Make product migrations step conditional: `if: inputs.needs_product_migrations == 'true'`
- [ ] Update `product-menu.yml`: add `needs_product_migrations: true` to `e2e-run` call

### 2b — Create core harness files

- [ ] `products/core/playwright.config.ts` — based on menu's, webServer → `../../apps/web`
- [ ] `products/core/.env.test` — CORE_DATABASE_URL → `core_test`, plus all build-safe vars
- [ ] `products/core/tests/e2e/global-setup.ts` — truncate `core.*` schema
- [ ] `products/core/tests/e2e/global-teardown.ts` — close pool
- [ ] `products/core/tests/e2e/fixtures.ts` — `signIn` (uses `auth.api.signUpEmail`), `signedInPage`
- [ ] `products/core/src/shared/testing/e2e-db.ts` — `SCHEMA = 'core'`, URL → `core_test`

### 2c — Update core CI

- [ ] `products/core/package.json` — add `test:e2e`, `test:e2e:ui`, `test:e2e:debug`
- [ ] `.github/workflows/product-core.yml` — add `e2e` job (uses `e2e-run` with `needs_product_migrations: false`)
- [ ] `.github/workflows/product-core.yml` — add `.github/actions/e2e-run/**` to paths filter

### 2d — Write first core specs

- [ ] `src/features/admin-users/e2e/list-users.spec.ts` — admin sees user list
- [ ] `src/features/admin-orgs/e2e/list-orgs.spec.ts` — admin sees org list
- [ ] `tests/e2e/journeys/sign-in-as-admin.spec.ts` — sign-in → admin dashboard

---

## Phase 3: Imopush E2E

> Blocked until slices and routes land.

- [ ] Follow § Adding a new product in `e2e-architecture.md`
- [ ] If imopush is Go and serves independently: adjust `webServer` in Playwright config
- [ ] If imopush serves through `apps/web`: follow the standard pattern

---

## Phase 4: Post-implementation

- [ ] Activate sharding — bump matrix from `['1/1']` to `['1/2', '2/2']` once suite >10 min
- [ ] Evaluate extracting reusable Playwright fixtures to a shared package
- [ ] Wire `@slow` tag to nightly CI run
