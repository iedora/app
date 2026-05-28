# CI

> O pipeline CI actual ainda referencia a pipeline Go legada
> (`bin/iedora-env`, `bin/iedora`, `infra/iac/tofu/`). A transição
> para Kamal está em curso — este doc documenta o estado actual.

## Workflows

| Workflow | O que faz | Trigger |
|----------|-----------|---------|
| `web.yml` | Typecheck + lint + Trivy + build arm64 → GHCR | push/PR em `apps/web/**`, `packages/**`, `products/**` |
| `deploy.yml` | Reusable — corre `bin/iedora deploy <product>` (legado) | `workflow_call` de `web.yml` |
| `app-state.yml` | Reusable — corre `bin/iedora app apply` (legado) | `workflow_dispatch` |
| `infra-deploy.yml` | Build infra-pg-backup + tofu apply (legado) | push em `infra/iac/**` |
| `product-menu.yml` | Typecheck + lint + test (Vitest) + E2E | push/PR em `products/menu/**` |
| `product-core.yml` | Typecheck + lint + test | push/PR em `products/core/**` |
| `product-imopush.yml` | Typecheck + lint + test | push/PR em `products/imopush/**` |
| `auth.yml` | Typecheck + lint + test | push/PR em `packages/auth/**` |
| `design-system.yml` | Typecheck + lint + test (jsdom) | push/PR em `packages/design-system/**` |
| `observability.yml` | Typecheck + lint + test | push/PR em `packages/iedora-observability/**` |
| `e2e.yml` | Playwright E2E (unified em apps/web) | push/PR |
| `migrate.yml` | Build + push `ghcr.io/eduvhc/migrate` | push/PR em `packages/auth/drizzle/**`, `products/*/drizzle/**` |
| `codeql.yml` | SAST (JS/TS) | push + PR + weekly |
| `dependency-review.yml` | Bloqueia PRs com CVEs HIGH/CRITICAL | PR |
| `topology.yml` | Drift guard em `src/generated/surfaces.ts` | push/PR |
| `workflow-lint.yml` | actionlint + shellcheck | push/PR em `.github/workflows/**` |

## Nota sobre o deploy legado

Os workflows `web.yml` → `deploy.yml` e `app-state.yml` + `infra-deploy.yml`
usam uma pipeline Go (`bin/iedora-env` + `bin/iedora` + `infra/`) que foi
removida a favor de Kamal + infra-bootstrap. Enquanto a CI não é
migrada, deploys são manuais via `kamal deploy -d production`.

Ver `docs/deploy/README.md` para o fluxo novo.
