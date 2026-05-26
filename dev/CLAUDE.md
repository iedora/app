# `dev/` — local development stack

Mirror of the production pipeline against local Docker + LocalStack. Boots Postgres, Zitadel, OpenObserve, and (optionally) a menu container via host-published ports. Independent from production credentials and BWS — uses dev-only fixtures.

## Layout

- [`dev/docker-compose.yml`](docker-compose.yml) — the local stack. Postgres, Zitadel + zitadel-login, OpenObserve, LocalStack (for R2). Compose owns the things Tofu used to bolt onto: network, volumes, profiles for `--only`/`--except`, `depends_on` ordering, healthchecks.
- [`dev/localstack-init.sh`](localstack-init.sh) — seeds LocalStack's R2 buckets on first boot.
- [`dev/orchestrator/`](orchestrator/) — Go binary (`task local`, `task local:down`, `task local:reset-db -- <svc>`). Thin shim over `docker compose` — translates `--only`/`--except` into profiles, brings the stack up, runs the Stage-3-equivalent `bin/zitadel-apply --mode local`, composes `products/menu/.env`, then starts the menu container.
- `dev/.zitadel-bootstrap/` — local Zitadel's FirstInstance outputs (SA key, PAT). Gitignored. Recreated on every `task local` cold start.

## How it differs from prod

- **No SSH** — Docker is local.
- **No Caddy** — services publish ports directly (`localhost:5432` postgres, `localhost:8080` zitadel, `localhost:5080` openobserve).
- **No BWS** — `bin/zitadel-apply --mode local --output-file <path>` writes Zitadel outputs to a JSON file the dev orchestrator composes into `.env.local`.
- **Same Stage 3 binaries** — [`app-state/zitadel/`](../app-state/zitadel/) reconciles against the local Zitadel exactly like it does against prod.

## See also

- **[`docs/deploy.md`](../docs/deploy.md)** § Local dev stack — operator commands + flow.
